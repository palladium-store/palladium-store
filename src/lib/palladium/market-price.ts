import 'server-only';
import { getSetting } from '@/lib/settings';
import { formatPrice } from '@/lib/token-math';
import { ethPhpRate } from './eth-rate';
import { marketPrice, type PricePurpose } from './market-price-core';

/**
 * Live $PALLADIUM market price in pesos (TOKEN_PRICE_SOURCE=market).
 *
 * ETH per token comes from the token's DEX pool as reported by GeckoTerminal (spot price, liquidity and hourly closes);
 * pesos per ETH from CoinGecko and Coinbase (they must agree). The pure rules in market-price-core.ts decide whether the
 * number can be used: minimum liquidity, maximum gap between spot and the recent average, and lower-for-payments /
 * higher-for-the-sale. Refreshed at most once a minute. Any failure makes the price unavailable, which pauses token
 * payments and the sale rather than guessing.
 *
 *   TOKEN_MARKET_POOL   the pool address (default: the PALLADIUM/WETH pool on Pons, Robinhood Chain mainnet)
 */
export const DEFAULT_MARKET_POOL = '0xc6b7af281d8fb8ad7dd1b22c1a75904fbff90762';
const NETWORK = 'robinhood';
const poolAddress = () => { const p = (process.env.TOKEN_MARKET_POOL ?? '').trim(); return /^0x[0-9a-fA-F]{40}$/.test(p) ? p.toLowerCase() : DEFAULT_MARKET_POOL; };

export interface PoolSnapshot { at: number; pool: string; spotEthPerToken: string; closes: number[]; liquidityUsd: number; name: string; dex: string }
let snapCache: { at: number; value: PoolSnapshot | null } | null = null;

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(7000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** The pool's current state from GeckoTerminal, cached for a minute (their data refreshes about that often). */
export async function poolSnapshot(): Promise<PoolSnapshot | null> {
  if (snapCache && Date.now() - snapCache.at < 60_000) return snapCache.value;
  const pool = poolAddress();
  let value: PoolSnapshot | null = null;
  try {
    const [p, o] = await Promise.all([
      getJson(`https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${pool}`),
      getJson(`https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${pool}/ohlcv/hour?aggregate=1&limit=6&currency=token`).catch(() => null),
    ]);
    const a = (p as { data?: { attributes?: Record<string, unknown>; relationships?: { dex?: { data?: { id?: string } } } } })?.data;
    const attrs = a?.attributes ?? {};
    const spot = String(attrs.base_token_price_native_currency ?? '');
    const liquidityUsd = Number(attrs.reserve_in_usd ?? 0);
    const list = ((o as { data?: { attributes?: { ohlcv_list?: number[][] } } } | null)?.data?.attributes?.ohlcv_list ?? []);
    if (spot) value = { at: Date.now(), pool, spotEthPerToken: spot, closes: list.map((r) => Number(r[4])).filter((n) => Number.isFinite(n) && n > 0), liquidityUsd, name: String(attrs.name ?? ''), dex: String(a?.relationships?.dex?.data?.id ?? '') };
  } catch (e) { console.error('[market-price] GeckoTerminal', String((e as Error)?.message ?? e)); }
  snapCache = { at: Date.now(), value };
  return value;
}

export type MarketResult =
  | { available: true; priceScaled: bigint; detail: { spotPhp: string; averagePhp: string; deviationPct: number; liquidityUsd: number; ethPhp: string; pool: string } }
  | { available: false; reason: string };

export async function getMarketPrice(purpose: PricePurpose): Promise<MarketResult> {
  const [snap, rate, settings] = await Promise.all([poolSnapshot(), ethPhpRate(), getSetting('tokenSale')]);
  if (!snap) return { available: false, reason: 'The market price could not be read.' };
  if (!rate) return { available: false, reason: 'The ETH exchange rate could not be read.' };
  const r = marketPrice({
    spotEthPerToken: snap.spotEthPerToken, closesEthPerToken: snap.closes, ethPhpScaled: rate.rate, liquidityUsd: snap.liquidityUsd,
    minLiquidityUsd: settings.marketMinLiquidityUsd, maxDeviationPct: settings.marketMaxDeviationPct, purpose,
  });
  if (!r.ok) return { available: false, reason: r.reason };
  return {
    available: true, priceScaled: r.phpPerTokenScaled,
    detail: { spotPhp: formatPrice(r.spotPhpScaled, 8), averagePhp: formatPrice(r.averagePhpScaled, 8), deviationPct: r.deviationPct, liquidityUsd: snap.liquidityUsd, ethPhp: formatPrice(rate.rate, 2), pool: snap.pool },
  };
}

import 'server-only';
import { formatPrice, parsePrice } from '@/lib/token-math';
import { agreeRate } from './sale-math';

/** Pesos per ETH from two independent public sources (CoinGecko, Coinbase) that must agree within 2%. Used by the sale and the market price. */
let rateCache: { at: number; value: { rate: bigint; sources: string[] } | null } | null = null;
async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const toScaled = (n: unknown): bigint | null => {
  const v = typeof n === 'string' ? Number(n) : typeof n === 'number' ? n : NaN;
  return Number.isFinite(v) && v > 1000 && v < 100_000_000 ? parsePrice(v.toFixed(6)) : null; // sanity: ETH between ₱1k and ₱100M
};

/** Pesos per ETH (scaled by 1e18) from two independent public sources that must agree within 2%. Cached for a minute. */
export async function ethPhpRate(): Promise<{ rate: bigint; sources: string[] } | null> {
  if (rateCache && Date.now() - rateCache.at < 60_000) return rateCache.value;
  const [cg, cb] = await Promise.allSettled([
    fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=php').then((j) => toScaled((j as { ethereum?: { php?: number } })?.ethereum?.php)),
    fetchJson('https://api.coinbase.com/v2/exchange-rates?currency=ETH').then((j) => toScaled((j as { data?: { rates?: { PHP?: string } } })?.data?.rates?.PHP)),
  ]);
  const found: { name: string; v: bigint }[] = [];
  if (cg.status === 'fulfilled' && cg.value) found.push({ name: 'CoinGecko', v: cg.value });
  if (cb.status === 'fulfilled' && cb.value) found.push({ name: 'Coinbase', v: cb.value });
  const rate = agreeRate(found.map((f) => f.v), 200, true);
  const value = rate ? { rate, sources: found.map((f) => f.name) } : null;
  if (!value) console.error('[token-sale] no agreed ETH/PHP rate', found.map((f) => `${f.name}=${formatPrice(f.v, 2)}`).join(' '));
  rateCache = { at: Date.now(), value };
  return value;
}


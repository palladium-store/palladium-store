import 'server-only';
import { AppError } from './errors';
import { getWalletConfig } from './token';
import { PriceError, PRICE_SCALE, assertPriceInBounds, formatPrice, parsePrice, quoteTtlSeconds, tokenAmountForPhp } from './token-math';
import { newQuoteId, signQuote, verifyQuote, type QuotePayload } from './token-quote';
import { formatUnits } from './chain-config';

/** The only store this build serves. Future platforms get their own identifier in payment records. */
export const PLATFORM = 'PALLADIUM_STORE';

export type PriceResult =
  | { available: true; priceScaled: bigint; source: string; fixed: boolean; asOf: number }
  | { available: false; reason: string };

const env = (k: string) => (process.env[k] ?? '').trim();

/**
 * Where the token price comes from, chosen by TOKEN_PRICE_SOURCE:
 *  - unset / "none": no price. Token checkout stays off. This is the default and the honest state before a real market exists.
 *  - "manual": a fixed PHP-per-token rate set deliberately by the business (TOKEN_MANUAL_PRICE_PHP). It is refused unless
 *    TOKEN_MANUAL_PRICE_REVIEWED=yes confirms the rate was approved after review. Meant for testnet or a reviewed arrangement.
 * Live market sources (DEX pool with time-weighted average, or an oracle) plug in here later. Until one exists, unknown
 * source names are rejected instead of guessed.
 */
export async function getCurrentPrice(now = Date.now()): Promise<PriceResult> {
  const source = env('TOKEN_PRICE_SOURCE').toLowerCase() || 'none';
  if (source === 'none') return { available: false, reason: 'No price source is configured.' };
  if (source !== 'manual') return { available: false, reason: 'The configured price source is not supported yet.' };
  if (env('TOKEN_MANUAL_PRICE_REVIEWED').toLowerCase() !== 'yes') return { available: false, reason: 'A fixed rate has not been marked as reviewed.' };
  try {
    const priceScaled = parsePrice(env('TOKEN_MANUAL_PRICE_PHP'));
    assertPriceInBounds(priceScaled, { min: parsePrice(env('TOKEN_PRICE_MIN_PHP') || '0.000001'), max: parsePrice(env('TOKEN_PRICE_MAX_PHP') || '1000000') });
    return { available: true, priceScaled, source: 'manual', fixed: true, asOf: now };
  } catch (e) {
    return { available: false, reason: e instanceof PriceError ? e.message : 'The configured price is invalid.' };
  }
}

/** Token checkout needs an explicit switch AND a usable price. Both are off by default. */
export async function tokenCheckoutState(): Promise<{ enabled: true; price: Extract<PriceResult, { available: true }> } | { enabled: false; reason: string }> {
  if (env('TOKEN_CHECKOUT_ENABLED').toLowerCase() !== 'true') return { enabled: false, reason: 'Token payments are not available yet.' };
  const price = await getCurrentPrice();
  if (!price.available) return { enabled: false, reason: 'Token payments are temporarily unavailable.' };
  return { enabled: true, price };
}

export interface IssuedQuote {
  token: string;
  id: string;
  phpCentavos: number;
  rate: string;
  source: string;
  tokenAmount: string;
  tokenAmountDisplay: string;
  symbol: string;
  quotedAt: number;
  expiresAt: number;
  ttlSeconds: number;
}

const secret = () => process.env.AUTH_SECRET ?? '';

/** Locks a quote for the configured time (default five minutes). The amount always comes from server-side pricing. */
export async function issueQuote(phpCentavos: number, now = Date.now()): Promise<IssuedQuote> {
  if (!Number.isSafeInteger(phpCentavos) || phpCentavos <= 0) throw new AppError(422, 'BAD_AMOUNT', 'Nothing to pay.');
  const state = await tokenCheckoutState();
  if (!state.enabled) throw new AppError(503, 'TOKEN_UNAVAILABLE', state.reason);
  const w = getWalletConfig();
  const ttl = quoteTtlSeconds(env('TOKEN_QUOTE_TTL_SECONDS'));
  const amount = tokenAmountForPhp(phpCentavos, state.price.priceScaled, w.decimals);
  const payload: QuotePayload = {
    v: 1, id: newQuoteId(), platform: PLATFORM, phpCentavos, rateScaled: state.price.priceScaled.toString(), source: state.price.source,
    tokenAmount: amount.toString(), decimals: w.decimals, chainId: w.chain.chainId, contract: w.contract, quotedAt: now, expiresAt: now + ttl * 1000,
  };
  return {
    token: signQuote(payload, secret()), id: payload.id, phpCentavos, rate: formatPrice(state.price.priceScaled, PRICE_SCALE), source: payload.source,
    tokenAmount: payload.tokenAmount, tokenAmountDisplay: formatUnits(amount, w.decimals, 6), symbol: w.symbol,
    quotedAt: now, expiresAt: payload.expiresAt, ttlSeconds: ttl,
  };
}

export const checkQuote = (token: string, now = Date.now()) => verifyQuote(token, secret(), now);

import { formatUnits } from './chain-config';

/**
 * Decimal-safe token pricing maths. Everything is bigint: no floating point is used anywhere.
 *
 * A price is "PHP per 1 whole token", stored as an integer scaled by 10^PRICE_SCALE (18 fractional digits).
 * Money is integer centavos. Token amounts are integers in the token's smallest unit (10^decimals per token).
 */
export const PRICE_SCALE = 18;
const TEN = 10n;
const SCALE = TEN ** BigInt(PRICE_SCALE);

export class PriceError extends Error {}

/** Parses a plain decimal string such as "10", "0.0425" or "1234.5" into a scaled bigint. Rejects anything else. */
export function parsePrice(input: string): bigint {
  const s = input.trim();
  if (!/^\d{1,12}(\.\d{1,18})?$/.test(s)) throw new PriceError('Price must be a plain decimal number with at most 18 decimal places.');
  const [whole, frac = ''] = s.split('.');
  const scaled = BigInt(whole) * SCALE + BigInt(frac.padEnd(PRICE_SCALE, '0'));
  if (scaled <= 0n) throw new PriceError('Price must be greater than zero.');
  return scaled;
}

export const formatPrice = (scaled: bigint, maxFraction = 6) => formatUnits(scaled, PRICE_SCALE, maxFraction);

function ceilDiv(a: bigint, b: bigint): bigint { return (a + b - 1n) / b; }

/**
 * Tokens needed to pay `phpCentavos`, in the token's smallest unit. Rounds UP so Palladium is never underpaid by rounding.
 * Example: 549,500 centavos (PHP 5,495) at PHP 10 per token, 18 decimals = 549.5 tokens.
 */
export function tokenAmountForPhp(phpCentavos: number | bigint, priceScaled: bigint, decimals: number): bigint {
  const centavos = BigInt(phpCentavos);
  if (centavos <= 0n) throw new PriceError('Amount must be greater than zero.');
  if (priceScaled <= 0n) throw new PriceError('Price must be greater than zero.');
  return ceilDiv(centavos * TEN ** BigInt(decimals) * SCALE, 100n * priceScaled);
}

/** Indicative PHP value of a token amount, in centavos, rounded down. For display only, never for settlement. */
export function phpCentavosForTokens(tokenAmount: bigint, priceScaled: bigint, decimals: number): bigint {
  return (tokenAmount * priceScaled * 100n) / (TEN ** BigInt(decimals) * SCALE);
}

export interface PriceBounds { min: bigint; max: bigint }
export function assertPriceInBounds(priceScaled: bigint, b: PriceBounds) {
  if (priceScaled < b.min || priceScaled > b.max) throw new PriceError('Price is outside the allowed range, so it was rejected.');
}

/** A live quote is usable only while fresh. Future timestamps are rejected too (clock or source error). */
export function isFresh(quotedAtMs: number, nowMs: number, maxAgeMs: number): boolean {
  const age = nowMs - quotedAtMs;
  return age >= -5_000 && age <= maxAgeMs;
}

/** Clamps the configured quote lifetime to a safe range, default five minutes. */
export function quoteTtlSeconds(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return 300;
  return Math.min(1800, Math.max(60, Math.floor(n)));
}

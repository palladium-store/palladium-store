/**
 * Token sale arithmetic. Whole numbers only (bigint), no floating point. Safe for client and server; fully unit tested.
 *
 * Prices are "PHP per unit, scaled by 10^18" (the same PRICE_SCALE as token-math.ts). Rounding always favours the
 * business by the smallest unit: tokens delivered round down, ETH charged rounds up.
 */
const SCALE = 10n ** 18n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Reference price plus the spread, in basis points (500 = 5%). */
export function priceWithSpread(referenceScaled: bigint, spreadBps: number): bigint {
  if (referenceScaled <= 0n) throw new Error('Reference price must be positive');
  if (!Number.isInteger(spreadBps) || spreadBps < 0 || spreadBps > 5000) throw new Error('Spread must be 0 to 50%');
  return ceilDiv(referenceScaled * BigInt(10_000 + spreadBps), 10_000n);
}

/** Tokens (smallest units) that `phpCentavos` buys at `unitPriceScaled`. Rounds down. */
export function tokensForPhp(phpCentavos: bigint, unitPriceScaled: bigint, decimals: number): bigint {
  if (phpCentavos <= 0n || unitPriceScaled <= 0n) return 0n;
  return (phpCentavos * 10n ** BigInt(decimals) * SCALE) / (100n * unitPriceScaled);
}

/** Wei that pays `phpCentavos` when one ETH is worth `ethPhpScaled` pesos. Rounds up. */
export function weiForPhp(phpCentavos: bigint, ethPhpScaled: bigint): bigint {
  if (phpCentavos <= 0n || ethPhpScaled <= 0n) throw new Error('Amounts must be positive');
  return ceilDiv(phpCentavos * SCALE * SCALE, 100n * ethPhpScaled);
}

/** The contract's own floor check: wei / (tokens / unit) >= minWeiPerToken, without dividing. */
export const meetsPriceFloor = (wei: bigint, tokenAmount: bigint, decimals: number, minWeiPerToken: bigint) =>
  wei * 10n ** BigInt(decimals) >= tokenAmount * minWeiPerToken;

/**
 * Picks an ETH/PHP rate from independent sources. With two or more, they must agree within `maxSpreadBps` (default 2%) and
 * the median is used; a single source is accepted only when `allowSingle`. Anything else: no rate, and the sale pauses.
 */
export function agreeRate(rates: bigint[], maxSpreadBps = 200, allowSingle = true): bigint | null {
  const r = rates.filter((x) => x > 0n).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!r.length) return null;
  if (r.length === 1) return allowSingle ? r[0] : null;
  const lo = r[0], hi = r[r.length - 1];
  if ((hi - lo) * 10_000n > lo * BigInt(maxSpreadBps)) return null;
  return r[Math.floor(r.length / 2)];
}

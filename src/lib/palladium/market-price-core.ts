/**
 * Market price of $PALLADIUM in pesos, from a DEX pool's ETH price and an ETH/PHP rate. Pure and unit tested.
 *
 * Thin markets are easy to push around, so a single spot price is never trusted on its own:
 *  - the spot price is compared with the recent average (hourly closes); a big gap pauses token pricing;
 *  - payments (the store receives tokens) use the LOWER of spot and average, so pumping the price just before paying
 *    does not cut what the customer owes; the sale (the store gives tokens) uses the HIGHER of the two;
 *  - a pool below the minimum liquidity is not used at all.
 */
export type PricePurpose = 'payment' | 'sale' | 'display';
const SCALE = 10n ** 18n;
/** ETH per token is tiny (around 10^-9), so it is kept with 27 decimals before converting to pesos. */
const FINE = 10n ** 27n;

/** Parses a positive decimal given as a string or number (including exponent form like 2.01e-9) at `decimals` places. Truncates. */
export function toScaledDecimal(v: string | number, decimals: number): bigint | null {
  // Numbers carry float noise past 15 significant digits, so they are read through their 15-digit form.
  let s = typeof v === 'number' ? (Number.isFinite(v) && v > 0 ? v.toPrecision(15) : '') : String(v).trim();
  if (/e/i.test(s)) s = expToPlain(s) ?? '';
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  const out = BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
  return out > 0n ? out : null;
}

/** "2.014e-9" -> "0.000000002014", digit by digit (no float). Null for anything else. */
function expToPlain(s: string): string | null {
  const m = /^(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(s.trim());
  if (!m) return null;
  const digits = (m[1] + (m[2] ?? '')).replace(/^0+(?=\d)/, '');
  const point = m[1].length + Number(m[3]); // position of the decimal point within `digits`
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

export interface MarketInput {
  /** ETH per token, from the pool, now. */
  spotEthPerToken: string | number;
  /** Recent hourly closing prices, ETH per token (newest first is fine; order does not matter). */
  closesEthPerToken: (string | number)[];
  /** Pesos per ETH, scaled by 10^18. */
  ethPhpScaled: bigint;
  liquidityUsd: number;
  minLiquidityUsd: number;
  /** Largest allowed gap between spot and average, in percent. */
  maxDeviationPct: number;
  purpose: PricePurpose;
}

export type MarketPrice =
  | { ok: true; phpPerTokenScaled: bigint; spotPhpScaled: bigint; averagePhpScaled: bigint; deviationPct: number }
  | { ok: false; reason: string };

export function marketPrice(i: MarketInput): MarketPrice {
  if (!(i.liquidityUsd >= i.minLiquidityUsd)) return { ok: false, reason: `Pool liquidity ($${Math.round(i.liquidityUsd || 0)}) is below the $${i.minLiquidityUsd} minimum.` };
  const spot = toScaledDecimal(i.spotEthPerToken, 27);
  if (!spot) return { ok: false, reason: 'The pool returned no usable price.' };
  const closes = i.closesEthPerToken.map((c) => toScaledDecimal(c, 27)).filter((x): x is bigint => !!x);
  // With no history yet, the spot price is all there is; the deviation check then has nothing to compare against.
  const avg = closes.length ? closes.reduce((a, b) => a + b, 0n) / BigInt(closes.length) : spot;
  const gap = spot > avg ? spot - avg : avg - spot;
  const deviationPct = Number((gap * 10_000n) / avg) / 100;
  if (deviationPct > i.maxDeviationPct) return { ok: false, reason: `The price moved ${deviationPct.toFixed(1)}% from its recent average; token pricing pauses until it settles.` };
  const pick = i.purpose === 'sale' ? (spot > avg ? spot : avg) : (spot < avg ? spot : avg);
  const toPhp = (ethPerToken: bigint) => (ethPerToken * i.ethPhpScaled) / FINE; // (ETH/token x PHP/ETH) at 10^18
  const php = toPhp(pick);
  if (php <= 0n) return { ok: false, reason: 'The token price rounds to zero pesos.' };
  return { ok: true, phpPerTokenScaled: php, spotPhpScaled: toPhp(spot), averagePhpScaled: toPhp(avg), deviationPct };
}

export const PHP_SCALE = SCALE;

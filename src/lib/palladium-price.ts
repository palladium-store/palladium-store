/**
 * $PALLADIUM display price (DEMO).
 *
 * The shop shows "≈ N PALLADIUM" under each PHP price. For now the token price is a fixed demo value.
 * This is the ONLY place to change it:
 *   - quick change: edit PALLADIUM_PRICE_PHP below.
 *   - live price: make getPalladiumPricePhp() read from your price API / oracle (it may become async; fetch it in a
 *     server component or route and pass the number down as the `palladiumPricePhp` prop of <ProductGrid>/<ProductCard>).
 * The product cards never need to change: they only call phpToPalladium() with the product's own PHP price.
 * Display only. Checkout and the token quote flow use their own server-side pricing (src/lib/token-quote.ts).
 */

/** DEMO price: PHP per 1 PALLADIUM token. The one place to change it. */
export const DEMO_PALLADIUM_PRICE_PHP = 2.0;
/** Same value, kept for the shop-card helpers above. */
export const PALLADIUM_PRICE_PHP = DEMO_PALLADIUM_PRICE_PHP;

/** Current PHP price of 1 PALLADIUM. Replace the body with a live feed later. */
export function getPalladiumPricePhp(): number {
  return PALLADIUM_PRICE_PHP;
}

/** Product price in centavos (the source of truth) -> PALLADIUM amount, rounded to 2 decimals. Null if the price is unusable. */
export function phpToPalladium(priceCentavos: number, palladiumPricePhp: number = getPalladiumPricePhp()): number | null {
  if (!Number.isFinite(priceCentavos) || priceCentavos < 0 || !Number.isFinite(palladiumPricePhp) || palladiumPricePhp <= 0) return null;
  return Math.round((priceCentavos / 100 / palladiumPricePhp) * 100) / 100;
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Whole amounts without decimals ("3,875"), anything else with exactly two ("197.50"), so prices never mix "197.5" and "61.25". */
const nf = { format: (n: number) => (Number.isInteger(Math.round(n * 100) / 100) ? whole : cents).format(n) };

/** 3875 -> "≈ 3,875 PALLADIUM", 12.5 -> "≈ 12.50 PALLADIUM". */
export function formatPalladium(amount: number): string {
  return `≈ ${nf.format(amount)} PALLADIUM`;
}

/** Product/order price in centavos -> PALLADIUM in minor units (hundredths of a token), as an integer. 775000 centavos at PHP 2.00 = 387500 (3,875.00). */
export function phpToPalladiumMinor(priceCentavos: number, palladiumPricePhp: number = getPalladiumPricePhp()): number {
  if (!Number.isFinite(priceCentavos) || priceCentavos < 0 || !Number.isFinite(palladiumPricePhp) || palladiumPricePhp <= 0) throw new Error('Invalid price');
  return Math.round(priceCentavos / palladiumPricePhp);
}

/** 387500 -> "3,875", 6125 -> "61.25", 1000000 -> "10,000". */
export function formatPalladiumMinor(minor: number): string {
  return nf.format(minor / 100);
}

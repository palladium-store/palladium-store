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

/** DEMO price: PHP per 1 PALLADIUM token. */
export const PALLADIUM_PRICE_PHP = 2.0;

/** Current PHP price of 1 PALLADIUM. Replace the body with a live feed later. */
export function getPalladiumPricePhp(): number {
  return PALLADIUM_PRICE_PHP;
}

/** Product price in centavos (the source of truth) -> PALLADIUM amount, rounded to 2 decimals. Null if the price is unusable. */
export function phpToPalladium(priceCentavos: number, palladiumPricePhp: number = getPalladiumPricePhp()): number | null {
  if (!Number.isFinite(priceCentavos) || priceCentavos < 0 || !Number.isFinite(palladiumPricePhp) || palladiumPricePhp <= 0) return null;
  return Math.round((priceCentavos / 100 / palladiumPricePhp) * 100) / 100;
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 3875 -> "≈ 3,875 PALLADIUM", 12.5 -> "≈ 12.5 PALLADIUM" (no trailing zeros). */
export function formatPalladium(amount: number): string {
  return `≈ ${nf.format(amount)} PALLADIUM`;
}

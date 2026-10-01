import { route, ok } from '@/lib/api';
import { getCurrentPrice, tokenCheckoutState } from '@/lib/pricing';
import { formatPrice } from '@/lib/token-math';

export const dynamic = 'force-dynamic';

/** Public. Never invents a price: when none is available it says so. */
export const GET = route(async () => {
  const p = await getCurrentPrice();
  const checkout = await tokenCheckoutState();
  if (!p.available) return ok({ available: false, checkoutEnabled: false });
  return ok({ available: true, phpPerToken: formatPrice(p.priceScaled), source: p.source, fixedRate: p.fixed, asOf: new Date(p.asOf).toISOString(), checkoutEnabled: checkout.enabled });
});

import { route, ok, readJson } from '@/lib/api';
import { priceCart } from '@/lib/cart';
import { priceCartSchema } from '@/lib/validators';
import { getUser, throttle } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { issueQuote } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/**
 * Locks a $PALLADIUM quote for a cart. The peso total is recomputed on the server from the cart; the browser never
 * supplies an amount. Call again to refresh an expired quote.
 */
export const POST = route(async (req) => {
  throttle(`tquote:${req.headers.get('x-forwarded-for') ?? 'ip'}`, 30);
  const body = priceCartSchema.parse(await readJson(req));
  if (!body.items.length) throw new AppError(422, 'EMPTY_CART', 'Your cart is empty.');
  const user = await getUser();
  const customer = user ? await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const cart = await priceCart(body.items, body.discountCode, body.province, customer?.id);
  if (!cart.ok || cart.shippingCentavos == null) throw new AppError(422, 'CART_NOT_READY', 'Complete your cart and shipping details first.');
  const q = await issueQuote(cart.totalCentavos);
  return ok(q);
});

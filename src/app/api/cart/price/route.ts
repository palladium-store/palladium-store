import { route, ok, readJson } from '@/lib/api';
import { priceCart } from '@/lib/cart';
import { priceCartSchema } from '@/lib/validators';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const POST = route(async (req) => {
  const body = priceCartSchema.parse(await readJson(req));
  const user = await getUser();
  const customer = user ? await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  return ok(await priceCart(body.items, body.discountCode, body.province, customer?.id));
});

import { route, ok } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';

/** Returns cart lines for the items in a past order that can still be bought. The client adds them to its cart. */
export const POST = route(async (_req, ctx: { params: { id: string } }) => {
  const { customer } = await requireCustomer();
  const o = await prisma.order.findFirst({ where: { id: ctx.params.id, customerId: customer.id }, include: { items: true } });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  const variants = await prisma.productVariant.findMany({ where: { id: { in: o.items.map((i) => i.variantId).filter(Boolean) as string[] }, isActive: true, product: { status: 'ACTIVE' } }, select: { id: true } });
  const live = new Set(variants.map((v) => v.id));
  const items = o.items.filter((i) => i.variantId && live.has(i.variantId)).map((i) => ({ variantId: i.variantId!, qty: i.quantity }));
  return ok({ items, skipped: o.items.length - items.length });
});

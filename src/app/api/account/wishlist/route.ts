import { route, ok, readJson } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const body = z.object({ productId: z.string().min(1) });
export const GET = route(async () => {
  const { customer } = await requireCustomer();
  const items = await prisma.wishlistItem.findMany({ where: { customerId: customer.id }, select: { productId: true } });
  return ok({ productIds: items.map((i) => i.productId) });
});
export const POST = route(async (req) => {
  const { customer } = await requireCustomer();
  const { productId } = body.parse(await readJson(req));
  await prisma.wishlistItem.upsert({ where: { customerId_productId: { customerId: customer.id, productId } }, create: { customerId: customer.id, productId }, update: {} });
  return ok({ ok: true }, 201);
});
export const DELETE = route(async (req) => {
  const { customer } = await requireCustomer();
  const { productId } = body.parse(await readJson(req));
  await prisma.wishlistItem.deleteMany({ where: { customerId: customer.id, productId } });
  return ok();
});

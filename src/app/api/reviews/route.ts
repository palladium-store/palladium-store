import { route, ok, readJson } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { reviewSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

export const POST = route(async (req) => {
  const { customer } = await requireCustomer();
  const b = reviewSchema.extend({ productId: z.string().min(1) }).parse(await readJson(req));
  if (await prisma.review.findFirst({ where: { productId: b.productId, customerId: customer.id } })) throw new AppError(409, 'DUPLICATE', 'You already reviewed this product.');
  const bought = await prisma.orderItem.findFirst({ where: { variant: { productId: b.productId }, order: { customerId: customer.id, status: { in: ['PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'] } } } });
  await prisma.review.create({ data: { productId: b.productId, customerId: customer.id, authorName: customer.name.split(' ')[0] + ' ' + (customer.name.split(' ')[1]?.[0] ?? '') + '.', rating: b.rating, title: b.title, body: b.body, verified: !!bought, isApproved: true } });
  return ok({ ok: true }, 201);
});

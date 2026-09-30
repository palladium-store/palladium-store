import { route, ok, readJson } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { addressSchema, normalizePhone } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';

async function own(id: string, customerId: string) {
  const a = await prisma.address.findFirst({ where: { id, customerId } });
  if (!a) throw new AppError(404, 'NOT_FOUND', 'Address not found.');
  return a;
}
export const PUT = route(async (req, ctx: { params: { id: string } }) => {
  const { customer } = await requireCustomer();
  await own(ctx.params.id, customer.id);
  const b = addressSchema.parse(await readJson(req));
  await prisma.$transaction(async (tx) => {
    if (b.isDefault) await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    await tx.address.update({ where: { id: ctx.params.id }, data: { ...b, phone: normalizePhone(b.phone) } });
  });
  return ok();
});
export const DELETE = route(async (_req, ctx: { params: { id: string } }) => {
  const { customer } = await requireCustomer();
  await own(ctx.params.id, customer.id);
  await prisma.address.delete({ where: { id: ctx.params.id } });
  return ok();
});

import { route, ok, readJson } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { addressSchema, normalizePhone } from '@/lib/validators';
import { prisma } from '@/lib/db';

export const GET = route(async () => { const { customer } = await requireCustomer(); return ok(await prisma.address.findMany({ where: { customerId: customer.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })); });
export const POST = route(async (req) => {
  const { customer } = await requireCustomer();
  const b = addressSchema.parse(await readJson(req));
  const count = await prisma.address.count({ where: { customerId: customer.id } });
  const makeDefault = b.isDefault || count === 0;
  const a = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    return tx.address.create({ data: { ...b, phone: normalizePhone(b.phone), isDefault: makeDefault, customerId: customer.id } });
  });
  return ok(a, 201);
});

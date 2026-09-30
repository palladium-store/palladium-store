import { route, ok, readJson } from '@/lib/api';
import { requireCustomer } from '@/lib/auth';
import { profileSchema, normalizePhone } from '@/lib/validators';
import { prisma } from '@/lib/db';

export const PATCH = route(async (req) => {
  const { user, customer } = await requireCustomer();
  const b = profileSchema.parse(await readJson(req));
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: b.name } }),
    prisma.customer.update({ where: { id: customer.id }, data: { name: b.name, phone: b.phone ? normalizePhone(b.phone) : null } }),
  ]);
  return ok();
});

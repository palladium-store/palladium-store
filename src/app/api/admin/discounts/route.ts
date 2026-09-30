import { adminRoute, ok, readJson } from '@/lib/api';
import { discountSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';

const discountData = (d: ReturnType<typeof discountSchema.parse>) => ({ ...d, startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null, maxDiscountCentavos: d.maxDiscountCentavos ?? null, usageLimit: d.usageLimit ?? null, perCustomerLimit: d.perCustomerLimit ?? null });
export const POST = adminRoute('MANAGE_DISCOUNTS', async (req, _c, user) => {
  const d = discountSchema.parse(await readJson(req));
  if (await prisma.discount.findFirst({ where: { code: { equals: d.code, mode: 'insensitive' } } })) throw new AppError(409, 'DUPLICATE', 'That discount code already exists.', { code: 'Already in use.' });
  const created = await prisma.discount.create({ data: discountData(d) });
  await audit(user, 'DISCOUNT_CREATED', 'Discount', created.id, `Created discount ${created.code}`);
  return ok({ id: created.id }, 201);
});

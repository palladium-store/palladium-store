import { adminRoute, ok, readJson } from '@/lib/api';
import { discountSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';

const data = (d: ReturnType<typeof discountSchema.parse>) => ({ ...d, startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null, maxDiscountCentavos: d.maxDiscountCentavos ?? null, usageLimit: d.usageLimit ?? null, perCustomerLimit: d.perCustomerLimit ?? null });
export const PUT = adminRoute('MANAGE_DISCOUNTS', async (req, ctx: { params: { id: string } }, user) => {
  const d = discountSchema.parse(await readJson(req));
  if (await prisma.discount.findFirst({ where: { code: { equals: d.code, mode: 'insensitive' }, id: { not: ctx.params.id } } })) throw new AppError(409, 'DUPLICATE', 'That discount code already exists.', { code: 'Already in use.' });
  await prisma.discount.update({ where: { id: ctx.params.id }, data: data(d) });
  await audit(user, 'DISCOUNT_UPDATED', 'Discount', ctx.params.id, `Updated discount ${d.code}`);
  return ok();
});
export const DELETE = adminRoute('MANAGE_DISCOUNTS', async (_req, ctx: { params: { id: string } }, user) => {
  const dsc = await prisma.discount.findUniqueOrThrow({ where: { id: ctx.params.id } });
  const used = await prisma.discountUsage.count({ where: { discountId: dsc.id } });
  if (used) { await prisma.discount.update({ where: { id: dsc.id }, data: { isActive: false } }); await audit(user, 'DISCOUNT_DISABLED', 'Discount', dsc.id, `Disabled ${dsc.code} (already used, kept for history)`); return ok({ disabled: true }); }
  await prisma.discount.delete({ where: { id: dsc.id } });
  await audit(user, 'DISCOUNT_DELETED', 'Discount', dsc.id, `Deleted discount ${dsc.code}`);
  return ok({ disabled: false });
});

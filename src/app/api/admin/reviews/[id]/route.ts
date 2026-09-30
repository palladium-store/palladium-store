import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';

export const PATCH = adminRoute('MANAGE_DISCOUNTS', async (req, ctx: { params: { id: string } }, user) => {
  const b = z.object({ isApproved: z.boolean() }).parse(await readJson(req));
  const r = await prisma.review.update({ where: { id: ctx.params.id }, data: b });
  await audit(user, b.isApproved ? 'REVIEW_APPROVED' : 'REVIEW_HIDDEN', 'Review', r.id, `${b.isApproved ? 'Approved' : 'Hid'} a review`);
  return ok();
});

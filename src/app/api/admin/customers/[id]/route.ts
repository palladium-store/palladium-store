import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';

export const PATCH = adminRoute('VIEW_CUSTOMERS', async (req, ctx: { params: { id: string } }, user) => {
  const b = z.object({ notes: z.string().max(4000).optional(), status: z.enum(['ACTIVE', 'BLOCKED']).optional() }).parse(await readJson(req));
  const c = await prisma.customer.update({ where: { id: ctx.params.id }, data: b });
  await audit(user, 'CUSTOMER_UPDATED', 'Customer', c.id, `Updated customer ${c.name}`);
  return ok();
});

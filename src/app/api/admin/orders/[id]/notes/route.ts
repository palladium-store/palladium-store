import { adminRoute, ok, readJson } from '@/lib/api';
import { noteSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';

export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  const b = noteSchema.parse(await readJson(req));
  const o = await prisma.order.update({ where: { id: ctx.params.id }, data: { internalNotes: b.internalNotes } });
  await prisma.orderEvent.create({ data: { orderId: o.id, type: 'NOTE', message: 'Internal note updated', actor: user.name } });
  await audit(user, 'ORDER_NOTE', 'Order', o.id, `Updated internal note on ${o.orderNumber}`);
  return ok();
});

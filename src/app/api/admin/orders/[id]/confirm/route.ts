import { adminRoute, ok, readJson } from '@/lib/api';
import { confirmOrder } from '@/lib/orders';
import { z } from 'zod';

const body = z.object({ markPaid: z.boolean().optional(), reference: z.string().max(120).optional() });
export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  const b = body.parse(await readJson(req).catch(() => ({})));
  await confirmOrder(ctx.params.id, user, b);
  return ok();
});

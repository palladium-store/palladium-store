import { adminRoute, ok, readJson } from '@/lib/api';
import { refundOrder } from '@/lib/orders';
import { refundSchema } from '@/lib/validators';

export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  await refundOrder(ctx.params.id, user, refundSchema.parse(await readJson(req)));
  return ok();
});

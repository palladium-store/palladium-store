import { adminRoute, ok, readJson } from '@/lib/api';
import { updateFulfillment } from '@/lib/orders';
import { orderStatusSchema } from '@/lib/validators';

export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  const b = orderStatusSchema.parse(await readJson(req));
  await updateFulfillment(ctx.params.id, user, b.status, { courier: b.courier, trackingNumber: b.trackingNumber });
  return ok();
});

import { adminRoute, ok, readJson } from '@/lib/api';
import { saveTracking } from '@/lib/orders';
import { trackingSchema } from '@/lib/validators';

export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  await saveTracking(ctx.params.id, user, trackingSchema.parse(await readJson(req)));
  return ok();
});

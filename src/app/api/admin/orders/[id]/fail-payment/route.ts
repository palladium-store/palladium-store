import { adminRoute, ok, readJson } from '@/lib/api';
import { failPayment } from '@/lib/orders';
import { reasonSchema } from '@/lib/validators';

export const POST = adminRoute('EDIT_ORDERS', async (req, ctx: { params: { id: string } }, user) => {
  await failPayment(ctx.params.id, user, reasonSchema.parse(await readJson(req).catch(() => ({}))).reason);
  return ok();
});

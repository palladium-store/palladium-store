import { route, ok, readJson, clientIp } from '@/lib/api';
import { checkoutSchema } from '@/lib/validators';
import { placeOrder } from '@/lib/orders';
import { throttleStrict } from '@/lib/auth';

export const POST = route(async (req) => {
  await throttleStrict(`checkout:${clientIp(req)}`, 20, 10 * 60 * 1000);
  // Each order holds stock until paid or expired, so also cap orders per visitor per hour.
  await throttleStrict(`checkout-hour:${clientIp(req)}`, 8, 60 * 60 * 1000);
  const input = checkoutSchema.parse(await readJson(req));
  const r = await placeOrder(input);
  return ok({ orderNumber: r.orderNumber, orderId: r.orderId, token: r.token, totalCentavos: r.totalCentavos, instructions: r.init.instructions, redirectUrl: r.init.redirectUrl ?? null, duplicate: r.duplicate }, r.duplicate ? 200 : 201);
});

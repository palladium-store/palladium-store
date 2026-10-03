import { route, ok, readJson } from '@/lib/api';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { throttle } from '@/lib/auth';
import { confirmOrderAsSystem, verifyOrderToken } from '@/lib/orders';
import { demoEnabled } from '@/lib/palladium/demo-server';
import { DEMO_TX_PATTERN, DEMO_WALLET_PATTERN, PAYMENT_MODE_DEMO } from '@/lib/palladium/config';
import { getPalladiumPricePhp, phpToPalladiumMinor } from '@/lib/palladium-price';

export const dynamic = 'force-dynamic';

const body = z.object({ token: z.string().length(32), txId: z.string().regex(DEMO_TX_PATTERN), wallet: z.string().regex(DEMO_WALLET_PATTERN) });

/**
 * DEMO ONLY. Marks an order paid after the simulated PALLADIUM payment. There is no blockchain here and nothing is verified
 * on-chain: it only works while PALLADIUM_DEMO_MODE=true, for an order created with the PALLADIUM method, with that order's own token.
 * The token amount is computed here from the order total, never taken from the browser.
 * The real version of this route will verify the transaction on Robinhood Chain before marking the order paid.
 */
export const POST = route(async (req, ctx: { params: { number: string } }) => {
  if (!demoEnabled()) throw new AppError(404, 'NOT_AVAILABLE', 'Not available.');
  throttle(`palladium-demo:${req.headers.get('x-forwarded-for') ?? 'ip'}`, 30, 10 * 60 * 1000);
  const input = body.parse(await readJson(req));
  const order = await prisma.order.findUnique({ where: { orderNumber: ctx.params.number }, select: { id: true, orderNumber: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true, txId: true } });
  if (!order || !verifyOrderToken(order.id, input.token)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.paymentMethod !== 'PALLADIUM') throw new AppError(409, 'WRONG_METHOD', 'This order was not placed with PALLADIUM.');
  if (order.paymentStatus === 'PAID') {
    if (order.txId === input.txId) return ok({ ok: true, alreadyPaid: true });
    throw new AppError(409, 'ALREADY_PAID', 'This order is already paid.');
  }
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new AppError(409, 'INVALID_STATE', 'This order can no longer be paid.');

  const price = getPalladiumPricePhp();
  const amountMinor = phpToPalladiumMinor(order.totalCentavos, price);
  await prisma.$executeRaw`UPDATE orders SET "paymentMode"=${PAYMENT_MODE_DEMO}, "tokenAmountMinor"=${amountMinor}, "tokenPriceCentavos"=${Math.round(price * 100)}, "txId"=${input.txId}, "walletAddress"=${input.wallet} WHERE id=${order.id}`;
  await confirmOrderAsSystem(order.id, input.txId, `Demo PALLADIUM payment ${input.txId}`);
  return ok({ ok: true, tokenAmountMinor: amountMinor });
});

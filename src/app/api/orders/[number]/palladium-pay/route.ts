import { route, ok, readJson, qs } from '@/lib/api';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { throttle } from '@/lib/auth';
import { verifyOrderToken } from '@/lib/orders';
import { attachTransaction, loadTokenPayment, requoteOrder, tokenPaymentView, verifyOrderPayment } from '@/lib/palladium/live-server';

export const dynamic = 'force-dynamic';

const select = { id: true, orderNumber: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true } as const;

async function load(number: string, token: string | undefined) {
  const order = await prisma.order.findUnique({ where: { orderNumber: number }, select });
  if (!order || !verifyOrderToken(order.id, token)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.paymentMethod !== 'PALLADIUM') throw new AppError(409, 'WRONG_METHOD', 'This order was not placed with $PALLADIUM.');
  return order;
}

/**
 * Real $PALLADIUM payments. GET is polled by the checkout and the order page: it re-reads the blockchain receipt (the browser
 * is never the source of truth). POST attaches the transaction hash the customer's wallet returned, or re-locks the amount
 * when the previous lock expired before anything was sent.
 */
export const GET = route<{ params: { number: string } }>(async (req, { params }) => {
  const order = await load(params.number, qs(req).t);
  throttle(`tokpoll:${order.id}`, 60, 60 * 1000);
  const cur = await loadTokenPayment(order.id);
  if (!cur) throw new AppError(409, 'NOT_TOKEN_ORDER', 'This order has no token payment.');
  if (order.paymentStatus === 'PAID' || !cur.rec.txHash) return ok(await tokenPaymentView(order, cur.rec));
  return ok((await verifyOrderPayment(order)).view);
});

const body = z.object({ token: z.string().length(32), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(), requote: z.boolean().optional() });

export const POST = route<{ params: { number: string } }>(async (req, { params }) => {
  const input = body.parse(await readJson(req));
  const order = await load(params.number, input.token);
  throttle(`tokpay:${order.id}`, 20, 10 * 60 * 1000);
  if (input.txHash) return ok((await attachTransaction(order, input.txHash)).view);
  if (input.requote) return ok(await tokenPaymentView(order, await requoteOrder(order)));
  throw new AppError(422, 'NOTHING_TO_DO', 'Send a transaction hash or ask for a new quote.');
});

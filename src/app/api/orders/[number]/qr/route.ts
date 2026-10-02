import { route, ok } from '@/lib/api';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { throttle } from '@/lib/auth';
import { verifyOrderToken } from '@/lib/orders';
import { createQr, syncIntent, paymongoConfigured, type QrState } from '@/lib/paymongo';

export const dynamic = 'force-dynamic';

async function load(req: Request, number: string) {
  const t = new URL(req.url).searchParams.get('t') ?? undefined;
  const order = await prisma.order.findUnique({ where: { orderNumber: number }, select: { id: true, orderNumber: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true } });
  if (!order || !verifyOrderToken(order.id, t)) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (order.paymentMethod !== 'QRPH') throw new AppError(422, 'WRONG_METHOD', 'This order is not paid by QR Ph.');
  return order;
}
const currentQr = async (orderId: string): Promise<QrState | null> => {
  const p = await prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' }, select: { rawPayload: true } });
  return ((p?.rawPayload ?? {}) as { current?: QrState | null }).current ?? null;
};
const view = async (orderId: string) => {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, paymentStatus: true } });
  const qr = o.paymentStatus === 'PAID' ? null : await currentQr(orderId);
  return { status: o.status, paymentStatus: o.paymentStatus, qr: qr ? { imageUrl: qr.imageUrl, expiresAt: qr.expiresAt, expired: qr.expiresAt < Date.now() } : null };
};

/** Polled by the order page. Re-checks the payment with PayMongo (the browser is never the source of truth). */
export const GET = route<{ params: { number: string } }>(async (req, { params }) => {
  const order = await load(req, params.number);
  if (order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED') {
    throttle(`qrpoll:${order.id}`, 40, 60 * 1000);
    const qr = await currentQr(order.id);
    if (qr && paymongoConfigured()) await syncIntent(qr.intentId).catch((e) => console.error('[qr poll]', e));
  }
  return ok(await view(order.id));
});

/** Generates a new QR (first one, or after the previous one expired). */
export const POST = route<{ params: { number: string } }>(async (req, { params }) => {
  const order = await load(req, params.number);
  if (!paymongoConfigured()) throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'QR Ph payments are not available right now.');
  if (order.paymentStatus === 'PAID') return ok(await view(order.id));
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new AppError(409, 'ORDER_CLOSED', 'This order is no longer open for payment.');
  throttle(`qrnew:${order.id}`, 6, 10 * 60 * 1000);
  const existing = await currentQr(order.id);
  if (existing && existing.expiresAt > Date.now() + 60_000) return ok(await view(order.id)); // still valid, reuse it
  // Before replacing an old QR, make sure it was not paid in the meantime.
  if (existing) { const r = await syncIntent(existing.intentId).catch(() => 'pending'); if (r === 'paid') return ok(await view(order.id)); }
  await createQr(order);
  return ok(await view(order.id), 201);
});

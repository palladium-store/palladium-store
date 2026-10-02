import 'server-only';
import type { PaymentMethod } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './errors';
import { audit } from './audit';
import { confirmOrderAsSystem } from './orders';
import { readIntent, verifyIntentForOrder, type IntentView } from './paymongo-core';
import type { PaymentProvider, PaymentInit } from './payments';

const API = 'https://api.paymongo.com/v1';
const QR_EXPIRY_SECONDS = 1800; // 30 minutes (PayMongo allows 60 - 9000)
const MIN_CENTAVOS = 100; // PayMongo minimum: PHP 1.00

export const paymongoConfigured = () => !!process.env.PAYMONGO_SECRET_KEY;
export const paymongoLive = () => (process.env.PAYMONGO_SECRET_KEY ?? '').startsWith('sk_live');

const basic = (key: string) => `Basic ${Buffer.from(`${key}:`).toString('base64')}`;

async function pm(path: string, init: { method?: string; body?: unknown; key?: string; idempotencyKey?: string } = {}) {
  const key = init.key ?? process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'QR Ph payments are not configured.');
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: basic(key), ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[paymongo]', path, res.status, JSON.stringify(json)?.slice(0, 500));
    throw new AppError(502, 'PAYMENT_PROVIDER', 'The payment provider could not complete that request. Please try again.');
  }
  return json as { data?: { id?: string; attributes?: Record<string, unknown> } };
}

export interface QrState { intentId: string; imageUrl: string; expiresAt: number; amountCentavos: number }
interface Stored { intentIds: string[]; current: QrState | null }

const readStored = (raw: unknown): Stored => {
  const r = (raw ?? {}) as Partial<Stored>;
  return { intentIds: Array.isArray(r.intentIds) ? r.intentIds.filter((x): x is string => typeof x === 'string') : [], current: r.current ?? null };
};

/** Creates a fresh dynamic QR Ph code for an order (intent -> qrph payment method -> attach) and stores it on the order's payment row. */
export async function createQr(order: { id: string; orderNumber: string; totalCentavos: number }): Promise<QrState> {
  if (order.totalCentavos < MIN_CENTAVOS) throw new AppError(422, 'AMOUNT_TOO_SMALL', 'QR Ph needs an order of at least ₱1.00.');
  const payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' } });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment record not found.');
  const stored = readStored(payment.rawPayload);
  const attempt = stored.intentIds.length + 1;
  const nonce = `${order.id}:qrph:${attempt}`;

  const intent = await pm('/payment_intents', {
    idempotencyKey: `pi:${nonce}`,
    body: { data: { attributes: {
      amount: order.totalCentavos, currency: 'PHP', payment_method_allowed: ['qrph'], capture_type: 'automatic',
      description: `Palladium order ${order.orderNumber}`, statement_descriptor: 'PALLADIUM',
      metadata: { order_id: order.id, order_number: order.orderNumber },
    } } },
  });
  const intentId = intent.data?.id;
  const clientKey = intent.data?.attributes?.client_key;
  if (!intentId || typeof clientKey !== 'string') throw new AppError(502, 'PAYMENT_PROVIDER', 'The payment provider returned an unexpected response.');

  const publicKey = process.env.PAYMONGO_PUBLIC_KEY || undefined;
  const method = await pm('/payment_methods', { key: publicKey, idempotencyKey: `pm:${nonce}`, body: { data: { attributes: { type: 'qrph', expiry_seconds: QR_EXPIRY_SECONDS } } } });
  const methodId = method.data?.id;
  if (!methodId) throw new AppError(502, 'PAYMENT_PROVIDER', 'The payment provider returned an unexpected response.');

  const attached = await pm(`/payment_intents/${intentId}/attach`, { key: publicKey, body: { data: { attributes: { payment_method: methodId, client_key: clientKey } } } });
  const next = (attached.data?.attributes?.next_action ?? {}) as { code?: { image_url?: unknown } };
  const imageUrl = next.code?.image_url;
  if (typeof imageUrl !== 'string' || !imageUrl) throw new AppError(502, 'PAYMENT_PROVIDER', 'The payment provider did not return a QR code.');

  const current: QrState = { intentId, imageUrl, expiresAt: Date.now() + QR_EXPIRY_SECONDS * 1000, amountCentavos: order.totalCentavos };
  const next2: Stored = { intentIds: [...stored.intentIds, intentId], current };
  await prisma.payment.update({ where: { id: payment.id }, data: { provider: 'paymongo', providerRef: intentId, rawPayload: next2 as unknown as object } });
  return current;
}

export const paymongoProvider: PaymentProvider = {
  id: 'paymongo',
  methods: ['QRPH'] as PaymentMethod[],
  async initiate(order): Promise<PaymentInit> {
    try {
      await createQr(order);
      return { instructions: 'Scan the QR code on the next page with any bank or e-wallet app that supports QR Ph. We confirm your payment automatically.', reference: order.orderNumber };
    } catch (e) {
      console.error('[paymongo] could not create QR at checkout', e);
      return { instructions: 'Your order is saved. Open your order page and tap "Show my QR code" to pay.', reference: order.orderNumber };
    }
  },
};

export type SyncResult = 'paid' | 'pending' | 'ignored' | 'review';

/** Re-fetches a payment intent from PayMongo and, only if it really succeeded for the right amount, confirms the order (idempotent). */
export async function syncIntent(intentId: string): Promise<SyncResult> {
  const json = await pm(`/payment_intents/${encodeURIComponent(intentId)}`);
  const intent: IntentView | null = readIntent(json);
  if (!intent?.orderId) return 'ignored';
  const order = await prisma.order.findUnique({ where: { id: intent.orderId }, select: { id: true, orderNumber: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true } });
  if (!order || order.paymentMethod !== 'QRPH') return 'ignored';
  const payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' } });
  const known = readStored(payment?.rawPayload).intentIds;
  const verdict = verifyIntentForOrder(intent, order, known);
  if (!verdict.ok) {
    if (intent.status === 'succeeded') {
      console.error('[paymongo] succeeded intent failed verification', intent.id, verdict.reason);
      await audit(null, 'QR_PAYMENT_MISMATCH', 'Order', order.id, `QR payment ${intent.id} on ${order.orderNumber} not applied: ${verdict.reason}`);
      return 'review';
    }
    return 'pending';
  }
  if (order.paymentStatus === 'PAID') return 'paid';
  try {
    await confirmOrderAsSystem(order.id, intent.id, `QR Ph payment ${intent.id}`);
    return 'paid';
  } catch (e) {
    // Paid at the provider but the order can no longer be confirmed (e.g. cancelled, out of stock): needs a human.
    console.error('[paymongo] could not confirm paid order', order.id, e);
    await audit(null, 'QR_PAYMENT_NEEDS_REVIEW', 'Order', order.id, `QR payment ${intent.id} was received for ${order.orderNumber} but the order could not be confirmed. Review or refund.`);
    return 'review';
  }
}

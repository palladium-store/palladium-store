import { NextResponse } from 'next/server';
import { verifyWebhookSignature, collectIntentIds, eventType } from '@/lib/paymongo-core';
import { syncIntent, paymongoLive } from '@/lib/paymongo';

export const dynamic = 'force-dynamic';

/**
 * PayMongo webhook (events: payment.paid, payment.failed, qrph.expired).
 * 1. The raw body's Paymongo-Signature (HMAC-SHA256 with PAYMONGO_WEBHOOK_SECRET) must be valid, else 400.
 * 2. The payload is NEVER trusted for amounts or status. Every payment-intent id in it is re-fetched from PayMongo and an order is
 *    confirmed only if the intent succeeded, for the exact order total, in PHP, for an intent we created for that order.
 * 3. Confirming is idempotent, so PayMongo retries and duplicate events are harmless.
 * Returns 200 once handled (or deliberately ignored), 500 on a transient failure so PayMongo retries.
 */
export async function POST(req: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET ?? '';
  if (!secret) return NextResponse.json({ error: { code: 'NOT_CONFIGURED', message: 'Webhook is not configured.' } }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('paymongo-signature'), secret, paymongoLive())) {
    return NextResponse.json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } }, { status: 400 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: { code: 'BAD_JSON', message: 'Invalid JSON.' } }, { status: 400 }); }

  const type = eventType(payload);
  const ids = collectIntentIds(payload).slice(0, 3);
  const results: Record<string, string> = {};
  try {
    for (const id of ids) results[id] = await syncIntent(id);
  } catch (e) {
    console.error('[paymongo webhook] processing failed', type, e);
    return NextResponse.json({ error: { code: 'RETRY', message: 'Temporary failure.' } }, { status: 500 });
  }
  return NextResponse.json({ ok: true, type, results });
}

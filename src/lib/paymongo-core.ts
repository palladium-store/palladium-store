// Pure PayMongo helpers (no server-only imports) so they can be unit tested.
import crypto from 'node:crypto';

export interface ParsedSignature { t: string; te?: string; li?: string }

/** Parses the `Paymongo-Signature` header: `t=1700000000,te=<test sig>,li=<live sig>`. */
export function parseSignatureHeader(header: string | null | undefined): ParsedSignature | null {
  if (!header) return null;
  const out: Record<string, string> = {};
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out.t ? { t: out.t, te: out.te || undefined, li: out.li || undefined } : null;
}

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** HMAC-SHA256 over `${t}.${rawBody}` with the webhook secret; compares te (test mode) or li (live mode) in constant time. */
export function verifyWebhookSignature(rawBody: string, header: string | null | undefined, secret: string, live: boolean): boolean {
  if (!secret) return false;
  const sig = parseSignatureHeader(header);
  if (!sig) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${sig.t}.${rawBody}`).digest('hex');
  const given = live ? sig.li : sig.te;
  return !!given && safeEq(given, expected);
}

/** Collects every PayMongo payment-intent id (pi_...) found anywhere in an event payload. The payload itself is never trusted:
 *  each id is re-fetched from PayMongo's API before anything is confirmed. */
export function collectIntentIds(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v == null) return;
    if (typeof v === 'string') { if (/^pi_[A-Za-z0-9]{8,}$/.test(v)) found.add(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1));
  };
  walk(payload, 0);
  return [...found];
}

export function eventType(payload: unknown): string | null {
  const t = (payload as { data?: { attributes?: { type?: unknown } } } | null)?.data?.attributes?.type;
  return typeof t === 'string' ? t : null;
}

export interface IntentView { id: string; status: string; amount: number; currency: string; orderId: string | null; paymentIds: string[] }

/** Normalises a GET /payment_intents/{id} response. */
export function readIntent(json: unknown): IntentView | null {
  const d = (json as { data?: { id?: unknown; attributes?: Record<string, unknown> } } | null)?.data;
  if (!d || typeof d.id !== 'string' || !d.attributes) return null;
  const a = d.attributes;
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  const pays = Array.isArray(a.payments) ? (a.payments as { id?: unknown }[]) : [];
  return {
    id: d.id, status: String(a.status ?? ''), amount: Number(a.amount), currency: String(a.currency ?? ''),
    orderId: typeof meta.order_id === 'string' ? meta.order_id : null,
    paymentIds: pays.map((p) => p.id).filter((x): x is string => typeof x === 'string'),
  };
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/** The only gate for confirming an order: provider says succeeded, and amount/currency/order all match what WE stored. */
export function verifyIntentForOrder(intent: IntentView, order: { id: string; totalCentavos: number }, knownIntentIds: string[]): Verdict {
  if (!knownIntentIds.includes(intent.id)) return { ok: false, reason: 'intent was not created for this order' };
  if (intent.orderId !== order.id) return { ok: false, reason: 'intent metadata does not match the order' };
  if (intent.status !== 'succeeded') return { ok: false, reason: `intent status is ${intent.status || 'unknown'}` };
  if (intent.currency !== 'PHP') return { ok: false, reason: `unexpected currency ${intent.currency}` };
  if (!Number.isInteger(intent.amount) || intent.amount !== order.totalCentavos) return { ok: false, reason: `amount ${intent.amount} does not equal order total ${order.totalCentavos}` };
  return { ok: true };
}

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Signed, expiring checkout quotes. A quote is a small JSON payload plus an HMAC-SHA256 signature, so the server can
 * later trust the locked rate and amount without storing anything, and nobody can edit them in the browser.
 * The payment record created in the payment phase stores these values permanently and enforces single use via `id`.
 */
export interface QuotePayload {
  v: 1;
  id: string;
  platform: string;
  phpCentavos: number;
  /** PHP per token, scaled by 1e18, as a decimal string. */
  rateScaled: string;
  source: string;
  /** Token amount in smallest units, decimal string. */
  tokenAmount: string;
  decimals: number;
  chainId: number;
  contract: string | null;
  quotedAt: number;
  expiresAt: number;
}

const b64 = (b: Buffer) => b.toString('base64url');

function key(secret: string): Buffer {
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return createHmac('sha256', secret).update('palladium:token-quote:v1').digest();
}

export function newQuoteId(): string { return randomUUID(); }

export function signQuote(payload: QuotePayload, secret: string): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  const sig = b64(createHmac('sha256', key(secret)).update(body).digest());
  return `${body}.${sig}`;
}

export type QuoteCheck = { ok: true; quote: QuotePayload } | { ok: false; reason: 'INVALID' | 'EXPIRED' };

export function verifyQuote(token: string, secret: string, nowMs = Date.now()): QuoteCheck {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 2) return { ok: false, reason: 'INVALID' };
  const [body, sig] = parts;
  const expect = createHmac('sha256', key(secret)).update(body).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, 'base64url'); } catch { return { ok: false, reason: 'INVALID' }; }
  if (given.length !== expect.length || !timingSafeEqual(given, expect)) return { ok: false, reason: 'INVALID' };
  let q: QuotePayload;
  try { q = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QuotePayload; } catch { return { ok: false, reason: 'INVALID' }; }
  if (q?.v !== 1 || typeof q.expiresAt !== 'number') return { ok: false, reason: 'INVALID' };
  if (nowMs >= q.expiresAt) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, quote: q };
}

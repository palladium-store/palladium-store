import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signQuote, verifyQuote, newQuoteId, type QuotePayload } from '../src/lib/token-quote';

const SECRET = 'x'.repeat(40);
const base = (over: Partial<QuotePayload> = {}): QuotePayload => ({
  v: 1, id: newQuoteId(), platform: 'PALLADIUM_STORE', phpCentavos: 549500, rateScaled: '10000000000000000000', source: 'manual',
  tokenAmount: '549500000000000000000', decimals: 18, chainId: 46630, contract: null, quotedAt: 1000, expiresAt: 301000, ...over,
});

test('a fresh signed quote verifies', () => {
  const q = base();
  const r = verifyQuote(signQuote(q, SECRET), SECRET, 2000);
  assert.ok(r.ok && r.quote.id === q.id && r.quote.tokenAmount === q.tokenAmount && r.quote.platform === 'PALLADIUM_STORE');
});
test('expires exactly at the lock time', () => {
  const t = signQuote(base(), SECRET);
  assert.ok(verifyQuote(t, SECRET, 300999).ok);
  assert.deepEqual(verifyQuote(t, SECRET, 301000), { ok: false, reason: 'EXPIRED' });
});
test('tampering with the amount, the signature or the secret is detected', () => {
  const t = signQuote(base(), SECRET);
  const [body, sig] = t.split('.');
  const edited = JSON.parse(Buffer.from(body, 'base64url').toString());
  edited.tokenAmount = '1';
  const forged = `${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${sig}`;
  assert.deepEqual(verifyQuote(forged, SECRET, 2000), { ok: false, reason: 'INVALID' });
  assert.deepEqual(verifyQuote(`${body}.${sig.slice(0, -2)}AA`, SECRET, 2000), { ok: false, reason: 'INVALID' });
  assert.deepEqual(verifyQuote(t, 'y'.repeat(40), 2000), { ok: false, reason: 'INVALID' });
});
test('garbage input is invalid, never a crash', () => {
  for (const g of ['', 'abc', 'a.b.c', '.', 'e30.e30', '%%%.%%%']) assert.deepEqual(verifyQuote(g, SECRET, 2000), { ok: false, reason: 'INVALID' }, g);
});
test('refuses to sign with a weak secret', () => {
  assert.throws(() => signQuote(base(), 'short'));
});
test('every quote has a unique id for single-use enforcement', () => {
  assert.notEqual(newQuoteId(), newQuoteId());
});

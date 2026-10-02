import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseSignatureHeader, verifyWebhookSignature, collectIntentIds, readIntent, verifyIntentForOrder, eventType } from '../src/lib/paymongo-core';

const SECRET = 'whsk_test_secret';
const sign = (body: string, t = '1700000000', s = SECRET) => crypto.createHmac('sha256', s).update(`${t}.${body}`).digest('hex');

test('parses signature header', () => {
  assert.deepEqual(parseSignatureHeader('t=1,te=abc,li='), { t: '1', te: 'abc', li: undefined });
  assert.equal(parseSignatureHeader(null), null);
  assert.equal(parseSignatureHeader('garbage'), null);
});
test('valid test-mode signature passes, live field is ignored in test mode', () => {
  const body = '{"a":1}';
  const h = `t=1700000000,te=${sign(body)},li=`;
  assert.equal(verifyWebhookSignature(body, h, SECRET, false), true);
  assert.equal(verifyWebhookSignature(body, h, SECRET, true), false);
});
test('valid live signature passes only in live mode', () => {
  const body = '{"a":1}';
  const h = `t=1700000000,te=,li=${sign(body)}`;
  assert.equal(verifyWebhookSignature(body, h, SECRET, true), true);
  assert.equal(verifyWebhookSignature(body, h, SECRET, false), false);
});
test('tampered body, wrong secret, wrong timestamp, missing secret all fail', () => {
  const body = '{"a":1}';
  const h = `t=1700000000,te=${sign(body)}`;
  assert.equal(verifyWebhookSignature('{"a":2}', h, SECRET, false), false);
  assert.equal(verifyWebhookSignature(body, h, 'other', false), false);
  assert.equal(verifyWebhookSignature(body, `t=1700000001,te=${sign(body)}`, SECRET, false), false);
  assert.equal(verifyWebhookSignature(body, h, '', false), false);
  assert.equal(verifyWebhookSignature(body, undefined, SECRET, false), false);
  assert.equal(verifyWebhookSignature(body, 't=1700000000,te=short', SECRET, false), false);
});
test('collects intent ids from nested payloads', () => {
  const p = { data: { attributes: { type: 'payment.paid', data: { attributes: { payment_intent_id: 'pi_abcdefgh12345678', other: 'x' } } } } };
  assert.deepEqual(collectIntentIds(p), ['pi_abcdefgh12345678']);
  assert.equal(eventType(p), 'payment.paid');
  assert.deepEqual(collectIntentIds({ a: 'pi_short' }), []);
});
const intentJson = (o: Record<string, unknown> = {}) => ({ data: { id: 'pi_abcdefgh12345678', attributes: { status: 'succeeded', amount: 549500, currency: 'PHP', metadata: { order_id: 'ord1' }, payments: [{ id: 'pay_1' }], ...o } } });
test('verifies a matching succeeded intent', () => {
  const i = readIntent(intentJson())!;
  assert.deepEqual(verifyIntentForOrder(i, { id: 'ord1', totalCentavos: 549500 }, ['pi_abcdefgh12345678']), { ok: true });
});
test('rejects wrong amount, currency, status, order, or unknown intent', () => {
  const o = { id: 'ord1', totalCentavos: 549500 }, known = ['pi_abcdefgh12345678'];
  assert.equal(verifyIntentForOrder(readIntent(intentJson({ amount: 100 }))!, o, known).ok, false);
  assert.equal(verifyIntentForOrder(readIntent(intentJson({ currency: 'USD' }))!, o, known).ok, false);
  assert.equal(verifyIntentForOrder(readIntent(intentJson({ status: 'awaiting_next_action' }))!, o, known).ok, false);
  assert.equal(verifyIntentForOrder(readIntent(intentJson({ metadata: { order_id: 'other' } }))!, o, known).ok, false);
  assert.equal(verifyIntentForOrder(readIntent(intentJson())!, o, ['pi_zzzzzzzzzzzz']).ok, false);
  assert.equal(readIntent({}), null);
});

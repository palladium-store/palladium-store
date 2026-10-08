import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER_TOPIC, isTxHash, sameAddress, topicToAddress, transferData } from '../src/lib/chain-config';
import { evaluateReceipt, type RpcReceipt } from '../src/lib/palladium/verify';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const PALLADIUM = '0x2222222222222222222222222222222222222222';
const BUYER = '0x3333333333333333333333333333333333333333';
const OTHER = '0x4444444444444444444444444444444444444444';
const pad = (a: string) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
const hex = (n: bigint) => `0x${n.toString(16)}`;
const ONE = 10n ** 18n;

function receipt(logs: { address?: string; from?: string; to?: string; value: bigint; topic?: string }[], opts: { status?: string; block?: bigint } = {}): RpcReceipt {
  return {
    status: opts.status ?? '0x1', blockNumber: hex(opts.block ?? 1000n), transactionHash: '0x' + 'ab'.repeat(32), from: BUYER, to: CONTRACT,
    logs: logs.map((l) => ({ address: l.address ?? CONTRACT, topics: [l.topic ?? TRANSFER_TOPIC, pad(l.from ?? BUYER), pad(l.to ?? PALLADIUM)], data: `0x${l.value.toString(16).padStart(64, '0')}` })),
  };
}
const base = { contract: CONTRACT, paymentWallet: PALLADIUM, expectedAmount: 549n * ONE + ONE / 2n, confirmations: 3 };

test('transfer calldata and helpers', () => {
  assert.equal(transferData('0xAbCdEf0123456789abcdef0123456789ABCDEF01', 1n), '0xa9059cbb000000000000000000000000abcdef0123456789abcdef0123456789abcdef010000000000000000000000000000000000000000000000000000000000000001');
  assert.throws(() => transferData('0x123', 1n));
  assert.throws(() => transferData(PALLADIUM, 0n));
  assert.ok(isTxHash('0x' + 'f'.repeat(64)));
  assert.ok(!isTxHash('0x' + 'f'.repeat(63)));
  assert.ok(sameAddress(PALLADIUM, PALLADIUM.toUpperCase().replace('0X', '0x')));
  assert.equal(topicToAddress(pad(BUYER)), BUYER);
});

test('not mined yet is pending; a reverted transaction fails', () => {
  assert.deepEqual(evaluateReceipt({ ...base, receipt: null, latestBlock: 1n }), { kind: 'pending' });
  assert.deepEqual(evaluateReceipt({ ...base, receipt: receipt([{ value: 600n * ONE }], { status: '0x0' }), latestBlock: 2000n }), { kind: 'failed' });
});

test('exact amount with enough confirmations is ok', () => {
  const r = evaluateReceipt({ ...base, receipt: receipt([{ value: 549n * ONE + ONE / 2n }], { block: 1000n }), latestBlock: 1002n });
  assert.equal(r.kind, 'ok');
  if (r.kind === 'ok') { assert.equal(r.received, 549n * ONE + ONE / 2n); assert.equal(r.from, BUYER); assert.equal(r.confirmations, 3); }
});

test('too few confirmations keeps confirming, and reports progress', () => {
  const r = evaluateReceipt({ ...base, receipt: receipt([{ value: 600n * ONE }], { block: 1000n }), latestBlock: 1001n });
  assert.equal(r.kind, 'confirming');
  if (r.kind === 'confirming') { assert.equal(r.have, 2); assert.equal(r.need, 3); }
});

test('underpaid is flagged, overpaid is accepted, several transfers add up', () => {
  const under = evaluateReceipt({ ...base, receipt: receipt([{ value: 100n * ONE }]), latestBlock: 5000n });
  assert.equal(under.kind, 'underpaid');
  const over = evaluateReceipt({ ...base, receipt: receipt([{ value: 1000n * ONE }]), latestBlock: 5000n });
  assert.equal(over.kind, 'ok');
  const split = evaluateReceipt({ ...base, receipt: receipt([{ value: 300n * ONE }, { value: 300n * ONE }]), latestBlock: 5000n });
  assert.equal(split.kind, 'ok');
});

test('transfers to someone else, from another contract, or non-Transfer events do not count', () => {
  const wrongTo = evaluateReceipt({ ...base, receipt: receipt([{ value: 1000n * ONE, to: OTHER }]), latestBlock: 5000n });
  assert.equal(wrongTo.kind, 'rejected');
  const wrongToken = evaluateReceipt({ ...base, receipt: receipt([{ value: 1000n * ONE, address: OTHER }]), latestBlock: 5000n });
  assert.equal(wrongToken.kind, 'rejected');
  const wrongEvent = evaluateReceipt({ ...base, receipt: receipt([{ value: 1000n * ONE, topic: '0x' + '11'.repeat(32) }]), latestBlock: 5000n });
  assert.equal(wrongEvent.kind, 'rejected');
  // Mixed: a decoy to someone else plus the real payment still passes on the real one only.
  const mixed = evaluateReceipt({ ...base, receipt: receipt([{ value: 10000n * ONE, to: OTHER }, { value: 550n * ONE }]), latestBlock: 5000n });
  assert.equal(mixed.kind, 'ok');
  if (mixed.kind === 'ok') assert.equal(mixed.received, 550n * ONE);
});

test('addresses compare case-insensitively (checksummed vs lowercase)', () => {
  const r = evaluateReceipt({ ...base, contract: CONTRACT.toUpperCase().replace('0X', '0x'), paymentWallet: PALLADIUM.toUpperCase().replace('0X', '0x'), receipt: receipt([{ value: 600n * ONE }]), latestBlock: 5000n });
  assert.equal(r.kind, 'ok');
});

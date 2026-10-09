import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER_TOPIC, addressTopic, parseUnits } from '../src/lib/chain-config';
import { scanWindows, toActivity, type RawLog } from '../src/lib/palladium/activity-core';

const TOKEN = '0x1111111111111111111111111111111111111111';
const PAL = '0x2222222222222222222222222222222222222222';
const ME = '0x3333333333333333333333333333333333333333';
const FRIEND = '0x4444444444444444444444444444444444444444';
const ONE = 10n ** 18n;
const hex = (n: bigint | number) => `0x${BigInt(n).toString(16)}`;
const log = (from: string, to: string, amount: bigint, block: number, tx: string, i = 0, extra: Partial<RawLog> = {}): RawLog => ({
  address: TOKEN, topics: [TRANSFER_TOPIC, addressTopic(from), addressTopic(to)], data: hex(amount), blockNumber: hex(block),
  transactionHash: tx, logIndex: hex(i), ...extra,
});
const ctx = { address: ME, contract: TOKEN, paymentWallet: PAL, latestBlock: 1000n };

test('labels each transfer from the wallet\'s point of view, newest first', () => {
  const out = toActivity([
    log(FRIEND, ME, 5n * ONE, 900, '0xa1'),
    log(ME, FRIEND, 2n * ONE, 950, '0xa2'),
    log(ME, PAL, 3n * ONE, 960, '0xa3'),
    log(PAL, ME, 1n * ONE, 970, '0xa4'),
    log(ME, ME, 1n, 980, '0xa5'),
  ], ctx);
  assert.deepEqual(out.map((e) => e.kind), ['self', 'from-palladium', 'paid-palladium', 'sent', 'received']);
  const received = out.find((e) => e.kind === 'received')!;
  assert.equal(received.counterparty, FRIEND);
  assert.equal(received.amount, (5n * ONE).toString());
  assert.equal(received.confirmations, 101);
  assert.equal(out.find((e) => e.kind === 'sent')!.counterparty, FRIEND);
});

test('ignores other tokens, other wallets, removed logs, non-Transfer events, and counts each log once', () => {
  const dup = log(ME, ME, 7n, 990, '0xbb', 2);
  const out = toActivity([
    { ...log(FRIEND, ME, 9n, 900, '0xc1'), address: '0x9999999999999999999999999999999999999999' },
    log(FRIEND, PAL, 9n, 900, '0xc2'),
    log(FRIEND, ME, 9n, 900, '0xc3', 0, { removed: true }),
    { ...log(FRIEND, ME, 9n, 900, '0xc4'), topics: ['0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', addressTopic(FRIEND), addressTopic(ME)] },
    dup, dup,
  ], ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].hash, '0xbb');
});

test('splits a long history into RPC-sized windows, newest first, never below the deployment block', () => {
  assert.deepEqual(scanWindows(100n, 0n, 40n, 10), [{ from: 61n, to: 100n }, { from: 21n, to: 60n }, { from: 0n, to: 20n }]);
  assert.deepEqual(scanWindows(100n, 70n, 40n, 10), [{ from: 70n, to: 100n }]);
  assert.equal(scanWindows(1_000_000_000n, 0n, 9_000_000n, 9).length, 9);
});

test('parseUnits reads typed amounts exactly and refuses anything ambiguous', () => {
  assert.equal(parseUnits('12', 18), 12n * ONE);
  assert.equal(parseUnits('0.5', 18), ONE / 2n);
  assert.equal(parseUnits('1,250.25', 2), 125025n);
  assert.equal(parseUnits('.5', 1), 5n);
  for (const bad of ['', '.', '-1', '1e3', 'abc', '1.2.3', ' 12 x']) assert.equal(parseUnits(bad, 18), null, bad);
  assert.equal(parseUnits('0.001', 2), null);
});

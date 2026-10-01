import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUnits, balanceOfData, toHexChainId, isAddress } from '../src/lib/chain-config';

test('formatUnits is exact and never uses floats', () => {
  assert.equal(formatUnits(5495n * 10n ** 17n, 18), '549.5');
  assert.equal(formatUnits(27475n * 10n ** 16n, 18), '274.75');
  assert.equal(formatUnits(0n, 18), '0');
  assert.equal(formatUnits(1n, 18), '0');
  assert.equal(formatUnits(1234567891234567890123n, 18), '1,234.5678');
  assert.equal(formatUnits(100000000n * 10n ** 18n, 18), '100,000,000');
});
test('chain ids and calldata', () => {
  assert.equal(toHexChainId(4663), '0x1237');
  assert.equal(toHexChainId(46630), '0xb626');
  assert.equal(balanceOfData('0xAbCdEf0123456789abcdef0123456789ABCDEF01'), '0x70a08231000000000000000000000000abcdef0123456789abcdef0123456789abcdef01');
  assert.ok(isAddress('0x0000000000000000000000000000000000000001'));
  assert.ok(!isAddress('0x123'));
});

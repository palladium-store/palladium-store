import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, formatPrice, tokenAmountForPhp, phpCentavosForTokens, assertPriceInBounds, isFresh, quoteTtlSeconds, PriceError } from '../src/lib/token-math';
import { formatUnits } from '../src/lib/chain-config';

const D = 18;
const tokens = (centavos: number, price: string) => formatUnits(tokenAmountForPhp(centavos, parsePrice(price), D), D, 18);

test('spec examples: PHP 5,495 at PHP 10 and PHP 20', () => {
  assert.equal(tokens(549500, '10'), '549.5');
  assert.equal(tokens(549500, '20'), '274.75');
});
test('PHP price stays fixed while token amount moves with the rate', () => {
  assert.equal(tokens(549500, '5'), '1,099');
  assert.equal(tokens(549500, '0.5'), '10,990');
});
test('rounds up, so Palladium is never underpaid', () => {
  // PHP 1.00 at PHP 3 per token = 0.333... tokens, must round UP at the last unit
  const amt = tokenAmountForPhp(100, parsePrice('3'), D);
  assert.equal(amt, 333333333333333334n);
  assert.ok(amt * 3n >= 10n ** 18n);
});
test('works with 6-decimal tokens too', () => {
  assert.equal(tokenAmountForPhp(549500, parsePrice('10'), 6), 549_500_000n);
});
test('no floating point drift on awkward prices', () => {
  const amt = tokenAmountForPhp(1999900, parsePrice('0.1'), D); // PHP 19,999 at 0.1
  assert.equal(formatUnits(amt, D, 18), '199,990');
});
test('indicative PHP value of a balance rounds down', () => {
  assert.equal(phpCentavosForTokens(549_500000000000000000n, parsePrice('10'), D), 549500n);
  assert.equal(phpCentavosForTokens(1n, parsePrice('10'), D), 0n);
});
test('parsePrice rejects junk, zero, negatives, exponents and too many decimals', () => {
  for (const bad of ['', 'abc', '-1', '0', '0.0', '1e3', '1,000', '0x10', ' ', '1.0000000000000000001', 'Infinity', 'NaN', '10 PHP']) {
    assert.throws(() => parsePrice(bad), PriceError, bad);
  }
  assert.equal(formatPrice(parsePrice(' 12.5 ')), '12.5');
});
test('rejects bad amounts and prices', () => {
  assert.throws(() => tokenAmountForPhp(0, parsePrice('10'), D), PriceError);
  assert.throws(() => tokenAmountForPhp(-5, parsePrice('10'), D), PriceError);
  assert.throws(() => tokenAmountForPhp(100, 0n, D), PriceError);
});
test('price bounds', () => {
  const b = { min: parsePrice('0.000001'), max: parsePrice('1000000') };
  assert.doesNotThrow(() => assertPriceInBounds(parsePrice('10'), b));
  assert.throws(() => assertPriceInBounds(parsePrice('0.0000001'), b), PriceError);
  assert.throws(() => assertPriceInBounds(parsePrice('2000000'), b), PriceError);
});
test('freshness: stale and future-dated quotes are rejected', () => {
  const now = 1_000_000;
  assert.ok(isFresh(now - 1000, now, 120_000));
  assert.ok(!isFresh(now - 121_000, now, 120_000));
  assert.ok(!isFresh(now + 60_000, now, 120_000));
});
test('quote lifetime defaults to five minutes and is clamped', () => {
  assert.equal(quoteTtlSeconds(undefined), 300);
  assert.equal(quoteTtlSeconds('abc'), 300);
  assert.equal(quoteTtlSeconds('10'), 60);
  assert.equal(quoteTtlSeconds('99999'), 1800);
  assert.equal(quoteTtlSeconds('420'), 420);
});

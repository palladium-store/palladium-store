import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreeRate, meetsPriceFloor, priceWithSpread, tokensForPhp, weiForPhp } from '../src/lib/palladium/sale-math';
import { parsePrice } from '../src/lib/token-math';

const ONE = 10n ** 18n;

test('the brief\'s example: ₱2.00 reference + 5% = ₱2.10, and ₱1,050 buys exactly 500 tokens', () => {
  const unit = priceWithSpread(parsePrice('2'), 500);
  assert.equal(unit, parsePrice('2.1'));
  assert.equal(tokensForPhp(105_000n, unit, 18), 500n * ONE);
});

test('token amounts round down and never exceed what was paid for', () => {
  const unit = priceWithSpread(parsePrice('3'), 500); // ₱3.15
  const t = tokensForPhp(100_00n, unit, 18);          // ₱100
  assert.ok(t * 315n <= 100n * 100n * ONE);           // tokens x price <= paid
  assert.equal(tokensForPhp(0n, unit, 18), 0n);
});

test('ETH charged rounds up', () => {
  const ethPhp = parsePrice('200000');                // ₱200,000 per ETH
  assert.equal(weiForPhp(105_000n, ethPhp), (1050n * ONE) / 200000n); // ₱1,050 = 0.00525 ETH exactly
  assert.equal(weiForPhp(1n, parsePrice('3')), ceil(ONE, 300n));
});
const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;

test('spread is limited to 0..50% and the reference price must be positive', () => {
  assert.equal(priceWithSpread(parsePrice('2'), 0), parsePrice('2'));
  assert.throws(() => priceWithSpread(parsePrice('2'), 5001));
  assert.throws(() => priceWithSpread(parsePrice('2'), -1));
  assert.throws(() => priceWithSpread(0n, 500));
});

test('price floor matches the contract rule', () => {
  const minWei = 10n ** 12n; // 0.000001 ETH per token
  assert.equal(meetsPriceFloor(10n ** 15n, 1000n * ONE, 18, minWei), true);
  assert.equal(meetsPriceFloor(10n ** 15n - 1n, 1000n * ONE, 18, minWei), false);
});

test('ETH/PHP sources must agree, otherwise there is no rate', () => {
  const p = (s: string) => parsePrice(s);
  assert.equal(agreeRate([p('200000'), p('201000')]), p('201000'));
  assert.equal(agreeRate([p('200000'), p('210000')]), null);
  assert.equal(agreeRate([p('200000')]), p('200000'));
  assert.equal(agreeRate([p('200000')], 200, false), null);
  assert.equal(agreeRate([]), null);
  assert.equal(agreeRate([p('199000'), p('200000'), p('200500')]), p('200000'));
});

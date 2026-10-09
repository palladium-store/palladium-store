import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPrice, toScaledDecimal } from '../src/lib/palladium/market-price-core';
import { formatPrice, parsePrice } from '../src/lib/token-math';

const ethPhp = parsePrice('145000'); // ₱145,000 per ETH
const base = { ethPhpScaled: ethPhp, liquidityUsd: 5000, minLiquidityUsd: 1000, maxDeviationPct: 20 };

test('reads the tiny ETH prices pools report, in plain and exponent form', () => {
  assert.equal(toScaledDecimal('0.00000000201410527630549', 27), 2_014_105_276_305_490_000n);
  assert.equal(toScaledDecimal(2.01410527630549e-9, 27), 2_014_105_276_305_490_000n);
  assert.equal(toScaledDecimal('2.5e-9', 27), 2_500_000_000_000_000_000n);
  assert.equal(toScaledDecimal('1.5e3', 2), 150_000n);
  assert.equal(toScaledDecimal('abc', 27), null);
  assert.equal(toScaledDecimal(0, 27), null);
});

test('converts ETH per token to pesos per token: 2.0e-9 ETH at ₱145,000 = ₱0.00029', () => {
  const r = marketPrice({ ...base, spotEthPerToken: '0.000000002', closesEthPerToken: ['0.000000002'], purpose: 'payment' });
  assert.ok(r.ok);
  assert.equal(formatPrice(r.phpPerTokenScaled, 8), '0.00029');
});

test('payments use the lower of spot and average; the sale uses the higher', () => {
  const input = { ...base, spotEthPerToken: '0.0000000022', closesEthPerToken: ['0.000000002', '0.000000002'] }; // spot 10% above average
  const pay = marketPrice({ ...input, purpose: 'payment' });
  const sale = marketPrice({ ...input, purpose: 'sale' });
  assert.ok(pay.ok && sale.ok);
  assert.equal(pay.phpPerTokenScaled, pay.averagePhpScaled, 'a pumped spot price does not lower what a customer owes');
  assert.equal(sale.phpPerTokenScaled, sale.spotPhpScaled);
  assert.equal(pay.deviationPct, 10);
});

test('pauses when the spot price is far from the recent average', () => {
  const r = marketPrice({ ...base, spotEthPerToken: '0.000000003', closesEthPerToken: ['0.000000002'], purpose: 'payment' }); // +50%
  assert.equal(r.ok, false);
});

test('refuses a pool below the minimum liquidity', () => {
  const r = marketPrice({ ...base, liquidityUsd: 400, spotEthPerToken: '0.000000002', closesEthPerToken: [], purpose: 'payment' });
  assert.equal(r.ok, false);
});

test('with no history yet, the spot price is used as is', () => {
  const r = marketPrice({ ...base, spotEthPerToken: '0.000000002', closesEthPerToken: [], purpose: 'payment' });
  assert.ok(r.ok);
  assert.equal(r.deviationPct, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser shims so the demo service can run in Node.
const store = new Map<string, string>();
(globalThis as any).window = { addEventListener() {} };
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

import { DemoPalladiumPaymentService } from '../src/lib/palladium/demo-service';
import { InsufficientBalanceError } from '../src/lib/palladium/types';
import { phpToPalladium, phpToPalladiumMinor, formatPalladium, formatPalladiumMinor, DEMO_PALLADIUM_PRICE_PHP } from '../src/lib/palladium-price';
import { DEMO_TX_PATTERN, DEMO_WALLET_ADDRESS, DEMO_WALLET_PATTERN } from '../src/lib/palladium/config';

test('1/4/5 demo price is PHP 2.00 and token amounts are calculated from the PHP price', () => {
  assert.equal(DEMO_PALLADIUM_PRICE_PHP, 2);
  assert.equal(phpToPalladium(775000), 3875);
  assert.equal(formatPalladium(phpToPalladium(775000)!), '≈ 3,875 PALLADIUM');
  assert.equal(formatPalladium(phpToPalladium(55000)!), '≈ 275 PALLADIUM');
  assert.equal(formatPalladium(phpToPalladium(1000)!), '≈ 5 PALLADIUM');
  assert.equal(formatPalladium(phpToPalladium(40000)!), '≈ 200 PALLADIUM');
  assert.equal(phpToPalladiumMinor(775000), 387500);
  assert.equal(formatPalladiumMinor(387500), '3,875');
  assert.equal(formatPalladiumMinor(1000000), '10,000');
  assert.equal(formatPalladiumMinor(612500), '6,125');
  assert.equal(phpToPalladiumMinor(775000, 4), 193750); // price is a parameter, ready for a live feed
});

test('wallet shape constants', () => {
  assert.equal(DEMO_WALLET_ADDRESS, '0x71C4...8A92');
  assert.match(DEMO_WALLET_ADDRESS, DEMO_WALLET_PATTERN);
});

test('connect, balances, pay, deduct, history, persistence, disconnect/reconnect, reset, insufficient', async () => {
  store.clear();
  const svc = new DemoPalladiumPaymentService();
  let s = svc.getSession();
  assert.equal(s.connected, false);
  assert.equal(s.palladiumMinor, 1_000_000);
  assert.equal(s.eth, 0.5);

  s = await svc.connect('metamask');                                  // 1, 2, 3: simulated, no real MetaMask
  assert.equal(s.connected, true);
  assert.equal(s.address, '0x71C4...8A92');
  assert.equal(s.network, 'Robinhood Chain — DEMO');

  const steps: number[] = [];
  let confirmed: { tx: string; wallet: string } | null = null;
  const r = await svc.pay({ orderNumber: 'PAL-1001', phpCentavos: 775000, label: 'Palladium KORU', confirmOrder: async (tx, wallet) => { confirmed = { tx, wallet }; } }, (i) => steps.push(i));
  assert.deepEqual(steps, [0, 1, 2, 3, 4]);                            // the five steps
  assert.equal(r.previousMinor, 1_000_000);                            // 6, 7: 10,000 - 3,875 = 6,125
  assert.equal(r.paidMinor, 387_500);
  assert.equal(r.newMinor, 612_500);
  assert.match(r.tx.txId, DEMO_TX_PATTERN);                            // 8
  assert.equal(r.tx.status, 'Confirmed');
  assert.equal(r.tx.mode, 'DEMO');
  assert.equal(confirmed!.tx, r.tx.txId);                              // 9: the order is confirmed with the same tx id
  assert.equal(svc.getSession().palladiumMinor, 612_500);
  assert.equal(svc.getHistory().length, 1);                            // 11
  assert.equal(svc.getHistory()[0].orderNumber, 'PAL-1001');

  // 15: a page refresh (new service instance, same localStorage) keeps everything
  const again = new DemoPalladiumPaymentService();
  assert.equal(again.getSession().connected, true);
  assert.equal(again.getSession().palladiumMinor, 612_500);
  assert.equal(again.getHistory().length, 1);

  // multiple purchases
  const r2 = await again.pay({ orderNumber: 'PAL-1002', phpCentavos: 55000, label: 'Cleaner', confirmOrder: async () => {} });
  assert.equal(r2.newMinor, 612_500 - 27_500);
  assert.equal(again.getHistory().length, 2);

  // 13, 14: disconnect and reconnect keep the balance
  again.disconnect();
  assert.equal(again.getSession().connected, false);
  assert.equal(again.getSession().address, null);
  await again.connect('demo');
  assert.equal(again.getSession().connected, true);
  assert.equal(again.getSession().palladiumMinor, 585_000);

  // 12: insufficient balance, nothing deducted, order never confirmed
  let called = false;
  await assert.rejects(
    again.pay({ orderNumber: 'PAL-1003', phpCentavos: 5_000_000, label: 'Big', confirmOrder: async () => { called = true; } }),
    (e: unknown) => e instanceof InsufficientBalanceError && e.requiredMinor === 2_500_000 && e.availableMinor === 585_000,
  );
  assert.equal(called, false);
  assert.equal(again.getSession().palladiumMinor, 585_000);

  // server failure: nothing deducted
  await assert.rejects(again.pay({ orderNumber: 'PAL-1004', phpCentavos: 10000, label: 'x', confirmOrder: async () => { throw new Error('server said no'); } }), /server said no/);
  assert.equal(again.getSession().palladiumMinor, 585_000);

  again.resetDemo!();
  assert.equal(again.getSession().palladiumMinor, 1_000_000);
  assert.equal(again.getHistory().length, 0);
});

test('corrupt or tampered storage never breaks the demo', () => {
  store.set('pal-demo-wallet-v1', '{not json');
  assert.equal(new DemoPalladiumPaymentService().getSession().palladiumMinor, 1_000_000);
  store.set('pal-demo-wallet-v1', JSON.stringify({ connected: true, walletType: 'x', palladiumMinor: -5, eth: 'a', history: [{ nope: 1 }] }));
  const s = new DemoPalladiumPaymentService();
  assert.equal(s.getSession().palladiumMinor, 1_000_000);
  assert.equal(s.getHistory().length, 0);
});

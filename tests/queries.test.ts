// Runs the raw-SQL query layer against a seeded local PostgreSQL through the psql shim.
// Setup: createdb palladium_seed; apply prisma/migrations/*; TEST_DB=palladium_seed tsx --tsconfig tsconfig.test.json prisma/seed.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { listProducts, listCategories, priceBounds, boughtTogether } from '../src/lib/queries/catalog';
import { listInventory, listLedger } from '../src/lib/inventory';
import { salesSummary, salesSeries, productSales, customerReport, paymentReport, analytics, dailySalesTable } from '../src/lib/queries/reports';
import { listCustomers } from '../src/lib/queries/admin';
import { resolveRange, startOfManilaDay, addDays } from '../src/lib/time';
import { peso } from '../src/lib/money';

process.env.TEST_DB ??= 'palladium_seed';
const r30 = resolveRange('30d');

test('catalog lists demo products with prices, images and stock flags', async () => {
  const all = await listProducts({ pageSize: 48 });
  assert.equal(all.total, 8);
  const koru = all.items.find((p) => p.slug === 'palladium-koru-limited-edition')!;
  assert.equal(koru.price, 450000); assert.equal(koru.variantCount, 2); assert.ok(koru.image); assert.ok(koru.inStock);
  assert.ok(koru.sold > 0, 'sold count comes from orders');
  assert.ok(koru.rating === null || koru.rating >= 1);
});
test('catalog filters and sorts', async () => {
  const asc = await listProducts({ sort: 'price_asc', pageSize: 48 });
  assert.deepEqual(asc.items.map((p) => p.price), [...asc.items.map((p) => p.price)].sort((a, b) => a - b));
  const desc = await listProducts({ sort: 'price_desc', pageSize: 48 });
  assert.equal(desc.items[0].name, 'Palladium Pickleball Net');
  const paddles = await listProducts({ category: 'paddles' });
  assert.equal(paddles.total, 2);
  const cheap = await listProducts({ max: 50000, pageSize: 48 });
  assert.ok(cheap.items.every((p) => p.price <= 50000));
  const s = await listProducts({ q: 'grip' });
  assert.ok(s.items.some((p) => p.name.includes('Grip Tape')));
  const inStock = await listProducts({ availability: 'in', pageSize: 48 }), out = await listProducts({ availability: 'out', pageSize: 48 });
  assert.equal(inStock.total + out.total, 8);
  const pg = await listProducts({ pageSize: 3, page: 3 });
  assert.equal(pg.items.length, 2); assert.equal(pg.pages, 3);
  const lim = await listProducts({ limited: true }); assert.equal(lim.total, 1);
  const best = await listProducts({ sort: 'best', pageSize: 48 }); assert.ok(best.items[0].sold >= best.items[1].sold);
});
test('categories, price bounds and bought-together', async () => {
  const cats = await listCategories(); assert.equal(cats.find((c) => c.slug === 'paddles')!.count, 2);
  const b = await priceBounds(); assert.equal(b.min, 30000); assert.equal(b.max, 650000);
  const p = (await listProducts({ pageSize: 48 })).items.find((x) => x.slug === 'palladium-gen4-pro-x-16')!;
  const t = await boughtTogether(p.id, 3); assert.ok(t.length > 0 && t.every((x) => x.id !== p.id));
});
test('inventory list flags low and out of stock and computes value', async () => {
  const inv = await listInventory({ pageSize: 100 });
  const edge = inv.rows.find((r) => r.sku === 'PAL-EDGE-BLK')!;
  assert.equal(edge.status, 'LOW'); assert.equal(edge.available, 4);
  assert.equal(edge.valueCentavos, 4 * 9000);
  assert.ok(inv.totals.low >= 1);
  assert.equal((await listInventory({ status: 'low', pageSize: 100 })).rows.every((r) => r.status === 'LOW'), true);
  assert.equal((await listInventory({ q: 'PAL-NET' })).rows.length, 1);
  for (const r of inv.rows) assert.equal(r.available, r.onHand - r.reserved);
});
test('ledger history joins product, user and order', async () => {
  const l = await listLedger({ pageSize: 10 });
  assert.equal(l.rows.length, 10); assert.ok(l.total > 100);
  for (const r of l.rows) assert.equal(r.previousOnHand + r.quantity, r.newOnHand);
  const sale = await listLedger({ action: 'SALE', pageSize: 5 });
  assert.ok(sale.rows.every((r) => r.action === 'SALE' && r.orderNumber && r.quantity < 0));
});
test('sales summary math and series agree', async () => {
  const s = await salesSummary(r30);
  assert.equal(s.netCentavos, s.grossCentavos - s.discountsCentavos - s.refundsCentavos);
  assert.equal(s.totalSalesCentavos, s.netCentavos + s.shippingCentavos);
  assert.ok(s.orders > 20 && s.itemsSold >= s.orders);
  assert.equal(s.avgOrderCentavos, Math.round(s.totalSalesCentavos / s.orders));
  const series = await salesSeries(r30);
  assert.equal(series.length, 30);
  assert.equal(series.reduce((a, p) => a + p.orders, 0), s.orders);
  assert.equal(Math.round(series.reduce((a, p) => a + p.salesCentavos, 0)), Math.round(s.totalSalesCentavos));
  const today = resolveRange('today'); const hourly = await salesSeries(today); assert.equal(hourly.length, 24);
  assert.equal(hourly.reduce((a, p) => a + p.orders, 0), (await salesSummary(today)).orders);
  const daily = await dailySalesTable(r30); assert.equal(daily.reduce((a, d) => a + d.orders, 0), s.orders);
});
test('product, customer and payment reports reconcile with the summary', async () => {
  const s = await salesSummary(r30);
  const prods = await productSales(r30, { byVariant: true });
  assert.equal(prods.reduce((a, p) => a + p.units, 0), s.itemsSold);
  assert.equal(Math.round(prods.reduce((a, p) => a + p.grossCentavos, 0)), s.grossCentavos);
  assert.equal(Math.round(prods.reduce((a, p) => a + p.discountsCentavos, 0)), s.discountsCentavos);
  const pay = await paymentReport(r30);
  assert.equal(pay.reduce((a, p) => a + p.orders, 0), s.orders); assert.equal(pay.length, 5);
  assert.equal(Math.round(pay.reduce((a, p) => a + p.salesCentavos, 0)), s.grossCentavos - s.discountsCentavos + s.shippingCentavos);
  const c = await customerReport(r30);
  assert.equal(c.totalCustomers, 12); assert.ok(c.buyers > 0 && c.returningCustomers <= c.buyers);
});
test('analytics bundle', async () => {
  const a = await analytics(r30);
  assert.ok(a.visitors > 0 && a.conversionRate > 0 && a.conversionRate <= 100);
  assert.ok(a.topProducts.length > 0 && a.categories.length > 0 && a.byProvince.length > 0 && a.acquisition.length > 0);
  assert.ok(a.repeatRate >= 0 && a.repeatRate <= 100);
  assert.equal(a.summary.orders, (await salesSummary(r30)).orders);
});
test('customer list aggregates spend and searches by order number', async () => {
  const l = await listCustomers({ sort: 'spent', pageSize: 50 });
  assert.equal(l.total, 12);
  assert.ok(l.rows[0].totalSpentCentavos >= l.rows[1].totalSpentCentavos);
  const c = l.rows.find((x) => x.orders > 0)!;
  assert.equal(Math.round(c.avgOrderCentavos) > 0, true);
  const [o] = JSON.parse(JSON.stringify(await (await import('../src/lib/db')).prisma.$queryRaw<{ n: string }[]>`SELECT "orderNumber" AS n FROM orders WHERE "customerId"=${c.id} LIMIT 1`));
  const found = await listCustomers({ q: o.n }); assert.ok(found.rows.some((x) => x.id === c.id));
  assert.equal((await listCustomers({ q: 'nomatchzzz' })).total, 0);
});
test('time and money helpers use Asia/Manila and pesos', () => {
  const d = new Date('2026-09-30T17:00:00Z'); // 1am Oct 1 in Manila
  assert.equal(startOfManilaDay(d).toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(addDays(startOfManilaDay(d), 1).toISOString(), '2026-10-01T16:00:00.000Z');
  assert.equal(resolveRange('custom', '2026-09-01', '2026-09-30').to.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(peso(565000), '₱5,650'); assert.equal(peso(12345), '₱123.45');
});

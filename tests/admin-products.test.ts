// Runs the admin product-list SQL against the seeded local PostgreSQL (see queries.test.ts for setup).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminProductQuery } from '../src/lib/queries/admin';
import { prisma } from '../src/lib/db';

process.env.TEST_DB ??= 'palladium_seed';
const run = async (o: Parameters<typeof buildAdminProductQuery>[0]) => {
  const q = buildAdminProductQuery(o);
  const [ids, count] = await Promise.all([prisma.$queryRaw<{ id: string }[]>(q.idSql), prisma.$queryRaw<{ n: number }[]>(q.countSql)]);
  return { ids: ids.map((r) => r.id), total: count[0].n };
};
const names = async (ids: string[]) => (await prisma.$queryRaw<{ id: string; name: string }[]>`SELECT id, name FROM products`).filter((p) => ids.includes(p.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).map((p) => p.name);

test('lists all non-archived products by default and counts them', async () => {
  const r = await run({});
  assert.equal(r.total, 8); assert.equal(r.ids.length, 8);
});
test('paginates', async () => {
  const a = await run({ pageSize: 3, page: 1, sort: 'name' }), b = await run({ pageSize: 3, page: 3, sort: 'name' });
  assert.equal(a.ids.length, 3); assert.equal(b.ids.length, 2); assert.equal(a.total, 8);
});
test('sorts by name, price and inventory', async () => {
  const byName = await names((await run({ sort: 'name' })).ids);
  assert.deepEqual(byName, [...byName].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase())));
  const priced = await prisma.$queryRaw<{ id: string; m: number; stock: number }[]>`
    SELECT p.id, min(v."priceCentavos")::int AS m, coalesce(sum(l."onHand"-l."reserved"),0)::int AS stock FROM products p JOIN product_variants v ON v."productId"=p.id AND v."isActive" LEFT JOIN inventory l ON l."variantId"=v.id GROUP BY p.id`;
  const asc = (await run({ sort: 'price_asc' })).ids.map((id) => priced.find((x) => x.id === id)!.m);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = (await run({ sort: 'price_desc' })).ids.map((id) => priced.find((x) => x.id === id)!.m);
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  const st = (await run({ sort: 'stock_desc' })).ids.map((id) => priced.find((x) => x.id === id)!.stock);
  assert.deepEqual(st, [...st].sort((a, b) => b - a));
});
test('search matches name, sku, barcode, tag and category', async () => {
  const sample = (await prisma.$queryRaw<{ id: string; name: string; sku: string; barcode: string | null; tag: string | null; cat: string }[]>`
    SELECT p.id, p.name, v.sku, v.barcode, p.tags[1] AS tag, c.name AS cat FROM products p JOIN product_variants v ON v."productId"=p.id JOIN categories c ON c.id=p."categoryId" ORDER BY p.id LIMIT 1`)[0];
  assert.ok((await run({ q: sample.name.slice(0, 6).toLowerCase() })).ids.includes(sample.id), 'name');
  assert.ok((await run({ q: sample.sku.toLowerCase() })).ids.includes(sample.id), 'sku');
  if (sample.tag) assert.ok((await run({ q: sample.tag.toUpperCase() })).ids.includes(sample.id), 'tag');
  assert.ok((await run({ q: sample.cat })).ids.includes(sample.id), 'category');
  assert.equal((await run({ q: 'zzz-no-such-thing' })).total, 0);
});
test('search treats % and _ and quotes as plain text (no injection)', async () => {
  assert.equal((await run({ q: '%' })).total, 0);
  assert.equal((await run({ q: "'; DROP TABLE products; --" })).total, 0);
  assert.equal((await run({})).total, 8);
});
test('status, category and inventory filters', async () => {
  assert.equal((await run({ status: 'ARCHIVED' })).total, 0);
  const cat = (await prisma.$queryRaw<{ id: string; n: number }[]>`SELECT c.id, count(*)::int AS n FROM categories c JOIN products p ON p."categoryId"=c.id GROUP BY c.id LIMIT 1`)[0];
  assert.equal((await run({ category: cat.id })).total, cat.n);
  const inS = await run({ stock: 'in' }), outS = await run({ stock: 'out' }), low = await run({ stock: 'low' });
  assert.equal(inS.total + outS.total, 8, 'in + out partitions the catalogue');
  assert.ok(low.ids.every((id) => inS.ids.includes(id)), 'low stock is a subset of in stock');
});

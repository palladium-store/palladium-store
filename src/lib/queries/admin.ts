import 'server-only';
import { Prisma } from '@prisma/client';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../db';

// ---------- Orders ----------
export interface OrderFilters { q?: string; status?: string; payment?: string; method?: string; from?: Date; to?: Date; sort?: string; page?: number; pageSize?: number }
export async function listOrders(f: OrderFilters) {
  const page = Math.max(f.page ?? 1, 1), size = Math.min(f.pageSize ?? 20, 100);
  const where: Prisma.OrderWhereInput = {
    ...(f.status ? { status: f.status as OrderStatus } : {}),
    ...(f.payment ? { paymentStatus: f.payment as PaymentStatus } : {}),
    ...(f.method ? { paymentMethod: f.method as PaymentMethod } : {}),
    ...(f.from || f.to ? { placedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    ...(f.q ? { OR: [
      { orderNumber: { contains: f.q.replace(/^#/, ''), mode: 'insensitive' } }, { shipName: { contains: f.q, mode: 'insensitive' } },
      { email: { contains: f.q, mode: 'insensitive' } }, { phone: { contains: f.q.replace(/[\s-]/g, '') } },
    ] } : {}),
  };
  const orderBy: Prisma.OrderOrderByWithRelationInput = f.sort === 'oldest' ? { placedAt: 'asc' } : f.sort === 'total_desc' ? { totalCentavos: 'desc' } : f.sort === 'total_asc' ? { totalCentavos: 'asc' } : { placedAt: 'desc' };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy, skip: (page - 1) * size, take: size, select: { id: true, orderNumber: true, placedAt: true, shipName: true, email: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true, _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  return { rows, total, page, pageSize: size, pages: Math.max(Math.ceil(total / size), 1) };
}

export async function getOrderDetail(id: string) {
  return prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' } }, shipments: { orderBy: { createdAt: 'desc' } }, events: { orderBy: { createdAt: 'asc' } }, customer: { select: { id: true, name: true, email: true, phone: true } }, transactions: { orderBy: { createdAt: 'asc' }, include: { variant: { select: { sku: true } } } } },
  });
}

// ---------- Customers ----------
export interface CustomerRow { id: string; name: string; email: string; phone: string | null; status: string; createdAt: Date; orders: number; totalSpentCentavos: number; avgOrderCentavos: number; lastOrderAt: Date | null; city: string | null; province: string | null }
export async function listCustomers(o: { q?: string; sort?: string; page?: number; pageSize?: number }) {
  const page = Math.max(o.page ?? 1, 1), size = Math.min(o.pageSize ?? 20, 100);
  const q = o.q?.trim();
  const like = q ? `%${q.replace(/^#/, '')}%` : null;
  const search = like ? Prisma.sql`AND (c.name ILIKE ${like} OR c.email ILIKE ${like} OR c.phone ILIKE ${like} OR EXISTS (SELECT 1 FROM orders so WHERE so."customerId"=c.id AND so."orderNumber" ILIKE ${like}))` : Prisma.empty;
  const order = { spent: Prisma.sql`"totalSpentCentavos" DESC`, orders: Prisma.sql`orders DESC`, recent: Prisma.sql`"lastOrderAt" DESC NULLS LAST`, name: Prisma.sql`name ASC`, newest: Prisma.sql`"createdAt" DESC` }[o.sort ?? 'newest'] ?? Prisma.sql`"createdAt" DESC`;
  const base = Prisma.sql`
    SELECT c.id, c.name, c.email, c.phone, c.status, c."createdAt",
      count(o.id) FILTER (WHERE o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED'))::int AS orders,
      COALESCE(sum(o."totalCentavos"-o."refundedCentavos") FILTER (WHERE o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED')),0)::float8 AS "totalSpentCentavos",
      COALESCE(round(avg(o."totalCentavos") FILTER (WHERE o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED'))),0)::float8 AS "avgOrderCentavos",
      max(o."placedAt") AS "lastOrderAt",
      (SELECT a.city FROM addresses a WHERE a."customerId"=c.id ORDER BY a."isDefault" DESC, a."createdAt" LIMIT 1) AS city,
      (SELECT a.province FROM addresses a WHERE a."customerId"=c.id ORDER BY a."isDefault" DESC, a."createdAt" LIMIT 1) AS province
    FROM customers c LEFT JOIN orders o ON o."customerId"=c.id WHERE TRUE ${search} GROUP BY c.id`;
  const [rows, cnt] = await Promise.all([
    prisma.$queryRaw<CustomerRow[]>(Prisma.sql`SELECT * FROM (${base}) t ORDER BY ${order} LIMIT ${size} OFFSET ${(page - 1) * size}`),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM (${base}) t`),
  ]);
  return { rows, total: cnt[0].n, page, pageSize: size, pages: Math.max(Math.ceil(cnt[0].n / size), 1) };
}

export async function getCustomerDetail(id: string) {
  const c = await prisma.customer.findUnique({ where: { id }, include: { addresses: true, orders: { orderBy: { placedAt: 'desc' }, include: { items: true } } } });
  if (!c) return null;
  const counted = c.orders.filter((o) => !['PENDING', 'PAYMENT_PENDING', 'CANCELLED'].includes(o.status));
  const spent = counted.reduce((a, o) => a + o.totalCentavos - o.refundedCentavos, 0);
  const products = new Map<string, { name: string; variant: string; qty: number }>();
  for (const o of counted) for (const i of o.items) { const k = `${i.productName}|${i.variantName}`; const p = products.get(k) ?? { name: i.productName, variant: i.variantName, qty: 0 }; p.qty += i.quantity; products.set(k, p); }
  return { ...c, stats: { orders: counted.length, spentCentavos: spent, avgOrderCentavos: counted.length ? Math.round(spent / counted.length) : 0, lastOrderAt: c.orders[0]?.placedAt ?? null }, products: [...products.values()].sort((a, b) => b.qty - a.qty) };
}

// ---------- Products (admin) ----------
export type AdminProductSort = 'newest' | 'oldest' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc';
export type AdminStockFilter = 'in' | 'low' | 'out';
const SORT_SQL: Record<AdminProductSort, Prisma.Sql> = {
  newest: Prisma.sql`p."createdAt" DESC`, oldest: Prisma.sql`p."createdAt" ASC`, name: Prisma.sql`lower(p.name) ASC`,
  price_asc: Prisma.sql`s.pmin ASC NULLS LAST`, price_desc: Prisma.sql`s.pmin DESC NULLS LAST`,
  stock_asc: Prisma.sql`s.stock ASC`, stock_desc: Prisma.sql`s.stock DESC`,
};
const escLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);

type AdminProductQuery = { q?: string; status?: string; category?: string; stock?: AdminStockFilter; sort?: AdminProductSort; page?: number; pageSize?: number };

/** Builds the SQL for one page of product ids plus the total count. Exported so it can be tested against a real database. */
export function buildAdminProductQuery(o: AdminProductQuery) {
  const page = Math.max(o.page ?? 1, 1), size = Math.min(o.pageSize ?? 20, 100);
  const conds: Prisma.Sql[] = [o.status ? Prisma.sql`p.status = ${o.status}::"ProductStatus"` : Prisma.sql`p.status <> 'ARCHIVED'::"ProductStatus"`];
  if (o.category) conds.push(Prisma.sql`p."categoryId" = ${o.category}`);
  if (o.stock === 'in') conds.push(Prisma.sql`s.stock > 0`);
  if (o.stock === 'out') conds.push(Prisma.sql`s.stock <= 0`);
  if (o.stock === 'low') conds.push(Prisma.sql`s.low`);
  if (o.q) {
    const like = `%${escLike(o.q)}%`;
    conds.push(Prisma.sql`(p.name ILIKE ${like} OR c.name ILIKE ${like}
      OR EXISTS (SELECT 1 FROM unnest(p.tags) AS t WHERE t ILIKE ${like})
      OR EXISTS (SELECT 1 FROM product_variants x WHERE x."productId" = p.id AND (x.sku ILIKE ${like} OR x.barcode ILIKE ${like})))`);
  }
  const from = Prisma.sql`FROM products p JOIN categories c ON c.id = p."categoryId"
    LEFT JOIN LATERAL (
      SELECT min(v."priceCentavos") AS pmin, coalesce(sum(a.avail), 0)::int AS stock, coalesce(bool_or(a.avail > 0 AND a.avail <= v."lowStockThreshold"), false) AS low
      FROM product_variants v
      LEFT JOIN LATERAL (SELECT coalesce(sum(l."onHand" - l."reserved"), 0) AS avail FROM inventory l WHERE l."variantId" = v.id) a ON true
      WHERE v."productId" = p.id AND v."isActive"
    ) s ON true
    WHERE ${Prisma.join(conds, ' AND ')}`;
  const order = SORT_SQL[o.sort ?? 'newest'] ?? SORT_SQL.newest;
  return { page, size, idSql: Prisma.sql`SELECT p.id ${from} ORDER BY ${order}, p.id ASC LIMIT ${size} OFFSET ${(page - 1) * size}`, countSql: Prisma.sql`SELECT count(*)::int AS n ${from}` };
}

/** Filtering, searching and sorting run in SQL so the list stays fast with thousands of products. */
export async function listAdminProducts(o: AdminProductQuery) {
  const { page, size, idSql, countSql } = buildAdminProductQuery(o);
  const [idRows, countRows] = await Promise.all([prisma.$queryRaw<{ id: string }[]>(idSql), prisma.$queryRaw<{ n: number }[]>(countSql)]);
  const total = countRows[0]?.n ?? 0;
  const ids = idRows.map((r) => r.id);
  const found = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, include: { category: { select: { name: true } }, images: { take: 1, orderBy: { position: 'asc' } }, variants: { orderBy: { position: 'asc' }, include: { levels: true } } } }) : [];
  const byId = new Map(found.map((p) => [p.id, p]));
  const rows = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => {
    const live = p.variants.filter((v) => v.isActive);
    const prices = live.map((v) => v.priceCentavos);
    return {
      id: p.id, name: p.name, slug: p.slug, status: p.status, category: p.category.name, image: p.images[0]?.url ?? null, isDemo: p.isDemo, createdAt: p.createdAt,
      variants: live.length, sku: live[0]?.sku ?? '', extraSkus: Math.max(live.length - 1, 0),
      priceMin: prices.length ? Math.min(...prices) : NaN, priceMax: prices.length ? Math.max(...prices) : NaN,
      stock: live.reduce((a, v) => a + v.levels.reduce((b, l) => b + l.onHand - l.reserved, 0), 0),
      low: live.some((v) => { const av = v.levels.reduce((b, l) => b + l.onHand - l.reserved, 0); return av > 0 && av <= v.lowStockThreshold; }),
    };
  });
  return { rows, total, page, pageSize: size, pages: Math.max(Math.ceil(total / size), 1) };
}
export async function getAdminProduct(id: string) {
  return prisma.product.findUnique({ where: { id }, include: { images: { orderBy: { position: 'asc' } }, variants: { orderBy: { position: 'asc' }, include: { levels: true } } } });
}

// ---------- Global search ----------
export async function globalSearch(q: string, perms: { orders: boolean; products: boolean; customers: boolean }) {
  q = q.trim();
  if (q.length < 2) return { products: [], orders: [], customers: [] };
  const like = { contains: q, mode: 'insensitive' as const };
  const [products, orders, customers] = await Promise.all([
    perms.products ? prisma.productVariant.findMany({ where: { OR: [{ sku: like }, { barcode: like }, { product: { name: like } }] }, take: 6, include: { product: { select: { id: true, name: true } } } }) : [],
    perms.orders ? prisma.order.findMany({ where: { OR: [{ orderNumber: { contains: q.replace(/^#/, ''), mode: 'insensitive' } }, { shipName: like }, { email: like }] }, take: 6, orderBy: { placedAt: 'desc' }, select: { id: true, orderNumber: true, shipName: true, totalCentavos: true, status: true } }) : [],
    perms.customers ? prisma.customer.findMany({ where: { OR: [{ name: like }, { email: like }, { phone: { contains: q.replace(/[\s-]/g, '') } }] }, take: 6, select: { id: true, name: true, email: true } }) : [],
  ]);
  return {
    products: products.map((v) => ({ id: v.product.id, title: v.product.name, sub: `${v.name} · ${v.sku}${v.barcode ? ' · ' + v.barcode : ''}`, href: `/admin/products/${v.product.id}` })),
    orders: orders.map((o) => ({ id: o.id, title: `#${o.orderNumber}`, sub: `${o.shipName} · ${o.status}`, href: `/admin/orders/${o.id}` })),
    customers: customers.map((c) => ({ id: c.id, title: c.name, sub: c.email, href: `/admin/customers/${c.id}` })),
  };
}

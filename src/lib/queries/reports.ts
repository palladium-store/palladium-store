import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { addDays, startOfManilaDay, ymdManila, type DateRange } from '../time';

// "Counted" orders are ones the business has accepted: not waiting for payment/confirmation and not cancelled.
// Refunded orders stay counted; their refunds are subtracted in net sales.
// Demo $PALLADIUM payments are simulated, so they never count as sales.
const COUNTED = Prisma.sql`o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED') AND o."paymentMode" IS DISTINCT FROM 'DEMO'`;
const inRange = (r: { from: Date; to: Date }) => Prisma.sql`o."placedAt" >= ${r.from} AND o."placedAt" < ${r.to}`;

export interface SalesSummary {
  grossCentavos: number; discountsCentavos: number; refundsCentavos: number; netCentavos: number; shippingCentavos: number;
  totalSalesCentavos: number; orders: number; avgOrderCentavos: number; itemsSold: number; newCustomers: number;
}
export async function salesSummary(r: { from: Date; to: Date }): Promise<SalesSummary> {
  const [o] = await prisma.$queryRaw<{ gross: number; disc: number; refunds: number; ship: number; orders: number }[]>(Prisma.sql`
    SELECT COALESCE(sum(o."subtotalCentavos"),0)::float8 AS gross, COALESCE(sum(o."discountCentavos"),0)::float8 AS disc, COALESCE(sum(o."refundedCentavos"),0)::float8 AS refunds,
           COALESCE(sum(o."shippingCentavos"),0)::float8 AS ship, count(*)::int AS orders
    FROM orders o WHERE ${COUNTED} AND ${inRange(r)}`);
  const [it] = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COALESCE(sum(oi.quantity),0)::int AS n FROM order_items oi JOIN orders o ON o.id=oi."orderId" WHERE ${COUNTED} AND ${inRange(r)}`);
  const [nc] = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM customers WHERE "createdAt" >= ${r.from} AND "createdAt" < ${r.to}`);
  const net = o.gross - o.disc - o.refunds;
  return { grossCentavos: o.gross, discountsCentavos: o.disc, refundsCentavos: o.refunds, netCentavos: net, shippingCentavos: o.ship, totalSalesCentavos: net + o.ship,
    orders: o.orders, avgOrderCentavos: o.orders ? Math.round((net + o.ship) / o.orders) : 0, itemsSold: it.n, newCustomers: nc.n };
}

export interface SeriesPoint { label: string; key: string; salesCentavos: number; orders: number }
/** Sales over time in Asia/Manila. Hourly for single-day ranges, daily otherwise. Missing buckets are filled with zeros. */
export async function salesSeries(r: { from: Date; to: Date }): Promise<SeriesPoint[]> {
  const hourly = r.to.getTime() - r.from.getTime() <= 86400000;
  const fmt = hourly ? 'HH24' : 'YYYY-MM-DD';
  const rows = await prisma.$queryRaw<{ k: string; sales: number; orders: number }[]>(Prisma.sql`
    SELECT to_char(o."placedAt" AT TIME ZONE 'Asia/Manila', ${fmt}) AS k,
      (sum(o."subtotalCentavos"-o."discountCentavos"-o."refundedCentavos"+o."shippingCentavos"))::float8 AS sales, count(*)::int AS orders
    FROM orders o WHERE ${COUNTED} AND ${inRange(r)} GROUP BY 1`);
  const map = new Map(rows.map((x) => [x.k, x]));
  const out: SeriesPoint[] = [];
  if (hourly) {
    for (let h = 0; h < 24; h++) { const k = String(h).padStart(2, '0'); const x = map.get(k); out.push({ key: k, label: `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`, salesCentavos: x?.sales ?? 0, orders: x?.orders ?? 0 }); }
  } else {
    for (let d = startOfManilaDay(r.from); d < r.to; d = addDays(d, 1)) {
      const k = ymdManila(d); const x = map.get(k);
      out.push({ key: k, label: new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(d), salesCentavos: x?.sales ?? 0, orders: x?.orders ?? 0 });
    }
  }
  return out;
}

export interface ProductSalesRow { productId: string; product: string; variant: string | null; sku: string | null; units: number; grossCentavos: number; discountsCentavos: number; netCentavos: number; returned: number }
export async function productSales(r: { from: Date; to: Date }, opts: { byVariant?: boolean; limit?: number } = {}): Promise<ProductSalesRow[]> {
  const byV = !!opts.byVariant;
  return prisma.$queryRaw<ProductSalesRow[]>(Prisma.sql`
    SELECT COALESCE(pv."productId", oi."productName") AS "productId", oi."productName" AS product,
      ${byV ? Prisma.sql`oi."variantName"` : Prisma.sql`NULL::text`} AS variant, ${byV ? Prisma.sql`oi.sku` : Prisma.sql`NULL::text`} AS sku,
      sum(oi.quantity)::int AS units, sum(oi."unitPriceCentavos"*oi.quantity)::float8 AS "grossCentavos", sum(oi."discountCentavos")::float8 AS "discountsCentavos",
      sum(oi."lineTotalCentavos")::float8 AS "netCentavos", sum(oi."returnedQty")::int AS returned
    FROM order_items oi JOIN orders o ON o.id=oi."orderId" LEFT JOIN product_variants pv ON pv.id=oi."variantId"
    WHERE ${COUNTED} AND ${inRange(r)}
    GROUP BY COALESCE(pv."productId", oi."productName"), oi."productName" ${byV ? Prisma.sql`, oi."variantName", oi.sku` : Prisma.empty}
    ORDER BY "netCentavos" DESC LIMIT ${opts.limit ?? 200}`);
}

export async function customerReport(r: { from: Date; to: Date }) {
  const [x] = await prisma.$queryRaw<{ newc: number; returning: number; total: number; buyers: number }[]>(Prisma.sql`
    SELECT (SELECT count(*)::int FROM customers WHERE "createdAt" >= ${r.from} AND "createdAt" < ${r.to}) AS newc,
      (SELECT count(*)::int FROM (SELECT DISTINCT o."customerId" FROM orders o WHERE ${COUNTED} AND ${inRange(r)}
         AND EXISTS (SELECT 1 FROM orders p WHERE p."customerId"=o."customerId" AND p.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED') AND p."placedAt" < ${r.from})) q) AS returning,
      (SELECT count(*)::int FROM customers) AS total,
      (SELECT count(DISTINCT o."customerId")::int FROM orders o WHERE ${COUNTED} AND ${inRange(r)}) AS buyers`);
  return { newCustomers: x.newc, returningCustomers: x.returning, totalCustomers: x.total, buyers: x.buyers };
}

export interface PaymentRow { method: string; orders: number; salesCentavos: number; refundsCentavos: number; netCentavos: number }
export async function paymentReport(r: { from: Date; to: Date }): Promise<PaymentRow[]> {
  const rows = await prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
    SELECT o."paymentMethod"::text AS method, count(*)::int AS orders, sum(o."totalCentavos")::float8 AS "salesCentavos", sum(o."refundedCentavos")::float8 AS "refundsCentavos",
      sum(o."totalCentavos"-o."refundedCentavos")::float8 AS "netCentavos"
    FROM orders o WHERE ${COUNTED} AND ${inRange(r)} GROUP BY 1`);
  const order = ['QRPH', 'GCASH', 'MAYA', 'CARD', 'BANK_TRANSFER', 'COD'];
  return order.map((m) => rows.find((x) => x.method === m) ?? { method: m, orders: 0, salesCentavos: 0, refundsCentavos: 0, netCentavos: 0 });
}
export const PAYMENT_LABELS: Record<string, string> = { QRPH: 'QR Ph', GCASH: 'GCash', MAYA: 'Maya', CARD: 'Credit/debit card', BANK_TRANSFER: 'Bank transfer', COD: 'Cash on delivery', PALLADIUM: 'PALLADIUM (DEMO)' };

export async function dailySalesTable(r: { from: Date; to: Date }) {
  return prisma.$queryRaw<{ day: string; orders: number; grossCentavos: number; discountsCentavos: number; refundsCentavos: number; shippingCentavos: number; netCentavos: number }[]>(Prisma.sql`
    SELECT to_char(o."placedAt" AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS day, count(*)::int AS orders, sum(o."subtotalCentavos")::float8 AS "grossCentavos",
      sum(o."discountCentavos")::float8 AS "discountsCentavos", sum(o."refundedCentavos")::float8 AS "refundsCentavos", sum(o."shippingCentavos")::float8 AS "shippingCentavos",
      sum(o."subtotalCentavos"-o."discountCentavos"-o."refundedCentavos")::float8 AS "netCentavos"
    FROM orders o WHERE ${COUNTED} AND ${inRange(r)} GROUP BY 1 ORDER BY 1`);
}

export async function dashboard() {
  const today = startOfManilaDay();
  const range = { from: today, to: addDays(today, 1) };
  const [summary, pending, lowStock, top, recent] = await Promise.all([
    salesSummary(range),
    prisma.order.count({ where: { status: { in: ['PENDING', 'PAYMENT_PENDING'] } } }),
    prisma.$queryRaw<{ variantId: string; product: string; variant: string; sku: string; available: number; threshold: number }[]>`
      SELECT v.id AS "variantId", p.name AS product, v.name AS variant, v.sku, (COALESCE(i."onHand",0)-COALESCE(i.reserved,0))::int AS available, v."lowStockThreshold" AS threshold
      FROM product_variants v JOIN products p ON p.id=v."productId" LEFT JOIN inventory i ON i."variantId"=v.id AND i."locationId"=(SELECT id FROM locations WHERE "isDefault" LIMIT 1)
      WHERE v."isActive" AND p.status IN ('ACTIVE','SOLD_OUT') AND COALESCE(i."onHand",0)-COALESCE(i.reserved,0) <= v."lowStockThreshold" ORDER BY available ASC, p.name LIMIT 8`,
    productSales({ from: addDays(today, -29), to: addDays(today, 1) }, { limit: 5 }),
    prisma.order.findMany({ orderBy: { placedAt: 'desc' }, take: 6, select: { id: true, orderNumber: true, shipName: true, totalCentavos: true, status: true, paymentStatus: true, placedAt: true } }),
  ]);
  return { summary, pending, lowStock, top, recent };
}

export interface Analytics {
  summary: SalesSummary; previous: SalesSummary; series: SeriesPoint[];
  visitors: number; conversionRate: number; repeatRate: number; repeatCustomers: number; buyers: number;
  topProducts: ProductSalesRow[]; categories: { category: string; units: number; netCentavos: number }[];
  acquisition: { source: string; customers: number }[]; byProvince: { province: string; orders: number; salesCentavos: number }[]; byCity: { city: string; orders: number; salesCentavos: number }[];
}
export async function analytics(r: DateRange): Promise<Analytics> {
  const span = r.to.getTime() - r.from.getTime();
  const prev = { from: new Date(r.from.getTime() - span), to: r.from };
  const [summary, previous, series, topProducts, vis, categories, acquisition, byProvince, byCity, repeat] = await Promise.all([
    salesSummary(r), salesSummary(prev), salesSeries(r), productSales(r, { limit: 8 }),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(DISTINCT "sessionId")::int AS n FROM site_visits WHERE "createdAt" >= ${r.from} AND "createdAt" < ${r.to}`),
    prisma.$queryRaw<{ category: string; units: number; netCentavos: number }[]>(Prisma.sql`
      SELECT c.name AS category, sum(oi.quantity)::int AS units, sum(oi."lineTotalCentavos")::float8 AS "netCentavos"
      FROM order_items oi JOIN orders o ON o.id=oi."orderId" JOIN product_variants pv ON pv.id=oi."variantId" JOIN products p ON p.id=pv."productId" JOIN categories c ON c.id=p."categoryId"
      WHERE ${COUNTED} AND ${inRange(r)} GROUP BY c.name ORDER BY "netCentavos" DESC`),
    prisma.$queryRaw<{ source: string; customers: number }[]>(Prisma.sql`SELECT COALESCE(NULLIF(source,''),'direct') AS source, count(*)::int AS customers FROM customers WHERE "createdAt" >= ${r.from} AND "createdAt" < ${r.to} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
    prisma.$queryRaw<{ province: string; orders: number; salesCentavos: number }[]>(Prisma.sql`SELECT o."shipProvince" AS province, count(*)::int AS orders, sum(o."totalCentavos"-o."refundedCentavos")::float8 AS "salesCentavos" FROM orders o WHERE ${COUNTED} AND ${inRange(r)} GROUP BY 1 ORDER BY 3 DESC LIMIT 10`),
    prisma.$queryRaw<{ city: string; orders: number; salesCentavos: number }[]>(Prisma.sql`SELECT o."shipCity" AS city, count(*)::int AS orders, sum(o."totalCentavos"-o."refundedCentavos")::float8 AS "salesCentavos" FROM orders o WHERE ${COUNTED} AND ${inRange(r)} GROUP BY 1 ORDER BY 3 DESC LIMIT 10`),
    prisma.$queryRaw<{ buyers: number; repeat: number }[]>(Prisma.sql`
      SELECT count(*)::int AS buyers, count(*) FILTER (WHERE n >= 2)::int AS repeat FROM (SELECT o."customerId", count(*) AS n FROM orders o WHERE ${COUNTED} GROUP BY 1) t`),
  ]);
  const visitors = vis[0].n;
  return { summary, previous, series, visitors, conversionRate: visitors ? Math.min((summary.orders / visitors) * 100, 100) : 0,
    repeatCustomers: repeat[0].repeat, buyers: repeat[0].buyers, repeatRate: repeat[0].buyers ? (repeat[0].repeat / repeat[0].buyers) * 100 : 0,
    topProducts, categories, acquisition, byProvince, byCity };
}

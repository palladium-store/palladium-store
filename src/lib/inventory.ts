import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { audit } from './audit';
import { AppError } from './errors';
import type { SessionUser } from './auth';

export type InvAction = 'RECEIVE' | 'ADD' | 'REMOVE' | 'ADJUST' | 'DAMAGED' | 'RETURNED';

export async function defaultLocationId(): Promise<string> {
  const l = await prisma.location.findFirst({ where: { isDefault: true, isActive: true } });
  if (!l) throw new AppError(500, 'NO_LOCATION', 'No default stock location is configured.');
  return l.id;
}

export async function adjustStock(user: SessionUser, a: { variantId: string; locationId?: string; action: InvAction; quantity: number; reason?: string }) {
  const loc = a.locationId ?? (await defaultLocationId());
  const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: a.variantId }, include: { product: { select: { name: true } } } });
  if (a.action === 'ADJUST' ? a.quantity < 0 : a.quantity < 1) throw new AppError(422, 'INVALID_QUANTITY', a.action === 'ADJUST' ? 'Counted quantity cannot be negative.' : 'Quantity must be at least 1.', { quantity: 'Enter a valid quantity.' });
  await prisma.$executeRaw`SELECT pal_adjust_inventory(${a.variantId}::text, ${loc}::text, ${a.action}::"InventoryAction", ${a.quantity}::int, ${a.reason ?? null}::text, ${user.id}::text)`;
  const lvl = await prisma.inventoryLevel.findUnique({ where: { variantId_locationId: { variantId: a.variantId, locationId: loc } } });
  const sign = ['REMOVE', 'DAMAGED'].includes(a.action) ? '-' : a.action === 'ADJUST' ? '=' : '+';
  await audit(user, `INVENTORY_${a.action}`, 'Inventory', a.variantId, `${v.product.name} (${v.sku}) ${sign}${a.quantity} units (${a.action.toLowerCase()})`, { reason: a.reason ?? null, onHand: lvl?.onHand ?? 0 });
  return { onHand: lvl?.onHand ?? 0, reserved: lvl?.reserved ?? 0 };
}

export async function transferStock(user: SessionUser, a: { variantId: string; fromLocationId: string; toLocationId: string; quantity: number; reason?: string }) {
  const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: a.variantId }, include: { product: { select: { name: true } } } });
  await prisma.$executeRaw`SELECT pal_transfer_inventory(${a.variantId}::text, ${a.fromLocationId}::text, ${a.toLocationId}::text, ${a.quantity}::int, ${a.reason ?? null}::text, ${user.id}::text)`;
  await audit(user, 'INVENTORY_TRANSFER', 'Inventory', a.variantId, `${v.product.name} (${v.sku}) transferred ${a.quantity} units`, { from: a.fromLocationId, to: a.toLocationId });
}

export async function setOversell(user: SessionUser, allow: boolean) {
  await prisma.inventoryLevel.updateMany({ data: { allowOversell: allow } });
  await prisma.setting.upsert({ where: { key: 'inventory' }, create: { key: 'inventory', value: { allowOversell: allow } }, update: { value: { allowOversell: allow } } });
  await audit(user, 'INVENTORY_OVERSELL', 'Settings', 'inventory', `Overselling ${allow ? 'enabled' : 'disabled'}`);
}

export interface InventoryRow {
  variantId: string; locationId: string; location: string; productId: string; product: string; variant: string; sku: string; barcode: string | null;
  onHand: number; reserved: number; available: number; threshold: number; unitsSold: number; unitsReceived: number;
  costCentavos: number; valueCentavos: number; status: 'OUT' | 'LOW' | 'OK';
}
export async function listInventory(opts: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(opts.page ?? 1, 1), size = opts.pageSize ?? 25;
  const q = opts.q?.trim();
  const rows = await prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
    SELECT v.id AS "variantId", l.id AS "locationId", l.name AS location, p.id AS "productId", p.name AS product, v.name AS variant, v.sku, v.barcode,
      COALESCE(i."onHand",0)::int AS "onHand", COALESCE(i.reserved,0)::int AS reserved, (COALESCE(i."onHand",0)-COALESCE(i.reserved,0))::int AS available,
      v."lowStockThreshold" AS threshold, COALESCE(i."unitsSold",0)::int AS "unitsSold", COALESCE(i."unitsReceived",0)::int AS "unitsReceived",
      v."costCentavos" AS "costCentavos", (COALESCE(i."onHand",0)*v."costCentavos")::int AS "valueCentavos",
      CASE WHEN COALESCE(i."onHand",0)-COALESCE(i.reserved,0) <= 0 THEN 'OUT' WHEN COALESCE(i."onHand",0)-COALESCE(i.reserved,0) <= v."lowStockThreshold" THEN 'LOW' ELSE 'OK' END AS status
    FROM product_variants v JOIN products p ON p.id=v."productId" CROSS JOIN locations l
    LEFT JOIN inventory i ON i."variantId"=v.id AND i."locationId"=l.id
    WHERE l."isActive" AND p.status <> 'ARCHIVED'
      ${q ? Prisma.sql`AND (p.name ILIKE ${'%' + q + '%'} OR v.sku ILIKE ${'%' + q + '%'} OR v.barcode ILIKE ${'%' + q + '%'} OR v.name ILIKE ${'%' + q + '%'})` : Prisma.empty}
    ORDER BY p.name, v.position, l."isDefault" DESC`);
  const filtered = opts.status === 'low' ? rows.filter((r) => r.status === 'LOW') : opts.status === 'out' ? rows.filter((r) => r.status === 'OUT') : rows;
  return { rows: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, pageSize: size,
    totals: { units: rows.reduce((a, r) => a + r.onHand, 0), valueCentavos: rows.reduce((a, r) => a + r.valueCentavos, 0), low: rows.filter((r) => r.status === 'LOW').length, out: rows.filter((r) => r.status === 'OUT').length } };
}

export interface LedgerRow { id: string; createdAt: Date; product: string; variant: string; sku: string; action: string; quantity: number; reservedDelta: number; previousOnHand: number; newOnHand: number; reason: string | null; user: string | null; orderNumber: string | null; location: string }
export async function listLedger(opts: { variantId?: string; action?: string; page?: number; pageSize?: number }) {
  const page = Math.max(opts.page ?? 1, 1), size = opts.pageSize ?? 30;
  const where = Prisma.sql`WHERE TRUE ${opts.variantId ? Prisma.sql`AND t."variantId"=${opts.variantId}` : Prisma.empty} ${opts.action ? Prisma.sql`AND t.action=${opts.action}::"InventoryAction"` : Prisma.empty}`;
  const rows = await prisma.$queryRaw<LedgerRow[]>(Prisma.sql`
    SELECT t.id, t."createdAt", p.name AS product, v.name AS variant, v.sku, t.action::text AS action, t.quantity, t."reservedDelta", t."previousOnHand", t."newOnHand", t.reason,
      u.name AS "user", o."orderNumber", l.name AS location
    FROM inventory_transactions t JOIN product_variants v ON v.id=t."variantId" JOIN products p ON p.id=v."productId" JOIN locations l ON l.id=t."locationId"
    LEFT JOIN users u ON u.id=t."userId" LEFT JOIN orders o ON o.id=t."orderId" ${where}
    ORDER BY t."createdAt" DESC, t.id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`);
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM inventory_transactions t ${where}`);
  return { rows, total: n, page, pageSize: size };
}

import 'server-only';
import { prisma } from './db';
import { quoteShipping, loadZone } from './shipping';

export interface PricedLine {
  variantId: string; qty: number; productId: string; productName: string; variantName: string; slug: string; sku: string;
  imageUrl: string | null; unitPriceCentavos: number; compareAtCentavos: number | null; lineTotalCentavos: number;
  available: number; problem: string | null;
}
export interface CartQuote {
  lines: PricedLine[]; subtotalCentavos: number; discountCentavos: number; discountCode: string | null; discountError: string | null;
  shippingCentavos: number | null; shippingZone: string | null; shippingError: string | null; totalCentavos: number; ok: boolean; weightGrams: number;
}

/** Live cart pricing shown to the customer. The order itself is priced again inside pal_place_order (authoritative). */
export async function priceCart(items: { variantId: string; qty: number }[], discountCode?: string | null, province?: string | null, customerId?: string | null): Promise<CartQuote> {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.qty);
  const ids = [...merged.keys()];
  const zoneLoad = province && ids.length ? loadZone(province) : undefined;
  zoneLoad?.catch(() => {});
  const variants = ids.length ? await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } }, levels: { where: { location: { isDefault: true } } } },
  }) : [];
  const lines: PricedLine[] = [];
  let weight = 0;
  for (const [variantId, qty] of merged) {
    const v = variants.find((x) => x.id === variantId);
    if (!v) { lines.push({ variantId, qty, productId: '', productName: 'Unavailable item', variantName: '', slug: '', sku: '', imageUrl: null, unitPriceCentavos: 0, compareAtCentavos: null, lineTotalCentavos: 0, available: 0, problem: 'This item is no longer available.' }); continue; }
    const lvl = v.levels[0];
    const available = lvl ? (lvl.allowOversell ? 9999 : Math.max(lvl.onHand - lvl.reserved, 0)) : 0;
    let problem: string | null = null;
    if (!v.isActive || v.product.status !== 'ACTIVE') problem = 'This item is no longer available.';
    else if (available < qty) problem = available === 0 ? 'Sold out.' : `Only ${available} left.`;
    weight += (v.product.weightGrams ?? 0) * qty;
    lines.push({ variantId, qty, productId: v.productId, productName: v.product.name, variantName: v.name, slug: v.product.slug, sku: v.sku,
      imageUrl: v.imageUrl ?? v.product.images[0]?.url ?? null, unitPriceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos,
      lineTotalCentavos: v.priceCentavos * qty, available, problem });
  }
  const subtotal = lines.reduce((a, l) => a + l.lineTotalCentavos, 0);

  let discount = 0, discountError: string | null = null;
  const code = discountCode?.trim().toUpperCase() || null;
  if (code) {
    const d = await prisma.discount.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
    const now = new Date();
    if (!d || !d.isActive) discountError = 'That code is not valid.';
    else if ((d.startsAt && d.startsAt > now) || (d.endsAt && d.endsAt < now)) discountError = 'That code is not active right now.';
    else if (d.usageLimit != null && d.timesUsed >= d.usageLimit) discountError = 'That code has reached its usage limit.';
    else if (subtotal < d.minOrderCentavos) discountError = `Spend at least ₱${(d.minOrderCentavos / 100).toLocaleString('en-PH')} to use this code.`;
    else {
      if (d.perCustomerLimit != null && customerId) {
        const used = await prisma.discountUsage.count({ where: { discountId: d.id, customerId } });
        if (used >= d.perCustomerLimit) discountError = 'You have already used this code.';
      }
      if (!discountError) {
        const restricted = d.productIds.length > 0 || d.categoryIds.length > 0;
        const cats = restricted ? await prisma.product.findMany({ where: { id: { in: lines.map((l) => l.productId).filter(Boolean) } }, select: { id: true, categoryId: true } }) : [];
        const catOf = new Map(cats.map((c) => [c.id, c.categoryId]));
        const eligible = lines.filter((l) => !restricted || d.productIds.includes(l.productId) || d.categoryIds.includes(catOf.get(l.productId) ?? ''))
          .reduce((a, l) => a + l.lineTotalCentavos, 0);
        if (eligible === 0) discountError = 'That code does not apply to the items in your cart.';
        else {
          discount = d.type === 'PERCENTAGE' ? Math.floor((eligible * d.value) / 100) : Math.min(d.value, eligible);
          if (d.maxDiscountCentavos != null) discount = Math.min(discount, d.maxDiscountCentavos);
        }
      }
    }
  }

  let shippingCentavos: number | null = null, shippingZone: string | null = null, shippingError: string | null = null;
  if (province && lines.length) {
    try { const q = await quoteShipping(province, weight, subtotal - discount, zoneLoad); shippingCentavos = q.feeCentavos; shippingZone = q.zone; }
    catch (e) { shippingError = (e as Error).message; }
  }
  const total = subtotal - discount + (shippingCentavos ?? 0);
  return { lines, subtotalCentavos: subtotal, discountCentavos: discount, discountCode: discountError ? null : code, discountError, shippingCentavos, shippingZone, shippingError, totalCentavos: total, weightGrams: weight,
    ok: lines.length > 0 && lines.every((l) => !l.problem) };
}

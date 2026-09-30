import 'server-only';
import { z } from 'zod';
import { prisma } from './db';
import { AppError } from './errors';
import { audit } from './audit';
import { productSchema } from './validators';
import type { SessionUser } from './auth';
import type { Prisma } from '@prisma/client';

export type ProductInput = z.infer<typeof productSchema>;
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'product';

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base, n = 1;
  while (await prisma.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) slug = `${base}-${++n}`;
  return slug;
}
const productData = (p: ProductInput) => ({
  name: p.name, categoryId: p.categoryId, shortDescription: p.shortDescription ?? null, description: p.description ?? null,
  specs: (p.specs ?? undefined) as Prisma.InputJsonValue | undefined, tags: p.tags, status: p.status, isFeatured: p.isFeatured, isLimited: p.isLimited,
  weightGrams: p.weightGrams ?? null, lengthMm: p.lengthMm ?? null, widthMm: p.widthMm ?? null, heightMm: p.heightMm ?? null, shippingInfo: p.shippingInfo ?? null,
  seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null, ogImageUrl: p.ogImageUrl ?? p.images.find((i) => i.kind === 'image')?.url ?? null,
});

export async function createProduct(user: SessionUser, p: ProductInput) {
  const slug = await uniqueSlug(p.slug ?? slugify(p.name));
  const loc = await prisma.location.findFirst({ where: { isDefault: true } });
  const created = await prisma.product.create({
    data: { ...productData(p), slug, publishedAt: p.status === 'ACTIVE' ? new Date() : null,
      images: { create: p.images.map((i, idx) => ({ url: i.url, alt: i.alt ?? p.name, kind: i.kind, position: idx })) },
      variants: { create: p.variants.map((v, idx) => ({ name: v.name, sku: v.sku, barcode: v.barcode, priceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos ?? null, costCentavos: v.costCentavos, lowStockThreshold: v.lowStockThreshold, imageUrl: v.imageUrl ?? null, isActive: v.isActive, position: idx })) } },
    include: { variants: true },
  });
  for (const v of p.variants) {
    if (v.initialStock && loc) {
      const row = created.variants.find((x) => x.sku === v.sku)!;
      await prisma.$executeRaw`SELECT pal_adjust_inventory(${row.id}::text, ${loc.id}::text, 'INITIAL'::"InventoryAction", ${v.initialStock}::int, ${'Initial stock'}::text, ${user.id}::text)`;
    }
  }
  await audit(user, 'PRODUCT_CREATED', 'Product', created.id, `Created product ${created.name}`);
  return created;
}

export async function updateProduct(user: SessionUser, id: string, p: ProductInput) {
  const existing = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
  const slug = p.slug && p.slug !== existing.slug ? await uniqueSlug(p.slug, id) : existing.slug;
  const keepIds = p.variants.map((v) => v.id).filter(Boolean) as string[];
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { ...productData(p), slug, publishedAt: existing.publishedAt ?? (p.status === 'ACTIVE' ? new Date() : null) } });
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productImage.createMany({ data: p.images.map((i, idx) => ({ productId: id, url: i.url, alt: i.alt ?? p.name, kind: i.kind, position: idx })) });
    // Variants missing from the form are deactivated, never deleted: inventory history and past orders reference them.
    await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: keepIds } }, data: { isActive: false } });
    for (const [idx, v] of p.variants.entries()) {
      const data = { name: v.name, sku: v.sku, barcode: v.barcode, priceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos ?? null, costCentavos: v.costCentavos, lowStockThreshold: v.lowStockThreshold, imageUrl: v.imageUrl ?? null, isActive: v.isActive, position: idx };
      if (v.id && existing.variants.some((x) => x.id === v.id)) await tx.productVariant.update({ where: { id: v.id }, data });
      else await tx.productVariant.create({ data: { ...data, productId: id } });
    }
  });
  // stock for newly added variants
  const loc = await prisma.location.findFirst({ where: { isDefault: true } });
  for (const v of p.variants.filter((x) => !x.id && x.initialStock)) {
    const row = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
    if (row && loc) await prisma.$executeRaw`SELECT pal_adjust_inventory(${row.id}::text, ${loc.id}::text, 'INITIAL'::"InventoryAction", ${v.initialStock!}::int, ${'Initial stock'}::text, ${user.id}::text)`;
  }
  await audit(user, 'PRODUCT_UPDATED', 'Product', id, `Updated product ${p.name}`);
}

export async function setProductStatus(user: SessionUser, id: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'SOLD_OUT') {
  const p = await prisma.product.update({ where: { id }, data: { status } });
  await audit(user, `PRODUCT_${status}`, 'Product', id, `Set ${p.name} to ${status.toLowerCase()}`);
}

export async function duplicateProduct(user: SessionUser, id: string) {
  const src = await prisma.product.findUniqueOrThrow({ where: { id }, include: { images: true, variants: true } });
  const slug = await uniqueSlug(`${src.slug}-copy`);
  const copy = await prisma.product.create({
    data: { name: `${src.name} (copy)`, slug, categoryId: src.categoryId, shortDescription: src.shortDescription, description: src.description, specs: src.specs ?? undefined, tags: src.tags, status: 'DRAFT',
      weightGrams: src.weightGrams, lengthMm: src.lengthMm, widthMm: src.widthMm, heightMm: src.heightMm, shippingInfo: src.shippingInfo, seoTitle: src.seoTitle, seoDescription: src.seoDescription, ogImageUrl: src.ogImageUrl,
      images: { create: src.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind, position: i.position })) },
      variants: { create: src.variants.map((v) => ({ name: v.name, sku: `${v.sku}-COPY-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, barcode: null, priceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos, costCentavos: v.costCentavos, lowStockThreshold: v.lowStockThreshold, imageUrl: v.imageUrl, position: v.position })) } },
  });
  await audit(user, 'PRODUCT_DUPLICATED', 'Product', copy.id, `Duplicated ${src.name}`);
  return copy;
}

export async function deleteProduct(user: SessionUser, id: string) {
  const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: { select: { id: true } } } });
  const ids = p.variants.map((v) => v.id);
  const [orders, ledger] = await Promise.all([prisma.orderItem.count({ where: { variantId: { in: ids } } }), prisma.inventoryTransaction.count({ where: { variantId: { in: ids } } })]);
  if (orders || ledger) throw new AppError(409, 'HAS_HISTORY', 'This product has order or stock history, so it cannot be deleted. Archive it instead.');
  await prisma.product.delete({ where: { id } });
  await audit(user, 'PRODUCT_DELETED', 'Product', id, `Deleted product ${p.name}`);
}

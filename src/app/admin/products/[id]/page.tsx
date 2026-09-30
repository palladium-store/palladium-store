import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { getAdminProduct } from '@/lib/queries/admin';
import { Badge } from '@/components/ui/bits';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductForm, type ProductInitial } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await guard('MANAGE_PRODUCTS');
  const [p, categories] = await Promise.all([
    getAdminProduct(params.id),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  if (!p) notFound();

  const rawSpecs = p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs) ? (p.specs as Record<string, unknown>) : {};
  const initial: ProductInitial = {
    id: p.id, name: p.name, slug: p.slug, categoryId: p.categoryId, shortDescription: p.shortDescription ?? '', description: p.description ?? '',
    status: p.status, tags: p.tags, isFeatured: p.isFeatured, isLimited: p.isLimited, isDemo: p.isDemo,
    specs: Object.fromEntries(Object.entries(rawSpecs).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
    weightGrams: p.weightGrams, lengthMm: p.lengthMm, widthMm: p.widthMm, heightMm: p.heightMm,
    shippingInfo: p.shippingInfo ?? '', seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '', ogImageUrl: p.ogImageUrl ?? '',
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? '', kind: i.kind === 'video' ? 'video' : 'image' })),
    variants: p.variants.map((v) => ({
      id: v.id, name: v.name, sku: v.sku, barcode: v.barcode ?? '', priceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos, costCentavos: v.costCentavos,
      lowStockThreshold: v.lowStockThreshold, imageUrl: v.imageUrl ?? '', isActive: v.isActive,
      onHand: v.levels.reduce((a, l) => a + l.onHand, 0), reserved: v.levels.reduce((a, l) => a + l.reserved, 0),
    })),
  };
  return (
    <div>
      <PageHeader title={p.name} subtitle={`/products/${p.slug}`}
        actions={<><Badge status={p.status} />{p.status === 'ACTIVE' && <Link href={`/products/${p.slug}`} target="_blank" className="btn-outline btn-sm">View in store</Link>}<Link href="/admin/products" className="btn-ghost btn-sm">Back to products</Link></>} />
      {/* Remounts with fresh server data after every save so new variants pick up their ids. */}
      <ProductForm key={p.updatedAt.toISOString()} mode="edit" categories={categories} initial={initial} />
    </div>
  );
}

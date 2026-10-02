import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductOrderManager } from '@/components/admin/ProductOrderManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Arrange products' };

export default async function ArrangeProductsPage() {
  await guard('MANAGE_PRODUCTS');
  const products = await prisma.product.findMany({
    where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, status: true, images: { where: { kind: 'image' }, orderBy: { position: 'asc' }, take: 1, select: { url: true } }, category: { select: { name: true } } },
  });
  return (
    <div>
      <PageHeader title="Arrange products" subtitle="Drag products into the order you want customers to see them in the shop and on the homepage."
        actions={<Link href="/admin/products" className="btn-outline btn-sm">Back to products</Link>} />
      <ProductOrderManager initial={products.map((p) => ({ id: p.id, name: p.name, category: p.category.name, status: p.status, image: p.images[0]?.url ?? null }))} />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  await guard('MANAGE_PRODUCTS');
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title="Add product" subtitle="Create a product with its variants, media and pricing." actions={<Link href="/admin/products" className="btn-ghost btn-sm">Back to products</Link>} />
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}

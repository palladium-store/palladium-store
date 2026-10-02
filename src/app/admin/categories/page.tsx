import type { Metadata } from 'next';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { CategoryManager, type CategoryRow } from '@/components/admin/CategoryManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  await guard('MANAGE_PRODUCTS');
  const cats = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true } } } });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const rows: CategoryRow[] = cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, parentName: c.parentId ? byId.get(c.parentId)?.name ?? '' : '', sortOrder: c.sortOrder, products: c._count.products, children: cats.filter((x) => x.parentId === c.id).length }));
  return (
    <div>
      <PageHeader title="Categories" subtitle="Group your products. Customers browse the store by these categories." />
      <CategoryManager rows={rows} />
    </div>
  );
}

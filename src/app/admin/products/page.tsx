import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { listAdminProducts, type AdminProductSort, type AdminStockFilter } from '@/lib/queries/admin';
import { fmtDateTime } from '@/lib/time';
import { EmptyState, Pagination } from '@/components/ui/bits';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductsTable } from '@/components/admin/ProductsTable';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Products' };

const STATUSES = [['', 'All except archived'], ['ACTIVE', 'Active'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived'], ['SOLD_OUT', 'Sold out']] as const;

const STOCKS = [['', 'Any inventory'], ['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock']] as const;
const SORTS: [AdminProductSort, string][] = [['order', 'Shop order'], ['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A-Z'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['stock_asc', 'Inventory: low to high'], ['stock_desc', 'Inventory: high to low']];

export default async function ProductsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await guard('MANAGE_PRODUCTS');
  const q = searchParams.q?.trim() || undefined;
  const status = STATUSES.some(([v]) => v && v === searchParams.status) ? searchParams.status : undefined;
  const category = searchParams.category || undefined;
  const stock = STOCKS.some(([v]) => v && v === searchParams.stock) ? (searchParams.stock as AdminStockFilter) : undefined;
  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as AdminProductSort) : 'order';
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const [data, categories] = await Promise.all([
    listAdminProducts({ q, status, category, stock, sort, page, pageSize: 20 }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  const filtered = !!(q || status || category || stock);

  return (
    <div>
      <PageHeader title="Products" subtitle="Manage the catalogue, variants, pricing and publishing status."
        actions={<><Link href="/admin/products/order" className="btn-outline btn-sm">Arrange order</Link><Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link></>} />

      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="sm:col-span-2 lg:col-span-1"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={q ?? ''} placeholder="Name, SKU, barcode, tag or category" className="input" /></div>
        <div><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className="input">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category ?? ''} className="input"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="stock">Inventory</label>
          <select id="stock" name="stock" defaultValue={stock ?? ''} className="input">{STOCKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="sort">Sort by</label>
          <select id="sort" name="sort" defaultValue={sort} className="input">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="flex gap-2"><button className="btn-primary btn-sm">Apply</button>{(filtered || sort !== 'newest') && <Link href="/admin/products" className="btn-ghost btn-sm">Clear</Link>}</div>
      </form>

      {data.rows.length === 0 ? (
        <EmptyState title={filtered ? 'No products match your filters' : 'No products yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Add your first product to start selling.'}
          action={<Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link>} />
      ) : (
        <ProductsTable categories={categories} canReorder={sort === 'order' && !filtered && data.pages === 1} rows={data.rows.map((p) => ({
          id: p.id, name: p.name, slug: p.slug, status: p.status, category: p.category, image: p.image, isDemo: p.isDemo, addedLabel: fmtDateTime(p.createdAt),
          variants: p.variants, sku: p.sku, extraSkus: p.extraSkus, priceMin: Number.isFinite(p.priceMin) ? p.priceMin : null, priceMax: Number.isFinite(p.priceMax) ? p.priceMax : null, stock: p.stock, low: p.low,
        }))} />
      )}
      <Pagination page={data.page} pages={data.pages} total={data.total} base="/admin/products" params={{ q, status, category, stock, sort: sort === 'order' ? undefined : sort }} />
    </div>
  );
}

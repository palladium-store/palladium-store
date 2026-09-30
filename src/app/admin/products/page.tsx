import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { listAdminProducts } from '@/lib/queries/admin';
import { peso } from '@/lib/money';
import { Badge, EmptyState, Pagination } from '@/components/ui/bits';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductRowActions } from '@/components/admin/ProductRowActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Products' };

const STATUSES = [['', 'All except archived'], ['ACTIVE', 'Active'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived'], ['SOLD_OUT', 'Sold out']] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await guard('MANAGE_PRODUCTS');
  const q = searchParams.q?.trim() || undefined;
  const status = STATUSES.some(([v]) => v && v === searchParams.status) ? searchParams.status : undefined;
  const category = searchParams.category || undefined;
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const [data, categories] = await Promise.all([
    listAdminProducts({ q, status, category, page, pageSize: 20 }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  const filtered = !!(q || status || category);

  return (
    <div>
      <PageHeader title="Products" subtitle="Manage the catalogue, variants, pricing and publishing status."
        actions={<Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link>} />

      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={q ?? ''} placeholder="Name, SKU or barcode" className="input" /></div>
        <div><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className="input">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category ?? ''} className="input"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button>{filtered && <Link href="/admin/products" className="btn-ghost btn-sm">Clear</Link>}</div>
      </form>

      {data.rows.length === 0 ? (
        <EmptyState title={filtered ? 'No products match your filters' : 'No products yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Add your first product to start selling.'}
          action={<Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="tbl min-w-[900px]">
            <thead><tr><th className="w-16"></th><th>Product</th><th>Status</th><th>Category</th><th className="text-right">Variants</th><th className="text-right">Price</th><th className="text-right">Available</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {data.rows.map((p) => {
                const hasPrice = Number.isFinite(p.priceMin);
                return (
                  <tr key={p.id}>
                    <td>{p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="h-12 w-12 border border-line bg-bone object-cover" /> : <div className="h-12 w-12 border border-line bg-bone" />}</td>
                    <td className="max-w-[280px]">
                      <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-gold-deep">{p.name}</Link>
                      {p.isDemo && <span className="ml-2 inline-block bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-deep">Demo</span>}
                      <div className="text-xs text-mute">/products/{p.slug}</div>
                    </td>
                    <td><Badge status={p.status} /></td>
                    <td>{p.category}</td>
                    <td className="text-right tabular-nums">{p.variants}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{!hasPrice ? '-' : p.priceMin === p.priceMax ? peso(p.priceMin) : `${peso(p.priceMin)} - ${peso(p.priceMax)}`}</td>
                    <td className={`text-right tabular-nums ${p.stock <= 0 ? 'font-semibold text-red-600' : ''}`}>{p.stock}</td>
                    <td className="text-right"><ProductRowActions id={p.id} name={p.name} status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page} pages={data.pages} total={data.total} base="/admin/products" params={{ q, status, category }} />
    </div>
  );
}

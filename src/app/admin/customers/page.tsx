import Link from 'next/link';
import { guard } from '@/lib/guard';
import { listCustomers } from '@/lib/queries/admin';
import { fmtDate } from '@/lib/time';
import { peso } from '@/lib/money';
import { Badge, EmptyState, Pagination } from '@/components/ui/bits';
import { PageHeader, num, one, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers' };

const SORTS: [string, string][] = [['newest', 'Newest'], ['spent', 'Top spenders'], ['orders', 'Most orders'], ['recent', 'Recent order'], ['name', 'Name (A-Z)']];

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  await guard('VIEW_CUSTOMERS');
  const q = one(searchParams.q)?.trim();
  const sort = SORTS.some(([k]) => k === one(searchParams.sort)) ? one(searchParams.sort)! : 'newest';
  const page = Math.max(parseInt(one(searchParams.page) ?? '1', 10) || 1, 1);
  const res = await listCustomers({ q, sort, page, pageSize: 20 });
  const params = { q, sort: sort === 'newest' ? undefined : sort };

  return (
    <div>
      <PageHeader title="Customers" subtitle="Everyone who has shopped or signed up." />
      <form method="get" action="/admin/customers" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
        <div><label className="label" htmlFor="c-q">Search</label><input id="c-q" className="input" type="search" name="q" defaultValue={q} placeholder="Name, email, phone or order number" /></div>
        <div><label className="label" htmlFor="c-sort">Sort by</label><select id="c-sort" className="input" name="sort" defaultValue={sort}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="flex items-end gap-2"><button className="btn-primary btn-sm !py-2.5" type="submit">Apply</button>{q && <Link className="btn-ghost btn-sm !py-2.5" href="/admin/customers">Clear</Link>}</div>
      </form>

      {res.rows.length === 0 ? (
        <EmptyState title={q ? 'No customers match your search' : 'No customers yet'} text={q ? 'Check the spelling or try an email, phone or order number.' : 'Customers appear here after they check out or register.'} />
      ) : (
        <div className="table-wrap">
          <table className="tbl min-w-[980px]">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th className="text-right">Orders</th><th className="text-right">Total spent</th><th className="text-right">Avg. order</th><th>Last order</th><th>Customer since</th><th>Status</th></tr></thead>
            <tbody>
              {res.rows.map((c) => (
                <tr key={c.id}>
                  <td><Link className="font-semibold hover:underline" href={`/admin/customers/${c.id}`}>{c.name}</Link></td>
                  <td className="text-mute">{c.email}</td>
                  <td className="whitespace-nowrap text-mute">{c.phone ?? '-'}</td>
                  <td className="whitespace-nowrap text-mute">{[c.city, c.province].filter(Boolean).join(', ') || '-'}</td>
                  <td className="text-right">{num(c.orders)}</td>
                  <td className="whitespace-nowrap text-right font-medium">{peso(c.totalSpentCentavos)}</td>
                  <td className="whitespace-nowrap text-right">{peso(c.avgOrderCentavos)}</td>
                  <td className="whitespace-nowrap text-mute">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : 'Never'}</td>
                  <td className="whitespace-nowrap text-mute">{fmtDate(c.createdAt)}</td>
                  <td><Badge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} base="/admin/customers" params={params} />
    </div>
  );
}

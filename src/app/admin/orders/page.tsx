import Link from 'next/link';
import { guard } from '@/lib/guard';
import { listOrders } from '@/lib/queries/admin';
import { addDays, fmtDateTime, parseManilaDate } from '@/lib/time';
import { peso } from '@/lib/money';
import { PAYMENT_LABELS } from '@/lib/queries/reports';
import { Badge, EmptyState, Pagination, statusLabel } from '@/components/ui/bits';
import { PageHeader, one, orderLabel, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders' };

const STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const PAY_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const METHODS = ['QRPH', 'GCASH', 'MAYA', 'CARD', 'BANK_TRANSFER', 'COD'];
const SORTS: [string, string][] = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['total_desc', 'Total: high to low'], ['total_asc', 'Total: low to high']];
const TABS: [string, string][] = [['', 'All'], ['PENDING', 'Pending'], ['PAID', 'Paid'], ['PROCESSING', 'Processing'], ['PACKED', 'Packed'], ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled'], ['REFUNDED', 'Refunded']];

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await guard('VIEW_ORDERS');
  const q = one(searchParams.q)?.trim();
  const status = STATUSES.includes(one(searchParams.status) ?? '') ? one(searchParams.status) : undefined;
  const payment = PAY_STATUSES.includes(one(searchParams.payment) ?? '') ? one(searchParams.payment) : undefined;
  const method = METHODS.includes(one(searchParams.method) ?? '') ? one(searchParams.method) : undefined;
  const sort = SORTS.some(([k]) => k === one(searchParams.sort)) ? one(searchParams.sort) : 'newest';
  const fromStr = one(searchParams.from), toStr = one(searchParams.to);
  const fromD = fromStr ? parseManilaDate(fromStr) : null;
  const toBase = toStr ? parseManilaDate(toStr) : null;
  const page = Math.max(parseInt(one(searchParams.page) ?? '1', 10) || 1, 1);

  const res = await listOrders({ q, status, payment, method, from: fromD ?? undefined, to: toBase ? addDays(toBase, 1) : undefined, sort, page, pageSize: 20 });

  const params = { q, status, payment, method, from: fromD ? fromStr : undefined, to: toBase ? toStr : undefined, sort: sort === 'newest' ? undefined : sort };
  const tabHref = (s: string) => { const sp = new URLSearchParams(); for (const [k, v] of Object.entries({ ...params, status: s || undefined })) if (v) sp.set(k, v); const qs = sp.toString(); return `/admin/orders${qs ? `?${qs}` : ''}`; };
  const filtered = !!(q || status || payment || method || params.from || params.to);

  return (
    <div>
      <PageHeader title="Orders" subtitle="Search, filter and fulfil customer orders." />

      <nav className="mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Order status">
        {TABS.map(([k, label]) => {
          const on = (status ?? '') === k;
          return <Link key={k || 'all'} href={tabHref(k)} aria-current={on ? 'page' : undefined} className={`whitespace-nowrap border px-3 py-2 text-xs font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>{label}</Link>;
        })}
      </nav>

      <form method="get" action="/admin/orders" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><label className="label" htmlFor="f-q">Search</label><input id="f-q" className="input" type="search" name="q" defaultValue={q} placeholder="Order number, name, email or phone" /></div>
        <div><label className="label" htmlFor="f-status">Order status</label>
          <select id="f-status" className="input" name="status" defaultValue={status ?? ''}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></div>
        <div><label className="label" htmlFor="f-pay">Payment status</label>
          <select id="f-pay" className="input" name="payment" defaultValue={payment ?? ''}><option value="">All payment statuses</option>{PAY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></div>
        <div><label className="label" htmlFor="f-method">Payment method</label>
          <select id="f-method" className="input" name="method" defaultValue={method ?? ''}><option value="">All methods</option>{METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}</select></div>
        <div><label className="label" htmlFor="f-from">From</label><input id="f-from" className="input" type="date" name="from" defaultValue={params.from} /></div>
        <div><label className="label" htmlFor="f-to">To</label><input id="f-to" className="input" type="date" name="to" defaultValue={params.to} /></div>
        <div><label className="label" htmlFor="f-sort">Sort by</label>
          <select id="f-sort" className="input" name="sort" defaultValue={sort}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary btn-sm !py-2.5" type="submit">Apply filters</button>
          {filtered && <Link className="btn-ghost btn-sm !py-2.5" href="/admin/orders">Clear</Link>}
        </div>
      </form>

      {res.rows.length === 0 ? (
        <EmptyState title={filtered ? 'No orders match these filters' : 'No orders yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Orders placed on the storefront will appear here.'} action={filtered ? <Link className="btn-outline btn-sm" href="/admin/orders">Clear filters</Link> : undefined} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Payment</th><th>Status</th><th>Method</th></tr></thead>
            <tbody>
              {res.rows.map((o) => (
                <tr key={o.id}>
                  <td><Link className="font-semibold hover:underline" href={`/admin/orders/${o.id}`}>{orderLabel(o.orderNumber)}</Link></td>
                  <td className="whitespace-nowrap text-mute">{fmtDateTime(o.placedAt)}</td>
                  <td>{o.shipName}<div className="text-xs text-mute">{o.email}</div></td>
                  <td className="text-right">{o._count.items}</td>
                  <td className="whitespace-nowrap text-right font-medium">{peso(o.totalCentavos)}</td>
                  <td><Badge status={o.paymentStatus} /></td>
                  <td><Badge status={o.status} /></td>
                  <td className="whitespace-nowrap text-mute">{PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} base="/admin/orders" params={params} />
    </div>
  );
}

import Link from 'next/link';
import { guard } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { dashboard, salesSummary, salesSeries } from '@/lib/queries/reports';
import { resolveRange, fmtDateTime } from '@/lib/time';
import { peso } from '@/lib/money';
import { Badge, EmptyState } from '@/components/ui/bits';
import { SalesChart } from '@/components/admin/charts';
import { Kpi, PageHeader, RangePicker, Section, one, num, orderLabel, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const user = await guard(null);
  const canReports = can(user.role, 'VIEW_REPORTS');
  const canOrders = can(user.role, 'VIEW_ORDERS');
  const canStock = can(user.role, 'MANAGE_INVENTORY');
  const canProducts = can(user.role, 'MANAGE_PRODUCTS');

  const from = one(searchParams.from), to = one(searchParams.to);
  const range = resolveRange(one(searchParams.range) ?? '7d', from, to);
  const [d, rangeSummary, series] = await Promise.all([
    dashboard(),
    canReports ? salesSummary(range) : null,
    canReports ? salesSeries(range) : null,
  ]);
  const t = d.summary;
  const denied = !!one(searchParams.denied);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Hello ${user.name.split(' ')[0]}. Here is how the store is doing today.`} />
      {denied && <div role="alert" className="mb-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">Your role does not have access to that page.</div>}

      <Section title="Today">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {canReports && <Kpi gold label="Total sales" value={peso(t.totalSalesCentavos)} sub="net of refunds, incl. shipping" />}
          {canReports && <Kpi label="Orders" value={num(t.orders)} />}
          {canReports && <Kpi label="Average order" value={peso(t.avgOrderCentavos)} />}
          {canReports && <Kpi label="Products sold" value={num(t.itemsSold)} />}
          {canReports && <Kpi label="New customers" value={num(t.newCustomers)} />}
          {canOrders && <Kpi label="Pending orders" value={num(d.pending)} sub={d.pending ? <Link href="/admin/orders?status=PENDING" className="underline">Review</Link> : 'All clear'} />}
          {canStock && <Kpi label="Low stock" value={num(d.lowStock.length)} sub={d.lowStock.length ? <Link href="/admin/inventory" className="underline">Restock</Link> : 'All stocked'} />}
        </div>
      </Section>

      {canReports && rangeSummary && series && (
        <Section title="Sales overview" hint={`${range.label}. Times are Asia/Manila.`}>
          <div className="card p-4">
            <RangePicker base="/admin" active={range.key} from={from} to={to} />
            <div className="mt-5"><SalesChart data={series} height={300} /></div>
            <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {[
                ['Gross sales', peso(rangeSummary.grossCentavos)], ['Discounts', peso(rangeSummary.discountsCentavos)],
                ['Returns / refunds', peso(rangeSummary.refundsCentavos)], ['Net sales', peso(rangeSummary.netCentavos)],
                ['Shipping revenue', peso(rangeSummary.shippingCentavos)], ['Total orders', num(rangeSummary.orders)],
                ['Average order value', peso(rangeSummary.avgOrderCentavos)], ['Total sales', peso(rangeSummary.totalSalesCentavos)],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wider text-mute">{k}</dt><dd className="mt-1 font-display text-lg tracking-tightest">{v}</dd></div>
              ))}
            </dl>
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {canReports && (
          <Section title="Top products" hint="Last 30 days, by net sales">
            {d.top.length === 0 ? <EmptyState title="No sales yet" text="Top products appear here once orders come in." /> : (
              <div className="table-wrap"><table className="tbl !min-w-0">
                <thead><tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Net sales</th></tr></thead>
                <tbody>{d.top.map((p) => (
                  <tr key={`${p.productId}-${p.product}`}>
                    <td className="font-medium">{canProducts ? <Link className="hover:underline" href={`/admin/products/${p.productId}`}>{p.product}</Link> : p.product}</td>
                    <td className="text-right">{num(p.units)}</td><td className="text-right">{peso(p.netCentavos)}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </Section>
        )}
        {canStock && (
          <Section title="Low stock" action={<Link href="/admin/inventory" className="text-xs font-semibold underline">Open inventory</Link>}>
            {d.lowStock.length === 0 ? <EmptyState title="Stock levels look healthy" text="Nothing is at or below its low stock threshold." /> : (
              <div className="table-wrap"><table className="tbl !min-w-0">
                <thead><tr><th>Item</th><th>SKU</th><th className="text-right">Available</th></tr></thead>
                <tbody>{d.lowStock.map((v) => (
                  <tr key={v.variantId}>
                    <td className="font-medium">{v.product}<div className="text-xs font-normal text-mute">{v.variant}</div></td>
                    <td className="text-xs text-mute">{v.sku}</td>
                    <td className="text-right"><Badge status={v.available <= 0 ? 'OUT' : 'LOW'} label={`${v.available} left`} /></td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </Section>
        )}
      </div>

      {canOrders && (
        <Section title="Recent orders" action={<Link href="/admin/orders" className="text-xs font-semibold underline">All orders</Link>}>
          {d.recent.length === 0 ? <EmptyState title="No orders yet" text="New orders will show up here." /> : (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th className="text-right">Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>{d.recent.map((o) => (
                <tr key={o.id}>
                  <td><Link className="font-semibold hover:underline" href={`/admin/orders/${o.id}`}>{orderLabel(o.orderNumber)}</Link></td>
                  <td className="whitespace-nowrap text-mute">{fmtDateTime(o.placedAt)}</td>
                  <td>{o.shipName}</td><td className="text-right">{peso(o.totalCentavos)}</td>
                  <td><Badge status={o.paymentStatus} /></td><td><Badge status={o.status} /></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Section>
      )}
    </div>
  );
}

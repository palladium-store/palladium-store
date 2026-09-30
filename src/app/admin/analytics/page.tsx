import { Prisma } from '@prisma/client';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { analytics, customerReport } from '@/lib/queries/reports';
import { resolveRange } from '@/lib/time';
import { peso, pct } from '@/lib/money';
import { EmptyState } from '@/components/ui/bits';
import { BarsChart, SalesChart } from '@/components/admin/charts';
import { Kpi, PageHeader, RangePicker, Section, delta, num, one, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: { searchParams: SP }) {
  await guard('VIEW_REPORTS');
  const from = one(searchParams.from), to = one(searchParams.to);
  const range = resolveRange(one(searchParams.range) ?? '30d', from, to);
  const span = range.to.getTime() - range.from.getTime();
  const prev = { from: new Date(range.from.getTime() - span), to: range.from };

  const [a, buyersNow, buyersPrev, visPrev] = await Promise.all([
    analytics(range),
    customerReport(range),
    customerReport(prev),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(DISTINCT "sessionId")::int AS n FROM site_visits WHERE "createdAt" >= ${prev.from} AND "createdAt" < ${prev.to}`),
  ]);
  const prevVisitors = visPrev[0]?.n ?? 0;
  const prevConversion = prevVisitors ? Math.min((a.previous.orders / prevVisitors) * 100, 100) : 0;
  const s = a.summary, p = a.previous;
  const noSales = s.orders === 0;

  return (
    <div>
      <PageHeader title="Analytics" subtitle={`${range.label}, compared with the previous ${range.key === 'today' || range.key === 'yesterday' ? 'day' : 'period of the same length'}. Times are Asia/Manila.`} />
      <div className="card p-4"><RangePicker base="/admin/analytics" active={range.key} from={from} to={to} /></div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi gold label="Revenue" value={peso(s.totalSalesCentavos)} delta={delta(s.totalSalesCentavos, p.totalSalesCentavos)} />
        <Kpi label="Orders" value={num(s.orders)} delta={delta(s.orders, p.orders)} />
        <Kpi label="Customers" value={num(buyersNow.buyers)} sub="who ordered" delta={delta(buyersNow.buyers, buyersPrev.buyers)} />
        <Kpi label="Conversion rate" value={pct(a.conversionRate)} sub={`${num(a.visitors)} visitors`} delta={delta(a.conversionRate, prevConversion)} />
        <Kpi label="Average order value" value={peso(s.avgOrderCentavos)} delta={delta(s.avgOrderCentavos, p.avgOrderCentavos)} />
        <Kpi label="Repeat customer rate" value={pct(a.repeatRate)} sub="all time" />
      </div>
      <p className="mt-2 text-xs text-mute">Conversion rate is orders divided by unique visitors in the range (one visitor is one browsing session, capped at 100%). Repeat customer rate is the share of all customers who have ordered more than once.</p>

      <Section title="Sales by date" hint="Net sales including shipping">
        <div className="card p-4"><SalesChart data={a.series} height={300} /></div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top products" hint="By net sales">
          <div className="card p-4"><BarsChart label="Net sales" format="peso" data={a.topProducts.map((x) => ({ name: x.product, value: x.netCentavos }))} emptyText="No product sales in this range." /></div>
        </Section>
        <Section title="Best-selling categories" hint="By net sales">
          <div className="card p-4"><BarsChart label="Net sales" format="peso" accent="ink" data={a.categories.map((x) => ({ name: x.category, value: x.netCentavos }))} emptyText="No category sales in this range." /></div>
        </Section>
      </div>

      <Section title="Sales by location" hint="Top provinces and cities by net sales">
        {noSales ? <EmptyState title="No orders in this range" text="Location sales appear once orders are placed." /> : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4"><BarsChart label="Net sales" format="peso" data={a.byProvince.map((x) => ({ name: x.province, value: x.salesCentavos }))} /></div>
            <div className="space-y-4">
              <div className="table-wrap"><table className="tbl !min-w-0">
                <thead><tr><th>Province</th><th className="text-right">Orders</th><th className="text-right">Sales</th></tr></thead>
                <tbody>{a.byProvince.map((x) => <tr key={x.province}><td className="font-medium">{x.province}</td><td className="text-right">{num(x.orders)}</td><td className="text-right">{peso(x.salesCentavos)}</td></tr>)}</tbody>
              </table></div>
              <div className="card p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Top cities</h3>
                <ol className="divide-y divide-line text-sm">
                  {a.byCity.map((x, i) => <li key={x.city} className="flex items-center justify-between gap-3 py-1.5"><span><span className="mr-2 text-mute">{i + 1}.</span>{x.city}</span><span className="text-mute">{num(x.orders)} order{x.orders === 1 ? '' : 's'} &middot; <b className="text-ink">{peso(x.salesCentavos)}</b></span></li>)}
                </ol>
              </div>
            </div>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Customer acquisition sources" hint="Where new customers signed up from">
          <div className="card p-4">
            <BarsChart label="New customers" format="number" unit="customers" accent="ink" data={a.acquisition.map((x) => ({ name: x.source, value: x.customers }))} emptyText="No new customers in this range." />
          </div>
        </Section>
        <Section title="Repeat customers">
          <div className="card p-6">
            <div className="font-display text-4xl tracking-tightest">{pct(a.repeatRate)}</div>
            <p className="mt-2 text-sm text-mute">{num(a.repeatCustomers)} of {num(a.buyers)} customers who have ever ordered came back for a second order.</p>
            <div className="mt-4 h-2 w-full bg-bone" role="img" aria-label={`Repeat customer rate ${pct(a.repeatRate)}`}><div className="h-2 bg-gold" style={{ width: `${Math.min(a.repeatRate, 100)}%` }} /></div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-mute">Returning customers in range</dt><dd className="font-semibold">{num(buyersNow.returningCustomers)}</dd></div>
              <div><dt className="text-xs text-mute">New customers in range</dt><dd className="font-semibold">{num(buyersNow.newCustomers)}</dd></div>
            </dl>
          </div>
        </Section>
      </div>
    </div>
  );
}

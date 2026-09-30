import { guard } from '@/lib/guard';
import { salesSummary, productSales, customerReport, paymentReport, dailySalesTable, PAYMENT_LABELS } from '@/lib/queries/reports';
import { resolveRange } from '@/lib/time';
import { peso } from '@/lib/money';
import { EmptyState } from '@/components/ui/bits';
import { ExportLinks, Kpi, PageHeader, RangePicker, Section, num, one, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  await guard('VIEW_REPORTS');
  const from = one(searchParams.from), to = one(searchParams.to);
  const range = resolveRange(one(searchParams.range) ?? '30d', from, to);
  const [s, daily, products, customers, payments] = await Promise.all([
    salesSummary(range), dailySalesTable(range), productSales(range, { byVariant: true }), customerReport(range), paymentReport(range),
  ]);
  const empty = s.orders === 0;
  const ex = (type: 'summary' | 'daily' | 'products' | 'customers' | 'payments') => <ExportLinks type={type} range={range.key} from={from} to={to} />;
  const payTotals = payments.reduce((a, p) => ({ orders: a.orders + p.orders, sales: a.sales + p.salesCentavos, refunds: a.refunds + p.refundsCentavos, net: a.net + p.netCentavos }), { orders: 0, sales: 0, refunds: 0, net: 0 });
  const dTot = daily.reduce((a, d) => ({ orders: a.orders + d.orders, gross: a.gross + d.grossCentavos, disc: a.disc + d.discountsCentavos, ref: a.ref + d.refundsCentavos, ship: a.ship + d.shippingCentavos, net: a.net + d.netCentavos }), { orders: 0, gross: 0, disc: 0, ref: 0, ship: 0, net: 0 });

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${range.label}. Accepted orders only (pending and cancelled orders are excluded). Times are Asia/Manila.`} />
      <div className="card p-4"><RangePicker base="/admin/reports" active={range.key} from={from} to={to} /></div>

      <Section title="Summary" action={ex('summary')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi gold label="Total sales" value={peso(s.totalSalesCentavos)} />
          <Kpi label="Net sales" value={peso(s.netCentavos)} sub="excl. shipping" />
          <Kpi label="Orders" value={num(s.orders)} />
          <Kpi label="Items sold" value={num(s.itemsSold)} />
          <Kpi label="Average order value" value={peso(s.avgOrderCentavos)} />
          <Kpi label="Refunds" value={peso(s.refundsCentavos)} />
          <Kpi label="Discounts" value={peso(s.discountsCentavos)} />
          <Kpi label="Shipping revenue" value={peso(s.shippingCentavos)} />
        </div>
      </Section>

      <Section title="Daily sales" action={ex('daily')}>
        {empty || daily.length === 0 ? <EmptyState title="No orders in this range" text="Pick another date range to see daily sales." /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th className="text-right">Orders</th><th className="text-right">Gross sales</th><th className="text-right">Discounts</th><th className="text-right">Refunds</th><th className="text-right">Net sales</th><th className="text-right">Shipping</th></tr></thead>
            <tbody>{daily.map((d) => (
              <tr key={d.day}><td className="whitespace-nowrap font-medium">{d.day}</td><td className="text-right">{num(d.orders)}</td><td className="text-right">{peso(d.grossCentavos)}</td><td className="text-right">{peso(d.discountsCentavos)}</td><td className="text-right">{peso(d.refundsCentavos)}</td><td className="text-right font-medium">{peso(d.netCentavos)}</td><td className="text-right">{peso(d.shippingCentavos)}</td></tr>
            ))}</tbody>
            <tfoot><tr className="bg-bone font-semibold"><td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right">{num(dTot.orders)}</td><td className="px-4 py-3 text-right">{peso(dTot.gross)}</td><td className="px-4 py-3 text-right">{peso(dTot.disc)}</td><td className="px-4 py-3 text-right">{peso(dTot.ref)}</td><td className="px-4 py-3 text-right">{peso(dTot.net)}</td><td className="px-4 py-3 text-right">{peso(dTot.ship)}</td></tr></tfoot>
          </table></div>
        )}
      </Section>

      <Section title="Product sales report" hint="By variant, ranked by net sales" action={ex('products')}>
        {products.length === 0 ? <EmptyState title="No product sales in this range" /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Units sold</th><th className="text-right">Gross sales</th><th className="text-right">Discounts</th><th className="text-right">Net sales</th></tr></thead>
            <tbody>{products.map((p) => (
              <tr key={`${p.productId}|${p.variant}|${p.sku}`}>
                <td className="font-medium">{p.product}{p.variant && <div className="text-xs font-normal text-mute">{p.variant}</div>}</td>
                <td className="text-xs text-mute">{p.sku ?? '-'}</td><td className="text-right">{num(p.units)}</td>
                <td className="text-right">{peso(p.grossCentavos)}</td><td className="text-right">{peso(p.discountsCentavos)}</td><td className="text-right font-medium">{peso(p.netCentavos)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Section>

      <Section title="Customer report" action={ex('customers')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="New customers" value={num(customers.newCustomers)} sub="signed up in range" />
          <Kpi label="Returning customers" value={num(customers.returningCustomers)} sub="ordered before this range" />
          <Kpi label="Customers who ordered" value={num(customers.buyers)} />
          <Kpi label="Total customers" value={num(customers.totalCustomers)} sub="all time" />
        </div>
      </Section>

      <Section title="Payment report" action={ex('payments')}>
        {empty ? <EmptyState title="No payments in this range" /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Payment method</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Refunds</th><th className="text-right">Net</th></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.method}><td className="font-medium">{PAYMENT_LABELS[p.method] ?? p.method}</td><td className="text-right">{num(p.orders)}</td><td className="text-right">{peso(p.salesCentavos)}</td><td className="text-right">{peso(p.refundsCentavos)}</td><td className="text-right">{peso(p.netCentavos)}</td></tr>
            ))}</tbody>
            <tfoot><tr className="bg-bone font-semibold"><td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right">{num(payTotals.orders)}</td><td className="px-4 py-3 text-right">{peso(payTotals.sales)}</td><td className="px-4 py-3 text-right">{peso(payTotals.refunds)}</td><td className="px-4 py-3 text-right">{peso(payTotals.net)}</td></tr></tfoot>
          </table></div>
        )}
      </Section>
    </div>
  );
}

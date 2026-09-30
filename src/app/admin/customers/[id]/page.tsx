import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guard } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { getCustomerDetail } from '@/lib/queries/admin';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { peso } from '@/lib/money';
import { Badge, EmptyState } from '@/components/ui/bits';
import { CustomerEditor } from '@/components/admin/CustomerEditor';
import { Kpi, PageHeader, Section, num, orderLabel } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const user = await guard('VIEW_CUSTOMERS');
  const c = await getCustomerDetail(params.id);
  if (!c) notFound();
  const canOrders = can(user.role, 'VIEW_ORDERS');

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/admin/customers" className="text-mute hover:text-ink">&larr; All customers</Link></div>
      <PageHeader title={c.name} subtitle={`Customer since ${fmtDate(c.createdAt)}${c.source ? ` · via ${c.source}` : ''}`} actions={<Badge status={c.status} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi gold label="Total spent" value={peso(c.stats.spentCentavos)} sub="net of refunds" />
        <Kpi label="Orders" value={num(c.stats.orders)} />
        <Kpi label="Average order" value={peso(c.stats.avgOrderCentavos)} />
        <Kpi label="Last order" value={c.stats.lastOrderAt ? fmtDate(c.stats.lastOrderAt) : 'Never'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Section title="Order history" className="!mt-0">
            {c.orders.length === 0 ? <EmptyState title="No orders yet" text="This customer has not placed an order." /> : (
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Order</th><th>Date</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Payment</th><th>Status</th></tr></thead>
                <tbody>{c.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{canOrders ? <Link className="font-semibold hover:underline" href={`/admin/orders/${o.id}`}>{orderLabel(o.orderNumber)}</Link> : <span className="font-semibold">{orderLabel(o.orderNumber)}</span>}</td>
                    <td className="whitespace-nowrap text-mute">{fmtDateTime(o.placedAt)}</td>
                    <td className="text-right">{o.items.reduce((a, i) => a + i.quantity, 0)}</td>
                    <td className="whitespace-nowrap text-right font-medium">{peso(o.totalCentavos)}</td>
                    <td><Badge status={o.paymentStatus} /></td><td><Badge status={o.status} /></td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </Section>

          <Section title="Products purchased" hint="Excludes pending and cancelled orders">
            {c.products.length === 0 ? <EmptyState title="Nothing purchased yet" /> : (
              <div className="table-wrap"><table className="tbl !min-w-0">
                <thead><tr><th>Product</th><th>Variant</th><th className="text-right">Quantity</th></tr></thead>
                <tbody>{c.products.map((p) => <tr key={`${p.name}|${p.variant}`}><td className="font-medium">{p.name}</td><td className="text-mute">{p.variant}</td><td className="text-right">{num(p.qty)}</td></tr>)}</tbody>
              </table></div>
            )}
          </Section>
        </div>

        <aside className="min-w-0 space-y-6">
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Contact</h2>
            <div><a className="break-all hover:underline" href={`mailto:${c.email}`}>{c.email}</a></div>
            <div className="mt-1">{c.phone ? <a className="hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : <span className="text-mute">No phone number</span>}</div>
            <div className="mt-2 text-xs text-mute">Marketing emails: {c.marketingOptIn ? 'opted in' : 'not opted in'}</div>
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Addresses</h2>
            {c.addresses.length === 0 ? <p className="text-mute">No saved addresses.</p> : (
              <ul className="divide-y divide-line">
                {c.addresses.map((a) => (
                  <li key={a.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2"><b>{a.recipient}</b>{a.isDefault && <span className="bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Default</span>}</div>
                    <div className="text-mute">{a.phone}<br />{a.line1}<br />Brgy. {a.barangay}, {a.city}<br />{a.province} {a.postalCode}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <CustomerEditor customerId={c.id} name={c.name} initialNotes={c.notes ?? ''} initialStatus={c.status} />
        </aside>
      </div>
    </div>
  );
}

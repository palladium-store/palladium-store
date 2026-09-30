import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guard } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { getOrderDetail } from '@/lib/queries/admin';
import { nextStatuses } from '@/lib/orders';
import { PAYMENT_LABELS } from '@/lib/queries/reports';
import { fmtDateTime } from '@/lib/time';
import { peso } from '@/lib/money';
import { Badge, statusLabel } from '@/components/ui/bits';
import { OrderActions } from '@/components/admin/OrderActions';
import { OrderNotes } from '@/components/admin/NotesEditor';
import { PageHeader, orderLabel } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };

export default async function OrderPage({ params }: { params: { id: string } }) {
  const user = await guard('VIEW_ORDERS');
  const order = await getOrderDetail(params.id);
  if (!order) notFound();

  const canEdit = can(user.role, 'EDIT_ORDERS');
  const label = orderLabel(order.orderNumber);
  const isCod = order.paymentMethod === 'COD';
  const awaiting = order.status === 'PENDING' || order.status === 'PAYMENT_PENDING';
  const remaining = Math.max(order.totalCentavos - order.refundedCentavos, 0);
  const shipment = order.shipments[0];
  const closed = ['CANCELLED', 'REFUNDED'].includes(order.status);
  const flags = {
    canConfirmPayment: canEdit && awaiting && !isCod,
    canConfirmCod: canEdit && awaiting && isCod,
    canFailPayment: canEdit && awaiting && !isCod && order.paymentStatus !== 'FAILED',
    canTrack: canEdit && !awaiting && !closed,
    canRefund: canEdit && (order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIALLY_REFUNDED') && remaining > 0,
    canCancel: canEdit && !['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status),
  };
  const next = canEdit ? nextStatuses(order.status) : [];
  const canCustomer = can(user.role, 'VIEW_CUSTOMERS');
  const base = `/admin/orders/${order.id}/print`;

  return (
    <div>
      <div className="no-print mb-2 text-sm"><Link href="/admin/orders" className="text-mute hover:text-ink">&larr; All orders</Link></div>
      <PageHeader
        title={`Order ${label}`}
        subtitle={<span>Placed {fmtDateTime(order.placedAt)}</span>}
        actions={<>
          <Badge status={order.status} /><Badge status={order.paymentStatus} />
          <Link href={`${base}/packing-slip`} target="_blank" rel="noopener" className="btn-outline btn-sm">Print packing slip</Link>
          <Link href={`${base}/invoice`} target="_blank" rel="noopener" className="btn-outline btn-sm">Print invoice</Link>
        </>}
      />

      {canEdit && (
        <div className="card mb-6 p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Actions</h2>
          <OrderActions
            orderId={order.id} orderLabel={label} isCod={isCod} nextStatuses={next} {...flags}
            courier={shipment?.courier ?? ''} trackingNumber={shipment?.trackingNumber ?? ''}
            remainingRefundCentavos={remaining}
            refundItems={order.items.map((i) => ({ id: i.id, name: i.productName, variant: i.variantName, sku: i.sku, maxReturn: Math.max(i.quantity - i.returnedQty, 0) }))}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Items</h2>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Item</th><th>SKU</th><th className="text-right">Unit price</th><th className="text-right">Qty</th><th className="text-right">Discount</th><th className="text-right">Line total</th><th className="text-right">Returned</th></tr></thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {i.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.imageUrl} alt="" className="h-12 w-12 shrink-0 border border-line bg-bone object-cover" /> : <div className="h-12 w-12 shrink-0 border border-line bg-bone" aria-hidden />}
                          <div className="min-w-0"><div className="font-medium">{i.productName}</div><div className="text-xs text-mute">{i.variantName}</div></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-mute">{i.sku}</td>
                      <td className="whitespace-nowrap text-right">{peso(i.unitPriceCentavos)}</td>
                      <td className="text-right">{i.quantity}</td>
                      <td className="whitespace-nowrap text-right">{i.discountCentavos ? `-${peso(i.discountCentavos)}` : '-'}</td>
                      <td className="whitespace-nowrap text-right font-medium">{peso(i.lineTotalCentavos)}</td>
                      <td className="text-right">{i.returnedQty || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-3 max-w-sm space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd>{peso(order.subtotalCentavos)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt><dd>{order.discountCentavos ? `-${peso(order.discountCentavos)}` : peso(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Shipping{order.shippingZone ? ` (${order.shippingZone})` : ''}</dt><dd>{peso(order.shippingCentavos)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Total</dt><dd>{peso(order.totalCentavos)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Refunded</dt><dd>{order.refundedCentavos ? `-${peso(order.refundedCentavos)}` : peso(0)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-display text-base"><dt>Net</dt><dd>{peso(remaining)}</dd></div>
            </dl>
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Timeline</h2>
            {order.events.length === 0 ? <p className="card p-4 text-sm text-mute">No events recorded yet.</p> : (
              <ol className="card divide-y divide-line">
                {order.events.map((e) => (
                  <li key={e.id} className="flex gap-3 p-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 bg-gold" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div>{e.message}</div>
                      <div className="text-xs text-mute">{fmtDateTime(e.createdAt)} &middot; {e.actor ?? 'System'} &middot; {statusLabel(e.type)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Inventory movements</h2>
            {order.transactions.length === 0 ? <p className="card p-4 text-sm text-mute">No stock has moved for this order yet. Stock is deducted when the order is confirmed.</p> : (
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Date</th><th>SKU</th><th>Action</th><th className="text-right">Change</th><th className="text-right">On hand</th><th>Reason</th></tr></thead>
                <tbody>{order.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-mute">{fmtDateTime(t.createdAt)}</td>
                    <td className="whitespace-nowrap text-xs">{t.variant.sku}</td>
                    <td>{statusLabel(t.action)}</td>
                    <td className="text-right">{t.quantity !== 0 ? (t.quantity > 0 ? `+${t.quantity}` : t.quantity) : t.reservedDelta ? `${t.reservedDelta > 0 ? '+' : ''}${t.reservedDelta} reserved` : '0'}</td>
                    <td className="whitespace-nowrap text-right text-mute">{t.previousOnHand} &rarr; {t.newOnHand}</td>
                    <td className="text-mute">{t.reason ?? '-'}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Customer</h2>
            <div className="font-semibold">{canCustomer ? <Link className="hover:underline" href={`/admin/customers/${order.customer.id}`}>{order.customer.name}</Link> : order.customer.name}</div>
            <div className="mt-1"><a className="break-all hover:underline" href={`mailto:${order.email}`}>{order.email}</a></div>
            <div><a className="hover:underline" href={`tel:${order.phone}`}>{order.phone}</a></div>
            {order.customerNotes && <p className="mt-3 border-l-2 border-gold bg-gold-soft px-3 py-2 text-xs"><b>Customer note:</b> {order.customerNotes}</p>}
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Shipping address</h2>
            <address className="not-italic leading-relaxed">
              <b>{order.shipName}</b><br />{order.shipPhone}<br />{order.shipLine1}<br />Brgy. {order.shipBarangay}, {order.shipCity}<br />{order.shipProvince} {order.shipPostalCode}
            </address>
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Payment and fulfillment</h2>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-mute">Method</dt><dd>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Payment</dt><dd><Badge status={order.paymentStatus} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Paid at</dt><dd>{order.paidAt ? fmtDateTime(order.paidAt) : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Fulfillment</dt><dd><Badge status={order.status} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Courier</dt><dd>{shipment?.courier || '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Tracking no.</dt><dd className="break-all text-right">{shipment?.trackingNumber || '-'}</dd></div>
              {shipment?.shippedAt && <div className="flex justify-between gap-3"><dt className="text-mute">Shipped</dt><dd className="text-right">{fmtDateTime(shipment.shippedAt)}</dd></div>}
              {shipment?.deliveredAt && <div className="flex justify-between gap-3"><dt className="text-mute">Delivered</dt><dd className="text-right">{fmtDateTime(shipment.deliveredAt)}</dd></div>}
            </dl>
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Payments</h2>
            {order.payments.length === 0 ? <p className="text-mute">No payment records.</p> : (
              <ul className="divide-y divide-line">
                {order.payments.map((p) => (
                  <li key={p.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{peso(p.amountCentavos)}</span><Badge status={p.status} /></div>
                    <div className="text-xs text-mute">{PAYMENT_LABELS[p.method] ?? p.method} &middot; {p.provider}{p.providerRef ? ` \u00B7 ref ${p.providerRef}` : ''}</div>
                    <div className="text-xs text-mute">{p.paidAt ? `Paid ${fmtDateTime(p.paidAt)}` : `Created ${fmtDateTime(p.createdAt)}`}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Internal notes</h2>
            <OrderNotes orderId={order.id} initial={order.internalNotes ?? ''} canEdit={canEdit} />
          </div>
        </aside>
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { guard } from '@/lib/guard';
import { getOrderDetail } from '@/lib/queries/admin';
import { getSetting } from '@/lib/settings';
import { PAYMENT_LABELS } from '@/lib/queries/reports';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { peso } from '@/lib/money';
import { statusLabel } from '@/components/ui/bits';
import { PrintButton } from '@/components/admin/PrintButton';
import { orderLabel } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print order' };

// Hides the admin chrome padding and paints the page white when printing.
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body, div.min-h-screen { background: #fff !important; }
  main { padding: 0 !important; max-width: none !important; }
  .lg\\:pl-64 { padding-left: 0 !important; }
  .print-sheet { border: 0 !important; box-shadow: none !important; padding: 0 !important; max-width: none !important; margin: 0 !important; }
}`;

export default async function PrintPage({ params }: { params: { id: string; kind: string } }) {
  await guard('VIEW_ORDERS');
  if (params.kind !== 'packing-slip' && params.kind !== 'invoice') notFound();
  const order = await getOrderDetail(params.id);
  if (!order) notFound();
  const store = await getSetting('store');
  const invoice = params.kind === 'invoice';
  const label = orderLabel(order.orderNumber);
  const shipment = order.shipments[0];
  const units = order.items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <a href={`/admin/orders/${order.id}`} className="text-sm text-mute hover:text-ink">&larr; Back to order {label}</a>
        <PrintButton label={invoice ? 'Print invoice' : 'Print packing slip'} />
      </div>

      <article className="print-sheet mx-auto max-w-[210mm] border border-line bg-white p-6 text-[13px] leading-snug text-black shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <div className="font-display text-2xl tracking-tightest">{store.name}</div>
            <div className="mt-1 whitespace-pre-line text-xs">{store.address}</div>
            <div className="text-xs">{store.email} &middot; {store.phone}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl uppercase tracking-tightest">{invoice ? 'Sales invoice' : 'Packing slip'}</div>
            <div className="mt-1 text-sm font-semibold">{label}</div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider">{invoice ? 'Bill to' : 'Customer'}</h2>
            <div className="mt-1"><b>{order.customer.name}</b><br />{order.email}<br />{order.phone}</div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider">Ship to</h2>
            <div className="mt-1"><b>{order.shipName}</b><br />{order.shipPhone}<br />{order.shipLine1}<br />Brgy. {order.shipBarangay}, {order.shipCity}<br />{order.shipProvince} {order.shipPostalCode}</div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider">Order details</h2>
            <dl className="mt-1 space-y-0.5">
              <div className="flex justify-between gap-2"><dt>Order</dt><dd>{label}</dd></div>
              <div className="flex justify-between gap-2"><dt>{invoice ? 'Invoice date' : 'Order date'}</dt><dd>{invoice ? fmtDate(new Date()) : fmtDate(order.placedAt)}</dd></div>
              {invoice && <div className="flex justify-between gap-2"><dt>Order date</dt><dd>{fmtDate(order.placedAt)}</dd></div>}
              <div className="flex justify-between gap-2"><dt>Payment</dt><dd>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd></div>
              {invoice && <div className="flex justify-between gap-2"><dt>Payment status</dt><dd>{statusLabel(order.paymentStatus)}</dd></div>}
              {shipment?.courier && <div className="flex justify-between gap-2"><dt>Courier</dt><dd>{shipment.courier}</dd></div>}
              {shipment?.trackingNumber && <div className="flex justify-between gap-2"><dt>Tracking</dt><dd>{shipment.trackingNumber}</dd></div>}
            </dl>
          </div>
        </section>

        <div className="mt-5 overflow-x-auto">
          {invoice ? (
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead><tr className="border-y border-black text-[10px] uppercase tracking-wider"><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">SKU</th><th className="py-2 pr-2 text-right">Unit price</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Discount</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-neutral-300 align-top">
                    <td className="py-2 pr-2"><b>{i.productName}</b><div className="text-xs">{i.variantName}</div></td>
                    <td className="py-2 pr-2 text-xs">{i.sku}</td>
                    <td className="py-2 pr-2 text-right">{peso(i.unitPriceCentavos)}</td>
                    <td className="py-2 pr-2 text-right">{i.quantity}</td>
                    <td className="py-2 pr-2 text-right">{i.discountCentavos ? `-${peso(i.discountCentavos)}` : '-'}</td>
                    <td className="py-2 text-right">{peso(i.lineTotalCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead><tr className="border-y border-black text-[10px] uppercase tracking-wider"><th className="w-10 py-2 pr-2">Packed</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">SKU</th><th className="py-2 text-right">Quantity</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-neutral-300 align-top">
                    <td className="py-2 pr-2"><span className="inline-block h-4 w-4 border border-black" aria-label="Packed checkbox" /></td>
                    <td className="py-2 pr-2"><b>{i.productName}</b><div className="text-xs">{i.variantName}</div></td>
                    <td className="py-2 pr-2 text-xs">{i.sku}</td>
                    <td className="py-2 text-right text-base font-bold">{i.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3} className="pt-2 text-right text-xs uppercase tracking-wider">Total units</td><td className="pt-2 text-right font-bold">{units}</td></tr></tfoot>
            </table>
          )}
        </div>

        {invoice && (
          <dl className="ml-auto mt-4 max-w-xs space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{peso(order.subtotalCentavos)}</dd></div>
            {order.discountCentavos > 0 && <div className="flex justify-between"><dt>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt><dd>-{peso(order.discountCentavos)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{peso(order.shippingCentavos)}</dd></div>
            <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><dt>Total</dt><dd>{peso(order.totalCentavos)}</dd></div>
            {order.refundedCentavos > 0 && <div className="flex justify-between"><dt>Refunded</dt><dd>-{peso(order.refundedCentavos)}</dd></div>}
            {order.refundedCentavos > 0 && <div className="flex justify-between font-semibold"><dt>Net total</dt><dd>{peso(order.totalCentavos - order.refundedCentavos)}</dd></div>}
          </dl>
        )}

        {!invoice && order.customerNotes && <p className="mt-5 border border-black p-2 text-xs"><b>Customer note:</b> {order.customerNotes}</p>}

        <footer className="mt-8 border-t border-neutral-300 pt-3 text-[11px] text-neutral-600">
          {invoice
            ? <p>This is a sales invoice for your order and is not an official receipt issued under BIR regulations. Printed {fmtDateTime(new Date())}.</p>
            : <p>Thank you for shopping with {store.name}. Questions about your order? Contact {store.email}. Printed {fmtDateTime(new Date())}.</p>}
        </footer>
      </article>
    </div>
  );
}

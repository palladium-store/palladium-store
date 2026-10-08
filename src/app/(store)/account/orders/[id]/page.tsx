import Link from 'next/link';
import { notFound } from 'next/navigation';
import { customerGuard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { orderToken } from '@/lib/orders';
import { fmtDateTime } from '@/lib/time';
import { Badge } from '@/components/ui/bits';
import { METHOD_LABEL } from '@/components/store/labels';
import { ReorderButton } from '@/components/store/reorder-button';
import { AddressBlock, OrderItemsList, OrderTotalsBlock, PaymentInstructions, DemoPaymentReceipt, TokenPaymentReceipt, StatusTimeline, TrackingBlock, orderStatusNote } from '@/components/store/order-parts';
import { loadTokenPayment, tokenPaymentView } from '@/lib/palladium/live-server';

export const dynamic = 'force-dynamic';

export default async function OrderDetail({ params }: { params: { id: string } }) {
  const { customer } = await customerGuard(`/account/orders/${params.id}`);
  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: customer.id },
    include: { items: true, events: { orderBy: { createdAt: 'asc' } }, shipments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!order) notFound();
  const payments = await getSetting('payments');
  const shipment = order.shipments.find((s) => s.trackingNumber) ?? order.shipments[0];
  const tok = order.paymentMethod === 'PALLADIUM' && order.paymentMode === 'LIVE' ? await loadTokenPayment(order.id) : null;
  const tokenPayment = tok ? await tokenPaymentView(order, tok.rec) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/account/orders" className="text-xs font-semibold uppercase tracking-[0.14em] text-mute hover:text-ink">&larr; All orders</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="h-display text-3xl sm:text-4xl">{order.orderNumber}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-mute"><Badge status={order.status} />Placed {fmtDateTime(order.placedAt)}</p>
            <p className="mt-2 text-sm text-mute">{orderStatusNote(order)}</p>
          </div>
          <ReorderButton orderId={order.id} />
        </div>
      </div>

      <PaymentInstructions order={order} instructions={(payments as unknown as Record<string, { instructions: string } | undefined>)[order.paymentMethod]?.instructions ?? ''} token={orderToken(order.id)} tokenPayment={tokenPayment} />
      <TokenPaymentReceipt order={order} tokenPayment={tokenPayment} />
      <DemoPaymentReceipt order={order} />
      <TrackingBlock shipment={shipment} />

      <section aria-labelledby="oi-h">
        <h3 id="oi-h" className="mb-3 font-display text-xl tracking-tightest">Items</h3>
        <OrderItemsList items={order.items} />
        <div className="mt-4"><OrderTotalsBlock order={order} /></div>
      </section>

      <div className="grid gap-8 border-t border-line pt-8 sm:grid-cols-2">
        <section aria-labelledby="oa-h"><h3 id="oa-h" className="mb-3 font-display text-xl tracking-tightest">Shipping to</h3><AddressBlock order={order} />{order.customerNotes && <p className="mt-3 text-sm text-mute">Note: {order.customerNotes}</p>}</section>
        <section aria-labelledby="op-h"><h3 id="op-h" className="mb-3 font-display text-xl tracking-tightest">Payment</h3><p className="text-sm">{METHOD_LABEL[order.paymentMethod]}</p><p className="mt-1"><Badge status={order.paymentStatus} /></p>{order.paidAt && <p className="mt-2 text-xs text-mute">Paid {fmtDateTime(order.paidAt)}</p>}</section>
      </div>

      <section className="border-t border-line pt-8" aria-labelledby="ot-h">
        <h3 id="ot-h" className="mb-5 font-display text-xl tracking-tightest">Order progress</h3>
        <StatusTimeline events={order.events} />
      </section>
    </div>
  );
}

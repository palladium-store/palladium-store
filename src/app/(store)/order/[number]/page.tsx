import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { verifyOrderToken } from '@/lib/orders';
import { fmtDateTime } from '@/lib/time';
import { Badge } from '@/components/ui/bits';
import { Container } from '@/components/store/container';
import { METHOD_LABEL } from '@/components/store/labels';
import { AddressBlock, NextSteps, OrderItemsList, OrderTotalsBlock, PaymentInstructions, TrackingBlock, orderStatusNote } from '@/components/store/order-parts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order confirmation', robots: { index: false, follow: false, nocache: true } };

export default async function OrderPage({ params, searchParams }: { params: { number: string }; searchParams: { t?: string | string[] } }) {
  const order = await prisma.order.findUnique({ where: { orderNumber: params.number }, include: { items: true, shipments: { orderBy: { createdAt: 'desc' } } } });
  if (!order) notFound();

  const token = typeof searchParams.t === 'string' ? searchParams.t : undefined;
  let allowed = verifyOrderToken(order.id, token);
  let owner = false;
  const user = await getUser();
  if (user) {
    const c = await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } });
    owner = c?.id === order.customerId;
    allowed = allowed || owner;
  }
  if (!allowed) notFound();

  const payments = await getSetting('payments');
  const shipment = order.shipments.find((s) => s.trackingNumber) ?? order.shipments[0];

  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <div className="max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep">{order.status === 'CANCELLED' ? 'Order cancelled' : 'Thank you for your order'}</p>
        <h1 className="h-display mt-2 text-4xl sm:text-6xl">{order.orderNumber}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge status={order.status} />
          <span className="text-mute">Placed {fmtDateTime(order.placedAt)}</span>
        </div>
        <p className="mt-3 text-sm text-mute">{orderStatusNote(order)} We will send updates to {order.email}.</p>

        <div className="mt-8 space-y-6">
          <PaymentInstructions order={order} instructions={payments[order.paymentMethod]?.instructions ?? ''} />
          <TrackingBlock shipment={shipment} />
          <section aria-labelledby="items-h">
            <h2 id="items-h" className="mb-3 font-display text-xl tracking-tightest">Items</h2>
            <OrderItemsList items={order.items} />
            <div className="mt-4"><OrderTotalsBlock order={order} /></div>
          </section>
          <div className="grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
            <section aria-labelledby="ship-h"><h2 id="ship-h" className="mb-3 font-display text-xl tracking-tightest">Shipping to</h2><AddressBlock order={order} />{order.customerNotes && <p className="mt-3 text-sm text-mute">Note: {order.customerNotes}</p>}</section>
            <section aria-labelledby="pm-h">
              <h2 id="pm-h" className="mb-3 font-display text-xl tracking-tightest">Payment</h2>
              <p className="text-sm">{METHOD_LABEL[order.paymentMethod]}</p>
              <p className="mt-1"><Badge status={order.paymentStatus} /></p>
            </section>
          </div>
          <div className="border-t border-line pt-6"><NextSteps order={order} /></div>
          <div className="flex flex-wrap gap-3 border-t border-line pt-6">
            <Link href="/shop" className="btn-primary">Continue shopping</Link>
            {owner ? <Link href={`/account/orders/${order.id}`} className="btn-outline">View in my account</Link> : !user && <Link href="/register" className="btn-outline">Create an account</Link>}
          </div>
        </div>
      </div>
    </Container>
  );
}

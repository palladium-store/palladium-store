import Link from 'next/link';
import type { Order, OrderItem, Shipment, OrderEvent } from '@prisma/client';
import { peso } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';
import { Img } from './img';
import { METHOD_HEADING, METHOD_LABEL } from './labels';
import { QrPayment } from './qr-payment';
import { formatPalladiumMinor } from '@/lib/palladium-price';
import { DEMO_NETWORK_LABEL } from '@/lib/palladium/config';

export function OrderItemsList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((i) => (
        <li key={i.id} className="flex gap-4 py-4">
          <div className="relative h-20 w-16 shrink-0 bg-ink"><Img src={i.imageUrl} alt={i.productName} sizes="64px" className="object-contain" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{i.productName}</p>
            {i.variantName && <p className="text-sm text-mute">{i.variantName}</p>}
            <p className="mt-1 text-sm text-mute">{peso(i.unitPriceCentavos)} &times; {i.quantity}</p>
          </div>
          <p className="font-semibold tabular-nums">{peso(i.lineTotalCentavos)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotalsBlock({ order }: { order: Order }) {
  const row = 'flex items-center justify-between py-1.5 text-sm';
  return (
    <dl className="ml-auto w-full max-w-sm">
      <div className={row}><dt className="text-mute">Subtotal</dt><dd className="tabular-nums">{peso(order.subtotalCentavos)}</dd></div>
      {order.discountCentavos > 0 && <div className={row}><dt className="text-mute">Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt><dd className="tabular-nums text-emerald-700">&minus;{peso(order.discountCentavos)}</dd></div>}
      <div className={row}><dt className="text-mute">Shipping</dt><dd className="tabular-nums">{order.shippingCentavos === 0 ? 'Free' : peso(order.shippingCentavos)}</dd></div>
      {order.refundedCentavos > 0 && <div className={row}><dt className="text-mute">Refunded</dt><dd className="tabular-nums">&minus;{peso(order.refundedCentavos)}</dd></div>}
      <div className="mt-2 flex items-center justify-between border-t border-ink pt-3"><dt className="text-sm font-semibold uppercase tracking-wider">Total</dt><dd className="font-display text-2xl tracking-tightest tabular-nums">{peso(order.totalCentavos)}</dd></div>
    </dl>
  );
}

export function AddressBlock({ order }: { order: Order }) {
  return (
    <address className="text-sm not-italic leading-relaxed">
      <span className="font-semibold">{order.shipName}</span><br />
      {order.shipLine1}<br />
      Brgy. {order.shipBarangay}, {order.shipCity}<br />
      {order.shipProvince} {order.shipPostalCode}<br />
      <span className="text-mute">{order.shipPhone}</span>
    </address>
  );
}

/** Shown while payment is outstanding. Wording depends on the payment method. */
export function PaymentInstructions({ order, instructions, token }: { order: Order; instructions: string; token?: string }) {
  if (order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'AUTHORIZED') return null;
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return null;
  const cod = order.paymentMethod === 'COD';
  return (
    <section className="border-2 border-gold bg-gold-soft p-5 sm:p-7" aria-labelledby="pay-h">
      <h2 id="pay-h" className="font-display text-xl tracking-tightest">{METHOD_HEADING[order.paymentMethod] ?? 'Payment'}</h2>
      <p className="mt-2 text-sm">{order.paymentMethod === 'PALLADIUM' ? 'DEMO order. Its simulated PALLADIUM payment has not been completed yet. Nothing real has been charged.' : instructions}</p>
      {order.paymentMethod === 'QRPH' && token && <QrPayment orderNumber={order.orderNumber} token={token} amount={peso(order.totalCentavos)} />}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wider text-mute">{cod ? 'Amount to prepare' : 'Amount to pay'}</dt><dd className="font-display text-2xl tracking-tightest">{peso(order.totalCentavos)}</dd></div>
        {!cod && <div><dt className="text-xs uppercase tracking-wider text-mute">Reference to use</dt><dd className="font-display text-2xl tracking-tightest">{order.orderNumber}</dd></div>}
      </dl>
      <p className="mt-4 text-xs text-mute">{cod ? 'We will confirm your order before it ships. Keep your phone nearby in case the courier calls.' : order.paymentMethod === 'QRPH' ? 'Your order is held while you pay. You will get an email as soon as your payment is confirmed.' : 'Your order is held for you. We confirm it as soon as we see your payment, and you will get an email.'}</p>
    </section>
  );
}

export function TrackingBlock({ shipment }: { shipment: Shipment | undefined }) {
  if (!shipment || !shipment.trackingNumber) return null;
  return (
    <section className="border border-line p-5 sm:p-7" aria-labelledby="track-h">
      <h2 id="track-h" className="font-display text-xl tracking-tightest">Tracking</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wider text-mute">Courier</dt><dd className="font-semibold">{shipment.courier ?? 'Courier'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-mute">Tracking number</dt><dd className="font-semibold">{shipment.trackingNumber}</dd></div>
        {shipment.shippedAt && <div><dt className="text-xs uppercase tracking-wider text-mute">Shipped</dt><dd>{fmtDateTime(shipment.shippedAt)}</dd></div>}
      </dl>
    </section>
  );
}

export function StatusTimeline({ events }: { events: OrderEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="relative ml-2 border-l border-line">
      {events.map((e, i) => (
        <li key={e.id} className="relative pb-6 pl-6 last:pb-0">
          <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${i === events.length - 1 ? 'bg-gold ring-4 ring-gold-soft' : 'bg-ink'}`} aria-hidden="true" />
          <p className="text-sm font-semibold">{e.message}</p>
          <p className="text-xs text-mute">{fmtDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}

export const orderStatusNote = (o: Pick<Order, 'status' | 'paymentStatus' | 'paymentMethod'>): string => {
  switch (o.status) {
    case 'PENDING': case 'PAYMENT_PENDING': return o.paymentMethod === 'COD' ? 'We received your order and will confirm it shortly.' : 'We received your order and are waiting for your payment.';
    case 'PAID': return 'Payment confirmed. We are getting your order ready.';
    case 'PROCESSING': return 'We are preparing your order.';
    case 'PACKED': return 'Your order is packed and waiting for the courier.';
    case 'SHIPPED': return 'Your order is on its way.';
    case 'DELIVERED': return 'Delivered. Enjoy your game!';
    case 'CANCELLED': return 'This order was cancelled.';
    case 'REFUNDED': return 'This order was refunded.';
    default: return '';
  }
};

export function NextSteps({ order }: { order: Order }) {
  const cod = order.paymentMethod === 'COD';
  const steps = ['CANCELLED', 'REFUNDED'].includes(order.status) ? [] : [
    cod ? 'We confirm your order (you may get a call or message).' : `You pay with ${METHOD_LABEL[order.paymentMethod] ?? 'your chosen method'} and we confirm the payment.`,
    'We pack your order, usually within 1 to 2 business days.',
    'You get an email with your tracking number when it ships.',
  ];
  if (!steps.length) return null;
  return (
    <section aria-labelledby="next-h">
      <h2 id="next-h" className="font-display text-xl tracking-tightest">What happens next</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => <li key={i} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center bg-ink text-xs font-bold text-gold">{i + 1}</span><span className="pt-0.5">{s}</span></li>)}
      </ol>
      <p className="mt-5 text-sm text-mute">Questions? <Link href="/pages/shipping" className="underline">Shipping policy</Link></p>
    </section>
  );
}

/** DEMO $PALLADIUM payment receipt. Clearly labelled: nothing was transferred and nothing is on a blockchain. */
export function DemoPaymentReceipt({ order }: { order: Order }) {
  if (order.paymentMethod !== 'PALLADIUM' || order.paymentMode !== 'DEMO' || order.paymentStatus !== 'PAID' || order.tokenAmountMinor == null) return null;
  const row = (k: string, v: React.ReactNode) => <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"><dt className="text-mute">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>;
  return (
    <section className="border border-ink bg-bone p-5 sm:p-7" aria-labelledby="demo-pay-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="demo-pay-h" className="font-display text-xl tracking-tightest">PALLADIUM payment</h2>
        <span className="border border-gold px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.16em] text-gold-deep">Demo</span>
      </div>
      <p className="mt-2 text-xs text-mute">DEMO MODE. This payment was simulated. No real cryptocurrency was transferred and no blockchain transaction took place.</p>
      <dl className="mt-3">
        {row('Paid', `${formatPalladiumMinor(order.tokenAmountMinor)} PALLADIUM`)}
        {row('PHP total', peso(order.totalCentavos))}
        {row('PALLADIUM price', order.tokenPriceCentavos != null ? `${peso(order.tokenPriceCentavos)} (demo)` : '-')}
        {row('Transaction', <span className="font-mono">{order.txId ?? '-'}</span>)}
        {row('Wallet', <span className="font-mono">{order.walletAddress ?? '-'}</span>)}
        {row('Network', DEMO_NETWORK_LABEL)}
        {row('Status', 'Confirmed')}
      </dl>
    </section>
  );
}

import 'server-only';
import { prisma } from './db';
import { audit } from './audit';
import { syncIntent, paymongoConfigured } from './paymongo';
import { queueCustomerEmail, processOutbox } from './email';

/**
 * Releases stock held by abandoned checkouts. A QR Ph / PALLADIUM order that was never paid keeps its items reserved, which would
 * slowly lock up limited stock. After `hours` unpaid, the order is cancelled and the stock goes back on sale.
 * Safety: before cancelling a QR Ph order every QR it ever had is re-checked with PayMongo; if any shows paid, or PayMongo cannot be reached,
 * the order is left alone for a human.
 */
export async function expireStaleOrders(hours = 24, limit = 50) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await prisma.order.findMany({
    where: { status: 'PAYMENT_PENDING', paymentStatus: 'PENDING', paymentMethod: { in: ['QRPH', 'PALLADIUM'] }, createdAt: { lt: cutoff } },
    select: { id: true, orderNumber: true, email: true, paymentMethod: true }, orderBy: { createdAt: 'asc' }, take: limit,
  });
  let cancelled = 0, skipped = 0;
  for (const o of rows) {
    try {
      if (o.paymentMethod === 'QRPH') {
        if (!paymongoConfigured()) { skipped++; continue; }
        const pay = await prisma.payment.findFirst({ where: { orderId: o.id }, orderBy: { createdAt: 'desc' }, select: { rawPayload: true } });
        const ids = ((pay?.rawPayload ?? {}) as { intentIds?: unknown }).intentIds;
        let paid = false;
        for (const id of Array.isArray(ids) ? ids : []) if (typeof id === 'string' && (await syncIntent(id)) === 'paid') paid = true;
        if (paid) { skipped++; continue; }
      }
      await prisma.$executeRaw`SELECT pal_cancel_order(${o.id}::text, ${'Not paid within 24 hours'}::text, ${null}::text)`;
      await audit(null, 'ORDER_AUTO_CANCELLED', 'Order', o.id, `Cancelled ${o.orderNumber}: not paid within ${hours} hours, stock released`);
      await queueCustomerEmail('ORDER_CANCELLED', `Order ${o.orderNumber} was cancelled because it was not paid`, o.email, o.id);
      cancelled++;
    } catch (e) { skipped++; console.error('[expire-orders]', o.orderNumber, e); }
  }
  if (cancelled) await processOutbox(20).catch(() => {});
  return { checked: rows.length, cancelled, skipped };
}

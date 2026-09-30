import 'server-only';
import crypto from 'node:crypto';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './errors';
import { audit } from './audit';
import { priceCart } from './cart';
import { providerFor, enabledMethods } from './payments';
import { processOutbox, queueCustomerEmail } from './email';
import { hashPassword, startSession, getUser, assertStrongPassword } from './auth';
import { normalizePhone } from './validators';
import type { SessionUser } from './auth';
import { z } from 'zod';
import { checkoutSchema } from './validators';

type Checkout = z.infer<typeof checkoutSchema>;

/** Signed token so guests can open their own confirmation page without an account. */
export function orderToken(orderId: string) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET ?? '').update(`order:${orderId}`).digest('hex').slice(0, 32);
}
export const verifyOrderToken = (orderId: string, t: string | undefined) => !!t && t.length === 32 && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(orderToken(orderId)));

export async function placeOrder(input: Checkout) {
  const acquisitionSource = input.source ?? null;
  const methods = await enabledMethods();
  if (!methods.includes(input.method)) throw new AppError(422, 'METHOD_DISABLED', 'That payment method is not available.', { method: 'Choose another payment method.' });

  const emailLower = input.email.toLowerCase();
  const sessionUser = await getUser();
  let customer = sessionUser ? await prisma.customer.findUnique({ where: { userId: sessionUser.id } }) : null;
  let newUser: SessionUser | null = null;

  if (!customer) {
    const existingUser = await prisma.user.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } });
    if (input.createAccount) {
      if (existingUser) throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Please sign in first.', { email: 'Account already exists. Sign in to continue.' });
      if (!input.password) throw new AppError(422, 'VALIDATION', 'Choose a password to create your account.', { password: 'Choose a password.' });
      assertStrongPassword(input.password);
    } else if (existingUser) {
      // Guest checkout with an e-mail that belongs to an account: allowed, but never attach the order to that account.
    }
    customer = await prisma.customer.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { email: emailLower, name: input.ship.name, phone: normalizePhone(input.phone), marketingOptIn: !!input.marketingOptIn, source: acquisitionSource ?? null } });
    }
    if (input.createAccount && !customer.userId) {
      const u = await prisma.user.create({ data: { email: emailLower, name: input.ship.name, passwordHash: await hashPassword(input.password!), role: 'CUSTOMER' } });
      customer = await prisma.customer.update({ where: { id: customer.id }, data: { userId: u.id } });
      newUser = { id: u.id, email: u.email, name: u.name, role: u.role };
    }
  }

  // Server-side price check (stock, discount, shipping) before touching inventory.
  const quote = await priceCart(input.items, input.discountCode, input.ship.province, customer.id);
  if (!quote.ok) throw new AppError(409, 'CART_CHANGED', quote.lines.find((l) => l.problem)?.problem ? `${quote.lines.find((l) => l.problem)!.productName}: ${quote.lines.find((l) => l.problem)!.problem}` : 'Your cart changed. Please review it.');
  if (quote.discountError) throw new AppError(422, 'DISCOUNT_INVALID', quote.discountError, { discountCode: quote.discountError });
  if (quote.shippingCentavos == null) throw new AppError(422, 'NO_SHIPPING', quote.shippingError ?? 'We cannot ship to that province.');

  const payload = {
    customerId: customer.id, email: emailLower, phone: normalizePhone(input.phone), method: input.method,
    discountCode: quote.discountCode, shippingCentavos: quote.shippingCentavos, shippingZone: quote.shippingZone,
    notes: input.notes ?? null, idempotencyKey: input.idempotencyKey,
    ship: { ...input.ship, phone: normalizePhone(input.ship.phone) },
    items: input.items,
  };
  const rows = await prisma.$queryRaw<{ r: { orderId: string; orderNumber: string; totalCentavos: number; duplicate: boolean } }[]>`SELECT pal_place_order(${JSON.stringify(payload)}::jsonb) AS r`;
  const res = rows[0].r;

  if (newUser) await startSession(newUser);
  if (!res.duplicate) {
    await prisma.customer.update({ where: { id: customer.id }, data: { name: customer.name || input.ship.name, phone: customer.phone ?? normalizePhone(input.phone), ...(input.marketingOptIn ? { marketingOptIn: true } : {}) } });
    if (input.saveAddress && (sessionUser || newUser)) {
      const count = await prisma.address.count({ where: { customerId: customer.id } });
      await prisma.address.create({ data: { customerId: customer.id, recipient: input.ship.name, phone: normalizePhone(input.ship.phone), line1: input.ship.line1, barangay: input.ship.barangay, city: input.ship.city, province: input.ship.province, postalCode: input.ship.postalCode, isDefault: count === 0 } });
    }
    if (input.marketingOptIn) await prisma.newsletterSubscriber.upsert({ where: { email: emailLower }, create: { email: emailLower }, update: {} });
  }
  const init = await providerFor(input.method).initiate({ id: res.orderId, orderNumber: res.orderNumber, totalCentavos: res.totalCentavos, method: input.method, email: emailLower });
  void processOutbox().catch(() => {});
  return { orderId: res.orderId, orderNumber: res.orderNumber, totalCentavos: res.totalCentavos, token: orderToken(res.orderId), init, duplicate: res.duplicate };
}

const orderNo = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id }, select: { orderNumber: true, email: true, paymentMethod: true, paymentStatus: true, status: true } }));

/** Confirms an order (deducts stock). Non-COD orders are marked paid; COD orders are confirmed, then marked paid on delivery. */
export async function confirmOrder(orderId: string, user: SessionUser, opts: { markPaid?: boolean; reference?: string } = {}) {
  const o = await orderNo(orderId);
  const markPaid = opts.markPaid ?? o.paymentMethod !== 'COD';
  await prisma.$executeRaw`SELECT pal_confirm_order(${orderId}::text, ${user.id}::text, ${markPaid}::boolean, ${opts.reference ?? null}::text)`;
  await audit(user, markPaid ? 'ORDER_PAYMENT_CONFIRMED' : 'ORDER_CONFIRMED', 'Order', orderId, `${markPaid ? 'Confirmed payment for' : 'Confirmed'} ${o.orderNumber}`);
  void processOutbox().catch(() => {});
}
export async function failPayment(orderId: string, user: SessionUser, reason?: string) {
  const o = await orderNo(orderId);
  await prisma.$executeRaw`SELECT pal_fail_payment(${orderId}::text, ${user.id}::text, ${reason ?? null}::text)`;
  await audit(user, 'ORDER_PAYMENT_FAILED', 'Order', orderId, `Marked payment failed for ${o.orderNumber}`);
}
export async function cancelOrder(orderId: string, user: SessionUser, reason?: string) {
  const o = await orderNo(orderId);
  await prisma.$executeRaw`SELECT pal_cancel_order(${orderId}::text, ${reason ?? null}::text, ${user.id}::text)`;
  await audit(user, 'ORDER_CANCELLED', 'Order', orderId, `Cancelled ${o.orderNumber}${reason ? `: ${reason}` : ''}`);
  await queueCustomerEmail('ORDER_CANCELLED', `Order ${o.orderNumber} was cancelled`, o.email, orderId);
  void processOutbox().catch(() => {});
}
export async function refundOrder(orderId: string, user: SessionUser, a: { amountCentavos: number; restock: boolean; items?: { orderItemId: string; qty: number }[]; reason?: string }) {
  const o = await orderNo(orderId);
  const items = a.items?.length ? JSON.stringify(a.items) : null;
  await prisma.$executeRaw`SELECT pal_refund_order(${orderId}::text, ${a.amountCentavos}::int, ${a.restock}::boolean, ${items}::jsonb, ${a.reason ?? null}::text, ${user.id}::text)`;
  await audit(user, 'ORDER_REFUNDED', 'Order', orderId, `Refunded ${(a.amountCentavos / 100).toFixed(2)} PHP on ${o.orderNumber}${a.restock ? ' (returned to stock)' : ''}`);
  void processOutbox().catch(() => {});
}

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ['PROCESSING', 'PACKED', 'SHIPPED'], PROCESSING: ['PACKED', 'SHIPPED'], PACKED: ['SHIPPED'], SHIPPED: ['DELIVERED'],
};
export const nextStatuses = (s: OrderStatus): OrderStatus[] => NEXT[s] ?? [];

export async function updateFulfillment(orderId: string, user: SessionUser, to: OrderStatus, ship: { courier?: string; trackingNumber?: string }) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!NEXT[o.status]?.includes(to)) throw new AppError(409, 'INVALID_STATE', `Cannot move an order from ${o.status} to ${to}. ${o.status === 'PENDING' || o.status === 'PAYMENT_PENDING' ? 'Confirm the order first.' : ''}`.trim());
  if (to === 'SHIPPED' && !ship.trackingNumber && !(await prisma.shipment.findFirst({ where: { orderId, trackingNumber: { not: null } } }))) {
    throw new AppError(422, 'TRACKING_REQUIRED', 'Add a tracking number before marking as shipped.', { trackingNumber: 'Required to ship.' });
  }
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    const shStatus = to === 'PACKED' ? 'PACKED' : to === 'SHIPPED' ? 'SHIPPED' : to === 'DELIVERED' ? 'DELIVERED' : 'PENDING';
    const existing = await tx.shipment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    const data = { status: shStatus as 'PENDING', ...(ship.courier ? { courier: ship.courier } : {}), ...(ship.trackingNumber ? { trackingNumber: ship.trackingNumber } : {}), ...(to === 'SHIPPED' ? { shippedAt: new Date() } : {}), ...(to === 'DELIVERED' ? { deliveredAt: new Date() } : {}) };
    if (existing) await tx.shipment.update({ where: { id: existing.id }, data });
    else await tx.shipment.create({ data: { orderId, feeCentavos: o.shippingCentavos, ...data } });
    await tx.orderEvent.create({ data: { orderId, type: 'STATUS', message: `Status changed to ${to}${to === 'SHIPPED' && ship.trackingNumber ? ` (tracking ${ship.trackingNumber})` : ''}`, actor: user.name } });
  });
  if (to === 'DELIVERED' && o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID') {
    await prisma.$executeRaw`SELECT pal_confirm_order(${orderId}::text, ${user.id}::text, true::boolean, ${'COD collected'}::text)`;
  }
  await audit(user, 'ORDER_STATUS', 'Order', orderId, `Marked ${o.orderNumber} as ${to.toLowerCase()}`);
  const titles: Partial<Record<OrderStatus, [string, string]>> = { PROCESSING: ['ORDER_PROCESSING', 'is being prepared'], SHIPPED: ['ORDER_SHIPPED', 'has shipped'], DELIVERED: ['ORDER_DELIVERED', 'was delivered'] };
  const t = titles[to];
  if (t) { await queueCustomerEmail(t[0], `Your order ${o.orderNumber} ${t[1]}`, o.email, orderId); void processOutbox().catch(() => {}); }
}

export async function saveTracking(orderId: string, user: SessionUser, ship: { courier?: string; trackingNumber?: string }) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const existing = await prisma.shipment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  if (existing) await prisma.shipment.update({ where: { id: existing.id }, data: { courier: ship.courier ?? existing.courier, trackingNumber: ship.trackingNumber ?? existing.trackingNumber } });
  else await prisma.shipment.create({ data: { orderId, courier: ship.courier, trackingNumber: ship.trackingNumber, feeCentavos: o.shippingCentavos } });
  await prisma.orderEvent.create({ data: { orderId, type: 'TRACKING', message: `Tracking updated: ${ship.courier ?? ''} ${ship.trackingNumber ?? ''}`.trim(), actor: user.name } });
  await audit(user, 'ORDER_TRACKING', 'Order', orderId, `Updated tracking on ${o.orderNumber}`);
}

import 'server-only';
import nodemailer from 'nodemailer';
import { prisma } from './db';
import { peso } from './money';
import { getSetting } from './settings';

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
let transport: nodemailer.Transporter | null | undefined;
function getTransport() {
  if (transport !== undefined) return transport;
  transport = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined }) : null;
  return transport;
}

const wrap = (title: string, body: string, store: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111"><div style="background:#0b0b0c;color:#fff;padding:20px 24px;font-size:22px;font-weight:800;letter-spacing:-1px">${store.toLowerCase()}<span style="color:#f2cf46">x</span></div><div style="padding:24px"><h2 style="margin:0 0 12px">${title}</h2>${body}</div></div>`;

async function bodyFor(n: { kind: string; title: string; link: string | null }) {
  const store = (await getSetting('store')).name;
  const orderId = n.link?.split('/').pop();
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, shipments: { orderBy: { createdAt: 'desc' }, take: 1 } } }) : null;
  let html = `<p>${n.title}.</p>`;
  if (order) {
    const rows = order.items.map((i) => `<tr><td>${i.productName} (${i.variantName}) x${i.quantity}</td><td style="text-align:right">${peso(i.lineTotalCentavos)}</td></tr>`).join('');
    const track = order.shipments[0]?.trackingNumber ? `<p>Courier: ${order.shipments[0].courier ?? '-'}<br>Tracking number: <b>${order.shipments[0].trackingNumber}</b></p>` : '';
    html = `<p>Hi ${order.shipName},</p><p>${n.title}.</p><table style="width:100%;border-collapse:collapse">${rows}<tr><td>Shipping</td><td style="text-align:right">${peso(order.shippingCentavos)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${peso(order.totalCentavos)}</b></td></tr></table>${track}<p><a href="${site()}${n.link}">View your order ${order.orderNumber}</a></p>`;
  }
  return wrap(n.title, html, store);
}

/** Sends queued EMAIL notifications. Safe to call repeatedly; each row is marked sent once.
 *  Newest first, and demo addresses (@example.*) are skipped, so old undeliverable rows can never block a real customer's email. */
export async function processOutbox(limit = 25): Promise<{ sent: number; logged: number; failed: number }> {
  const rows = await prisma.notification.findMany({ where: { channel: 'EMAIL', sentAt: null, recipient: { not: null }, NOT: { recipient: { contains: '@example.', mode: 'insensitive' } } }, orderBy: { createdAt: 'desc' }, take: limit });
  const t = getTransport();
  const from = process.env.MAIL_FROM ?? 'Palladium <orders@palladiumpickleball.com>';
  let sent = 0, logged = 0, failed = 0;
  for (const n of rows) {
    try {
      const html = await bodyFor(n);
      if (t) { await t.sendMail({ from, to: n.recipient!, subject: n.title, html }); sent++; }
      else { console.log(`[email:dev] to=${n.recipient} subject="${n.title}"`); logged++; }
      await prisma.notification.update({ where: { id: n.id }, data: { sentAt: new Date() } });
    } catch (e) { failed++; console.error('[email] failed', n.id, e); }
  }
  return { sent, logged, failed };
}

export async function queueCustomerEmail(kind: string, title: string, recipient: string, orderId: string) {
  await prisma.notification.create({ data: { audience: 'CUSTOMER', kind, title, channel: 'EMAIL', recipient, link: `/account/orders/${orderId}` } });
}

/** Sends a password-reset email immediately. With no SMTP configured it logs the link (dev / first launch). */
export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  const store = (await getSetting('store')).name;
  const html = wrap('Reset your password', `<p>Hi ${name},</p><p>We received a request to reset your password. This link works once and expires in 1 hour.</p><p><a href="${link}" style="display:inline-block;background:#0b0b0c;color:#fff;padding:12px 20px;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:12px;color:#666">If you did not ask for this, you can ignore this email. Your password will not change.</p>`, store);
  const t = getTransport();
  if (!t) { console.log(`[email:dev] password reset for ${to}: ${link}`); return; }
  await t.sendMail({ from: process.env.MAIL_FROM ?? 'Palladium <orders@palladiumpickleball.com>', to, subject: `Reset your ${store} password`, html });
}

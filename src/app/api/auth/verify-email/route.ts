import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { assertSameOrigin } from '@/lib/api';
import { verifyVerifyToken, createResetToken, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * Link from the confirmation email. Opening it changes nothing: email scanners open links on their own, so it only shows the
 * /confirm-email page, whose button posts back here.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  return NextResponse.redirect(`${site()}/confirm-email?token=${encodeURIComponent(token)}`);
}

/**
 * The person pressed "Confirm" on /confirm-email, proving they own the address. Their past guest orders are linked to the account.
 * The account's password was typed by whoever signed up, which may not be the owner, so it is replaced and the owner chooses a
 * password on the next page. This also signs out anyone else using the account. Nothing signs in from here.
 */
export async function POST(req: Request) {
  try { assertSameOrigin(req); } catch { return NextResponse.redirect(`${site()}/login?verify=failed`, 303); }
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  const u = await verifyVerifyToken(token);
  if (!u) return NextResponse.redirect(`${site()}/login?verify=failed`, 303);
  const mine = await prisma.customer.findUnique({ where: { userId: u.id } });
  if (!mine) {
    const guest = await prisma.customer.findFirst({ where: { email: { equals: u.email, mode: 'insensitive' }, userId: null } });
    if (guest) await prisma.customer.update({ where: { id: guest.id }, data: { userId: u.id, name: u.name } });
    else await prisma.customer.create({ data: { email: u.email.toLowerCase(), name: u.name, userId: u.id } }).catch(() => {});
  }
  const fresh = await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(randomBytes(32).toString('base64url')) } });
  return NextResponse.redirect(`${site()}/reset-password?token=${encodeURIComponent(await createResetToken(fresh))}&confirmed=1`, 303);
}

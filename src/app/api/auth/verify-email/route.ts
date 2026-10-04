import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyVerifyToken, startSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Link from the confirmation email. Proves the person owns the address, links their existing guest record, signs them in. Safe to open twice. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const u = await verifyVerifyToken(token);
  if (!u) return NextResponse.redirect(`${site()}/login?verify=failed`);
  const mine = await prisma.customer.findUnique({ where: { userId: u.id } });
  if (!mine) {
    const guest = await prisma.customer.findFirst({ where: { email: { equals: u.email, mode: 'insensitive' }, userId: null } });
    if (guest) await prisma.customer.update({ where: { id: guest.id }, data: { userId: u.id, name: u.name } });
    else await prisma.customer.create({ data: { email: u.email.toLowerCase(), name: u.name, userId: u.id } }).catch(() => {});
  }
  await startSession({ id: u.id, email: u.email, name: u.name, role: u.role });
  return NextResponse.redirect(`${site()}/`);
}

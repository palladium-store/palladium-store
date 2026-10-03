import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { finish, GOOGLE_COOKIE } from '@/lib/google-oauth';
import { startSession, hashPassword } from '@/lib/auth';
import { isStaff } from '@/lib/rbac';
import { safeNext } from '@/components/store/labels';

export const dynamic = 'force-dynamic';

/** A password nobody knows. Google-only accounts can still set a real one later with "Forgot your password?". */
const unusablePassword = () => hashPassword(randomBytes(32).toString('base64url'));

/** Step 2: Google sends the visitor back here. Verify, then sign in to (or create) the account for that verified email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (reason: string) => {
    const r = NextResponse.redirect(new URL(`/login?google=${reason}`, url.origin));
    r.cookies.set(GOOGLE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return r;
  };

  let saved: { s?: string; n?: string; v?: string; next?: string | null } = {};
  try { saved = JSON.parse(cookies().get(GOOGLE_COOKIE)?.value ?? '{}'); } catch { saved = {}; }

  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code || !saved.s || !saved.n || !saved.v || url.searchParams.get('state') !== saved.s) return back('expired');

  try {
    const g = await finish(code, saved.v, `${url.origin}/api/auth/google/callback`, saved.n);
    if (!g) return back('failed');

    let user = await prisma.user.findFirst({ where: { email: { equals: g.email, mode: 'insensitive' } } });
    if (user) {
      if (!user.isActive) return back('failed');
      // Staff keep signing in with their password, so a hijacked Gmail cannot open the admin area.
      if (isStaff(user.role)) return back('staff');
      const linked = await prisma.customer.findUnique({ where: { userId: user.id } });
      if (!linked) {
        // Someone signed up with this email but never confirmed it. Google has now proved who owns the address, so throw away the
        // unconfirmed password (it may not be theirs) before linking the account.
        user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await unusablePassword() } });
      }
    } else {
      user = await prisma.user.create({ data: { email: g.email, name: g.name, passwordHash: await unusablePassword(), role: 'CUSTOMER' } });
    }

    if (!(await prisma.customer.findUnique({ where: { userId: user.id } }))) {
      // The email is verified by Google, so it is safe to attach past guest orders made with it.
      const guest = await prisma.customer.findFirst({ where: { email: { equals: g.email, mode: 'insensitive' }, userId: null } });
      if (guest) await prisma.customer.update({ where: { id: guest.id }, data: { userId: user.id } });
      else await prisma.customer.create({ data: { email: g.email, name: user.name, userId: user.id, source: 'google' } }).catch(() => {});
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });

    const r = NextResponse.redirect(new URL(safeNext(saved.next) ?? '/account', url.origin));
    r.cookies.set(GOOGLE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return r;
  } catch (e) {
    console.error('[google callback]', e);
    return back('failed');
  }
}

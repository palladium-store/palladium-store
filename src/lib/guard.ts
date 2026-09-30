import 'server-only';
import { redirect } from 'next/navigation';
import { getUser } from './auth';
import { prisma } from './db';
import { can, isStaff, type Permission } from './rbac';

/** For server-rendered admin pages: redirects instead of throwing. Call at the top of every admin page. */
export async function guard(perm: Permission | null) {
  const u = await getUser();
  if (!u || !isStaff(u.role)) redirect('/login?next=/admin');
  if (perm && !can(u.role, perm)) redirect('/admin?denied=1');
  return u;
}
/** For customer account pages. Returns the signed-in customer profile. */
export async function customerGuard(next = '/account') {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  const customer = await prisma.customer.findUnique({ where: { userId: u.id } });
  if (!customer) redirect('/');
  return { user: u, customer };
}

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { guard } from '@/lib/guard';
import { NAV, can, ROLE_LABELS } from '@/lib/rbac';
import { AdminShell } from '@/components/admin/AdminShell';
import { StoreShell } from '@/components/store/store-shell';
import { ADMIN_THEME_COOKIE } from '@/components/admin/theme-cookie';

export const metadata: Metadata = { title: { default: 'Palladium Admin', template: '%s | Palladium Admin' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await guard(null);
  const nav = NAV.filter((n) => !n.perm || can(user.role, n.perm));
  const theme = cookies().get(ADMIN_THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  return (
    <StoreShell className={`theme-admin${theme === 'light' ? ' admin-light' : ''}`}>
      <AdminShell user={{ name: user.name, role: ROLE_LABELS[user.role] }} nav={nav} canAudit={can(user.role, 'VIEW_AUDIT')} initialTheme={theme}>{children}</AdminShell>
    </StoreShell>
  );
}

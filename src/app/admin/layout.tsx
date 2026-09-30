import type { Metadata } from 'next';
import { guard } from '@/lib/guard';
import { NAV, can, ROLE_LABELS } from '@/lib/rbac';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: { default: 'Palladium Admin', template: '%s | Palladium Admin' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await guard(null);
  const nav = NAV.filter((n) => !n.perm || can(user.role, n.perm));
  return <AdminShell user={{ name: user.name, role: ROLE_LABELS[user.role] }} nav={nav} canAudit={can(user.role, 'VIEW_AUDIT')}>{children}</AdminShell>;
}

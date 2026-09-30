import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { can } from '@/lib/rbac';
import { fmtDateTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/PageHeader';
import { GeneralSettings, PaymentSettings } from '@/components/admin/SettingsForms';
import { ShippingEditor, type ZoneData } from '@/components/admin/ShippingEditor';
import { StaffManager, type StaffRow } from '@/components/admin/StaffManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await guard('MANAGE_SETTINGS');
  const canStaff = can(user.role, 'MANAGE_STAFF');
  const tabs = [['general', 'General'], ['payments', 'Payments'], ['shipping', 'Shipping'], ...(canStaff ? [['staff', 'Staff & roles']] : [])] as [string, string][];
  const tab = tabs.some(([k]) => k === searchParams.tab) ? (searchParams.tab as string) : 'general';

  let body: React.ReactNode = null;
  if (tab === 'general') {
    const s = await getSetting('store');
    body = <GeneralSettings initial={{ name: s.name, email: s.email, phone: s.phone, address: s.address, facebook: s.facebook ?? '', instagram: s.instagram ?? '' }} />;
  } else if (tab === 'payments') {
    body = <PaymentSettings initial={await getSetting('payments')} />;
  } else if (tab === 'shipping') {
    const zones = await prisma.shippingZone.findMany({ include: { rates: { orderBy: [{ minWeightGrams: 'asc' }, { rateCentavos: 'asc' }] } } });
    const order = ['Metro Manila', 'Luzon', 'Visayas', 'Mindanao'];
    zones.sort((a, b) => (order.indexOf(a.name) === -1 ? 99 : order.indexOf(a.name)) - (order.indexOf(b.name) === -1 ? 99 : order.indexOf(b.name)) || a.name.localeCompare(b.name));
    const data: ZoneData[] = zones.map((z) => ({
      id: z.id, name: z.name, provinces: z.provinces,
      rates: z.rates.map((r) => ({ id: r.id, name: r.name, minWeightGrams: r.minWeightGrams, maxWeightGrams: r.maxWeightGrams, rateCentavos: r.rateCentavos, freeOverCentavos: r.freeOverCentavos, courier: r.courier })),
    }));
    // Saving recreates rates with new ids, so the changing key remounts the editor with fresh data after router.refresh().
    const key = zones.map((z) => z.id + z.rates.map((r) => r.id).join(',')).join('|');
    body = <ShippingEditor key={key} initial={data} />;
  } else if (tab === 'staff' && canStaff) {
    const users = await prisma.user.findMany({ where: { role: { not: 'CUSTOMER' } }, orderBy: [{ createdAt: 'asc' }], select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } });
    const rows: StaffRow[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginLabel: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never', isSelf: u.id === user.id }));
    body = <StaffManager staff={rows} activeSuperAdmins={users.filter((u) => u.role === 'SUPER_ADMIN' && u.isActive).length} />;
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Store details, payment methods, shipping rates and team access."
        actions={<Link href="/admin/content" className="btn-ghost btn-sm">Storefront content</Link>} />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/settings?tab=${k}`} role="tab" aria-selected={tab === k}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-gold text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{l}</Link>
        ))}
      </div>
      {body}
    </div>
  );
}

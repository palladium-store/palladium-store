import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/PageHeader';
import { DiscountManager, type DiscountRow } from '@/components/admin/DiscountManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Discounts' };

export default async function DiscountsPage() {
  await guard('MANAGE_DISCOUNTS');
  const now = new Date();
  const [discounts, products, categories] = await Promise.all([
    prisma.discount.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.product.findMany({ where: { status: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  const rows: DiscountRow[] = discounts.map((d) => {
    const exhausted = d.usageLimit != null && d.timesUsed >= d.usageLimit;
    const state: DiscountRow['state'] = !d.isActive ? 'DISABLED' : (d.endsAt && d.endsAt < now) || exhausted ? 'EXPIRED' : d.startsAt && d.startsAt > now ? 'SCHEDULED' : 'ACTIVE';
    return {
      id: d.id, code: d.code, type: d.type, value: d.value, minOrderCentavos: d.minOrderCentavos, maxDiscountCentavos: d.maxDiscountCentavos,
      startsAt: d.startsAt?.toISOString() ?? null, endsAt: d.endsAt?.toISOString() ?? null,
      startsLabel: d.startsAt ? fmtDateTime(d.startsAt) : '', endsLabel: d.endsAt ? fmtDateTime(d.endsAt) : '',
      usageLimit: d.usageLimit, perCustomerLimit: d.perCustomerLimit, timesUsed: d.timesUsed, productIds: d.productIds, categoryIds: d.categoryIds, isActive: d.isActive, state,
    };
  });
  return (
    <div>
      <PageHeader title="Discounts" subtitle="Create and manage discount codes for checkout. Codes that reach their usage limit are shown as expired."
        actions={<Link href="/admin/marketing" className="btn-ghost btn-sm">Marketing</Link>} />
      <DiscountManager rows={rows} products={products} categories={categories} />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { peso } from '@/lib/money';
import { fmtDate } from '@/lib/time';
import { EmptyState, Pagination } from '@/components/ui/bits';
import { PageHeader, StatCard } from '@/components/admin/PageHeader';
import { CopyEmails, ReviewModeration, type ReviewItem } from '@/components/admin/MarketingActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketing' };

const PAGE_SIZE = 25;

export default async function MarketingPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await guard('MANAGE_DISCOUNTS');
  const now = new Date();
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const hiddenOnly = searchParams.reviews === 'hidden';
  const activeWhere = { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };

  const [activeCodes, subCount, subs, allEmails, reviews, hiddenCount, reviewCount] = await Promise.all([
    prisma.discount.findMany({ where: activeWhere, orderBy: { timesUsed: 'desc' } }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 20000, select: { email: true } }),
    prisma.review.findMany({ where: hiddenOnly ? { isApproved: false } : {}, orderBy: { createdAt: 'desc' }, take: 20, include: { product: { select: { id: true, name: true } } } }),
    prisma.review.count({ where: { isApproved: false } }),
    prisma.review.count(),
  ]);
  const activeCodesLive = activeCodes.filter((d) => d.usageLimit == null || d.timesUsed < d.usageLimit);
  const pages = Math.max(Math.ceil(subCount / PAGE_SIZE), 1);
  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id, product: r.product.name, productId: r.product.id, author: r.authorName, rating: Math.min(Math.max(r.rating, 1), 5), title: r.title, body: r.body,
    verified: r.verified, isDemo: r.isDemo, isApproved: r.isApproved, dateLabel: fmtDate(r.createdAt),
  }));

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Discount codes, newsletter subscribers and customer review moderation."
        actions={<><Link href="/admin/discounts" className="btn-outline btn-sm">Manage discounts</Link><Link href="/admin/content" className="btn-outline btn-sm">Storefront content</Link></>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active codes" value={activeCodesLive.length} />
        <StatCard label="Code redemptions" value={activeCodesLive.reduce((a, d) => a + d.timesUsed, 0)} hint="Across active codes" />
        <StatCard label="Newsletter subscribers" value={subCount.toLocaleString('en-PH')} />
        <StatCard label="Hidden reviews" value={hiddenCount} hint={`${reviewCount} review${reviewCount === 1 ? '' : 's'} in total`} tone={hiddenCount ? 'warn' : undefined} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg tracking-tightest">Active discount codes</h2><Link href="/admin/discounts" className="text-sm font-semibold underline">All discounts</Link></div>
        {activeCodesLive.length === 0 ? <EmptyState title="No active discount codes" text="Create a code to run a promotion." action={<Link href="/admin/discounts" className="btn-primary btn-sm">Create discount</Link>} />
          : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCodesLive.map((d) => (
                <div key={d.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-base font-semibold">{d.code}</span><span className="text-sm font-semibold">{d.type === 'PERCENTAGE' ? `${d.value}% off` : `${peso(d.value)} off`}</span></div>
                  <div className="mt-2 text-sm text-mute">Used <strong className="text-ink">{d.timesUsed}</strong> / {d.usageLimit ?? 'unlimited'}{d.minOrderCentavos ? ` · min ${peso(d.minOrderCentavos)}` : ''}</div>
                  {d.endsAt && <div className="text-xs text-mute">Ends {fmtDate(d.endsAt)}</div>}
                </div>
              ))}
            </div>
          )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg tracking-tightest">Newsletter subscribers</h2><CopyEmails emails={allEmails.map((s) => s.email)} /></div>
        {subs.length === 0 ? <EmptyState title="No subscribers yet" text="Emails collected from the storefront newsletter form appear here." />
          : (
            <>
              <div className="table-wrap"><table className="tbl min-w-[420px]"><thead><tr><th>Email</th><th>Subscribed</th></tr></thead>
                <tbody>{subs.map((s) => <tr key={s.id}><td>{s.email}</td><td className="whitespace-nowrap text-mute">{fmtDate(s.createdAt)}</td></tr>)}</tbody></table></div>
              <Pagination page={page} pages={pages} total={subCount} base="/admin/marketing" params={{ reviews: searchParams.reviews }} />
            </>
          )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-tightest">Review moderation</h2>
          <div className="flex gap-1 text-sm">
            <Link href="/admin/marketing" className={`rounded-full px-3 py-1.5 font-semibold ${!hiddenOnly ? 'bg-ink text-paper' : 'border border-line'}`}>Recent</Link>
            <Link href="/admin/marketing?reviews=hidden" className={`rounded-full px-3 py-1.5 font-semibold ${hiddenOnly ? 'bg-ink text-paper' : 'border border-line'}`}>Hidden ({hiddenCount})</Link>
          </div>
        </div>
        {reviewItems.length === 0 ? <EmptyState title={hiddenOnly ? 'No hidden reviews' : 'No reviews yet'} text="Customer reviews appear here so you can hide or approve them." />
          : <ReviewModeration reviews={reviewItems} />}
        <p className="mt-2 text-xs text-mute">Showing the 20 most recent{hiddenOnly ? ' hidden' : ''} reviews. Hidden reviews are not shown in the store.</p>
      </section>
    </div>
  );
}

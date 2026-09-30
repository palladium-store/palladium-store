import Link from 'next/link';
import { customerGuard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { peso } from '@/lib/money';
import { fmtDate } from '@/lib/time';
import { Badge, EmptyState } from '@/components/ui/bits';

export const dynamic = 'force-dynamic';
const OPEN = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED'] as const;

export default async function AccountHome() {
  const { customer } = await customerGuard('/account');
  const [orderCount, openCount, wishCount, addrCount, latest] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.order.count({ where: { customerId: customer.id, status: { in: [...OPEN] } } }),
    prisma.wishlistItem.count({ where: { customerId: customer.id } }),
    prisma.address.count({ where: { customerId: customer.id } }),
    prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { placedAt: 'desc' }, take: 3, include: { _count: { select: { items: true } } } }),
  ]);
  const stats = [
    { label: 'Orders', value: orderCount, href: '/account/orders' }, { label: 'In progress', value: openCount, href: '/account/orders' },
    { label: 'Wishlist', value: wishCount, href: '/account/wishlist' }, { label: 'Saved addresses', value: addrCount, href: '/account/addresses' },
  ];
  return (
    <div className="space-y-10">
      <div>
        <h2 className="h-display text-2xl sm:text-3xl">Welcome back, {customer.name.split(' ')[0]}.</h2>
        <p className="mt-1 text-sm text-mute">{customer.email}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition hover:border-ink">
            <p className="h-display text-3xl">{s.value}</p><p className="mt-1 text-xs uppercase tracking-wider text-mute">{s.label}</p>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl tracking-tightest">Latest orders</h2>{orderCount > 0 && <Link href="/account/orders" className="text-xs font-semibold uppercase tracking-[0.14em] underline underline-offset-4">View all</Link>}</div>
        {latest.length === 0 ? (
          <EmptyState title="No orders yet" text="When you place an order it will show up here." action={<Link href="/shop" className="btn-primary">Start shopping</Link>} />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {latest.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-bone">
                  <div><p className="font-semibold">{o.orderNumber}</p><p className="text-xs text-mute">{fmtDate(o.placedAt)} &middot; {o._count.items} line{o._count.items === 1 ? '' : 's'}</p></div>
                  <div className="flex items-center gap-4"><Badge status={o.status} /><span className="font-semibold tabular-nums">{peso(o.totalCentavos)}</span></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

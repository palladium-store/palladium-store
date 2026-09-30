import Link from 'next/link';
import { customerGuard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { peso } from '@/lib/money';
import { fmtDate } from '@/lib/time';
import { Badge, EmptyState, Pagination } from '@/components/ui/bits';

export const dynamic = 'force-dynamic';
const SIZE = 10;

export default async function OrdersPage({ searchParams }: { searchParams: { page?: string } }) {
  const { customer } = await customerGuard('/account/orders');
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { placedAt: 'desc' }, skip: (page - 1) * SIZE, take: SIZE, include: { items: { select: { quantity: true, productName: true } } } }),
  ]);
  const pages = Math.max(Math.ceil(total / SIZE), 1);
  return (
    <div>
      <h2 className="h-display mb-6 text-2xl sm:text-3xl">Orders</h2>
      {orders.length === 0 ? (
        <EmptyState title={total ? 'No orders on this page' : 'No orders yet'} text="Your orders will be listed here." action={<Link href={total ? '/account/orders' : '/shop'} className="btn-primary">{total ? 'Back to first page' : 'Start shopping'}</Link>} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((o) => {
            const units = o.items.reduce((a, i) => a + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-5 transition hover:bg-bone">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.orderNumber}</p>
                    <p className="text-xs text-mute">{fmtDate(o.placedAt)} &middot; {units} item{units === 1 ? '' : 's'}</p>
                    <p className="mt-1 max-w-md truncate text-sm text-mute">{o.items.map((i) => i.productName).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-4"><Badge status={o.status} /><span className="font-semibold tabular-nums">{peso(o.totalCentavos)}</span></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pages={pages} total={total} base="/account/orders" />
    </div>
  );
}

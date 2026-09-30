import Link from 'next/link';
import { customerGuard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { listProducts } from '@/lib/queries/catalog';
import { EmptyState } from '@/components/ui/bits';
import { ProductCard } from '@/components/store/product-card';
import { RemoveWishlistButton } from '@/components/store/account-forms';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const { customer } = await customerGuard('/account/wishlist');
  const rows = await prisma.wishlistItem.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, select: { productId: true } });
  const ids = rows.map((r) => r.productId);
  const { items } = ids.length ? await listProducts({ ids, pageSize: 48 }) : { items: [] };
  const ordered = ids.map((id) => items.find((p) => p.id === id)).filter((p): p is (typeof items)[number] => !!p);
  return (
    <div>
      <h2 className="h-display mb-6 text-2xl sm:text-3xl">Wishlist</h2>
      {ordered.length === 0 ? (
        <EmptyState title="Your wishlist is empty" text="Tap the heart on any product to save it here." action={<Link href="/shop" className="btn-primary">Browse the shop</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
          {ordered.map((p) => (
            <div key={p.id}><ProductCard p={p} refreshOnWishChange /><RemoveWishlistButton productId={p.id} name={p.name} /></div>
          ))}
        </div>
      )}
    </div>
  );
}

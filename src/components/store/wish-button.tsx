'use client';
import { useRouter } from 'next/navigation';
import { useWishlist } from './wishlist-context';

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/** Icon heart used on product cards. `refreshOnChange` re-renders the server page after a change (wishlist page). */
export function WishButton({ productId, name, refreshOnChange = false, className = '' }: { productId: string; name: string; refreshOnChange?: boolean; className?: string }) {
  const { has, toggle, busy } = useWishlist();
  const router = useRouter();
  const on = has(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      disabled={busy === productId}
      onClick={async () => { const ok = await toggle(productId); if (ok && refreshOnChange) router.refresh(); }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow transition hover:scale-110 hover:text-gold-deep disabled:opacity-60 ${on ? 'text-gold-deep' : ''} ${className}`}
    >
      <Heart filled={on} />
    </button>
  );
}

/** Text variant for the product page. */
export function WishTextButton({ productId, name }: { productId: string; name: string }) {
  const { has, toggle, busy } = useWishlist();
  const on = has(productId);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`} disabled={busy === productId}
      onClick={() => void toggle(productId)} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink underline-offset-4 hover:underline disabled:opacity-60">
      <Heart filled={on} /> {on ? 'Saved to wishlist' : 'Save to wishlist'}
    </button>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { peso } from '@/lib/money';
import { useCart } from './cart-context';
import { useQuote } from './use-quote';
import { QtyStepper } from './qty-stepper';
import { Img } from './img';

export function CartDrawer() {
  const { drawerOpen, closeDrawer, lines, set, remove, ready } = useCart();
  const { quote, loading, error, refresh } = useQuote(lines, { enabled: drawerOpen });
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) { setShown(false); return; }
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;
  const byId = new Map((quote?.lines ?? []).map((l) => [l.variantId, l]));

  return (
    <div className="no-print fixed inset-0 z-[80]">
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={closeDrawer} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Shopping cart" className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl tracking-tightest">Your cart</h2>
          <button ref={closeRef} onClick={closeDrawer} aria-label="Close cart" className="-mr-2 px-2 text-3xl leading-none text-mute hover:text-ink">&times;</button>
        </div>

        {!ready ? null : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-display text-2xl tracking-tightest">Your cart is empty</p>
            <p className="text-sm text-mute">Nothing here yet. Find your next paddle, balls or grips.</p>
            <Link href="/shop" onClick={closeDrawer} className="btn-primary">Shop all</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => {
                const q = byId.get(l.variantId);
                return (
                  <li key={l.variantId} className="flex gap-4 py-4">
                    <div className="relative h-24 w-20 shrink-0 bg-ink"><Img src={q?.imageUrl} alt={q?.productName ?? 'Cart item'} sizes="80px" className="object-contain" /></div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {q?.slug ? <Link href={`/products/${q.slug}`} onClick={closeDrawer} className="block truncate text-sm font-semibold hover:underline">{q.productName}</Link> : <p className="text-sm font-semibold">{q?.productName ?? 'Loading...'}</p>}
                          {q?.variantName && <p className="text-xs text-mute">{q.variantName}</p>}
                        </div>
                        <p className="text-sm font-semibold tabular-nums">{q ? peso(q.lineTotalCentavos) : ''}</p>
                      </div>
                      {q?.problem && <p className="mt-1 text-xs font-semibold text-red-600">{q.problem}</p>}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <QtyStepper value={l.qty} max={Math.max(1, Math.min(q?.available ?? 99, 99))} onChange={(n) => set(l.variantId, n)} label={`Quantity for ${q?.productName ?? 'item'}`} />
                        <button onClick={() => remove(l.variantId)} className="text-xs text-mute underline underline-offset-4 hover:text-ink" aria-label={`Remove ${q?.productName ?? 'item'} from cart`}>Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line bg-bone px-5 py-4">
              {error && <p className="mb-3 text-xs text-red-600">{error} <button onClick={refresh} className="underline">Try again</button></p>}
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold uppercase tracking-wider">Subtotal</span>
                <span className="font-display text-lg tracking-tightest tabular-nums">{quote ? peso(quote.subtotalCentavos) : loading ? '...' : ''}</span>
              </div>
              <p className="mt-1 text-xs text-mute">Shipping and discount codes are applied on the cart and checkout pages.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/cart" onClick={closeDrawer} className="btn-outline">View cart</Link>
                {quote && quote.ok ? <Link href="/checkout" onClick={closeDrawer} className="btn-gold">Checkout</Link> : <button className="btn-gold" disabled>{loading ? 'Checking...' : 'Checkout'}</button>}
              </div>
              {quote && !quote.ok && <p className="mt-2 text-xs text-red-600">Fix the items marked above to check out.</p>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

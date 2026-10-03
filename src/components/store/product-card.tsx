'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePalladiumWallet } from './palladium/wallet';
import { peso } from '@/lib/money';
import { getPalladiumPricePhp, phpToPalladium, formatPalladium } from '@/lib/palladium-price';
import { Img } from './img';
import { Stars } from './stars';
import { WishButton } from './wish-button';
import { swatchColor } from './swatch';
import { useCart } from './cart-context';
import { useToast } from '@/components/ui/toast';
import type { CardProduct } from './types';

export function ProductCard({ p, priority = false, refreshOnWishChange = false, palladiumPricePhp = getPalladiumPricePhp() }: { p: CardProduct; priority?: boolean; refreshOnWishChange?: boolean; palladiumPricePhp?: number }) {
  const { lines, add, openDrawer } = useCart();
  const router = useRouter();
  const { enabled: cryptoEnabled, openSoon } = usePalladiumWallet();
  const { toast } = useToast();
  const variants = p.variants ?? [];
  const firstAvail = Math.max(variants.findIndex((v) => v.available > 0), 0);
  const [sel, setSel] = useState(firstAvail);
  const [picked, setPicked] = useState(false); // customer chose a variant: its photo replaces the default one
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const v = variants[sel];
  const multi = variants.length > 1;
  const swatches = multi && variants.every((x) => swatchColor(x.name));
  const price = v?.price ?? p.price;
  const compareAt = v ? v.compareAt : p.compareAt;
  const onSale = compareAt != null && compareAt > price;
  const priceVaries = multi && new Set(variants.map((x) => x.price)).size > 1;
  const shownPrice = priceVaries && !picked ? p.price : price; // the PHP price on screen is the single source of truth
  const tokenAmount = phpToPalladium(shownPrice, palladiumPricePhp);
  const main = picked && v?.image ? v.image : p.image;
  const soldOut = v ? v.available <= 0 : !p.inStock;
  const inCart = v ? lines.find((l) => l.variantId === v.id)?.qty ?? 0 : 0;
  const left = v && v.available > 0 && v.available <= 5 ? v.available : null;

  function quickAdd() {
    if (!v || soldOut || state !== 'idle') return;
    if (inCart >= Math.min(v.available, 99)) { toast(`All ${v.available} available are already in your cart.`, 'error'); return; }
    setState('busy');
    add(v.id, 1);
    timer.current = setTimeout(() => {
      setState('done'); openDrawer();
      timer.current = setTimeout(() => setState('idle'), 1600);
    }, 350);
  }

  /** DEMO crypto checkout: add this variant, then go straight to checkout with PALLADIUM preselected. */
  function payWithCrypto() {
    if (!v || soldOut) return;
    if (inCart >= Math.min(v.available, 99)) { toast(`All ${v.available} available are already in your cart.`, 'error'); return; }
    add(v.id, 1);
    router.push('/checkout?pay=crypto');
  }

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden border border-line bg-gradient-to-b from-white to-bone transition duration-300 group-hover:-translate-y-0.5 group-hover:border-ink group-hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.35)]">
        <Link href={`/products/${p.slug}`} aria-label={p.name} className="absolute inset-0 block">
          <div className="absolute inset-5 sm:inset-6">
            <Img src={main} alt={p.name} sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw" priority={priority}
              className={`object-contain mix-blend-multiply transition duration-500 ease-out ${p.image2 && !picked ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04]'} ${soldOut ? 'opacity-50' : ''}`} />
            {p.image2 && !picked && (
              <Img src={p.image2} alt="" sizes="(min-width:1024px) 25vw, 50vw"
                className={`object-contain opacity-0 mix-blend-multiply transition duration-500 ease-out group-hover:opacity-100 ${soldOut ? '!opacity-0' : ''}`} />
            )}
          </div>
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
          {onSale && <span className="bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Sale</span>}
          {p.isLimited && <span className="inline-flex items-center gap-1.5 bg-[#d91e18] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_-4px_rgba(217,30,24,0.6)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />Limited</span>}
          {left != null && !soldOut && <span className="bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">Only {left} left</span>}
        </div>
        {soldOut && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white">Sold out</div>}
        <div className="absolute right-3 top-3 z-10"><WishButton productId={p.id} name={p.name} refreshOnChange={refreshOnWishChange} /></div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-mute">{p.category}</p>
        <h3 className="min-h-[2.75rem] text-[15px] font-semibold leading-snug tracking-tight"><Link href={`/products/${p.slug}`} className="hover:underline hover:decoration-gold hover:decoration-2 hover:underline-offset-4">{p.name}</Link></h3>
        <p className="mt-1 line-clamp-1 min-h-[1.25rem] text-[13px] leading-snug text-mute">{p.shortDescription ?? ''}</p>
        <div className="mt-2 flex min-h-[1rem] items-center gap-2 text-xs text-mute">{p.rating != null && p.reviewCount > 0 && <><Stars value={p.rating} /><span>({p.reviewCount})</span></>}</div>

        <div className={`mt-3 flex min-h-[1.5rem] flex-wrap items-center ${swatches ? 'gap-4' : 'gap-2'}`} role={multi ? 'radiogroup' : undefined} aria-label={multi ? `${p.name} options` : undefined}>
          {multi && (<>
            {variants.map((x, i) => {
              const out = x.available <= 0, on = i === sel;
              return swatches ? (
                <button key={x.id} type="button" role="radio" aria-checked={on} aria-label={`${x.name}${out ? ' (sold out)' : ''}`} title={`${x.name}${out ? ' (sold out)' : ''}`}
                  onClick={() => { setSel(i); setPicked(true); }}
                  className={`relative h-6 w-6 rounded-full p-[2px] transition after:absolute after:-inset-2 after:content-[''] ${on ? 'ring-2 ring-ink ring-offset-2' : 'ring-1 ring-line hover:ring-ink'} ${out ? 'opacity-40' : ''}`}>
                  <span className="block h-full w-full rounded-full border border-black/10" style={{ backgroundColor: swatchColor(x.name) as string }} />
                  {out && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="h-px w-full rotate-45 bg-ink" /></span>}
                </button>
              ) : (
                <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => { setSel(i); setPicked(true); }}
                  className={`border px-2.5 py-1 text-[11px] font-semibold transition ${on ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'} ${out ? 'text-mute line-through opacity-60' : ''}`}>{x.name}</button>
              );
            })}
          </>)}
        </div>

        <div className="mt-auto pt-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            {priceVaries && !picked && <span className="text-xs font-medium text-mute">From</span>}
            <span className="text-xl font-extrabold tracking-tight sm:text-[22px]">{peso(shownPrice)}</span>
            {onSale && !(priceVaries && !picked) && <span className="text-sm text-mute line-through">{peso(compareAt as number)}</span>}
          </p>
          <p className="mt-2 min-h-[1.75rem] whitespace-nowrap" aria-label={tokenAmount != null ? `About ${tokenAmount} PALLADIUM tokens` : undefined}>
            {tokenAmount != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink py-1 pl-1.5 pr-3 text-[12px] font-bold tabular-nums tracking-wide text-gold shadow-sm">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-black leading-none text-ink" aria-hidden="true">P</span>
                {formatPalladium(tokenAmount)}
              </span>
            )}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          {soldOut ? (
            <Link href={`/products/${p.slug}`} className="btn-outline btn-sm flex-1 !py-2.5">View product</Link>
          ) : (
            <>
              <button type="button" onClick={quickAdd} disabled={state !== 'idle'} aria-busy={state === 'busy'} aria-live="polite"
                className="btn-primary btn-sm flex-1 !py-2.5 disabled:!opacity-100">
                {state === 'busy' ? 'Adding...' : state === 'done' ? 'Added \u2713' : 'Quick add'}
              </button>
              <Link href={`/products/${p.slug}`} className="btn-outline btn-sm !px-3 !py-2.5" aria-label={`View ${p.name}`}>View</Link>
            </>
          )}
        </div>
        {(soldOut ? <div className="mt-2 h-[2.5rem]" aria-hidden="true" /> : (
          <button type="button" onClick={cryptoEnabled ? payWithCrypto : openSoon}
            className="group/crypto relative mt-2 flex h-[2.5rem] w-full items-center justify-center gap-2 overflow-hidden border border-ink/80 bg-gold px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)] transition duration-300 before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:skew-x-[-20deg] before:bg-white/50 before:transition-transform before:duration-700 hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(0,0,0,0.55)] hover:before:translate-x-[320%]">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 8h4.5a2 2 0 0 1 0 4H9m0 0h5a2 2 0 0 1 0 4H9M9 8v8M11 6v2m0 8v2" /></svg>
            Pay with crypto
            <span className="rounded-full bg-ink px-2 text-[10px] font-bold leading-4 tracking-[0.1em] text-gold">{cryptoEnabled ? 'Demo' : <><span className="sm:hidden">Soon</span><span className="hidden sm:inline">In progress</span></>}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

export function ProductGrid({ items, className = 'grid-cols-2 lg:grid-cols-4', priorityCount = 0, refreshOnWishChange = false, palladiumPricePhp }: { items: CardProduct[]; className?: string; priorityCount?: number; palladiumPricePhp?: number; refreshOnWishChange?: boolean }) {
  return (
    <div className={`grid gap-x-4 gap-y-10 sm:gap-x-6 ${className}`}>
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} refreshOnWishChange={refreshOnWishChange} palladiumPricePhp={palladiumPricePhp} />)}
    </div>
  );
}

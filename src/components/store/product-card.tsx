'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden border border-line bg-bone transition-colors duration-300 group-hover:border-ink">
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
          {p.isLimited && <span className="border border-gold bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-deep">Limited</span>}
          {left != null && !soldOut && <span className="bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">Only {left} left</span>}
        </div>
        {soldOut && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white">Sold out</div>}
        <div className="absolute right-3 top-3 z-10"><WishButton productId={p.id} name={p.name} refreshOnChange={refreshOnWishChange} /></div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="min-h-[2.75rem] text-[15px] font-semibold leading-snug tracking-tight"><Link href={`/products/${p.slug}`} className="hover:underline hover:decoration-gold hover:decoration-2 hover:underline-offset-4">{p.name}</Link></h3>
        <p className="mt-1 line-clamp-1 min-h-[1.25rem] text-[13px] leading-snug text-mute">{p.shortDescription ?? ''}</p>
        <div className="mt-2 flex min-h-[1rem] items-center gap-2 text-xs text-mute">{p.rating != null && p.reviewCount > 0 && <><Stars value={p.rating} /><span>({p.reviewCount})</span></>}</div>

        <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-2" role={multi ? 'radiogroup' : undefined} aria-label={multi ? `${p.name} options` : undefined}>
          {multi && (<>
            {variants.map((x, i) => {
              const out = x.available <= 0, on = i === sel;
              return swatches ? (
                <button key={x.id} type="button" role="radio" aria-checked={on} aria-label={`${x.name}${out ? ' (sold out)' : ''}`} title={`${x.name}${out ? ' (sold out)' : ''}`}
                  onClick={() => { setSel(i); setPicked(true); }}
                  className={`relative h-6 w-6 rounded-full p-[2px] transition ${on ? 'ring-2 ring-ink ring-offset-2' : 'ring-1 ring-line hover:ring-ink'} ${out ? 'opacity-40' : ''}`}>
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
          <p className="mt-0.5 min-h-[1.25rem] whitespace-nowrap text-[13px] font-semibold tabular-nums text-gold-deep" aria-label={tokenAmount != null ? `About ${tokenAmount} PALLADIUM tokens` : undefined}>
            {tokenAmount != null ? formatPalladium(tokenAmount) : null}
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

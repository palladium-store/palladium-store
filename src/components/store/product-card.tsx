'use client';
import { useState } from 'react';
import Link from 'next/link';
import { peso } from '@/lib/money';
import { Img } from './img';
import { Stars } from './stars';
import { WishButton } from './wish-button';
import { swatchColor } from './swatch';
import type { CardProduct } from './types';

export function ProductCard({ p, priority = false, refreshOnWishChange = false }: { p: CardProduct; priority?: boolean; refreshOnWishChange?: boolean }) {
  const [img, setImg] = useState<string | null>(p.image);
  const [active, setActive] = useState<number | null>(null);
  const onSale = p.compareAt != null && p.compareAt > p.price;
  const showStrike = onSale && p.variantCount === 1;
  const variants = p.variants ?? [];
  const showVariants = variants.length > 1;
  const swatches = showVariants && variants.every((v) => swatchColor(v.name));
  const pick = (i: number) => { setActive(i); setImg(variants[i].image || p.image); };
  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${p.slug}`} className="block" aria-label={p.name}>
        <div className="relative aspect-[4/5] overflow-hidden border border-line bg-white transition-colors duration-300 group-hover:border-ink">
          <div className="absolute inset-4 sm:inset-5"><Img src={img} alt={p.name} sizes="(min-width:1024px) 25vw, 50vw" priority={priority} className={`object-contain mix-blend-multiply transition duration-500 ease-out group-hover:scale-105 ${p.inStock ? '' : 'opacity-50'}`} /></div>
          <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
            {onSale && <span className="bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink">Sale</span>}
            {p.isLimited && <span className="border border-white/70 bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Limited</span>}
          </div>
          {!p.inStock && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white">Sold out</div>
          )}
        </div>
      </Link>
      {showVariants && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`${p.name} options`}>
          {variants.map((v, i) => swatches ? (
            <button key={v.name + i} type="button" onClick={() => pick(i)} aria-label={v.name} title={v.name} aria-pressed={active === i}
              className={`h-6 w-6 rounded-full p-[2px] transition ${active === i ? 'ring-2 ring-ink ring-offset-1' : 'ring-1 ring-line hover:ring-ink'}`}>
              <span className="block h-full w-full rounded-full border border-black/10" style={{ backgroundColor: swatchColor(v.name) as string }} />
            </button>
          ) : (
            <button key={v.name + i} type="button" onClick={() => pick(i)} aria-pressed={active === i}
              className={`border px-2 py-1 text-[11px] font-semibold transition ${active === i ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}>{v.name}</button>
          ))}
        </div>
      )}
      <Link href={`/products/${p.slug}`} className="block">
        <div className="mt-3 space-y-1.5">
          <h3 className="font-display text-base leading-tight tracking-tightest underline decoration-transparent decoration-2 underline-offset-4 transition group-hover:decoration-gold">{p.name}</h3>
          {p.rating != null && p.reviewCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-mute"><Stars value={p.rating} /><span>({p.reviewCount})</span></div>
          )}
          <p className="flex flex-wrap items-baseline gap-x-2">
            {p.variantCount > 1 && <span className="text-xs text-mute">From</span>}
            <span className="font-display text-xl tracking-tightest sm:text-2xl">{peso(p.price)}</span>
            {showStrike && <span className="text-sm text-mute line-through">{peso(p.compareAt as number)}</span>}
          </p>
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10"><WishButton productId={p.id} name={p.name} refreshOnChange={refreshOnWishChange} /></div>
    </article>
  );
}

export function ProductGrid({ items, className = 'grid-cols-2 lg:grid-cols-4', priorityCount = 0, refreshOnWishChange = false }: { items: CardProduct[]; className?: string; priorityCount?: number; refreshOnWishChange?: boolean }) {
  return (
    <div className={`grid gap-x-4 gap-y-10 sm:gap-x-6 ${className}`}>
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} refreshOnWishChange={refreshOnWishChange} />)}
    </div>
  );
}

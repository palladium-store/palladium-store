'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { peso } from '@/lib/money';
import { useToast } from '@/components/ui/toast';
import { useCart } from './cart-context';
import { Img } from './img';
import { Stars } from './stars';
import { QtyStepper } from './qty-stepper';
import { WishTextButton } from './wish-button';
import type { VariantDTO } from './types';

interface Props {
  productId: string; name: string; category: string; categorySlug: string; isLimited: boolean; shortDescription: string | null;
  images: { url: string; alt: string | null }[]; variants: VariantDTO[]; rating: number | null; reviewCount: number;
}

export function ProductView({ productId, name, category, categorySlug, isLimited, shortDescription, images, variants, rating, reviewCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { add, lines, openDrawer } = useCart();
  const firstAvail = variants.find((v) => v.available > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvail?.id);
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState<string | null>(images[0]?.url ?? firstAvail?.imageUrl ?? null);
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const v = variants.find((x) => x.id === variantId) ?? firstAvail;

  const thumbs = useMemo(() => {
    const seen = new Set<string>(); const out: { url: string; alt: string }[] = [];
    for (const i of images) if (!seen.has(i.url)) { seen.add(i.url); out.push({ url: i.url, alt: i.alt || name }); }
    for (const x of variants) if (x.imageUrl && !seen.has(x.imageUrl)) { seen.add(x.imageUrl); out.push({ url: x.imageUrl, alt: `${name} ${x.name}` }); }
    return out;
  }, [images, variants, name]);
  const activeAlt = thumbs.find((t) => t.url === active)?.alt ?? name;

  if (!v) return null;
  const soldOut = v.available <= 0;
  const maxQty = Math.max(1, Math.min(10, v.available));
  const onSale = v.compareAtCentavos != null && v.compareAtCentavos > v.priceCentavos;
  const inCart = lines.find((l) => l.variantId === v.id)?.qty ?? 0;

  function pick(id: string) {
    const next = variants.find((x) => x.id === id);
    if (!next || next.available <= 0) return;
    setVariantId(id);
    setQty((q) => Math.min(q, Math.max(1, Math.min(10, next.available))));
    if (next.imageUrl) setActive(next.imageUrl);
  }

  /** Adds to the cart, never past the available stock (counting what is already in the cart). Returns false if nothing was added. */
  function addToCart(): boolean {
    if (!v || soldOut) return false;
    const cap = Math.min(v.available, 99) - inCart;
    if (cap <= 0) { toast(`All ${v.available} available are already in your cart.`, 'error'); return false; }
    const n = Math.min(qty, cap);
    add(v.id, n);
    if (n < qty) toast(`Only ${v.available} available, so we added ${n}.`, 'info');
    else toast(`${name}${variants.length > 1 ? ` (${v.name})` : ''} added to your cart.`);
    return true;
  }
  function onAdd() { if (busy) return; setBusy('add'); if (addToCart()) openDrawer(); setBusy(null); }
  function onBuy() { if (busy) return; setBusy('buy'); if (addToCart()) router.push('/checkout'); else setBusy(null); }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      {/* Gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative aspect-[4/5] overflow-hidden bg-white">
          <Img key={active ?? 'none'} src={active} alt={activeAlt} priority sizes="(min-width:1024px) 50vw, 100vw" className="object-contain" />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
            {onSale && <span className="bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink">Sale</span>}
            {isLimited && <span className="border border-white/70 bg-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">Limited</span>}
          </div>
        </div>
        {thumbs.length > 1 && (
          <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product images">
            {thumbs.map((t) => (
              <li key={t.url}>
                <button type="button" onClick={() => setActive(t.url)} aria-label={`Show image: ${t.alt}`} aria-current={t.url === active} className={`relative block aspect-square w-full overflow-hidden bg-white outline-offset-2 transition ${t.url === active ? 'ring-2 ring-gold' : 'opacity-70 hover:opacity-100'}`}>
                  <Img src={t.url} alt="" sizes="100px" className="object-contain" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy box */}
      <div>
        <Link href={`/shop?category=${categorySlug}`} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep hover:underline">{category}</Link>
        <h1 className="h-display mt-2 text-4xl leading-[1] sm:text-5xl">{name}</h1>
        {rating != null && reviewCount > 0 ? (
          <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-mute hover:text-ink"><Stars value={rating} size={16} /><span>{rating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}</span></a>
        ) : (
          <a href="#reviews" className="mt-4 inline-block text-sm text-mute hover:text-ink">No reviews yet</a>
        )}

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-3xl tracking-tightest sm:text-4xl">{peso(v.priceCentavos)}</span>
          {onSale && (
            <>
              <span className="text-lg text-mute line-through">{peso(v.compareAtCentavos as number)}</span>
              <span className="bg-gold px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">Sale &middot; save {peso((v.compareAtCentavos as number) - v.priceCentavos)}</span>
            </>
          )}
        </div>
        {shortDescription && <p className="mt-5 max-w-xl text-base text-mute">{shortDescription}</p>}

        {variants.length > 1 && (
          <fieldset className="mt-7">
            <legend className="label">Option: <span className="text-ink normal-case tracking-normal">{v.name}</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {variants.map((x) => {
                const sel = x.id === v.id, out = x.available <= 0;
                return (
                  <button key={x.id} type="button" disabled={out} aria-pressed={sel} onClick={() => pick(x.id)}
                    className={`min-w-[4.5rem] border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:text-mute disabled:line-through disabled:opacity-50 ${sel ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}>
                    {x.name}{out ? ' (sold out)' : ''}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <p className={`mt-6 flex items-center gap-2 text-sm font-semibold ${soldOut ? 'text-red-600' : v.lowStock ? 'text-amber-700' : 'text-emerald-700'}`} role="status">
          <span className={`h-2 w-2 rounded-full ${soldOut ? 'bg-red-600' : v.lowStock ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
          {soldOut ? 'Sold out' : v.lowStock ? `Only ${v.available} left` : 'In stock'}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QtyStepper value={Math.min(qty, maxQty)} max={maxQty} onChange={setQty} disabled={soldOut} />
          <button type="button" className="btn-primary min-w-[12rem] flex-1 py-4" disabled={soldOut || busy !== null} aria-busy={busy === 'add'} onClick={onAdd}>{busy === 'add' ? 'Working...' : soldOut ? 'Sold out' : 'Add to cart'}</button>
        </div>
        <button type="button" className="btn-gold mt-3 w-full py-4" disabled={soldOut || busy !== null} onClick={onBuy}>{busy === 'buy' ? 'Working...' : 'Buy now'}</button>
        {inCart > 0 && <p className="mt-2 text-xs text-mute">{inCart} of this option already in your cart.</p>}
        <div className="mt-6"><WishTextButton productId={productId} name={name} /></div>
      </div>
    </div>
  );
}

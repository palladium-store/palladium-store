'use client';
import { useState } from 'react';
import Link from 'next/link';
import { peso } from '@/lib/money';
import { useToast } from '@/components/ui/toast';
import { useCart } from './cart-context';
import { Img } from './img';

export interface BundleItem { productId: string; variantId: string; name: string; slug: string; variantLabel: string | null; image: string | null; priceCentavos: number; available: number; isCurrent: boolean }

export function BundleBox({ items }: { items: BundleItem[] }) {
  const [on, setOn] = useState<Set<string>>(new Set(items.filter((i) => i.available > 0).map((i) => i.variantId)));
  const [busy, setBusy] = useState(false);
  const { addMany, lines, openDrawer } = useCart();
  const { toast } = useToast();
  const chosen = items.filter((i) => on.has(i.variantId));
  const total = chosen.reduce((a, i) => a + i.priceCentavos, 0);

  function flip(id: string) {
    if ((items.find((i) => i.variantId === id)?.available ?? 0) <= 0) return; setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function addAll() {
    if (busy || !chosen.length) return;
    setBusy(true);
    const toAdd = chosen.filter((i) => (lines.find((l) => l.variantId === i.variantId)?.qty ?? 0) < Math.min(i.available, 99));
    if (!toAdd.length) { toast('Those items are already in your cart at the most we have in stock.', 'error'); setBusy(false); return; }
    addMany(toAdd.map((i) => ({ variantId: i.variantId, qty: 1 })));
    toast(`${toAdd.length} item${toAdd.length === 1 ? '' : 's'} added to your cart.`);
    openDrawer();
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:gap-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] sm:gap-4">
        {items.map((i, idx) => {
          const isOn = on.has(i.variantId), out = i.available <= 0;
          return (
            <li key={i.variantId} className="relative">
              {idx > 0 && (
                <span className="pointer-events-none absolute -left-[0.95rem] top-[38%] z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-sm font-bold text-ink shadow-sm sm:flex" aria-hidden="true">+</span>
              )}
              <label className={`group flex h-full cursor-pointer flex-col border bg-white transition duration-200 ${isOn ? 'border-ink shadow-[0_10px_24px_-14px_rgba(0,0,0,0.45)]' : 'border-line opacity-60 hover:opacity-100'} ${out ? 'cursor-not-allowed' : ''}`}>
                <span className="relative block aspect-square overflow-hidden bg-gradient-to-b from-white to-bone">
                  <input type="checkbox" checked={isOn} disabled={out} onChange={() => flip(i.variantId)} className="peer sr-only" aria-label={`Include ${i.name}`} />
                  <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-transparent peer-focus-visible:ring-ink" aria-hidden="true" />
                  <span className="absolute inset-3 sm:inset-4"><Img src={i.image} alt="" sizes="(min-width:1024px) 14vw, 40vw" className={`object-contain mix-blend-multiply transition duration-300 ${out ? 'opacity-40' : 'group-hover:scale-[1.04]'}`} /></span>
                  <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center border transition ${isOn ? 'border-ink bg-ink text-gold' : 'border-line bg-white text-transparent'}`} aria-hidden="true">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                  {i.isCurrent && <span className="absolute right-2 top-2 bg-ink px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-gold">This item</span>}
                  {out && <span className="absolute inset-x-0 bottom-0 bg-ink py-1 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white">Sold out</span>}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <Link href={`/products/${i.slug}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 text-[13px] font-semibold leading-snug hover:underline">{i.name}</Link>
                  {i.variantLabel && <span className="text-[11px] uppercase tracking-wider text-mute">{i.variantLabel}</span>}
                  <span className="mt-auto pt-1 text-base font-extrabold tracking-tight">{peso(i.priceCentavos)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col justify-between bg-ink p-5 text-white sm:p-6 lg:sticky lg:top-24 lg:self-start">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Complete the set</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-white/60">{chosen.length} {chosen.length === 1 ? 'item' : 'items'} selected</p>
          <p className="mt-1 font-display text-3xl tracking-tightest tabular-nums">{peso(total)}</p>
        </div>
        <button type="button" className="btn mt-5 w-full bg-gold py-3.5 text-ink hover:bg-white" disabled={!chosen.length || busy} onClick={addAll}>{busy ? 'Working...' : chosen.length ? `Add ${chosen.length} to cart` : 'Select items'}</button>
      </div>
    </div>
  );
}

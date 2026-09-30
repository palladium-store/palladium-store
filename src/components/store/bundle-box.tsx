'use client';
import { useState } from 'react';
import Link from 'next/link';
import { peso } from '@/lib/money';
import { useToast } from '@/components/ui/toast';
import { useCart } from './cart-context';
import { Img } from './img';

export interface BundleItem { productId: string; variantId: string; name: string; slug: string; variantLabel: string | null; image: string | null; priceCentavos: number; available: number; isCurrent: boolean }

export function BundleBox({ items }: { items: BundleItem[] }) {
  const [on, setOn] = useState<Set<string>>(new Set(items.map((i) => i.variantId)));
  const [busy, setBusy] = useState(false);
  const { addMany, lines, openDrawer } = useCart();
  const { toast } = useToast();
  const chosen = items.filter((i) => on.has(i.variantId));
  const total = chosen.reduce((a, i) => a + i.priceCentavos, 0);

  function flip(id: string) { setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
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
    <div className="border border-line p-5 sm:p-8">
      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
        <ul className="flex flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          {items.map((i, idx) => (
            <li key={i.variantId} className="flex items-center gap-4">
              {idx > 0 && <span className="hidden text-2xl text-mute sm:block" aria-hidden="true">+</span>}
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={on.has(i.variantId)} onChange={() => flip(i.variantId)} className="h-4 w-4 accent-black" aria-label={`Include ${i.name}`} />
                <span className="relative h-20 w-16 shrink-0 bg-ink"><Img src={i.image} alt="" sizes="64px" className="object-contain" /></span>
                <span className="text-sm">
                  <Link href={`/products/${i.slug}`} className="block font-semibold hover:underline">{i.isCurrent ? 'This item: ' : ''}{i.name}</Link>
                  <span className="block text-xs text-mute">{i.variantLabel ? `${i.variantLabel} · ` : ''}{peso(i.priceCentavos)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="border-t border-line pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="text-xs uppercase tracking-wider text-mute">{chosen.length} selected</p>
          <p className="font-display text-2xl tracking-tightest">{peso(total)}</p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={!chosen.length || busy} onClick={addAll}>{busy ? 'Working...' : 'Add selected to cart'}</button>
        </div>
      </div>
    </div>
  );
}

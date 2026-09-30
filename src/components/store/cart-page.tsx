'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { peso } from '@/lib/money';
import { PROVINCES } from '@/lib/ph';
import { useToast } from '@/components/ui/toast';
import { Spinner, EmptyState } from '@/components/ui/bits';
import { useCart } from './cart-context';
import { useQuote } from './use-quote';
import { QtyStepper } from './qty-stepper';
import { QuoteTotals } from './order-summary';
import { Img } from './img';

const PROV_KEY = 'pal-province';
const CODE_KEY = 'pal-discount';

export function CartPage() {
  const { lines, ready, set, remove, clear } = useCart();
  const { toast } = useToast();
  const [province, setProvince] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const { quote, loading, error, refresh } = useQuote(lines, { discountCode: code, province });

  useEffect(() => {
    try {
      const p = localStorage.getItem(PROV_KEY); if (p && PROVINCES.includes(p)) setProvince(p);
      const c = localStorage.getItem(CODE_KEY); if (c) { setCode(c); setCodeInput(c); }
    } catch { /* storage unavailable */ }
  }, []);

  function chooseProvince(p: string) {
    setProvince(p);
    try { if (p) localStorage.setItem(PROV_KEY, p); else localStorage.removeItem(PROV_KEY); } catch { /* ignore */ }
  }
  function applyCode(e: React.FormEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    setCode(c);
    try { if (c) localStorage.setItem(CODE_KEY, c); else localStorage.removeItem(CODE_KEY); } catch { /* ignore */ }
    if (!c) toast('Discount code removed.', 'info');
  }
  function removeCode() { setCodeInput(''); setCode(''); try { localStorage.removeItem(CODE_KEY); } catch { /* ignore */ } toast('Discount code removed.', 'info'); }

  // Toast once when a code is accepted.
  useEffect(() => { if (quote?.discountCode && quote.discountCentavos > 0) toast(`Code ${quote.discountCode} applied.`); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [quote?.discountCode]);

  if (!ready) return <Spinner label="Loading your cart" />;
  if (lines.length === 0) {
    return <EmptyState title="Your cart is empty" text="Add a paddle, some balls or fresh grips and they will show up here." action={<Link href="/shop" className="btn-primary">Continue shopping</Link>} />;
  }
  const byId = new Map((quote?.lines ?? []).map((l) => [l.variantId, l]));
  const canCheckout = !!quote && quote.ok && !loading;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <div>
        {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error} <button className="underline" onClick={refresh}>Try again</button></p>}
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((l) => {
            const q = byId.get(l.variantId);
            const max = Math.max(1, Math.min(q?.available ?? 99, 99));
            return (
              <li key={l.variantId} className="flex gap-4 py-5 sm:gap-6">
                <Link href={q?.slug ? `/products/${q.slug}` : '/shop'} className="relative h-28 w-24 shrink-0 bg-ink sm:h-32 sm:w-28" aria-label={q?.productName ?? 'Product'}><Img src={q?.imageUrl} alt={q?.productName ?? 'Cart item'} sizes="112px" className="object-contain" /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{q ? q.productName : 'Loading...'}</p>
                      {q?.variantName && <p className="text-sm text-mute">{q.variantName}</p>}
                      {q && q.unitPriceCentavos > 0 && (
                        <p className="mt-1 text-sm">{peso(q.unitPriceCentavos)} each{q.compareAtCentavos != null && q.compareAtCentavos > q.unitPriceCentavos && <span className="ml-2 text-mute line-through">{peso(q.compareAtCentavos)}</span>}</p>
                      )}
                    </div>
                    <p className="font-semibold tabular-nums">{q ? peso(q.lineTotalCentavos) : ''}</p>
                  </div>
                  {q?.problem && (
                    <p className="mt-2 text-sm font-semibold text-red-600" role="alert">
                      {q.problem}{' '}
                      {q.available > 0 && q.available < l.qty && <button className="underline" onClick={() => set(l.variantId, q.available)}>Set quantity to {q.available}</button>}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QtyStepper value={l.qty} max={max} onChange={(n) => set(l.variantId, n)} label={`Quantity for ${q?.productName ?? 'item'}`} />
                    <button onClick={() => { remove(l.variantId); toast('Item removed from your cart.', 'info'); }} className="text-sm text-mute underline underline-offset-4 hover:text-ink" aria-label={`Remove ${q?.productName ?? 'item'}`}>Remove</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/shop" className="text-xs font-semibold uppercase tracking-[0.14em] underline underline-offset-4">Continue shopping</Link>
          <button className="text-xs text-mute underline underline-offset-4 hover:text-ink" onClick={() => { clear(); toast('Cart cleared.', 'info'); }}>Clear cart</button>
        </div>
      </div>

      <aside className="h-fit border border-line bg-bone p-6 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className="font-display text-xl tracking-tightest">Summary</h2>
        <div className="mt-5">
          <label htmlFor="cart-province" className="label">Estimate shipping</label>
          <select id="cart-province" className="input" value={province} onChange={(e) => chooseProvince(e.target.value)}>
            <option value="">Select your province</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <form onSubmit={applyCode} className="mt-5">
          <label htmlFor="cart-code" className="label">Discount code</label>
          <div className="flex gap-2">
            <input id="cart-code" className="input uppercase" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Enter code" autoComplete="off" />
            <button type="submit" className="btn-outline" disabled={loading}>Apply</button>
          </div>
          {quote?.discountError && <p className="field-error" role="alert">{quote.discountError}</p>}
          {quote?.discountCode && quote.discountCentavos > 0 && (
            <p className="mt-2 text-xs text-emerald-700">Code {quote.discountCode} saves you {peso(quote.discountCentavos)}. <button type="button" className="underline" onClick={removeCode}>Remove</button></p>
          )}
        </form>
        <div className="mt-6 border-t border-line pt-4">
          {quote ? <QuoteTotals quote={quote} hasProvince={!!province} /> : <Spinner label="Pricing" />}
        </div>
        {canCheckout ? <Link href="/checkout" className="btn-gold mt-6 w-full py-4">Checkout</Link> : <button className="btn-gold mt-6 w-full py-4" disabled>{loading ? 'Updating...' : 'Checkout'}</button>}
        {quote && !quote.ok && <p className="mt-2 text-xs text-red-600">Some items need attention before you can check out.</p>}
      </aside>
    </div>
  );
}

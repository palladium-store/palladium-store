'use client';
import { peso } from '@/lib/money';
import { Img } from './img';
import type { Quote } from './types';

/** Totals block used by the cart page and the checkout sidebar. */
export function QuoteTotals({ quote, hasProvince }: { quote: Quote; hasProvince: boolean }) {
  const row = 'flex items-center justify-between py-1.5 text-sm';
  return (
    <dl>
      <div className={row}><dt className="text-mute">Subtotal</dt><dd className="tabular-nums">{peso(quote.subtotalCentavos)}</dd></div>
      {quote.discountCentavos > 0 && <div className={row}><dt className="text-mute">Discount{quote.discountCode ? ` (${quote.discountCode})` : ''}</dt><dd className="tabular-nums text-emerald-700">&minus;{peso(quote.discountCentavos)}</dd></div>}
      <div className={row}>
        <dt className="text-mute">Shipping{quote.shippingZone ? ` (${quote.shippingZone})` : ''}</dt>
        <dd className="tabular-nums">{quote.shippingCentavos != null ? (quote.shippingCentavos === 0 ? 'Free' : peso(quote.shippingCentavos)) : hasProvince ? 'Unavailable' : 'Choose a province'}</dd>
      </div>
      {quote.shippingError && <p className="field-error">{quote.shippingError}</p>}
      <div className="mt-2 flex items-center justify-between border-t border-ink pt-3">
        <dt className="text-sm font-semibold uppercase tracking-wider">Total</dt>
        <dd className="font-display text-2xl tracking-tightest tabular-nums">{peso(quote.totalCentavos)}</dd>
      </div>
      {quote.shippingCentavos == null && <p className="mt-1 text-right text-xs text-mute">Excludes shipping</p>}
    </dl>
  );
}

export function SummaryLine({ name, variant, image, qty, total, problem }: { name: string; variant: string; image: string | null; qty: number; total: number; problem?: string | null }) {
  return (
    <li className="flex gap-3 py-3">
      <div className="relative h-16 w-14 shrink-0 bg-ink"><Img src={image} alt="" sizes="56px" className="object-contain" />
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{qty}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        {variant && <p className="text-xs text-mute">{variant}</p>}
        {problem && <p className="text-xs font-semibold text-red-600">{problem}</p>}
      </div>
      <p className="text-sm font-semibold tabular-nums">{peso(total)}</p>
    </li>
  );
}

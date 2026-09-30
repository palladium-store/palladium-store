import Link from 'next/link';
import { RANGE_LABELS, type RangeKey } from '@/lib/time';

export type SP = Record<string, string | string[] | undefined>;
/** Next 14 may hand back arrays for repeated params; take the first value. */
export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
export const num = (n: number) => Math.round(n).toLocaleString('en-PH');

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-display text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, hint, action, children, className = '' }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-6 ${className}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface Delta { pct: number | null; isNew?: boolean }
/** Change of `cur` versus `prev`. Returns null when both are zero (nothing to compare). */
export function delta(cur: number, prev: number): Delta | null {
  if (!prev) return cur > 0 ? { pct: null, isNew: true } : null;
  return { pct: ((cur - prev) / prev) * 100 };
}

export function Kpi({ label, value, sub, delta: d, gold }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: Delta | null; gold?: boolean }) {
  const up = d && (d.isNew || (d.pct ?? 0) >= 0);
  return (
    <div className={`card p-4 ${gold ? 'border-t-2 border-t-gold' : ''}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-1.5 font-display text-2xl tracking-tightest sm:text-[26px]">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-mute">
        {d && (
          <span className={`font-semibold ${up ? 'text-emerald-700' : 'text-red-600'}`} aria-label={up ? 'Up' : 'Down'}>
            {up ? '▲' : '▼'} {d.isNew ? 'New' : `${Math.abs(d.pct ?? 0).toFixed(1)}%`}
          </span>
        )}
        {d && <span>vs previous period</span>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Range tabs plus a custom from/to GET form. Works without JavaScript. */
export function RangePicker({ base, active, from, to, keys = ['today', 'yesterday', '7d', '30d', 'this_month', 'last_month'] }: { base: string; active: RangeKey; from?: string; to?: string; keys?: RangeKey[] }) {
  return (
    <div className="no-print flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Date range">
        {keys.map((k) => (
          <Link key={k} href={`${base}?range=${k}`} role="tab" aria-selected={active === k}
            className={`border px-3 py-2 text-xs font-semibold transition ${active === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink'}`}>{RANGE_LABELS[k]}</Link>
        ))}
      </div>
      <form action={base} method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        <div><label className="label" htmlFor="rp-from">From</label><input id="rp-from" className="input !py-2" type="date" name="from" defaultValue={from} required /></div>
        <div><label className="label" htmlFor="rp-to">To</label><input id="rp-to" className="input !py-2" type="date" name="to" defaultValue={to} required /></div>
        <button className={`${active === 'custom' ? 'btn-primary' : 'btn-outline'} btn-sm !py-2.5`} type="submit">Apply custom range</button>
      </form>
    </div>
  );
}

export function ExportLinks({ type, range, from, to }: { type: 'summary' | 'daily' | 'products' | 'customers' | 'payments'; range: RangeKey; from?: string; to?: string }) {
  const href = (format: string) => {
    const sp = new URLSearchParams({ type, format, range });
    if (range === 'custom' && from && to) { sp.set('from', from); sp.set('to', to); }
    return `/api/admin/reports/export?${sp}`;
  };
  return (
    <div className="no-print flex items-center gap-1.5 text-xs">
      <span className="text-mute">Export</span>
      {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
        <a key={f} href={href(f)} className="border border-line bg-white px-2.5 py-1 font-semibold uppercase tracking-wider hover:border-ink" download>{f === 'xlsx' ? 'Excel' : f.toUpperCase()}</a>
      ))}
    </div>
  );
}

export const orderLabel = (orderNumber: string) => `#${orderNumber.replace(/^#/, '')}`;

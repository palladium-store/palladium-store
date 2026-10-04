import Link from 'next/link';

const TONE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', PAYMENT_PENDING: 'bg-amber-100 text-amber-800', PAID: 'bg-emerald-100 text-emerald-800', PROCESSING: 'bg-sky-100 text-sky-800',
  PACKED: 'bg-indigo-100 text-indigo-800', SHIPPED: 'bg-violet-100 text-violet-800', DELIVERED: 'bg-emerald-600 text-white', CANCELLED: 'bg-neutral-200 text-neutral-700',
  REFUNDED: 'bg-rose-100 text-rose-800', PARTIALLY_REFUNDED: 'bg-rose-50 text-rose-700', FAILED: 'bg-red-100 text-red-800', AUTHORIZED: 'bg-sky-100 text-sky-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800', DRAFT: 'bg-neutral-200 text-neutral-700', ARCHIVED: 'bg-neutral-300 text-neutral-600', SOLD_OUT: 'bg-red-100 text-red-800',
  LOW: 'bg-amber-100 text-amber-800', OUT: 'bg-red-100 text-red-800', OK: 'bg-emerald-100 text-emerald-800', BLOCKED: 'bg-red-100 text-red-800',
};
export const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold ${TONE[status] ?? 'bg-neutral-100 text-neutral-700'}`}>{label ?? statusLabel(status)}</span>;
}

export function Pagination({ page, pages, total, base, params }: { page: number; pages: number; total: number; base: string; params?: Record<string, string | undefined> }) {
  const href = (p: number) => { const sp = new URLSearchParams(); for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v); sp.set('page', String(p)); return `${base}?${sp}`; };
  return (
    <nav className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span className="text-mute">{total.toLocaleString('en-PH')} result{total === 1 ? '' : 's'}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? <Link className="btn-outline btn-sm" href={href(page - 1)}>Previous</Link> : <span className="btn-outline btn-sm opacity-30">Previous</span>}
          <span className="px-3 text-mute">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn-outline btn-sm" href={href(page + 1)}>Next</Link> : <span className="btn-outline btn-sm opacity-30">Next</span>}
        </div>
      )}
    </nav>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line bg-paper px-6 py-14 text-center">
      <p className="font-display text-lg tracking-tightest">{title}</p>
      {text && <p className="mx-auto mt-2 max-w-md text-sm text-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-3 py-10 text-sm text-mute"><span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />{label}...</div>;
}

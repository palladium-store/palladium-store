'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/modal';
import { Badge } from '@/components/ui/bits';
import { peso } from '@/lib/money';
import { ProductRowActions } from './ProductRowActions';

export interface ProductRow {
  id: string; name: string; slug: string; status: string; category: string; image: string | null; isDemo: boolean; addedLabel: string;
  variants: number; sku: string; extraSkus: number; priceMin: number | null; priceMax: number | null; stock: number; low: boolean;
}
type Bulk = { kind: 'status'; status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' } | { kind: 'category'; categoryId: string } | { kind: 'delete' };

function StockPill({ stock, low }: { stock: number; low: boolean }) {
  if (stock <= 0) return <span className="inline-block bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Out of stock</span>;
  if (low) return <span className="inline-block bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Low stock</span>;
  return <span className="inline-block bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">In stock</span>;
}

export function ProductsTable({ rows, categories }: { rows: ProductRow[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Bulk | null>(null);
  const [catPick, setCatPick] = useState('');
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOn = ids.length > 0 && ids.every((i) => sel.has(i));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(ids));
  const count = sel.size;

  async function run(b: Bulk) {
    setBusy(true);
    try {
      const body = b.kind === 'status' ? { ids: [...sel], action: 'status', status: b.status } : b.kind === 'category' ? { ids: [...sel], action: 'category', categoryId: b.categoryId } : { ids: [...sel], action: 'delete' };
      const r = await api<{ done: number; skipped: { id: string; name: string; reason: string }[] }>('/api/admin/products/bulk', { method: 'POST', body });
      const verb = b.kind === 'delete' ? 'deleted' : 'updated';
      if (r.skipped.length) toast(`${r.done} ${verb}. ${r.skipped.length} skipped: ${r.skipped.slice(0, 2).map((x) => `${x.name} (${x.reason})`).join('; ')}${r.skipped.length > 2 ? '...' : ''}`, r.done ? 'info' : 'error');
      else toast(`${r.done} product${r.done === 1 ? '' : 's'} ${verb}.`);
      setSel(new Set()); setCatPick(''); router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'The bulk action failed. Please try again.', 'error'); }
    setBusy(false); setConfirm(null);
  }
  const sbtn = 'border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-ink hover:text-white disabled:opacity-40';
  const confirmText = confirm?.kind === 'delete' ? `Permanently delete ${count} product${count === 1 ? '' : 's'}? This cannot be undone. Products with orders or stock history are skipped; archive those instead.`
    : confirm?.kind === 'status' ? `Set ${count} product${count === 1 ? '' : 's'} to ${confirm.status.toLowerCase()}?` : '';

  return (
    <>
      {count > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 border border-ink bg-white p-3 shadow-sm" role="region" aria-label="Bulk actions">
          <span className="mr-2 text-sm font-semibold">{count} selected</span>
          <button className={sbtn} aria-busy={busy} disabled={busy} onClick={() => setConfirm({ kind: 'status', status: 'ACTIVE' })}>Set active</button>
          <button className={sbtn} aria-busy={busy} disabled={busy} onClick={() => setConfirm({ kind: 'status', status: 'DRAFT' })}>Set draft</button>
          <button className={sbtn} aria-busy={busy} disabled={busy} onClick={() => setConfirm({ kind: 'status', status: 'ARCHIVED' })}>Archive</button>
          <span className="flex items-center gap-1">
            <select className="input h-8 w-44 py-0 text-xs" value={catPick} onChange={(e) => setCatPick(e.target.value)} aria-label="Move to category" disabled={busy}>
              <option value="">Move to category...</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className={sbtn} disabled={busy || !catPick} onClick={() => run({ kind: 'category', categoryId: catPick })}>Move</button>
          </span>
          <button className={`${sbtn} text-red-600 hover:bg-red-600`} aria-busy={busy} disabled={busy} onClick={() => setConfirm({ kind: 'delete' })}>Delete</button>
          <button className="ml-auto text-xs font-semibold underline" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {/* Phone layout: cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((p) => (
          <li key={p.id} className={`card flex gap-3 p-3 ${sel.has(p.id) ? 'ring-2 ring-gold' : ''}`}>
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
            {p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="h-16 w-16 shrink-0 border border-line bg-bone object-cover" /> : <div className="h-16 w-16 shrink-0 border border-line bg-bone" />}
            <div className="min-w-0 flex-1">
              <Link href={`/admin/products/${p.id}`} className="block truncate font-semibold">{p.name}</Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute"><Badge status={p.status} /><StockPill stock={p.stock} low={p.low} /><span>{p.stock} avail.</span></div>
              <div className="mt-1 text-xs text-mute">{p.category}{p.sku ? ` · ${p.sku}` : ''}</div>
              <div className="mt-1 text-sm font-semibold">{p.priceMin == null ? '-' : p.priceMin === p.priceMax ? peso(p.priceMin) : `${peso(p.priceMin)} - ${peso(p.priceMax!)}`}</div>
              <div className="mt-2"><ProductRowActions id={p.id} name={p.name} status={p.status} /></div>
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and desktop: table */}
      <div className="table-wrap hidden md:block">
        <table className="tbl min-w-[1000px]">
          <thead><tr>
            <th className="w-10"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all products on this page" /></th>
            <th className="w-16"></th><th>Product</th><th>SKU</th><th>Status</th><th>Category</th><th className="text-right">Price</th><th className="text-right">Inventory</th><th>Added</th><th className="text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={sel.has(p.id) ? 'bg-gold-soft/40' : ''}>
                <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                <td>{p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="h-12 w-12 border border-line bg-bone object-cover" /> : <div className="h-12 w-12 border border-line bg-bone" />}</td>
                <td className="max-w-[260px]">
                  <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-gold-deep">{p.name}</Link>
                  {p.isDemo && <span className="ml-2 inline-block bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-deep">Demo</span>}
                  <div className="text-xs text-mute">{p.variants} variant{p.variants === 1 ? '' : 's'}</div>
                </td>
                <td className="whitespace-nowrap font-mono text-xs">{p.sku || '-'}{p.extraSkus > 0 && <span className="ml-1 text-mute">+{p.extraSkus}</span>}</td>
                <td><Badge status={p.status} /></td>
                <td>{p.category}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{p.priceMin == null ? '-' : p.priceMin === p.priceMax ? peso(p.priceMin) : `${peso(p.priceMin)} - ${peso(p.priceMax!)}`}</td>
                <td className="text-right"><div className="tabular-nums">{p.stock}</div><StockPill stock={p.stock} low={p.low} /></td>
                <td className="whitespace-nowrap text-xs text-mute">{p.addedLabel}</td>
                <td className="text-right"><ProductRowActions id={p.id} name={p.name} status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => !busy && setConfirm(null)} title={confirm?.kind === 'delete' ? 'Delete products?' : 'Change status?'} danger={confirm?.kind === 'delete'} busy={busy}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete products' : 'Apply'} onConfirm={() => confirm && run(confirm)} message={confirmText} />
    </>
  );
}

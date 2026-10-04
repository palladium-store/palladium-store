'use client';
import { useRef, useState } from 'react';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

export interface OrderRow { id: string; name: string; category: string; status: string; image: string | null }

export function ProductOrderManager({ initial }: { initial: OrderRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((rs) => { const n = rs.slice(); const [r] = n.splice(from, 1); n.splice(to, 0, r); return n; });
    setDirty(true);
  }
  async function save() {
    setBusy(true);
    try {
      await api('/api/admin/products/order', { method: 'PUT', body: { ids: rows.map((r) => r.id) } });
      setDirty(false); toast('Order saved. The shop updates within a minute.');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save the order.', 'error'); }
    setBusy(false);
  }

  return (
    <div>
      <ol className="card divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.id} draggable onDragStart={() => { drag.current = i; }} onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
            onDrop={() => { if (drag.current != null) move(drag.current, i); drag.current = null; setOver(null); }} onDragEnd={() => { drag.current = null; setOver(null); }}
            className={`flex items-center gap-3 bg-paper p-3 ${over === i ? 'outline outline-2 -outline-offset-2 outline-gold' : ''}`}>
            <span className="w-6 shrink-0 cursor-grab select-none text-center text-lg text-mute" aria-hidden="true">&#8942;&#8942;</span>
            <span className="w-6 shrink-0 text-center text-xs font-semibold text-mute">{i + 1}</span>
            <span className="plate plate-sm h-12 w-12 shrink-0 overflow-hidden border border-line bg-white">
              {r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="h-full w-full object-contain" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.name}</span>
              <span className="block text-xs text-mute">{r.category}{r.status === 'SOLD_OUT' ? ' · Sold out' : ''}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button type="button" className="btn-outline btn-sm !px-2.5" onClick={() => move(i, 0)} disabled={i === 0} aria-label={`Move ${r.name} to top`} title="Top">&#8648;</button>
              <button type="button" className="btn-outline btn-sm !px-2.5" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${r.name} up`}>&uarr;</button>
              <button type="button" className="btn-outline btn-sm !px-2.5" onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.name} down`}>&darr;</button>
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="p-6 text-sm text-mute">No active products yet.</li>}
      </ol>
      <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 border-t border-line bg-paper/90 py-3 backdrop-blur-md">
        <p className="text-sm text-mute">{dirty ? 'You have unsaved changes.' : 'Drag rows, or use the arrows.'}</p>
        <button type="button" className="btn-primary" onClick={save} aria-busy={busy} disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save order'}</button>
      </div>
    </div>
  );
}

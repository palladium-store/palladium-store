'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/ui/api-client';

type Hit = { id: string; title: string; sub: string; href: string };
type Res = { products: Hit[]; orders: Hit[]; customers: Hit[] };

export function GlobalSearch() {
  const [q, setQ] = useState(''); const [res, setRes] = useState<Res | null>(null); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    setBusy(true);
    const t = setTimeout(() => api<Res>(`/api/admin/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes(null)).finally(() => setBusy(false)), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const groups: [string, Hit[]][] = res ? [['Orders', res.orders], ['Products & SKUs', res.products], ['Customers', res.customers]] : [];
  const none = res && groups.every(([, h]) => !h.length);
  return (
    <div ref={box} className="relative w-full max-w-md">
      <input className="input" placeholder="Search orders, products, SKU, customers" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label="Search admin" />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto border border-line bg-white shadow-xl">
          {busy && !res && <div className="p-4 text-sm text-mute">Searching...</div>}
          {none && <div className="p-4 text-sm text-mute">No results for &ldquo;{q}&rdquo;.</div>}
          {groups.filter(([, h]) => h.length).map(([label, hits]) => (
            <div key={label}>
              <div className="bg-bone px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-mute">{label}</div>
              {hits.map((h) => (
                <Link key={h.href} href={h.href} onClick={() => { setOpen(false); setQ(''); }} className="block border-b border-line px-4 py-2 hover:bg-bone">
                  <div className="text-sm font-semibold">{h.title}</div><div className="text-xs text-mute">{h.sub}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

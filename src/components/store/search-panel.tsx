'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { peso } from '@/lib/money';
import { Img } from './img';

interface Hit { id: string; name: string; slug: string; price: number; image: string | null; category: string; inStock: boolean }

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setBusy(false); setFailed(false); return; }
    const ctrl = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('search failed');
        const data = (await res.json()) as { items: Hit[] };
        setHits(data.items); setFailed(false); setBusy(false);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setFailed(true); setBusy(false); }
      }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  if (!open) return null;
  const term = q.trim();
  return (
    <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-paper shadow-xl" role="search">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <form action="/search" method="get" onSubmit={(e) => { e.preventDefault(); if (term) { onClose(); router.push(`/search?q=${encodeURIComponent(term)}`); } }} className="flex gap-2">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input id="site-search" ref={inputRef} name="q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Search paddles, balls, grips..." className="input py-3 text-base" />
          <button type="submit" className="btn-primary">Search</button>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close search">&times;</button>
        </form>
        <div aria-live="polite" className="mt-3">
          {busy && <p className="py-3 text-sm text-mute">Searching...</p>}
          {failed && <p className="py-3 text-sm text-red-600">Search is unavailable right now. Press Enter to search the full catalogue.</p>}
          {!busy && !failed && term.length >= 2 && hits.length === 0 && <p className="py-3 text-sm text-mute">No products match &ldquo;{term}&rdquo;.</p>}
          {hits.length > 0 && (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link href={`/products/${h.slug}`} onClick={onClose} className="flex items-center gap-4 py-3 hover:bg-bone">
                    <span className="relative h-14 w-12 shrink-0 bg-ink"><Img src={h.image} alt="" sizes="48px" className="object-contain" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block text-xs text-mute">{h.category}{h.inStock ? '' : ' · Sold out'}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{peso(h.price)}</span>
                  </Link>
                </li>
              ))}
              <li className="pt-3"><Link href={`/search?q=${encodeURIComponent(term)}`} onClick={onClose} className="text-xs font-semibold uppercase tracking-[0.14em] underline underline-offset-4">See all results</Link></li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

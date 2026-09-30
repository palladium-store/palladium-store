'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/ui/api-client';
import { fmtDateTime } from '@/lib/time';

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

export function NotificationBell() {
  const [items, setItems] = useState<N[]>([]); const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(() => api<{ items: N[]; unread: number }>('/api/admin/notifications').then((r) => { setItems(r.items); setUnread(r.unread); }).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  async function markAll() { await api('/api/admin/notifications', { method: 'POST', body: {} }); load(); }
  return (
    <div ref={box} className="relative">
      <button className="relative border border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider" onClick={() => setOpen(!open)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        Alerts{unread > 0 && <span className="ml-2 bg-gold px-1.5 py-0.5 text-[10px] text-ink">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(92vw,380px)] border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2"><span className="text-sm font-semibold">Notifications</span>{unread > 0 && <button className="text-xs text-mute underline" onClick={markAll}>Mark all read</button>}</div>
          <div className="max-h-96 overflow-y-auto">
            {!items.length && <p className="p-6 text-center text-sm text-mute">Nothing yet.</p>}
            {items.map((n) => (
              <Link key={n.id} href={n.link ?? '#'} onClick={() => { setOpen(false); api('/api/admin/notifications', { method: 'POST', body: { ids: [n.id] } }).then(load); }} className={`block border-b border-line px-4 py-3 hover:bg-bone ${n.isRead ? '' : 'bg-gold-soft/50'}`}>
                <div className="text-sm font-semibold">{n.title}</div>{n.body && <div className="text-xs text-mute">{n.body}</div>}<div className="mt-0.5 text-[11px] text-mute">{fmtDateTime(n.createdAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { api } from '@/components/ui/api-client';

export function AdminShell({ user, nav, canAudit, children }: { user: { name: string; role: string }; nav: { href: string; label: string }[]; canAudit: boolean; children: React.ReactNode }) {
  const path = usePathname(), router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  async function logout() { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.push('/login'); router.refresh(); }
  return (
    <div className="min-h-screen bg-bone">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform bg-ink text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/admin" className="font-display text-xl tracking-tightest" onClick={() => setOpen(false)}>palladium<span className="text-gold">x</span> <span className="ml-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Admin</span></Link>
          <button className="text-2xl leading-none text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">&times;</button>
        </div>
        <nav className="mt-2 flex flex-col px-3" aria-label="Admin">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active(n.href) ? 'page' : undefined}
              className={`border-l-2 px-4 py-2.5 text-sm font-medium transition ${active(n.href) ? 'border-gold bg-white/10 text-white' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}>{n.label}</Link>
          ))}
          {canAudit && <Link href="/admin/activity" onClick={() => setOpen(false)} className={`border-l-2 px-4 py-2.5 text-sm font-medium ${path.startsWith('/admin/activity') ? 'border-gold bg-white/10 text-white' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}>Activity log</Link>}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4 text-xs text-white/50">
          <Link href="/" className="hover:text-white" target="_blank">View storefront &rarr;</Link>
        </div>
      </aside>
      {open && <div className="no-print fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button className="mr-1 border border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">Menu</button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="hidden text-right leading-tight sm:block"><div className="text-sm font-semibold">{user.name}</div><div className="text-[11px] text-mute">{user.role}</div></div>
            <button onClick={logout} className="btn-outline btn-sm">Log out</button>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

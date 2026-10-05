'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/store/logo';
import { api } from '@/components/ui/api-client';
import { AdminThemeContext, ThemeMenuItem, ThemeToggle, saveAdminTheme, type AdminTheme } from './theme';

function NavLink({ href, label, on, onClick }: { href: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} aria-current={on ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${on ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${on ? 'bg-gold shadow-[0_0_10px_2px_rgba(220,33,27,0.6)]' : 'bg-white/15'}`} aria-hidden="true" />
      {label}
    </Link>
  );
}

export function AdminShell({ user, nav, canAudit, initialTheme = 'dark', children }: { user: { name: string; role: string }; nav: { href: string; label: string }[]; canAudit: boolean; initialTheme?: AdminTheme; children: React.ReactNode }) {
  const path = usePathname(), router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);
  const root = useRef<HTMLDivElement>(null);
  // The palette lives on the surrounding .theme-admin wrapper (rendered by the server layout), so switch the class there.
  useEffect(() => { root.current?.closest('.theme-admin')?.classList.toggle('admin-light', theme === 'light'); }, [theme]);
  const toggle = () => { const n = theme === 'dark' ? 'light' : 'dark'; saveAdminTheme(n); setTheme(n); };
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  async function logout() { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.push('/login'); router.refresh(); }
  return (
    <AdminThemeContext.Provider value={{ theme, toggle }}>
    <div ref={root} className="min-h-screen">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/10 bg-night text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setOpen(false)} aria-label="Palladium admin home">
            <Logo light className="h-6" />
            <span className="k-mono rounded-full border border-white/20 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.18em] text-white/60">Admin</span>
          </Link>
          <button className="text-2xl leading-none text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">&times;</button>
        </div>
        <nav className="mt-2 flex max-h-[calc(100vh-9rem)] flex-col gap-0.5 overflow-y-auto px-3 pb-4" aria-label="Admin">
          {nav.map((n) => <NavLink key={n.href} href={n.href} label={n.label} on={active(n.href)} onClick={() => setOpen(false)} />)}
          {canAudit && <NavLink href="/admin/activity" label="Activity log" on={path.startsWith('/admin/activity')} onClick={() => setOpen(false)} />}
        </nav>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-night p-4">
          <Link href="/" className="k-mono whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-white/50 transition hover:text-white" target="_blank">View storefront &rarr;</Link>
          <ThemeMenuItem className="sm:hidden" />
        </div>
      </aside>
      {open && <div className="no-print fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/80 px-4 backdrop-blur-md sm:px-6">
          <button className="mr-1 shrink-0 rounded-full border border-line px-3.5 py-2 text-xs font-semibold lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">Menu</button>
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <ThemeToggle className="hidden sm:flex" />
            <NotificationBell />
            <div className="hidden text-right leading-tight sm:block"><div className="text-sm font-medium">{user.name}</div><div className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-mute">{user.role}</div></div>
            <button onClick={logout} className="btn-outline btn-sm whitespace-nowrap">Log out</button>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </AdminThemeContext.Provider>
  );
}

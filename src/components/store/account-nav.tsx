'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

const LINKS = [
  { href: '/account', label: 'Overview' }, { href: '/account/orders', label: 'Orders' }, { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' }, { href: '/account/wallet', label: 'Wallet' }, { href: '/account/profile', label: 'Profile' }, { href: '/account/password', label: 'Change password' },
];

export function AccountNav() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
      toast('You have been signed out.', 'info');
      window.location.assign('/');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out.', 'error'); setBusy(false); }
  }
  const active = (h: string) => (h === '/account' ? pathname === h : pathname === h || pathname.startsWith(`${h}/`));
  const item = 'block whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition lg:border-b-0 lg:border-l-2 lg:py-3';
  return (
    <nav aria-label="Account" className="-mx-4 flex overflow-x-auto border-b border-line px-4 lg:mx-0 lg:block lg:overflow-visible lg:border-b-0 lg:px-0">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={`${item} ${active(l.href) ? 'border-gold text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{l.label}</Link>
      ))}
      <button onClick={logout} aria-busy={busy} disabled={busy} className={`${item} border-transparent text-mute hover:text-red-600 disabled:opacity-50`}>{busy ? 'Working...' : 'Log out'}</button>
    </nav>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Logo } from './logo';
import { Container } from './container';
import { SearchPanel } from './search-panel';
import { WalletButton } from './palladium/wallet';
import { ContractAddress } from './palladium/contract-address';
import { useCart } from './cart-context';

const NAV = [
  { label: 'Shop', href: '/shop' },
  { label: 'Wallet', href: '/wallet' },
  { label: '$PALLADIUM', href: '/pages/palladium-token' },
];
const icon = 'h-5 w-5';
const iconBtn = 'relative flex h-10 w-10 items-center justify-center text-ink transition hover:text-gold-deep';

export function Header({ userName }: { userName: string | null }) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const { count, openDrawer } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" className={`${iconBtn} -ml-2 lg:hidden`} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="mobile-nav" onClick={() => { setMenu((m) => !m); setSearch(false); }}>
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
          <Link href="/" aria-label="Palladium home" onClick={() => setMenu(false)}><Logo light className="h-8 sm:h-9" /></Link>
        </div>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-label group relative py-2 text-xs font-semibold uppercase tracking-[0.16em]">
              {n.label}
              <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center">
          <ContractAddress className="mr-1 hidden md:flex" />
          <WalletButton />
          <button type="button" className={iconBtn} aria-label="Search" aria-expanded={search} onClick={() => { setSearch((s) => !s); setMenu(false); }}>
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
          <Link href={userName ? '/account' : '/login'} className={`${iconBtn} lg:w-auto lg:gap-2 lg:px-2`} aria-label={userName ? 'My account' : 'Sign in'}>
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6" /></svg>
            <span className="nav-label hidden text-xs font-semibold uppercase tracking-[0.14em] lg:inline">{userName ? userName.split(' ')[0] : 'Sign in'}</span>
          </Link>
          <button type="button" className={iconBtn} aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`} onClick={() => { setMenu(false); setSearch(false); openDrawer(); }}>
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {count > 0 && <span className="absolute right-0 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{count > 99 ? '99+' : count}</span>}
          </button>
        </div>
      </Container>

      {menu && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper lg:hidden">
          <Container className="flex flex-col py-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="border-b border-line py-4 font-display text-2xl tracking-tightest last:border-0">{n.label}</Link>
            ))}
            <ContractAddress className="flex border-b border-line !px-0 py-4 md:hidden" />
            <Link href={userName ? '/account' : '/login'} onClick={() => setMenu(false)} className="py-4 text-sm font-semibold uppercase tracking-[0.14em] text-mute">{userName ? 'My account' : 'Sign in or create account'}</Link>
          </Container>
        </nav>
      )}
      <SearchPanel open={search} onClose={() => setSearch(false)} />
    </header>
  );
}

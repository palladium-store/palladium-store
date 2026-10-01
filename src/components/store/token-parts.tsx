import Link from 'next/link';
import type { TokenInfo } from '@/lib/token';

export function StatusPill({ tone, children }: { tone: 'live' | 'planned' | 'pending'; children: React.ReactNode }) {
  const c = tone === 'live' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : tone === 'planned' ? 'bg-bone text-mute border-line' : 'bg-gold/15 text-ink border-gold/40';
  return <span className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${c}`}>{children}</span>;
}

export function TokenFacts({ t, price }: { t: TokenInfo; price?: { text: string; note: string } | null }) {
  const rows: [string, React.ReactNode][] = [
    ['Token name', t.name],
    ['Symbol', t.symbol],
    ['Network', t.network],
    ['Contract address', t.contractAddress ? <span className="break-all font-mono text-xs">{t.contractAddress}</span> : <StatusPill tone="pending">Token deployment pending</StatusPill>],
    ['Maximum supply', <>{t.maxSupply.toLocaleString('en-PH')} <span className="text-mute">{t.deployed ? '' : '(proposed, final once deployed)'}</span></>],
    ['Circulating supply', t.circulatingSupply ?? <span className="text-mute">Not yet verified</span>],
    ['Price', price ? <>{price.text} <span className="text-mute">{price.note}</span></> : <span className="text-mute">Unavailable</span>],
    ['Blockchain explorer', t.explorerUrl ? <a className="underline underline-offset-4" href={t.explorerUrl} target="_blank" rel="noopener noreferrer">View on explorer</a> : <span className="text-mute">Available after deployment</span>],
  ];
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
          <dt className="text-xs font-semibold uppercase tracking-wider text-mute">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const TOKEN_NOTICE = 'The $PALLADIUM token is a digital utility and payment component of the Palladium ecosystem. It does not represent equity, ownership of Palladium assets, a share of profits, or any promise of return or price appreciation.';

export function TokenNav({ current }: { current: string }) {
  const links = [
    { href: '/pages/palladium-token', label: 'Overview' },
    { href: '/pages/tokenomics', label: 'Tokenomics' },
    { href: '/pages/token-terms', label: 'Token terms' },
  ];
  return (
    <nav aria-label="Token pages" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line pb-3">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.href === current ? 'page' : undefined} className={`py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${l.href === current ? 'text-ink underline decoration-gold decoration-2 underline-offset-8' : 'text-mute hover:text-ink'}`}>{l.label}</Link>
      ))}
    </nav>
  );
}

import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { StatusPill, TokenNav, TOKEN_NOTICE } from '@/components/store/token-parts';
import { PROPOSED_MAX_SUPPLY } from '@/lib/token';

export const metadata: Metadata = { title: 'Tokenomics', description: 'The proposed maximum supply of $PALLADIUM. Allocation and distribution are to be announced.', alternates: { canonical: '/pages/tokenomics' } };

/** Everything except the supply is still being decided, so the page says so instead of showing draft numbers. */
const TBA = ['Allocation', 'Distribution and release schedule', 'Vesting', 'Treasury and liquidity'];

export default function TokenomicsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <TokenNav current="/pages/tokenomics" />
      <h1 className="h-display mt-10 text-4xl sm:text-6xl">Tokenomics</h1>
      <p className="mt-4"><StatusPill tone="pending">To be announced</StatusPill></p>
      <p className="mt-4 max-w-2xl text-sm text-mute">The full tokenomics will be published here before the token is deployed.</p>

      <p className="mt-10 font-display text-5xl tracking-tightest sm:text-6xl">{PROPOSED_MAX_SUPPLY.toLocaleString('en-PH')}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-mute">Proposed maximum supply of $PALLADIUM, final once deployed</p>

      <dl className="mt-10 max-w-3xl divide-y divide-line border-y border-line">
        {TBA.map((k) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[18rem_1fr] sm:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-wider text-mute">{k}</dt>
            <dd className="text-sm text-mute">To be announced</dd>
          </div>
        ))}
      </dl>

      <p className="mt-12 max-w-3xl border-t border-line pt-6 text-xs text-mute">{TOKEN_NOTICE}</p>
    </Container>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { StatusPill, TokenFacts, TokenNav, TOKEN_NOTICE } from '@/components/store/token-parts';
import { getTokenInfo, getWalletConfig } from '@/lib/token';
import { WalletPanel } from '@/components/store/wallet-panel';
import { getCurrentPrice } from '@/lib/pricing';
import { formatPrice } from '@/lib/token-math';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Introducing $PALLADIUM',
  description: 'Powering the Palladium Pickleball commerce ecosystem. Digital payments and community rewards, planned for palladiumpickleball.com.',
  alternates: { canonical: '/pages/palladium-token' },
};

const UTILITIES = [
  { title: 'Palladium product payments', body: 'Pay for paddles, balls, grips and accessories with $PALLADIUM. The peso price of every product stays the same; the token amount is calculated at checkout from a time-stamped, locked quote.' },
  { title: 'Customer rewards', body: 'Earn Palladium rewards for purchases, reviews and community activity, under published rules.' },
  { title: 'Exclusive promotions', body: 'Member offers and early access to limited runs.' },
  { title: 'Community benefits', body: 'Tournaments, ambassadors and club partnerships.' },
  { title: 'Future ecosystem integrations', body: 'Authorized retailers, clubs and Palladium Touchpoints, once approvals are in place.' },
];

export default async function PalladiumTokenPage() {
  const t = getTokenInfo();
  const p = await getCurrentPrice();
  const price = p.available ? { text: `₱${formatPrice(p.priceScaled, 4)} per ${t.symbol}`, note: p.fixed ? '(fixed rate set by Palladium, indicative)' : '(indicative, not a guarantee)' } : null;
  const wallet = getWalletConfig();
  return (
    <>
      <section className="bg-night text-white">
        <Container className="py-16 sm:py-24">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Palladium ecosystem</p>
          <h1 className="h-display max-w-3xl text-5xl sm:text-7xl">Introducing $PALLADIUM</h1>
          <p className="mt-5 max-w-2xl text-xl text-white/90">Powering the Palladium Pickleball Commerce Ecosystem.</p>
          <p className="mt-4 max-w-2xl text-white/70">Discover a new way to shop, participate, and engage with Palladium through digital payments and community rewards.</p>
          <div className="mt-8 grid max-w-xl gap-4">
            <WalletPanel config={wallet} dark compact />
            <div><Link href="/shop" className="btn border border-white text-white hover:bg-white hover:text-night">Explore Palladium products</Link></div>
          </div>
          <p className="mt-3 text-xs text-white/60">Connecting only shares your public address. You never need a wallet to browse or to pay in pesos.</p>
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <TokenNav current="/pages/palladium-token" />

        <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16" aria-labelledby="info">
          <div>
            <h2 id="info" className="h-display text-3xl sm:text-4xl">Token information</h2>
            <p className="mt-3 text-sm text-mute">Every detail here is read from the official configuration. Nothing is estimated or invented. Where something is not available yet, we say so.</p>
            {!t.deployed && <p className="mt-4"><StatusPill tone="pending">Token deployment pending</StatusPill></p>}
          </div>
          <TokenFacts t={t} price={price} />
        </section>

        <section className="mt-16" aria-labelledby="utility">
          <h2 id="utility" className="h-display text-3xl sm:text-4xl">What it is for</h2>
          <p className="mt-3 max-w-2xl text-sm text-mute">These are the intended utilities. None of them is live yet. Today every order on the store is paid in pesos.</p>
          <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {UTILITIES.map((u) => (
              <li key={u.title} className="bg-paper p-6">
                <StatusPill tone="planned">Planned</StatusPill>
                <h3 className="mt-3 font-display text-xl tracking-tightest">{u.title}</h3>
                <p className="mt-2 text-sm text-mute">{u.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 border-t border-line pt-8" aria-labelledby="notice">
          <h2 id="notice" className="label">Important</h2>
          <p className="max-w-3xl text-sm text-mute">{TOKEN_NOTICE} Availability of token features depends on regulatory review and technical readiness. Read the <Link className="underline underline-offset-4" href="/pages/token-terms">token terms</Link> and the <Link className="underline underline-offset-4" href="/pages/tokenomics">proposed tokenomics</Link>.</p>
        </section>
      </Container>
    </>
  );
}

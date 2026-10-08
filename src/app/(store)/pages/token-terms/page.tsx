import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { StatusPill, TokenNav, TOKEN_NOTICE } from '@/components/store/token-parts';

export const metadata: Metadata = { title: 'Token terms', description: 'Terms for $PALLADIUM are to be announced.', alternates: { canonical: '/pages/token-terms' } };

/** The full terms are still being written. These few points already hold and protect customers in the meantime. */
const NOW = [
  { h: 'What $PALLADIUM is', p: TOKEN_NOTICE },
  { h: 'Paying in pesos stays available', p: 'You never need a crypto wallet or any cryptocurrency to browse, create an account or order from Palladium.' },
  { h: 'Keep your wallet safe', p: 'Palladium will never ask for your seed phrase or private key.' },
];

export default function TokenTermsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <TokenNav current="/pages/token-terms" />
      <h1 className="h-display mt-10 text-4xl sm:text-6xl">Token terms</h1>
      <p className="mt-4"><StatusPill tone="pending">To be announced</StatusPill></p>
      <p className="mt-4 max-w-2xl text-sm text-mute">The full token terms will be published here before token payments go live. Nothing on this page is an offer to sell tokens or any other security.</p>
      <div className="mt-10 max-w-3xl space-y-8">
        {NOW.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-2xl tracking-tightest">{s.h}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">{s.p}</p>
          </section>
        ))}
      </div>
    </Container>
  );
}

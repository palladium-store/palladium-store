import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { StatusPill, TokenNav, TOKEN_NOTICE } from '@/components/store/token-parts';

export const metadata: Metadata = { title: 'Token terms', description: 'Plain-language terms for $PALLADIUM. Draft, pending legal review.', alternates: { canonical: '/pages/token-terms' } };

const SECTIONS = [
  { h: 'What $PALLADIUM is', p: TOKEN_NOTICE },
  { h: 'Paying in pesos is always available', p: 'You never need a crypto wallet or any cryptocurrency to browse, create an account or order from Palladium. Peso payment options remain available.' },
  { h: 'How token prices work', p: 'Products are priced in Philippine pesos. If token payment is offered, the token amount is calculated from the market price at checkout and locked for a short time. Prices shown for tokens are estimates until you confirm a payment. If no reliable market price is available, token payment is switched off.' },
  { h: 'Payments are confirmed on-chain', p: 'An order is marked paid only after the payment is independently verified on the blockchain. A payment sent to the wrong address, on the wrong network, in the wrong amount or after the quote expires may not be accepted automatically and may need manual review.' },
  { h: 'Refunds', p: 'Refund rules for token payments, including the rate used, will be published here before token payments go live.' },
  { h: 'Rewards', p: 'Palladium rewards are promotional benefits issued under published rules. They are not purchased, are not guaranteed, and may expire or change.' },
  { h: 'Risks', p: 'Digital assets can lose value, transactions cannot be reversed, and wallets can be lost or compromised. Palladium will never ask for your seed phrase or private key.' },
  { h: 'Availability and regulation', p: 'Token features depend on technical readiness and on review under applicable laws in the Philippines and elsewhere. Features may be delayed, limited by country, or withdrawn.' },
];

export default function TokenTermsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <TokenNav current="/pages/token-terms" />
      <h1 className="h-display mt-10 text-4xl sm:text-6xl">Token terms</h1>
      <p className="mt-4"><StatusPill tone="pending">Draft, pending legal review</StatusPill></p>
      <p className="mt-4 max-w-2xl text-sm text-mute">This is a plain-language summary and is not yet a final legal document. It is not an offer to sell tokens or any other security.</p>
      <div className="mt-10 max-w-3xl space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-2xl tracking-tightest">{s.h}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">{s.p}</p>
          </section>
        ))}
      </div>
    </Container>
  );
}

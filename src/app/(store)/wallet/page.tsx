import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/store/container';
import { WalletDashboard, type DashboardPrice } from '@/components/store/palladium/wallet-dashboard';
import { getCurrentPrice } from '@/lib/pricing';
import { formatPrice } from '@/lib/token-math';
import { getWalletConfig } from '@/lib/token';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Wallet',
  description: 'Your $PALLADIUM wallet: balance, send, receive and activity on Robinhood Chain.',
  robots: { index: false, follow: true },
};

export default async function WalletPage() {
  const p = await getCurrentPrice();
  const price: DashboardPrice | null = p.available ? { phpPerToken: formatPrice(p.priceScaled, 4), fixed: p.fixed } : null;
  const { chain } = getWalletConfig();
  return (
    <Container className="py-12 sm:py-16">
      <p className="k-kicker">Palladium wallet</p>
      <h1 className="h-display mt-3 text-4xl sm:text-6xl">Wallet</h1>
      <p className="mt-3 max-w-2xl text-sm text-mute">
        Your {chain.name} wallet, read live from the blockchain. Palladium never holds your tokens, your keys or your seed phrase:
        every transfer is signed in your own wallet. <Link href="/pages/palladium-token" className="underline underline-offset-4">About $PALLADIUM</Link>
      </p>
      <div className="mt-8"><WalletDashboard price={price} /></div>
    </Container>
  );
}

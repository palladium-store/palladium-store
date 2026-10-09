import type { Metadata } from 'next';
import Link from 'next/link';
import { BuyPalladium } from '@/components/store/palladium/wallet-dashboard';

export const metadata: Metadata = { title: 'Buy $PALLADIUM' };

export default function AccountBuyPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="h-display text-3xl">Buy $PALLADIUM</h2>
      <p className="mt-2 text-sm text-mute">
        Pay with ETH from your own crypto wallet. The tokens are delivered to that wallet in the same transaction, straight from
        Palladium&apos;s sale contract on Robinhood Chain. Palladium never holds your tokens or keys.
      </p>
      <div className="mt-6"><BuyPalladium /></div>
      <div className="mt-8 space-y-2 text-xs text-mute">
        <p>Blockchain purchases cannot be reversed. The value of $PALLADIUM can go down; buy only what you are comfortable holding. It is not equity and carries no promise of returns.</p>
        <p><Link href="/wallet" className="underline underline-offset-4">Your wallet</Link> · <Link href="/pages/token-terms" className="underline underline-offset-4">Token terms</Link> · <Link href="/pages/palladium-token" className="underline underline-offset-4">About $PALLADIUM</Link></p>
      </div>
    </div>
  );
}

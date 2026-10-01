import type { Metadata } from 'next';
import Link from 'next/link';
import { WalletPanel } from '@/components/store/wallet-panel';
import { getWalletConfig } from '@/lib/token';

export const metadata: Metadata = { title: 'My wallet' };

export default function AccountWalletPage() {
  const config = getWalletConfig();
  return (
    <div className="max-w-2xl">
      <h2 className="h-display text-3xl">Wallet</h2>
      <p className="mt-2 text-sm text-mute">Connect a Web3 wallet to see your $PALLADIUM balance. A wallet is optional: you can always shop and pay in pesos.</p>
      <div className="mt-6"><WalletPanel config={config} /></div>
      <div className="mt-8 space-y-2 text-sm text-mute">
        <p>Coming next: linking a wallet to your Palladium account, token payment history and rewards.</p>
        <p><Link href="/pages/palladium-token" className="underline underline-offset-4">About $PALLADIUM</Link></p>
      </div>
    </div>
  );
}

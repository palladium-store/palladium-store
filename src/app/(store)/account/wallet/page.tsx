import type { Metadata } from 'next';
import Link from 'next/link';
import { WalletPanel } from '@/components/store/wallet-panel';

export const metadata: Metadata = { title: 'My wallet' };

export default function AccountWalletPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="h-display text-3xl">Wallet</h2>
      <p className="mt-2 text-sm text-mute">Connect a crypto wallet to see your $PALLADIUM balance and pay with it when token payments are open. A wallet is optional: you can always shop and pay in pesos.</p>
      <div className="mt-6"><WalletPanel /></div>
      <div className="mt-8 space-y-2 text-sm text-mute">
        <p>Coming next: token payment history and rewards.</p>
        <p><Link href="/pages/palladium-token" className="underline underline-offset-4">About $PALLADIUM</Link></p>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { guard } from '@/lib/guard';
import { PageHeader } from '@/components/admin/PageHeader';
import { TokenAdmin } from '@/components/admin/TokenAdmin';
import { LiveWalletProvider } from '@/components/store/palladium/live-wallet';
import { getPalladiumClientConfig } from '@/lib/palladium/live-config';
import { saleOverview } from '@/lib/palladium/sale-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Token' };

export default async function TokenAdminPage() {
  await guard('MANAGE_TOKEN');
  const [overview, wallet] = await Promise.all([saleOverview(), getPalladiumClientConfig()]);
  return (
    <div>
      <PageHeader title="$PALLADIUM" subtitle="Token sale: price, spread, limits and the sale contract. Contract actions are signed by your own wallet." />
      <LiveWalletProvider config={wallet}><TokenAdmin o={overview} /></LiveWalletProvider>
    </div>
  );
}

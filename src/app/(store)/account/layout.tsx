import type { Metadata } from 'next';
import { customerGuard } from '@/lib/guard';
import { Container } from '@/components/store/container';
import { AccountNav } from '@/components/store/account-nav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My account', robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await customerGuard();
  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <h1 className="h-display mb-8 text-4xl sm:text-5xl">My account</h1>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr] lg:gap-12">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}

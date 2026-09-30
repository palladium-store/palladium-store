import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { isStaff } from '@/lib/rbac';
import { Container } from '@/components/store/container';
import { LoginForm } from '@/components/store/auth-forms';
import { safeNext } from '@/components/store/labels';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  const [user, store] = await Promise.all([getUser(), getSetting('store')]);
  if (user) redirect(next ?? (isStaff(user.role) ? '/admin' : '/account'));
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">Sign in</h1>
        <p className="mt-3 mb-8 text-sm text-mute">Track orders, save addresses and check out faster.</p>
        <LoginForm next={next} storeEmail={store.email} />
      </div>
    </Container>
  );
}

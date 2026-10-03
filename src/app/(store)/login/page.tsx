import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { isStaff } from '@/lib/rbac';
import { Container } from '@/components/store/container';
import { LoginForm } from '@/components/store/auth-forms';
import { safeNext } from '@/components/store/labels';
import { GoogleButton, GOOGLE_MESSAGES } from '@/components/store/google-button';
import { googleEnabled } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; google?: string; verify?: string } }) {
  const next = safeNext(searchParams.next);
  const [user, store] = await Promise.all([getUser(), getSetting('store')]);
  if (user) redirect(next ?? (isStaff(user.role) ? '/admin' : '/account'));
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">Sign in</h1>
        <p className="mt-3 mb-8 text-sm text-mute">Track orders, save addresses and check out faster.</p>
        {(() => {
          const msg = (searchParams.google && GOOGLE_MESSAGES[searchParams.google]) || (searchParams.verify === 'failed' ? 'That confirmation link is invalid or has expired. Sign in, or create your account again to get a new link.' : null);
          return msg ? <p className="mb-6 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{msg}</p> : null;
        })()}
        {googleEnabled() && <GoogleButton next={next} />}
        <LoginForm next={next} storeEmail={store.email} />
      </div>
    </Container>
  );
}

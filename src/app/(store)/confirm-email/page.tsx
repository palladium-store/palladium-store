import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false, follow: false } };

/** Opened from the confirmation email. Confirming takes a button press, so a link scanner opening the email cannot do it. */
export default function ConfirmEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? '';
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">Confirm your email</h1>
        {token ? (
          <>
            <p className="mt-3 mb-8 text-sm text-mute">Confirm that this is your email address. Next you will choose your password, and your past orders will appear in your account.</p>
            <form method="post" action="/api/auth/verify-email">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary w-full py-4">Confirm my email</button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm text-mute">This confirmation link is incomplete. <Link href="/login" className="underline">Sign in</Link> to get a new one.</p>
        )}
      </div>
    </Container>
  );
}

import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { ResetForm } from '@/components/store/auth-forms';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">New password</h1>
        <p className="mt-3 mb-8 text-sm text-mute">Choose a new password for your account.</p>
        <ResetForm token={searchParams.token ?? ''} />
      </div>
    </Container>
  );
}

import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { ForgotForm } from '@/components/store/auth-forms';

export const metadata: Metadata = { title: 'Forgot password', robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">Forgot password</h1>
        <p className="mt-3 mb-8 text-sm text-mute">Enter your email and we will send you a link to choose a new password.</p>
        <ForgotForm />
      </div>
    </Container>
  );
}

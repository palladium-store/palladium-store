import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Container } from '@/components/store/container';
import { RegisterForm } from '@/components/store/auth-forms';
import { safeNext } from '@/components/store/labels';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create account', robots: { index: false, follow: true } };

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getUser()) redirect(next ?? '/');
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="h-display text-4xl sm:text-5xl">Create account</h1>
        <p className="mt-3 mb-8 text-sm text-mute">Already ordered as a guest? Use the same email and your past orders will appear.</p>
        <RegisterForm next={next} />
      </div>
    </Container>
  );
}

import Link from 'next/link';
import { StoreShell } from '@/components/store/store-shell';

export default function NotFound() {
  return (
    <StoreShell>
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-6xl text-gold-deep">404</p>
          <h1 className="mt-3 font-display text-3xl">Page not found</h1>
          <p className="mt-3 text-mute">The page you are looking for does not exist or has moved.</p>
          <Link href="/" className="btn-gold mt-6 inline-flex">Back to Palladium</Link>
        </div>
      </main>
    </StoreShell>
  );
}

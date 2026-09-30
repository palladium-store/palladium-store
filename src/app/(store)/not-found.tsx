import Link from 'next/link';
import { Container } from '@/components/store/container';

export default function NotFound() {
  return (
    <Container className="py-24 text-center sm:py-32">
      <p className="h-display text-8xl text-gold sm:text-9xl">404</p>
      <h1 className="h-display mt-4 text-3xl sm:text-5xl">Out of bounds.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-mute">We could not find that page. It may have moved, sold out for good or never existed.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/shop" className="btn-outline">Shop all</Link>
      </div>
    </Container>
  );
}

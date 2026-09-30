import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-ink text-white flex items-center justify-center px-6 text-center">
      <div>
        <p className="text-gold font-display text-6xl">404</p>
        <h1 className="font-display text-3xl mt-3">Page not found</h1>
        <p className="text-white/60 mt-3">The page you are looking for does not exist or has moved.</p>
        <Link href="/" className="btn btn-gold mt-6 inline-flex">Back to Palladium</Link>
      </div>
    </main>
  );
}

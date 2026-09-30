import Link from 'next/link';
import { Container } from './container';
import { Logo } from './logo';
import { NewsletterForm } from './newsletter-form';
import type { ContentSettings, StoreSettings } from '@/lib/settings';

const h = 'mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold';
const a = 'text-sm text-white/70 transition hover:text-white';

export function Footer({ store, content, categories }: { store: StoreSettings; content: ContentSettings; categories: { name: string; slug: string; count: number }[] }) {
  return (
    <footer className="mt-24 bg-ink text-white">
      <Container className="grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo light className="text-4xl" />
          <p className="mt-4 max-w-sm text-sm text-white/70">Premium pickleball equipment designed in New Zealand and delivered across the Philippines.</p>
          <div className="mt-8 max-w-sm">
            <p className="mb-3 text-sm font-semibold">New drops and limited runs, first.</p>
            <NewsletterForm dark />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
          <div>
            <p className={h}>Shop</p>
            <ul className="space-y-3">
              <li><Link href="/shop" className={a}>All products</Link></li>
              {categories.filter((c) => c.count > 0).map((c) => <li key={c.slug}><Link href={`/shop?category=${c.slug}`} className={a}>{c.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className={h}>Help</p>
            <ul className="space-y-3">
              <li><Link href="/pages/about" className={a}>About Palladium</Link></li>
              {content.policies.map((p) => <li key={p.slug}><Link href={`/pages/${p.slug}`} className={a}>{p.title}</Link></li>)}
              <li><Link href="/account" className={a}>My account</Link></li>
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className={h}>Contact</p>
            <ul className="space-y-3 text-sm text-white/70">
              <li><a href={`mailto:${store.email}`} className={a}>{store.email}</a></li>
              <li><a href={`tel:${store.phone.replace(/\s/g, '')}`} className={a}>{store.phone}</a></li>
              <li>{store.address}</li>
              {store.instagram && <li><a href={store.instagram} target="_blank" rel="noopener noreferrer" className={a}>Instagram</a></li>}
              {store.facebook && <li><a href={store.facebook} target="_blank" rel="noopener noreferrer" className={a}>Facebook</a></li>}
            </ul>
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {store.name}. All prices in Philippine pesos.</p>
          <p>Registered in New Zealand. Made for the court.</p>
        </Container>
      </div>
    </footer>
  );
}

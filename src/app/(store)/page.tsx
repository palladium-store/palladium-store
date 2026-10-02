import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { homeData, listProducts } from '@/lib/queries/catalog';
import { fmtDate } from '@/lib/time';
import { Container } from '@/components/store/container';
import { Img } from '@/components/store/img';
import { Stars } from '@/components/store/stars';
import { ProductGrid } from '@/components/store/product-card';
import { NewsletterForm } from '@/components/store/newsletter-form';
import { paragraphs, shipCta } from '@/components/store/labels';
import type { CardProduct } from '@/components/store/types';

export const revalidate = 60;
export const metadata: Metadata = { alternates: { canonical: '/' } };

function Section({ eyebrow, title, href, children }: { eyebrow: string; title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-20 sm:mt-28">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep">{eyebrow}</p>
            <h2 className="h-display mt-2 text-3xl sm:text-5xl">{title}</h2>
          </div>
          {href && <Link href={href} className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.14em] underline underline-offset-4 hover:text-gold-deep sm:block">View all</Link>}
        </div>
        {children}
        {href && <div className="mt-8 sm:hidden"><Link href={href} className="btn-outline w-full">View all</Link></div>}
      </Container>
    </section>
  );
}

export default async function HomePage() {
  const [content, data, shipped, shopRes] = await Promise.all([
    getSetting('content'),
    homeData(),
    prisma.order.count({ where: { status: { in: ['SHIPPED', 'DELIVERED'] } } }),
    listProducts({ pageSize: 12 }),
  ]);
  const shopItems: CardProduct[] = shopRes.items;
  const { hero, brandStory } = content;
  const cats = data.categories.filter((c) => c.count > 0);
  const totalProducts = cats.reduce((a, c) => a + c.count, 0);
  const proof: { value: string; label: string }[] = [];
  if (data.ratingCount > 0 && data.ratingAvg != null) proof.push({ value: data.ratingAvg.toFixed(1), label: `average from ${data.ratingCount.toLocaleString('en-PH')} review${data.ratingCount === 1 ? '' : 's'}` });
  if (shipped > 0) proof.push({ value: shipped.toLocaleString('en-PH'), label: `order${shipped === 1 ? '' : 's'} shipped` });
  if (totalProducts > 0) proof.push({ value: String(totalProducts), label: `product${totalProducts === 1 ? '' : 's'} in ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}` });
  proof.push({ value: 'NZ', label: 'brand registered in New Zealand' });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <Container className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="order-2 lg:order-1">
            {hero.eyebrow && <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{hero.eyebrow}</p>}
            <h1 className="h-display text-6xl leading-[0.92] sm:text-8xl xl:text-[8.5rem]">{hero.title}</h1>
            <p className="mt-6 max-w-lg text-base text-white/70 sm:text-lg">{hero.subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={shipCta(hero.cta)} className="btn-gold px-8 py-4">{hero.cta}</Link>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative mx-auto aspect-[4/5] max-h-[70vh] w-full max-w-md lg:max-w-none">
              <div aria-hidden="true" className="absolute inset-[8%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),rgba(255,255,255,0)_100%)]" />
              <Img src={hero.image} alt="Palladium paddle" priority sizes="(min-width:1024px) 45vw, 90vw" className="object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
        </Container>
      </section>

      {/* Social proof */}
      <section className="border-b border-line bg-bone" aria-label="Palladium in numbers">
        <Container className={`grid gap-6 py-6 sm:py-8 ${proof.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {proof.map((s) => (
            <div key={s.label} className="flex items-baseline gap-3">
              <span className="h-display text-3xl sm:text-4xl">{s.value}</span>
              <span className="text-xs leading-snug text-mute">{s.label}</span>
            </div>
          ))}
        </Container>
      </section>

      {/* Shop */}
      {shopItems.length > 0 && (
        <Section eyebrow="Palladium" title="Shop" href="/shop">
          <ProductGrid items={shopItems} className="grid-cols-2 lg:grid-cols-4" />
        </Section>
      )}

      {/* Brand story */}
      <section className="mt-20 bg-ink text-white sm:mt-28">
        <Container className="py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">The brand</p>
            <h2 className="h-display text-3xl leading-tight sm:text-5xl">{brandStory.title}</h2>
            <div className="mt-6 max-w-2xl space-y-4 text-base text-white/70">
              {paragraphs(brandStory.body).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <Link href="/pages/about" className="btn-gold mt-8">Read our story</Link>
          </div>
        </Container>
      </section>

      {/* Reviews */}
      {data.reviews.length > 0 && data.ratingAvg != null && (
        <section className="mt-20 sm:mt-28" aria-labelledby="reviews-h">
          <Container>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep">Customer reviews</p>
                <h2 id="reviews-h" className="h-display mt-2 text-3xl sm:text-5xl">Heard on court</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="h-display text-5xl">{data.ratingAvg.toFixed(1)}</span>
                <div><Stars value={data.ratingAvg} size={20} /><p className="mt-1 text-xs text-mute">{data.ratingCount} review{data.ratingCount === 1 ? '' : 's'}</p></div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {data.reviews.map((r) => (
                <figure key={r.id} className="card flex flex-col p-6">
                  <Stars value={r.rating} size={16} />
                  {r.title && <p className="mt-4 font-display text-lg leading-tight tracking-tightest">{r.title}</p>}
                  <blockquote className="mt-2 flex-1 text-sm text-mute">{r.body}</blockquote>
                  <figcaption className="mt-5 border-t border-line pt-4 text-xs">
                    <span className="font-semibold">{r.authorName}</span>{r.verified && <span className="ml-2 text-gold-deep">Verified buyer</span>}
                    <span className="block text-mute">on <Link href={`/products/${r.product.slug}`} className="underline underline-offset-2">{r.product.name}</Link> · {fmtDate(r.createdAt)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Newsletter */}
      <section className="mt-20 sm:mt-28">
        <Container>
          <div className="grid items-center gap-8 border border-ink p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="h-display text-3xl sm:text-4xl">Get first access.</h2>
              <p className="mt-3 max-w-md text-sm text-mute">Limited runs sell out. Join the list and hear about new paddles, restocks and offers before anyone else.</p>
            </div>
            <NewsletterForm />
          </div>
        </Container>
      </section>
    </>
  );
}

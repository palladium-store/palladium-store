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
import { Reveal } from '@/components/store/koru/reveal';
import { KoruLine } from '@/components/store/koru/koru-line';
import { paragraphs, shipCta } from '@/components/store/labels';
import type { CardProduct } from '@/components/store/types';

export const revalidate = 60;
export const metadata: Metadata = { alternates: { canonical: '/' } };

/** Stagger position of a `.rv` element inside a <Reveal> (see koru.css). */
const i = (n: number) => ({ '--i': n }) as React.CSSProperties;

const Arrow = () => (
  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 5h14M11 1l4 4-4 4" /></svg>
);

/** A hairline that ends in a small curl and draws itself as its section arrives. */
const Rule = () => (
  <svg className="k-rule" viewBox="0 0 1180 26" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} d="M0 13H1140c14 0 22-10 14-17s-18 4-11 10" /></svg>
);

function Section({ eyebrow, title, href, children }: { eyebrow: string; title: string; href?: string; children: React.ReactNode }) {
  return (
    <Reveal as="section" className="mt-24 sm:mt-32">
      <Container>
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="k-kicker rv" style={i(0)}>{eyebrow}</p>
            <h2 className="k-h2 rv mt-4" style={i(1)}>{title}</h2>
          </div>
          {href && <div className="rv hidden shrink-0 sm:block" style={i(2)}><Link href={href} className="k-link">View all <Arrow /></Link></div>}
        </div>
        <div className="rv" style={i(2)}>{children}</div>
        {href && <div className="mt-10 sm:hidden"><Link href={href} className="btn-outline w-full">View all</Link></div>}
      </Container>
    </Reveal>
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
      <section className="k-hero">
        <div className="k-dust" aria-hidden="true" />
        <Container className="grid items-center gap-8 py-10 sm:py-14 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="order-2 lg:order-1">
            {hero.eyebrow && <p className="mb-6"><span className="k-chip">{hero.eyebrow}</span></p>}
            <h1 className="k-mega">{hero.title}</h1>
            <p className="k-lede mt-7">{hero.subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={shipCta(hero.cta)} className="btn-gold k-btn-lg">{hero.cta}</Link>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="k-stage mx-auto aspect-[4/5] max-h-[46vh] w-full max-w-md lg:max-h-[72vh] lg:max-w-none">
              <Img src={hero.image} alt="Palladium paddle" priority sizes="(min-width:1024px) 45vw, 90vw" className="k-stage-img object-contain" />
            </div>
          </div>
        </Container>
      </section>

      {/* Social proof */}
      <section className="border-y border-line" aria-label="Palladium in numbers">
        <Container className={`grid gap-x-8 gap-y-6 py-8 sm:py-10 ${proof.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {proof.map((s) => (
            <div key={s.label} className="k-stat"><b>{s.value}</b><span>{s.label}</span></div>
          ))}
        </Container>
      </section>

      {/* Shop */}
      {shopItems.length > 0 && (
        <Section eyebrow="Palladium" title="Shop" href="/shop">
          <ProductGrid items={shopItems} className="grid-cols-2 lg:grid-cols-4" />
        </Section>
      )}

      {/* The KORU film's resting frame. /koru is a static page (public/koru), so this is a plain link, not a router link. */}
      <Reveal as="section" className="k-band mt-24 sm:mt-32" aria-label="KORU limited edition">
        <div className="k-band-bg" aria-hidden="true" />
        <div className="k-band-halo" aria-hidden="true" />
        <Container className="py-20">
          <p className="rv" style={i(0)}><span className="k-chip">Limited edition</span></p>
          <h2 className="k-mega rv mt-5" style={i(1)}>KORU</h2>
          <p className="rv mt-5 max-w-lg text-lg" style={i(2)}>Full foam core. Control and power. Designed in New&nbsp;Zealand.</p>
          <div className="rv mt-8" style={i(3)}><a href="/koru" className="btn-gold k-btn-lg">See the KORU</a></div>
        </Container>
      </Reveal>

      {/* Brand story */}
      <Reveal as="section" className="mt-24 sm:mt-32">
        <Container>
          <Rule />
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-24">
            <div>
              <p className="k-kicker rv" style={i(0)}>The brand</p>
              <h2 className="k-h2 rv mt-4" style={i(1)}>{brandStory.title}</h2>
              <div className="k-lede rv mt-7 space-y-4" style={i(2)}>
                {paragraphs(brandStory.body).map((p, n) => <p key={n}>{p}</p>)}
              </div>
              <div className="rv mt-9" style={i(3)}><Link href="/pages/about" className="btn-outline">Read our story</Link></div>
            </div>
            <div className="k-koru rv mx-auto w-[min(64%,300px)] lg:w-[min(100%,400px)]" style={i(3)}><KoruLine /></div>
          </div>
        </Container>
      </Reveal>

      {/* Reviews */}
      {data.reviews.length > 0 && data.ratingAvg != null && (
        <Reveal as="section" className="mt-24 sm:mt-32" aria-labelledby="reviews-h">
          <Container>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="k-kicker rv" style={i(0)}>Customer reviews</p>
                <h2 id="reviews-h" className="k-h2 rv mt-4" style={i(1)}>Heard on court</h2>
              </div>
              <div className="rv flex items-center gap-4" style={i(2)}>
                <span className="k-h2">{data.ratingAvg.toFixed(1)}</span>
                <div><Stars value={data.ratingAvg} size={20} /><p className="k-mono mt-1.5 text-[11px] uppercase tracking-[0.12em] text-mute">{data.ratingCount} review{data.ratingCount === 1 ? '' : 's'}</p></div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {data.reviews.map((r, n) => (
                <figure key={r.id} className="k-panel rv flex flex-col p-7" style={i(2 + n)}>
                  <Stars value={r.rating} size={16} />
                  {r.title && <p className="k-h3 mt-5 text-xl">{r.title}</p>}
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-mute">{r.body}</blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4 text-xs">
                    <span className="font-medium">{r.authorName}</span>{r.verified && <span className="ml-2 text-gold-deep">Verified buyer</span>}
                    <span className="mt-1 block text-mute">on <Link href={`/products/${r.product.slug}`} className="underline underline-offset-2">{r.product.name}</Link> · {fmtDate(r.createdAt)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </Reveal>
      )}

      {/* Newsletter */}
      <Reveal as="section" className="mt-24 sm:mt-32">
        <Container>
          <div className="k-panel rv grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="k-h2 !text-[length:clamp(1.9rem,3.6vw,3.2rem)]">Get first access.</h2>
              <p className="mt-4 max-w-md text-[15px] text-mute">Limited runs sell out. Join the list and hear about new paddles, restocks and offers before anyone else.</p>
            </div>
            <div className="min-w-0"><NewsletterForm /></div>
          </div>
        </Container>
      </Reveal>
    </>
  );
}

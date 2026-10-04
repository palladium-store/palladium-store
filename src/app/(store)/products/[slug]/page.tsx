import Link from 'next/link';
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getProduct, boughtTogether, relatedProducts } from '@/lib/queries/catalog';
import { getSetting } from '@/lib/settings';
import { getUser } from '@/lib/auth';
import { fmtDate } from '@/lib/time';
import { Container } from '@/components/store/container';
import { ProductView } from '@/components/store/product-view';
import { ProductGrid } from '@/components/store/product-card';
import { BundleBox, type BundleItem } from '@/components/store/bundle-box';
import { ReviewForm } from '@/components/store/review-form';
import { Stars } from '@/components/store/stars';
import { paragraphs } from '@/components/store/labels';
import { toHtml, htmlToText } from '@/lib/rich-text';

export const dynamic = 'force-dynamic';
type Params = { params: { slug: string } };
/** One database read per request, shared by the metadata and the page. */
const loadProduct = cache((slug: string) => getProduct(slug));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadProduct(params.slug);
  if (!p) notFound(); // here, not only in the page, so the response is a real 404 rather than a 200 "not found" page
  const img = p.ogImageUrl || p.images.find((i) => i.kind === 'image')?.url;
  const title = p.seoTitle || p.name;
  const description = p.seoDescription || p.shortDescription || undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: 'website', title, description, url: `/products/${p.slug}`, images: img ? [{ url: img, alt: p.name }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img] : undefined },
  };
}

export default async function ProductPage({ params }: Params) {
  const product = await loadProduct(params.slug);
  if (!product) notFound();

  const [content, user, together, related] = await Promise.all([
    getSetting('content'), getUser(), boughtTogether(product.id, 3), relatedProducts(product.id, product.categoryId, 4),
  ]);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const images = product.images.filter((i) => i.kind === 'image').map((i) => ({ url: i.url, alt: i.alt }));
  const variants = product.variants;
  const anyAvailable = variants.some((v) => v.available > 0);
  const firstAvail = variants.find((v) => v.available > 0);

  // Frequently bought together: the first available variant of each product (skip sold-out ones).
  const partners = (await Promise.all(together.map((c) => getProduct(c.slug)))).filter((x): x is NonNullable<typeof x> => !!x);
  const bundle: BundleItem[] = [];
  if (firstAvail) {
    bundle.push({ productId: product.id, variantId: firstAvail.id, name: product.name, slug: product.slug, variantLabel: variants.length > 1 ? firstAvail.name : null, image: firstAvail.imageUrl ?? images[0]?.url ?? null, priceCentavos: firstAvail.priceCentavos, available: firstAvail.available, isCurrent: true });
    for (const pp of partners) {
      const v = pp.variants.find((x) => x.available > 0);
      if (!v) continue;
      bundle.push({ productId: pp.id, variantId: v.id, name: pp.name, slug: pp.slug, variantLabel: pp.variants.length > 1 ? v.name : null, image: v.imageUrl ?? pp.images.find((i) => i.kind === 'image')?.url ?? null, priceCentavos: v.priceCentavos, available: v.available, isCurrent: false });
    }
  }

  const specs = product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs) ? Object.entries(product.specs as Record<string, unknown>).filter(([, v]) => v != null && String(v) !== '') : [];
  const shippingPolicy = content.policies.find((p) => p.slug === 'shipping');

  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: product.reviews.filter((r) => r.rating === n).length }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || htmlToText(product.description) || product.name,
    sku: (firstAvail ?? variants[0])?.sku,
    image: images.map((i) => (i.url.startsWith('http') ? i.url : `${site}${i.url}`)),
    brand: { '@type': 'Brand', name: 'Palladium' },
    category: product.category.name,
    url: `${site}/products/${product.slug}`,
    offers: variants.map((v) => ({
      '@type': 'Offer', sku: v.sku, name: v.name, priceCurrency: 'PHP', price: (v.priceCentavos / 100).toFixed(2),
      availability: v.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${site}/products/${product.slug}`, itemCondition: 'https://schema.org/NewCondition',
    })),
    ...(product.reviewCount > 0 && product.ratingAvg != null ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.reviewCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Container className="pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-mute">
          <Link href="/" className="hover:text-ink">Home</Link> / <Link href="/shop" className="hover:text-ink">Shop</Link> / <Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> / <span className="text-ink">{product.name}</span>
        </nav>

        <ProductView
          productId={product.id} name={product.name} category={product.category.name} categorySlug={product.category.slug} isLimited={product.isLimited}
          shortDescription={product.shortDescription} images={images} variants={variants} rating={product.ratingAvg} reviewCount={product.reviewCount}
        />
        {!anyAvailable && <p className="mt-6 border border-line bg-bone p-4 text-sm">This product is sold out right now. Browse similar products below.</p>}

        {/* Details */}
        <section className="mt-16 grid gap-10 border-t border-line pt-12 lg:grid-cols-12" aria-label="Product details">
          <div className="lg:col-span-7">
            <h2 className="h-display text-2xl sm:text-3xl">About this product</h2>
            {product.description
              ? <div className="rte-view mt-5 max-w-2xl space-y-4 text-base leading-relaxed text-mute" dangerouslySetInnerHTML={{ __html: toHtml(product.description) }} />
              : <div className="mt-5 max-w-2xl space-y-4 text-base leading-relaxed text-mute">{paragraphs(product.shortDescription).map((t, i) => <p key={i}>{t}</p>)}</div>}
          </div>
          {specs.length > 0 && (
            <div className="lg:col-span-5">
              <h2 className="h-display text-2xl sm:text-3xl">Specifications</h2>
              <table className="mt-5 w-full text-left text-sm">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k} className="border-b border-line align-top">
                      <th scope="row" className="w-2/5 py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-mute">{k}</th>
                      <td className="py-3">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Shipping */}
        <section className="mt-12 border-t border-line" aria-label="Shipping">
          <details className="group border-b border-line py-5" open>
            <summary className="flex cursor-pointer items-center justify-between font-display text-xl tracking-tightest">Shipping information<span className="text-2xl transition group-open:rotate-45" aria-hidden="true">+</span></summary>
            <div className="mt-4 max-w-3xl space-y-3 text-sm text-mute">
              {paragraphs(product.shippingInfo).map((t, i) => <p key={`p${i}`}>{t}</p>)}
              {paragraphs(shippingPolicy?.body).map((t, i) => <p key={`s${i}`}>{t}</p>)}
              {!product.shippingInfo && !shippingPolicy && <p>Shipping is calculated at checkout based on your province.</p>}
            </div>
          </details>
        </section>

        {/* Frequently bought together */}
        {bundle.length > 1 && (
          <section className="mt-16" aria-labelledby="fbt-h">
            <h2 id="fbt-h" className="h-display mb-6 text-2xl sm:text-3xl">Frequently bought together</h2>
            <BundleBox items={bundle} />
          </section>
        )}

        {/* Reviews */}
        <section id="reviews" className="mt-16 scroll-mt-24 border-t border-line pt-12" aria-labelledby="reviews-h">
          <h2 id="reviews-h" className="h-display text-2xl sm:text-3xl">Customer reviews</h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              {product.reviewCount > 0 && product.ratingAvg != null ? (
                <div>
                  <div className="flex items-center gap-4"><span className="h-display text-6xl">{product.ratingAvg.toFixed(1)}</span><div><Stars value={product.ratingAvg} size={20} /><p className="mt-1 text-xs text-mute">{product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}</p></div></div>
                  <ul className="mt-6 space-y-2 text-xs">
                    {dist.map((d) => (
                      <li key={d.n} className="flex items-center gap-3"><span className="w-8 text-mute">{d.n} star</span><span className="h-2 flex-1 bg-bone"><span className="block h-2 bg-gold" style={{ width: `${(d.c / product.reviewCount) * 100}%` }} /></span><span className="w-6 text-right text-mute">{d.c}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-sm text-mute">No reviews yet. Be the first to share how it plays.</p>}
              <div className="mt-8">
                {user ? <ReviewForm productId={product.id} /> : (
                  <div className="border border-line bg-bone p-5 text-sm">
                    <p className="font-semibold">Played with it?</p>
                    <p className="mt-1 text-mute">Sign in to write a review.</p>
                    <Link href={`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`} className="btn-primary mt-4">Sign in</Link>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-8">
              {product.reviews.length > 0 && (
                <ul className="divide-y divide-line border-y border-line">
                  {product.reviews.map((r) => (
                    <li key={r.id} className="py-6">
                      <div className="flex flex-wrap items-center gap-3"><Stars value={r.rating} size={15} />{r.title && <span className="font-semibold">{r.title}</span>}</div>
                      <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-mute">{r.body}</p>
                      <p className="mt-3 text-xs text-mute"><span className="font-semibold text-ink">{r.authorName}</span>{r.verified && <span className="ml-2 text-gold-deep">Verified buyer</span>} · {fmtDate(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="related-h">
            <h2 id="related-h" className="h-display mb-8 text-2xl sm:text-3xl">You might also like</h2>
            <ProductGrid items={related} />
          </section>
        )}
      </Container>
    </>
  );
}

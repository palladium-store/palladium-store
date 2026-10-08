import Link from 'next/link';
import { displayTokenPricePhp } from '@/lib/pricing';
import type { Metadata } from 'next';
import { listProducts, listCategories, priceBounds, type Sort } from '@/lib/queries/catalog';
import { peso } from '@/lib/money';
import { Pagination, EmptyState } from '@/components/ui/bits';
import { Container } from '@/components/store/container';
import { ProductGrid } from '@/components/store/product-card';
import { SortSelect } from '@/components/store/sort-select';
import { SORT_VALUES } from '@/components/store/labels';

export const revalidate = 60;
type SP = { category?: string; q?: string; min?: string; max?: string; availability?: string; sort?: string; page?: string };

const pesos = (v: string | undefined) => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  if (searchParams.category) {
    const cat = (await listCategories()).find((c) => c.slug === searchParams.category);
    if (cat) return { title: `${cat.name} | Shop`, description: `Shop Palladium ${cat.name.toLowerCase()} with nationwide delivery in the Philippines.`, alternates: { canonical: `/shop?category=${cat.slug}` } };
  }
  return { title: 'Shop pickleball equipment', description: 'Browse Palladium pickleball paddles, balls, grips and accessories.', alternates: { canonical: '/shop' } };
}

function href(sp: Record<string, string | undefined>, over: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/shop?${s}` : '/shop';
}

function FilterForm({ idp, sp, bounds }: { idp: string; sp: Record<string, string | undefined>; bounds: { min: number; max: number } }) {
  const radio = 'flex cursor-pointer items-center gap-2.5 py-1 text-sm';
  return (
    <form action="/shop" method="get" className="space-y-7">
      {sp.category && <input type="hidden" name="category" value={sp.category} />}
      {sp.q && <input type="hidden" name="q" value={sp.q} />}
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      <fieldset>
        <legend className="label">Price (PHP)</legend>
        <div className="flex items-center gap-2">
          <div className="flex-1"><label htmlFor={`${idp}-min`} className="sr-only">Minimum price</label><input id={`${idp}-min`} name="min" type="number" inputMode="numeric" min={0} step="1" defaultValue={sp.min ?? ''} placeholder={String(Math.floor(bounds.min / 100))} className="input" /></div>
          <span className="text-mute">to</span>
          <div className="flex-1"><label htmlFor={`${idp}-max`} className="sr-only">Maximum price</label><input id={`${idp}-max`} name="max" type="number" inputMode="numeric" min={0} step="1" defaultValue={sp.max ?? ''} placeholder={String(Math.ceil(bounds.max / 100))} className="input" /></div>
        </div>
        {bounds.max > 0 && <p className="mt-2 text-xs text-mute">Ranges from {peso(bounds.min)} to {peso(bounds.max)}</p>}
      </fieldset>
      <fieldset>
        <legend className="label">Availability</legend>
        {[['', 'All'], ['in', 'In stock'], ['out', 'Sold out']].map(([v, l]) => (
          <label key={v} className={radio}><input type="radio" name="availability" value={v} defaultChecked={(sp.availability ?? '') === v} className="accent-gold" />{l}</label>
        ))}
      </fieldset>
      <button type="submit" className="btn-primary w-full">Apply filters</button>
    </form>
  );
}

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sort = (SORT_VALUES.includes(searchParams.sort ?? '') ? searchParams.sort : 'featured') as Sort;
  const min = pesos(searchParams.min), max = pesos(searchParams.max);
  const availability = searchParams.availability === 'in' || searchParams.availability === 'out' ? searchParams.availability : undefined;
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const q = searchParams.q?.trim() || undefined;
  const category = searchParams.category || undefined;

  const [res, cats, bounds] = await Promise.all([
    listProducts({ category, q, min: min != null ? Math.round(min * 100) : undefined, max: max != null ? Math.round(max * 100) : undefined, availability, sort, page, pageSize: 24 }),
    listCategories(),
    priceBounds(),
  ]);
  const activeCat = cats.find((c) => c.slug === category);

  const sp: Record<string, string | undefined> = {
    category, q, min: min != null ? String(min) : undefined, max: max != null ? String(max) : undefined, availability,
    sort: sort !== 'featured' ? sort : undefined,
  };
  const chips: { label: string; to: string }[] = [];
  if (activeCat) chips.push({ label: activeCat.name, to: href(sp, { category: undefined }) });
  if (q) chips.push({ label: `Search: ${q}`, to: href(sp, { q: undefined }) });
  if (min != null || max != null) chips.push({ label: `${min != null ? peso(Math.round(min * 100)) : 'Any'} to ${max != null ? peso(Math.round(max * 100)) : 'Any'}`, to: href(sp, { min: undefined, max: undefined }) });
  if (availability) chips.push({ label: availability === 'in' ? 'In stock' : 'Sold out', to: href(sp, { availability: undefined }) });

  const filterCount = chips.filter((c) => !c.label.startsWith('Search') && c.label !== activeCat?.name).length;
  const visibleCats = cats.filter((c) => c.count > 0 || c.slug === category);

  return (
    <>
      <section className="k-hero border-b border-line">
        <Container className="pb-9 pt-10 sm:pt-14">
          <nav aria-label="Breadcrumb" className="k-mono mb-7 text-[11.5px] uppercase tracking-[0.14em] text-mute"><Link href="/" className="transition hover:text-ink">Home</Link> / <span className="text-ink">Shop</span>{activeCat && <> / <span className="text-ink">{activeCat.name}</span></>}</nav>
          <p className="k-kicker">Palladium / {activeCat ? activeCat.name : 'Performance Equipment'}</p>
          <h1 className="k-h2 mt-4 max-w-4xl">{q ? `Results for “${q}”` : 'Built for Your Next Level.'}</h1>
          <p className="k-lede mt-5">Performance equipment engineered for power, control, and confidence.</p>
          <div className="-mx-4 mt-9 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="navigation" aria-label="Categories">
            <Link href={href(sp, { category: undefined, page: undefined })} className="k-tab" aria-current={!activeCat ? 'true' : undefined}>All Products</Link>
            {visibleCats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug, page: undefined })} className="k-tab" aria-current={c.slug === category ? 'true' : undefined}>{c.name}</Link>)}
          </div>
        </Container>
      </section>

      <Container className="pb-12 pt-7 sm:pt-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="k-mono text-xs uppercase tracking-[0.12em] text-mute" aria-live="polite"><span className="text-ink">{res.total.toLocaleString('en-PH')}</span> product{res.total === 1 ? '' : 's'}</p>
          <div className="flex flex-wrap items-center gap-3">
            <details className="group relative">
              <summary className="k-tab cursor-pointer list-none gap-2 group-open:border-ink group-open:text-ink">
                Filters{filterCount > 0 ? ` (${filterCount})` : ''}
                <span aria-hidden="true" className="text-[9px] transition group-open:rotate-180">&#9660;</span>
              </summary>
              <div className="k-pop absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] p-5">
                <FilterForm idp="f" sp={sp} bounds={bounds} />
              </div>
            </details>
            <SortSelect action="/shop" value={sort} hidden={{ category, q, min: sp.min, max: sp.max, availability }} />
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {chips.map((c) => (
              <Link key={c.label} href={c.to} className="k-pill" aria-label={`Remove filter ${c.label}`}>{c.label}<span aria-hidden="true">&times;</span></Link>
            ))}
            <Link href="/shop" className="k-link ml-1">Clear all</Link>
          </div>
        )}

        <div className="mt-9">
          {res.items.length === 0 ? (
            <EmptyState title="No products match" text="Try removing a filter or searching for something else." action={<Link href="/shop" className="btn-primary">Clear filters</Link>} />
          ) : (
            <ProductGrid items={res.items} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" priorityCount={4} palladiumPricePhp={await displayTokenPricePhp()} />
          )}
          <Pagination page={res.page} pages={res.pages} total={res.total} base="/shop" params={sp} />
        </div>
      </Container>
    </>
  );
}

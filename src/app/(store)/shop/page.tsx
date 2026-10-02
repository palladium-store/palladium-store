import Link from 'next/link';
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
  const radio = 'flex cursor-pointer items-center gap-2 py-1 text-sm';
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
        {bounds.max > 0 && <p className="mt-1 text-xs text-mute">Ranges from {peso(bounds.min)} to {peso(bounds.max)}</p>}
      </fieldset>
      <fieldset>
        <legend className="label">Availability</legend>
        {[['', 'All'], ['in', 'In stock'], ['out', 'Sold out']].map(([v, l]) => (
          <label key={v} className={radio}><input type="radio" name="availability" value={v} defaultChecked={(sp.availability ?? '') === v} className="accent-black" />{l}</label>
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

  const tab = (active: boolean) => `relative whitespace-nowrap px-1 pb-3 pt-1 text-[13px] font-semibold tracking-tight transition after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition ${active ? 'text-ink after:bg-ink' : 'text-mute hover:text-ink after:bg-transparent hover:after:bg-line'}`;
  const visibleCats = cats.filter((c) => c.count > 0 || c.slug === category);

  return (
    <>
      <section className="border-b border-line bg-bone">
        <Container className="pb-0 pt-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="mb-5 text-xs text-mute"><Link href="/" className="hover:text-ink">Home</Link> / <span className="text-ink">Shop</span>{activeCat && <> / <span className="text-ink">{activeCat.name}</span></>}</nav>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-deep">Palladium / {activeCat ? activeCat.name : 'Performance Equipment'}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tightest sm:text-6xl">{q ? `Results for \u201c${q}\u201d` : 'Built for Your Next Level.'}</h1>
          <p className="mt-4 max-w-xl text-base text-mute sm:text-lg">Performance equipment engineered for power, control, and confidence.</p>
          <div className="-mx-4 mt-8 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:gap-8 sm:px-0" role="navigation" aria-label="Categories">
            <Link href={href(sp, { category: undefined, page: undefined })} className={tab(!activeCat)} aria-current={!activeCat ? 'true' : undefined}>All Products</Link>
            {visibleCats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug, page: undefined })} className={tab(c.slug === category)} aria-current={c.slug === category ? 'true' : undefined}>{c.name}</Link>)}
          </div>
        </Container>
      </section>

      <Container className="pb-12 pt-6 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute" aria-live="polite"><span className="font-semibold text-ink">{res.total.toLocaleString('en-PH')}</span> product{res.total === 1 ? '' : 's'}</p>
          <div className="flex flex-wrap items-center gap-3">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 border border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-ink group-open:border-ink">
                Filters{chips.filter((c) => !c.label.startsWith('Search') && c.label !== activeCat?.name).length > 0 ? ` (${chips.filter((c) => !c.label.startsWith('Search') && c.label !== activeCat?.name).length})` : ''}
                <span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">&#9660;</span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-ink bg-white p-5 shadow-sm">
                <FilterForm idp="f" sp={sp} bounds={bounds} />
              </div>
            </details>
            <SortSelect action="/shop" value={sort} hidden={{ category, q, min: sp.min, max: sp.max, availability }} />
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Link key={c.label} href={c.to} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-ink" aria-label={`Remove filter ${c.label}`}>{c.label}<span aria-hidden="true">&times;</span></Link>
            ))}
            <Link href="/shop" className="text-xs font-semibold underline underline-offset-4">Clear all</Link>
          </div>
        )}

        <div className="mt-8">
          {res.items.length === 0 ? (
            <EmptyState title="No products match" text="Try removing a filter or searching for something else." action={<Link href="/shop" className="btn-primary">Clear filters</Link>} />
          ) : (
            <ProductGrid items={res.items} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" priorityCount={4} />
          )}
          <Pagination page={res.page} pages={res.pages} total={res.total} base="/shop" params={sp} />
        </div>
      </Container>
    </>
  );
}

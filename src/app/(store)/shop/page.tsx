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
    listProducts({ category, q, min: min != null ? Math.round(min * 100) : undefined, max: max != null ? Math.round(max * 100) : undefined, availability, sort, page, pageSize: 12 }),
    listCategories(),
    priceBounds(),
  ]);
  const activeCat = cats.find((c) => c.slug === category);
  const allCount = cats.reduce((a, c) => a + c.count, 0);

  const sp: Record<string, string | undefined> = {
    category, q, min: min != null ? String(min) : undefined, max: max != null ? String(max) : undefined, availability,
    sort: sort !== 'featured' ? sort : undefined,
  };
  const chips: { label: string; to: string }[] = [];
  if (activeCat) chips.push({ label: activeCat.name, to: href(sp, { category: undefined }) });
  if (q) chips.push({ label: `Search: ${q}`, to: href(sp, { q: undefined }) });
  if (min != null || max != null) chips.push({ label: `${min != null ? peso(Math.round(min * 100)) : 'Any'} to ${max != null ? peso(Math.round(max * 100)) : 'Any'}`, to: href(sp, { min: undefined, max: undefined }) });
  if (availability) chips.push({ label: availability === 'in' ? 'In stock' : 'Sold out', to: href(sp, { availability: undefined }) });

  const pill = (active: boolean) => `whitespace-nowrap border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${active ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`;

  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-mute"><Link href="/" className="hover:text-ink">Home</Link> / <span className="text-ink">Shop</span>{activeCat && <> / <span className="text-ink">{activeCat.name}</span></>}</nav>
      <h1 className="h-display text-4xl sm:text-6xl">{activeCat ? activeCat.name : q ? `Results for "${q}"` : 'All products'}</h1>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="navigation" aria-label="Categories">
        <Link href={href(sp, { category: undefined, page: undefined })} className={pill(!activeCat)} aria-current={!activeCat ? 'true' : undefined}>All ({allCount})</Link>
        {cats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug, page: undefined })} className={pill(c.slug === category)} aria-current={c.slug === category ? 'true' : undefined}>{c.name} ({c.count})</Link>)}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters">
          <details className="border border-line lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Filters{chips.length > 0 ? ` (${chips.length})` : ''}</summary>
            <div className="border-t border-line p-4"><FilterForm idp="m" sp={sp} bounds={bounds} /></div>
          </details>
          <div className="hidden lg:sticky lg:top-24 lg:block"><FilterForm idp="d" sp={sp} bounds={bounds} /></div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="text-sm text-mute" aria-live="polite">{res.total.toLocaleString('en-PH')} product{res.total === 1 ? '' : 's'}</p>
            <SortSelect action="/shop" value={sort} hidden={{ category, q, min: sp.min, max: sp.max, availability }} />
          </div>
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <Link key={c.label} href={c.to} className="inline-flex items-center gap-2 bg-bone px-3 py-1.5 text-xs font-semibold transition hover:bg-ink hover:text-white" aria-label={`Remove filter ${c.label}`}>{c.label}<span aria-hidden="true">&times;</span></Link>
              ))}
              <Link href="/shop" className="text-xs font-semibold underline underline-offset-4">Clear all</Link>
            </div>
          )}
          {res.items.length === 0 ? (
            <EmptyState title="No products match" text="Try removing a filter or searching for something else." action={<Link href="/shop" className="btn-primary">Clear filters</Link>} />
          ) : (
            <ProductGrid items={res.items} className="grid-cols-2 lg:grid-cols-3" priorityCount={3} />
          )}
          <Pagination page={res.page} pages={res.pages} total={res.total} base="/shop" params={sp} />
        </div>
      </div>
    </Container>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { listProducts, type Sort } from '@/lib/queries/catalog';
import { Pagination, EmptyState } from '@/components/ui/bits';
import { Container } from '@/components/store/container';
import { ProductGrid } from '@/components/store/product-card';
import { SortSelect } from '@/components/store/sort-select';
import { SORT_VALUES } from '@/components/store/labels';

export const dynamic = 'force-dynamic';
type SP = { q?: string; sort?: string; page?: string };

export function generateMetadata({ searchParams }: { searchParams: SP }): Metadata {
  return { title: searchParams.q ? `Search: ${searchParams.q}` : 'Search', robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const sort = (SORT_VALUES.includes(searchParams.sort ?? '') ? searchParams.sort : 'featured') as Sort;
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const res = q ? await listProducts({ q, sort, page, pageSize: 12 }) : null;

  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <h1 className="h-display text-4xl sm:text-6xl">{q ? <>Results for &ldquo;{q}&rdquo;</> : 'Search'}</h1>
      <form action="/search" method="get" className="mt-6 flex max-w-xl gap-2" role="search">
        <label htmlFor="search-page-q" className="sr-only">Search products</label>
        <input id="search-page-q" name="q" defaultValue={q} placeholder="Search paddles, balls, grips..." className="input py-3" />
        <button className="btn-primary" type="submit">Search</button>
      </form>
      <div className="mt-8">
        {!res ? (
          <EmptyState title="What are you looking for?" text="Type a product name, category or keyword above." action={<Link href="/shop" className="btn-primary">Browse the shop</Link>} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="text-sm text-mute" aria-live="polite">{res.total.toLocaleString('en-PH')} result{res.total === 1 ? '' : 's'}</p>
              <SortSelect action="/search" value={sort} hidden={{ q }} />
            </div>
            {res.items.length === 0
              ? <EmptyState title="No products found" text={`Nothing matched "${q}". Check the spelling or browse the shop.`} action={<Link href="/shop" className="btn-primary">Browse the shop</Link>} />
              : <ProductGrid items={res.items} />}
            <Pagination page={res.page} pages={res.pages} total={res.total} base="/search" params={{ q, sort: sort !== 'featured' ? sort : undefined }} />
          </>
        )}
      </div>
    </Container>
  );
}

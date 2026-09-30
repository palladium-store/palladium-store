import { getUser } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { listCategories } from '@/lib/queries/catalog';
import { StoreProviders } from '@/components/store/store-providers';
import { Header } from '@/components/store/header';
import { Footer } from '@/components/store/footer';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, store, content, categories] = await Promise.all([getUser(), getSetting('store'), getSetting('content'), listCategories()]);
  return (
    <StoreProviders signedIn={!!user}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>
      {content.announcement && (
        <div className="bg-ink px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{content.announcement}</div>
      )}
      <Header userName={user?.name ?? null} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer store={store} content={content} categories={categories} />
    </StoreProviders>
  );
}

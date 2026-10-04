import Link from 'next/link';
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { Container } from '@/components/store/container';
import { paragraphs, storePolicies } from '@/components/store/labels';

export const dynamic = 'force-dynamic';

const load = cache(async (slug: string) => {
  const [content, store] = await Promise.all([getSetting('content'), getSetting('store')]);
  const policy = storePolicies(content.policies).find((p) => p.slug === slug);
  if (policy) return { title: policy.title, body: policy.body, content, store };
  return null;
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await load(params.slug);
  if (!page) notFound();
  return { title: page.title, description: page.body.slice(0, 160), alternates: { canonical: `/pages/${params.slug}` } };
}

export default async function InfoPage({ params }: { params: { slug: string } }) {
  const page = await load(params.slug);
  if (!page) notFound();
  const links = storePolicies(page.content.policies).map((p) => ({ slug: p.slug, title: p.title }));
  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <div className="grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-16">
        <nav aria-label="Information pages" className="lg:sticky lg:top-24 lg:self-start">
          <p className="label">Information</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:block lg:space-y-1">
            {links.map((l) => (
              <li key={l.slug}><Link href={`/pages/${l.slug}`} aria-current={l.slug === params.slug ? 'page' : undefined} className={`block py-1.5 text-sm ${l.slug === params.slug ? 'font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4' : 'text-mute hover:text-ink'}`}>{l.title}</Link></li>
            ))}
          </ul>
        </nav>
        <article className="max-w-2xl">
          <h1 className="h-display text-4xl sm:text-5xl">{page.title}</h1>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-mute">
            {paragraphs(page.body).map((t, i) => <p key={i}>{t}</p>)}
          </div>
          <p className="mt-10 border-t border-line pt-6 text-sm text-mute">Questions? Contact us at <a className="underline" href={`mailto:${page.store.email}`}>{page.store.email}</a>.</p>
        </article>
      </div>
    </Container>
  );
}

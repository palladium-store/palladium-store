import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { listCategories } from '@/lib/queries/catalog';
import { storePolicies } from '@/components/store/labels';

export const dynamic = 'force-dynamic';
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, content] = await Promise.all([
    prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
    listCategories(),
    getSetting('content'),
  ]);
  return [
    { url: `${site}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site}/koru`, changeFrequency: 'monthly', priority: 0.8 },
    ...categories.filter((c) => c.count > 0).map((c) => ({ url: `${site}/shop?category=${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: `${site}/pages/palladium-token`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${site}/pages/tokenomics`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${site}/pages/token-terms`, changeFrequency: 'monthly', priority: 0.2 },
    ...storePolicies(content.policies).map((p) =>({ url: `${site}/pages/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}

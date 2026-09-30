import type { Metadata } from 'next';
import { guard } from '@/lib/guard';
import { getSetting } from '@/lib/settings';
import { PageHeader } from '@/components/admin/PageHeader';
import { ContentEditor } from '@/components/admin/ContentEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Content' };

export default async function ContentPage() {
  await guard('MANAGE_SETTINGS');
  const c = await getSetting('content');
  return (
    <div>
      <PageHeader title="Content" subtitle="Edit the homepage hero, announcement bar, promo banners, brand story and policy pages shown on the storefront." />
      <ContentEditor initial={{ hero: c.hero, banners: c.banners, brandStory: c.brandStory, announcement: c.announcement, policies: c.policies }} />
    </div>
  );
}

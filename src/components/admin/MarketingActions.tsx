'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

export function CopyEmails({ emails }: { emails: string[] }) {
  const { toast } = useToast();
  async function copy() {
    const text = emails.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for insecure contexts or blocked clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const okay = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!okay) { toast('Could not copy. Select the emails in the table and copy them manually.', 'error'); return; }
    }
    toast(`${emails.length} email${emails.length === 1 ? '' : 's'} copied to the clipboard.`);
  }
  return <button className="btn-outline btn-sm" onClick={copy} disabled={emails.length === 0}>Copy all emails</button>;
}

export interface ReviewItem {
  id: string; product: string; productId: string; author: string; rating: number; title: string | null; body: string;
  verified: boolean; isDemo: boolean; isApproved: boolean; dateLabel: string;
}

export function ReviewModeration({ reviews }: { reviews: ReviewItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function set(r: ReviewItem, isApproved: boolean) {
    setBusy(r.id);
    try {
      await api(`/api/admin/reviews/${r.id}`, { method: 'PATCH', body: { isApproved } });
      toast(isApproved ? 'Review approved and visible in the store.' : 'Review hidden from the store.');
      router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not update the review.', 'error'); }
    setBusy(null);
  }
  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-gold-deep" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span className="text-neutral-300">{'★'.repeat(5 - r.rating)}</span></span>
              <span className="font-semibold">{r.author}</span>
              <span className="text-xs text-mute">on {r.product} &middot; {r.dateLabel}</span>
              {r.verified && <span className="bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">Verified</span>}
              {r.isDemo && <span className="bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-deep">Demo</span>}
              <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}>{r.isApproved ? 'Approved' : 'Hidden'}</span>
            </div>
            {r.title && <p className="mt-1 text-sm font-semibold">{r.title}</p>}
            <p className="mt-1 whitespace-pre-line text-sm text-mute">{r.body}</p>
          </div>
          <div className="shrink-0">
            {r.isApproved
              ? <button className="btn-outline btn-sm" onClick={() => set(r, false)} disabled={busy === r.id}>{busy === r.id ? 'Saving...' : 'Hide'}</button>
              : <button className="btn-primary btn-sm" onClick={() => set(r, true)} disabled={busy === r.id}>{busy === r.id ? 'Saving...' : 'Approve'}</button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

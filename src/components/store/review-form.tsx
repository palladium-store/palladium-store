'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null); setFields({});
    if (rating < 1) { setFields({ rating: 'Choose a star rating.' }); return; }
    setBusy(true);
    try {
      await api('/api/reviews', { body: { productId, rating, title: title.trim() || undefined, body } });
      toast('Thanks for your review!');
      setDone(true);
      router.refresh();
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not post your review.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFields(ex.fields);
      toast(m, 'error');
    } finally { setBusy(false); }
  }

  if (done) return <p className="border border-line bg-bone p-5 text-sm">Thank you. Your review has been posted.</p>;
  return (
    <form onSubmit={submit} className="space-y-4 border border-line p-5 sm:p-6" noValidate>
      <h3 className="font-display text-xl tracking-tightest">Write a review</h3>
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className={`text-3xl leading-none transition hover:scale-110 ${n <= rating ? 'text-gold' : 'text-line'}`}>★</button>
          ))}
        </div>
        {fields.rating && <p className="field-error">{fields.rating}</p>}
      </fieldset>
      <div>
        <label htmlFor="rv-title" className="label">Title (optional)</label>
        <input id="rv-title" className={`input ${fields.title ? 'input-error' : ''}`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        {fields.title && <p className="field-error">{fields.title}</p>}
      </div>
      <div>
        <label htmlFor="rv-body" className="label">Your review</label>
        <textarea id="rv-body" rows={4} maxLength={2000} className={`input ${fields.body ? 'input-error' : ''}`} value={body} onChange={(e) => setBody(e.target.value)} />
        {fields.body && <p className="field-error">{fields.body}</p>}
      </div>
      {err && !Object.keys(fields).length && <p className="field-error" role="alert">{err}</p>}
      <button type="submit" className="btn-primary" aria-busy={busy} disabled={busy}>{busy ? 'Working...' : 'Post review'}</button>
    </form>
  );
}

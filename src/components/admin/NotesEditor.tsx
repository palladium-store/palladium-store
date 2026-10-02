'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

/** Internal notes for an order (POST /api/admin/orders/[id]/notes). Read-only when the viewer cannot edit. */
export function OrderNotes({ orderId, initial, canEdit }: { orderId: string; initial: string; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return <p className="whitespace-pre-wrap text-sm text-mute">{initial || 'No internal notes.'}</p>;

  async function save() {
    setBusy(true); setError(null);
    try {
      await api(`/api/admin/orders/${orderId}/notes`, { method: 'POST', body: { internalNotes: value } });
      setSaved(value); toast('Internal note saved.'); router.refresh();
    } catch (e) {
      const m = e instanceof ApiError ? e.message : 'Could not save the note.';
      setError(m); toast(m, 'error');
    } finally { setBusy(false); }
  }
  return (
    <div>
      <label className="sr-only" htmlFor="order-notes">Internal notes</label>
      <textarea id="order-notes" className="input min-h-[96px]" value={value} maxLength={4000} onChange={(e) => setValue(e.target.value)} placeholder="Notes only staff can see" />
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-mute">{value.length}/4000</span>
        <button className="btn-primary btn-sm" onClick={save} aria-busy={busy} disabled={busy || value === saved}>{busy ? 'Working...' : 'Save note'}</button>
      </div>
    </div>
  );
}

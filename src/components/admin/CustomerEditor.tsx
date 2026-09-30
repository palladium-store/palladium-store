'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/modal';
import { Badge } from '@/components/ui/bits';

/** Notes and ACTIVE/BLOCKED status for one customer via PATCH /api/admin/customers/[id]. */
export function CustomerEditor({ customerId, name, initialNotes, initialStatus }: { customerId: string; name: string; initialNotes: string; initialStatus: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<null | 'notes' | 'status'>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const close = useCallback(() => setConfirm(false), []);
  const blocked = status === 'BLOCKED';

  async function patch(kind: 'notes' | 'status', body: { notes?: string; status?: string }, success: string) {
    setBusy(kind); setError(null);
    try {
      await api(`/api/admin/customers/${customerId}`, { method: 'PATCH', body });
      if (body.notes !== undefined) setSavedNotes(body.notes);
      if (body.status) setStatus(body.status);
      toast(success); setConfirm(false); router.refresh();
    } catch (e) {
      const m = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setError(m); toast(m, 'error');
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Account status</h2>
          <Badge status={status} />
        </div>
        <p className="mt-2 text-sm text-mute">{blocked ? 'This customer is blocked.' : 'This customer is active.'}</p>
        <button className={`${blocked ? 'btn-outline' : 'btn-danger'} btn-sm mt-3`} disabled={busy !== null} onClick={() => setConfirm(true)}>{blocked ? 'Unblock customer' : 'Block customer'}</button>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Internal notes</h2>
        <label className="sr-only" htmlFor="cust-notes">Customer notes</label>
        <textarea id="cust-notes" className="input min-h-[110px]" value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} placeholder="Notes only staff can see" />
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-mute">{notes.length}/4000</span>
          <button className="btn-primary btn-sm" disabled={busy !== null || notes === savedNotes} onClick={() => patch('notes', { notes }, 'Customer notes saved.')}>{busy === 'notes' ? 'Working...' : 'Save notes'}</button>
        </div>
      </div>

      <ConfirmDialog open={confirm} onClose={close} danger={!blocked} busy={busy === 'status'} confirmLabel={blocked ? 'Unblock' : 'Block customer'}
        title={blocked ? `Unblock ${name}` : `Block ${name}`}
        message={blocked ? 'The customer will be marked as active again.' : 'The customer is marked as blocked so your team can spot them. Existing orders are not changed.'}
        onConfirm={() => patch('status', { status: blocked ? 'ACTIVE' : 'BLOCKED' }, blocked ? `${name} unblocked.` : `${name} blocked.`)} />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/modal';

export function ProductRowActions({ id, name, status }: { id: string; name: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const archived = status === 'ARCHIVED';

  async function duplicate() {
    setBusy('duplicate');
    try {
      const r = await api<{ id: string }>(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
      toast('Product duplicated as a draft. Review the copy before publishing.');
      router.push(`/admin/products/${r.id}`);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not duplicate the product.', 'error'); setBusy(null); }
  }
  async function setStatus(next: 'ARCHIVED' | 'DRAFT') {
    setBusy('status');
    try {
      await api(`/api/admin/products/${id}/status`, { method: 'POST', body: { status: next } });
      toast(next === 'ARCHIVED' ? 'Product archived.' : 'Product restored as a draft.');
      router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not change the status.', 'error'); }
    setBusy(null);
  }
  async function remove() {
    setBusy('delete'); setDeleteError(null);
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      toast('Product deleted.');
      setConfirm(false);
      router.refresh();
    } catch (e) { setDeleteError(e instanceof ApiError ? e.message : 'Could not delete the product.'); }
    setBusy(null);
  }
  const btn = 'rounded-md border border-line px-2 py-1 text-[11px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-40';
  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <button className={btn} onClick={duplicate} disabled={!!busy}>{busy === 'duplicate' ? 'Copying...' : 'Duplicate'}</button>
        <button className={btn} onClick={() => setStatus(archived ? 'DRAFT' : 'ARCHIVED')} disabled={!!busy}>{busy === 'status' ? 'Saving...' : archived ? 'Restore' : 'Archive'}</button>
        <button className={`${btn} text-red-600 hover:bg-red-600`} onClick={() => { setDeleteError(null); setConfirm(true); }} disabled={!!busy}>Delete</button>
      </div>
      <ConfirmDialog open={confirm} title="Delete product?" danger confirmLabel="Delete product" busy={busy === 'delete'} onConfirm={remove} onClose={() => setConfirm(false)}
        message={<>Permanently delete <strong className="text-ink">{name}</strong> and its variants? This cannot be undone. Products with orders or stock history cannot be deleted; archive them instead.</>}>
        {deleteError && (
          <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {deleteError}
            {!archived && <button className="ml-2 font-semibold underline" onClick={() => { setConfirm(false); setStatus('ARCHIVED'); }}>Archive instead</button>}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

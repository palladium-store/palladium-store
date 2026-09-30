'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/modal';

export function OversellToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [allow, setAllow] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function set(next: boolean) {
    setBusy(true);
    try {
      await api('/api/admin/inventory/oversell', { method: 'POST', body: { allow: next } });
      setAllow(next);
      setConfirm(false);
      toast(next ? 'Overselling enabled.' : 'Overselling disabled.');
      router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not update the setting.', 'error'); }
    setBusy(false);
  }
  return (
    <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="max-w-2xl">
        <h2 className="font-display text-lg tracking-tightest">Allow overselling</h2>
        <p className="mt-1 text-sm text-mute">
          When off (recommended), customers cannot buy more units than are available, so you never sell stock you do not have. When on, orders are accepted even when available stock is zero, which is useful for pre-orders but can leave orders you cannot fulfil. Applies to all products and locations.
        </p>
        <p className="mt-2 text-sm">Currently <strong className={allow ? 'text-red-600' : 'text-emerald-700'}>{allow ? 'ON' : 'OFF'}</strong></p>
      </div>
      <button className={allow ? 'btn-outline btn-sm' : 'btn-primary btn-sm'} onClick={() => (allow ? set(false) : setConfirm(true))} disabled={busy}>{busy && allow ? 'Saving...' : allow ? 'Turn off overselling' : 'Turn on overselling'}</button>
      <ConfirmDialog open={confirm} title="Allow overselling?" confirmLabel="Allow overselling" danger busy={busy} onConfirm={() => set(true)} onClose={() => setConfirm(false)}
        message="Customers will be able to order products that are out of stock. Make sure you can restock or fulfil those orders." />
    </div>
  );
}

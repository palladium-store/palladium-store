'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Field, inputCls } from './Field';

type Act = 'RECEIVE' | 'ADD' | 'REMOVE' | 'ADJUST' | 'DAMAGED' | 'RETURNED' | 'TRANSFER';
export interface InvRowProps { variantId: string; locationId: string; location: string; product: string; variant: string; sku: string; onHand: number; reserved: number }
export interface LocOption { id: string; name: string }

const META: Record<Act, { label: string; help: string; reasonRequired: boolean; qtyLabel: string }> = {
  RECEIVE: { label: 'Receive', help: 'Record new stock arriving from a supplier or production run. Adds to units on hand and to units received.', reasonRequired: false, qtyLabel: 'Units received' },
  ADD: { label: 'Add', help: 'Manually add units without a supplier delivery, for example after a recount finds extra stock.', reasonRequired: false, qtyLabel: 'Units to add' },
  REMOVE: { label: 'Remove', help: 'Take units out of stock for a reason other than a sale, such as samples or giveaways. Reserved units cannot be removed.', reasonRequired: true, qtyLabel: 'Units to remove' },
  ADJUST: { label: 'Adjust', help: 'Set the counted quantity after a stock take. Units on hand become exactly the number you enter.', reasonRequired: true, qtyLabel: 'Counted quantity' },
  DAMAGED: { label: 'Damaged', help: 'Write off units that are damaged or unsellable. They are removed from units on hand.', reasonRequired: true, qtyLabel: 'Damaged units' },
  RETURNED: { label: 'Returned', help: 'Put units back into stock after a customer return that is in sellable condition.', reasonRequired: false, qtyLabel: 'Units returned' },
  TRANSFER: { label: 'Transfer', help: 'Move units from this location to another. Total stock does not change.', reasonRequired: false, qtyLabel: 'Units to transfer' },
};
const ORDER: Act[] = ['RECEIVE', 'ADD', 'REMOVE', 'ADJUST', 'DAMAGED', 'RETURNED', 'TRANSFER'];

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const units = (n: number) => `${Math.abs(n)} unit${Math.abs(n) === 1 ? '' : 's'}`;

export function InventoryActions({ row, locations }: { row: InvRowProps; locations: LocOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [act, setAct] = useState<Act | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const others = locations.filter((l) => l.id !== row.locationId);
  const actions = ORDER.filter((a) => a !== 'TRANSFER' || locations.length > 1);

  function open(a: Act) { setAct(a); setQty(''); setReason(''); setToLoc(others[0]?.id ?? ''); setError(null); setFieldErrors({}); }
  // Stable identity: Modal re-focuses its container whenever onClose changes, which would steal focus while typing.
  const close = useCallback(() => { if (!busy) setAct(null); }, [busy]);

  const n = qty.trim() === '' ? NaN : Number(qty);
  const validQty = Number.isInteger(n) && n >= (act === 'ADJUST' ? 0 : 1);
  let next: number | null = null;
  if (act && validQty) {
    next = act === 'ADJUST' ? n : ['REMOVE', 'DAMAGED', 'TRANSFER'].includes(act) ? row.onHand - n : row.onHand + n;
  }
  const meta = act ? META[act] : null;
  const belowZero = next != null && next < 0;
  const belowReserved = next != null && next >= 0 && next < row.reserved;
  const canSubmit = !!act && validQty && !belowZero && (!meta?.reasonRequired || reason.trim().length > 0) && (act !== 'TRANSFER' || !!toLoc);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!act || !canSubmit) return;
    setBusy(true); setError(null); setFieldErrors({});
    try {
      if (act === 'TRANSFER') {
        await api('/api/admin/inventory/transfer', { method: 'POST', body: { variantId: row.variantId, fromLocationId: row.locationId, toLocationId: toLoc, quantity: n, reason: reason.trim() || undefined } });
        toast(`Stock transferred: ${units(n)} moved to ${others.find((l) => l.id === toLoc)?.name ?? 'the other location'}.`);
      } else {
        const res = await api<{ onHand: number }>('/api/admin/inventory/adjust', { method: 'POST', body: { variantId: row.variantId, locationId: row.locationId, action: act, quantity: n, reason: reason.trim() || undefined } });
        const delta = res.onHand - row.onHand;
        toast(delta === 0 ? 'Inventory adjusted: no change.' : `Inventory adjusted: ${signed(delta)} ${Math.abs(delta) === 1 ? 'unit' : 'units'}.`);
      }
      setAct(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFieldErrors(err.fields ?? {}); } else setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  const btn = 'border border-line px-2 py-1 text-[11px] font-semibold hover:bg-ink hover:text-white';
  return (
    <>
      <div className="flex min-w-[210px] flex-wrap justify-end gap-1">
        {actions.map((a) => <button key={a} className={btn} onClick={() => open(a)}>{META[a].label}</button>)}
      </div>
      <Modal open={!!act} onClose={close} title={meta ? `${meta.label} stock` : 'Stock'}>
        {act && meta && (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="text-sm"><div className="font-semibold">{row.product}</div><div className="text-mute">{row.variant} &middot; <span className="font-mono">{row.sku}</span> &middot; {row.location}</div></div>
            <p className="bg-bone p-3 text-xs text-mute">{meta.help}</p>
            <Field label={meta.qtyLabel} error={fieldErrors.quantity}>
              <input className={inputCls(fieldErrors.quantity)} inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} placeholder={act === 'ADJUST' ? 'e.g. 24' : 'e.g. 5'} />
            </Field>
            {act === 'TRANSFER' && (
              <Field label="Transfer to" error={fieldErrors.toLocationId}>
                <select className="input" value={toLoc} onChange={(e) => setToLoc(e.target.value)}>{others.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </Field>
            )}
            <Field label={meta.reasonRequired ? 'Reason (required)' : 'Reason (optional)'} error={fieldErrors.reason}>
              <input className={inputCls(fieldErrors.reason)} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={act === 'DAMAGED' ? 'e.g. Cracked in transit' : act === 'ADJUST' ? 'e.g. Monthly stock take' : 'e.g. PO #1042'} />
            </Field>
            <div className="border border-line p-3 text-sm" aria-live="polite">
              <div className="flex items-center justify-between"><span className="text-mute">On hand now</span><strong>{row.onHand}</strong></div>
              <div className="flex items-center justify-between"><span className="text-mute">{act === 'TRANSFER' ? 'On hand here after transfer' : 'On hand after'}</span>
                <strong className={belowZero ? 'text-red-600' : ''}>{next == null ? '-' : next}</strong></div>
              {row.reserved > 0 && <div className="mt-1 text-xs text-mute">{row.reserved} unit{row.reserved === 1 ? ' is' : 's are'} reserved by open orders.</div>}
              {belowZero && <div className="mt-1 text-xs text-red-600">This would take stock below zero.</div>}
              {belowReserved && <div className="mt-1 text-xs text-gold-deep">This is below the reserved quantity. The server may refuse it.</div>}
            </div>
            {error && <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={close} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-primary btn-sm" disabled={!canSubmit || busy}>{busy ? 'Saving...' : `Confirm ${meta.label.toLowerCase()}`}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

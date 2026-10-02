'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { peso, toCentavos } from '@/lib/money';

export interface RefundableItem { id: string; name: string; variant: string; sku: string; maxReturn: number }
export interface OrderActionsProps {
  orderId: string;
  orderLabel: string; // e.g. "#PAL-10025"
  isCod: boolean;
  nextStatuses: string[];
  canConfirmPayment: boolean;
  canConfirmCod: boolean;
  canFailPayment: boolean;
  canTrack: boolean;
  canRefund: boolean;
  canCancel: boolean;
  courier: string;
  trackingNumber: string;
  remainingRefundCentavos: number;
  refundItems: RefundableItem[];
}
type ModalKind = null | 'confirm' | 'cod' | 'fail' | 'ship' | 'delivered' | 'tracking' | 'refund' | 'cancel';

const STATUS_LABEL: Record<string, string> = { PROCESSING: 'Mark as processing', PACKED: 'Mark as packed', SHIPPED: 'Mark as shipped', DELIVERED: 'Mark as delivered' };

export function OrderActions(p: OrderActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState(p.courier);
  const [tracking, setTracking] = useState(p.trackingNumber);
  const [amount, setAmount] = useState((p.remainingRefundCentavos / 100).toFixed(2));
  const [restock, setRestock] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});

  const close = useCallback(() => setModal(null), []);
  const open = (m: ModalKind) => {
    setError(null); setReason(''); setReference(''); setCourier(p.courier); setTracking(p.trackingNumber);
    setAmount((p.remainingRefundCentavos / 100).toFixed(2)); setRestock(false); setQty({});
    setModal(m);
  };

  async function run(url: string, body: unknown, success: string) {
    setBusy(true); setError(null);
    try {
      await api(`/api/admin/orders/${p.orderId}/${url}`, { method: 'POST', body });
      toast(success, 'success');
      setModal(null);
      router.refresh();
    } catch (e) {
      const m = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setError(m); toast(m, 'error');
    } finally { setBusy(false); }
  }

  const setStatus = (status: string) => run('status', { status }, `Order ${p.orderLabel} marked as ${status.toLowerCase()}.`);

  function submitShip() {
    if (!courier.trim() || !tracking.trim()) { setError('Enter both the courier and the tracking number to ship this order.'); return; }
    void run('status', { status: 'SHIPPED', courier: courier.trim(), trackingNumber: tracking.trim() }, `Order ${p.orderLabel} marked as shipped.`);
  }
  function submitTracking() {
    if (!courier.trim() && !tracking.trim()) { setError('Enter a courier or a tracking number.'); return; }
    void run('tracking', { courier: courier.trim() || undefined, trackingNumber: tracking.trim() || undefined }, `Tracking updated for order ${p.orderLabel}.`);
  }
  function submitRefund() {
    const cents = toCentavos(amount);
    if (!Number.isFinite(cents) || cents < 1) { setError('Enter a refund amount greater than zero.'); return; }
    if (cents > p.remainingRefundCentavos) { setError(`The most you can refund is ${peso(p.remainingRefundCentavos)}.`); return; }
    const items = p.refundItems.map((i) => ({ orderItemId: i.id, qty: Math.floor(Number(qty[i.id] || 0)) })).filter((i) => i.qty > 0);
    if (restock) {
      if (!items.length) { setError('Enter the quantity to return to stock for at least one item.'); return; }
      const over = p.refundItems.find((i) => Math.floor(Number(qty[i.id] || 0)) > i.maxReturn);
      if (over) { setError(`Only ${over.maxReturn} of ${over.name} (${over.variant}) can be returned.`); return; }
    }
    void run('refund', { amountCentavos: cents, restock, ...(restock ? { items } : {}), reason: reason.trim() || undefined }, `Refunded ${peso(cents)} on order ${p.orderLabel}.`);
  }

  const anything = p.canConfirmPayment || p.canConfirmCod || p.canFailPayment || p.nextStatuses.length > 0 || p.canTrack || p.canRefund || p.canCancel;
  if (!anything) return <p className="text-sm text-mute">No actions are available for this order in its current state.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {p.canConfirmPayment && <button className="btn-primary btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('confirm')}>Confirm payment</button>}
        {p.canConfirmCod && <button className="btn-primary btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('cod')}>Confirm COD order</button>}
        {p.nextStatuses.map((s) => (
          <button key={s} className={`${s === p.nextStatuses[0] && !p.canConfirmPayment && !p.canConfirmCod ? 'btn-gold' : 'btn-outline'} btn-sm`} aria-busy={busy} disabled={busy}
            onClick={() => (s === 'SHIPPED' ? open('ship') : s === 'DELIVERED' ? open('delivered') : void setStatus(s))}>{busy && s !== 'SHIPPED' && s !== 'DELIVERED' ? 'Working...' : STATUS_LABEL[s] ?? s}</button>
        ))}
        {p.canTrack && <button className="btn-outline btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('tracking')}>{p.trackingNumber ? 'Update tracking' : 'Add tracking'}</button>}
        {p.canRefund && <button className="btn-outline btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('refund')}>Refund</button>}
        {p.canFailPayment && <button className="btn-ghost btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('fail')}>Mark payment failed</button>}
        {p.canCancel && <button className="btn-danger btn-sm" aria-busy={busy} disabled={busy} onClick={() => open('cancel')}>Cancel order</button>}
      </div>

      <ConfirmDialog open={modal === 'confirm'} title="Confirm payment" busy={busy} confirmLabel="Confirm payment" onClose={close}
        onConfirm={() => run('confirm', { markPaid: true, reference: reference.trim() || undefined }, `Payment confirmed for order ${p.orderLabel}.`)}
        message="This marks the order as paid and reserves the stock.">
        <div className="mt-4"><label className="label" htmlFor="oa-ref">Payment reference (optional)</label>
          <input id="oa-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="GCash or bank reference number" /></div>
        {error && <p role="alert" className="field-error">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={modal === 'cod'} title="Confirm COD order" busy={busy} confirmLabel="Confirm order" onClose={close}
        onConfirm={() => run('confirm', { markPaid: false }, `Order ${p.orderLabel} confirmed. Payment will be collected on delivery.`)}
        message="The order is confirmed and stock is deducted. Payment is recorded when you mark it as delivered.">
        {error && <p role="alert" className="field-error mt-3">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={modal === 'fail'} title="Mark payment as failed" danger busy={busy} confirmLabel="Mark as failed" onClose={close}
        onConfirm={() => run('fail-payment', { reason: reason.trim() || undefined }, `Payment marked as failed for order ${p.orderLabel}.`)}
        message="Use this when the customer's payment did not come through.">
        <div className="mt-4"><label className="label" htmlFor="oa-fail">Reason (optional)</label>
          <input id="oa-fail" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
        {error && <p role="alert" className="field-error">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={modal === 'delivered'} title="Mark as delivered" busy={busy} confirmLabel="Mark delivered" onClose={close}
        onConfirm={() => setStatus('DELIVERED')}
        message={p.isCod ? 'The order is delivered and the cash on delivery payment is recorded as collected.' : 'The order is marked as delivered and the customer is notified.'}>
        {error && <p role="alert" className="field-error mt-3">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={modal === 'cancel'} title={`Cancel order ${p.orderLabel}`} danger busy={busy} confirmLabel="Cancel order" onClose={close}
        onConfirm={() => run('cancel', { reason: reason.trim() || undefined }, `Order ${p.orderLabel} cancelled.`)}
        message="Reserved stock is released and the customer is emailed. This cannot be undone.">
        <div className="mt-4"><label className="label" htmlFor="oa-cancel">Reason (optional)</label>
          <input id="oa-cancel" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Customer requested cancellation" /></div>
        {error && <p role="alert" className="field-error">{error}</p>}
      </ConfirmDialog>

      <Modal open={modal === 'ship' || modal === 'tracking'} onClose={close} title={modal === 'ship' ? 'Mark as shipped' : 'Tracking details'}>
        <p className="mb-4 text-sm text-mute">{modal === 'ship' ? 'Enter the courier and tracking number. The customer is emailed when the order ships.' : 'Save or correct the courier and tracking number for this order.'}</p>
        <div className="space-y-3">
          <div><label className="label" htmlFor="oa-courier">Courier</label><input id="oa-courier" className="input" value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={80} placeholder="e.g. LBC, J&T Express" /></div>
          <div><label className="label" htmlFor="oa-track">Tracking number</label><input id="oa-track" className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={120} /></div>
        </div>
        {error && <p role="alert" className="field-error mt-3">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost btn-sm" onClick={close} aria-busy={busy} disabled={busy}>Cancel</button>
          <button className="btn-primary btn-sm" aria-busy={busy} disabled={busy} onClick={modal === 'ship' ? submitShip : submitTracking}>{busy ? 'Working...' : modal === 'ship' ? 'Mark as shipped' : 'Save tracking'}</button>
        </div>
      </Modal>

      <Modal open={modal === 'refund'} onClose={close} title={`Refund order ${p.orderLabel}`} wide>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="oa-amt">Refund amount (PHP)</label>
            <input id="oa-amt" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-mute">Remaining refundable: {peso(p.remainingRefundCentavos)}</p>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={restock} onChange={(e) => setRestock(e.target.checked)} /><span>Return items to stock</span></label>
          {restock && (
            <div className="border border-line">
              {p.refundItems.filter((i) => i.maxReturn > 0).length === 0 && <p className="p-3 text-sm text-mute">Every item on this order has already been returned.</p>}
              {p.refundItems.filter((i) => i.maxReturn > 0).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 border-b border-line p-3 last:border-b-0">
                  <div className="min-w-0 text-sm"><div className="truncate font-medium">{i.name}</div><div className="text-xs text-mute">{i.variant} &middot; {i.sku}</div></div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-mute">
                    <label htmlFor={`oa-q-${i.id}`} className="sr-only">Quantity of {i.name} to return</label>
                    <input id={`oa-q-${i.id}`} className="input !w-16 !py-1.5 text-center" type="number" min={0} max={i.maxReturn} value={qty[i.id] ?? ''} placeholder="0" onChange={(e) => setQty((s) => ({ ...s, [i.id]: e.target.value }))} />
                    <span>of {i.maxReturn}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div><label className="label" htmlFor="oa-rr">Reason (optional)</label><input id="oa-rr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Damaged on arrival" /></div>
        </div>
        {error && <p role="alert" className="field-error mt-3">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost btn-sm" onClick={close} aria-busy={busy} disabled={busy}>Cancel</button>
          <button className="btn-danger btn-sm" aria-busy={busy} disabled={busy} onClick={submitRefund}>{busy ? 'Working...' : 'Issue refund'}</button>
        </div>
      </Modal>
    </div>
  );
}

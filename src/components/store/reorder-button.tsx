'use client';
import { useState } from 'react';
import { api } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { useCart } from './cart-context';

export function ReorderButton({ orderId }: { orderId: string }) {
  const { addMany, openDrawer } = useCart();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ items: { variantId: string; qty: number }[]; skipped: number }>(`/api/account/orders/${orderId}/reorder`, { method: 'POST', body: {} });
      if (!r.items.length) { toast('None of the items in this order are available right now.', 'error'); return; }
      addMany(r.items);
      toast(r.skipped > 0 ? `Added to your cart. ${r.skipped} item${r.skipped === 1 ? ' was' : 's were'} skipped because ${r.skipped === 1 ? 'it is' : 'they are'} no longer available.` : 'Order items added to your cart.', r.skipped > 0 ? 'info' : 'success');
      openDrawer();
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not reorder.', 'error'); }
    finally { setBusy(false); }
  }
  return <button type="button" className="btn-primary" onClick={go} aria-busy={busy} disabled={busy}>{busy ? 'Working...' : 'Reorder'}</button>;
}

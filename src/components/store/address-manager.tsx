'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROVINCES, NCR_CITIES } from '@/lib/ph';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/bits';
import type { SavedAddress } from './types';

const blank = { id: '', label: '', name: '', phone: '', line1: '', barangay: '', city: '', province: '', postalCode: '', isDefault: false };
type Form = typeof blank;

function F({ fe, id, label, k, children }: { fe: Record<string, string>; id: string; label: string; k: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="label">{label}</label>{children}{fe[k] && <p className="field-error" role="alert">{fe[k]}</p>}</div>;
}

export function AddressManager({ addresses, defaultName, defaultPhone }: { addresses: SavedAddress[]; defaultName: string; defaultPhone: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<SavedAddress | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const up = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => (s ? { ...s, [k]: v } : s));
  const openNew = () => { setFe({}); setErr(null); setForm({ ...blank, name: defaultName, phone: defaultPhone, isDefault: addresses.length === 0 }); };
  const openEdit = (a: SavedAddress) => { setFe({}); setErr(null); setForm({ id: a.id, label: a.label ?? '', name: a.recipient, phone: a.phone, line1: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: a.isDefault }); };
  const payload = (x: Form) => ({ label: x.label.trim() || undefined, name: x.name, phone: x.phone, line1: x.line1, barangay: x.barangay, city: x.city, province: x.province, postalCode: x.postalCode, isDefault: x.isDefault });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true); setFe({}); setErr(null);
    try {
      if (form.id) await api(`/api/account/addresses/${form.id}`, { method: 'PUT', body: payload(form) });
      else await api('/api/account/addresses', { body: payload(form) });
      toast(form.id ? 'Address updated.' : 'Address added.');
      setForm(null); router.refresh();
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not save the address.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFe(ex.fields); toast(m, 'error');
    } finally { setBusy(false); }
  }
  async function makeDefault(a: SavedAddress) {
    setWorkingId(a.id);
    try { await api(`/api/account/addresses/${a.id}`, { method: 'PUT', body: payload({ id: a.id, label: a.label ?? '', name: a.recipient, phone: a.phone, line1: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: true }) }); toast('Default address updated.'); router.refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not update the address.', 'error'); }
    finally { setWorkingId(null); }
  }
  async function remove() {
    if (!del) return;
    setBusy(true);
    try { await api(`/api/account/addresses/${del.id}`, { method: 'DELETE' }); toast('Address deleted.'); setDel(null); router.refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not delete the address.', 'error'); }
    finally { setBusy(false); }
  }

  const inp = (k: string) => `input ${fe[k] ? 'input-error' : ''}`;
  return (
    <div>
      <div className="mb-6 flex justify-end"><button className="btn-primary" onClick={openNew}>Add address</button></div>
      {addresses.length === 0 ? (
        <EmptyState title="No saved addresses" text="Add an address to check out faster next time." action={<button className="btn-primary" onClick={openNew}>Add address</button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={`card flex flex-col p-5 ${a.isDefault ? 'border-ink' : ''}`}>
              <div className="flex items-center gap-2"><p className="font-semibold">{a.label || 'Address'}</p>{a.isDefault && <span className="bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Default</span>}</div>
              <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-mute">{a.recipient}<br />{a.line1}<br />Brgy. {a.barangay}, {a.city}<br />{a.province} {a.postalCode}<br />{a.phone}</address>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wider">
                <button className="underline underline-offset-4" onClick={() => openEdit(a)}>Edit</button>
                {!a.isDefault && <button className="underline underline-offset-4 disabled:opacity-50" disabled={workingId === a.id} onClick={() => makeDefault(a)}>{workingId === a.id ? 'Working...' : 'Set as default'}</button>}
                <button className="text-red-600 underline underline-offset-4" onClick={() => setDel(a)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={form?.id ? 'Edit address' : 'Add address'} wide>
        {form && (
          <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
            {err && !Object.keys(fe).length && <p className="field-error sm:col-span-2" role="alert">{err}</p>}
            <F fe={fe} id="a-label" label="Label (optional)" k="label"><input id="a-label" className={inp('label')} placeholder="Home, Office..." maxLength={40} value={form.label} onChange={(e) => up('label', e.target.value)} /></F>
            <F fe={fe} id="a-name" label="Recipient name" k="name"><input id="a-name" className={inp('name')} autoComplete="name" value={form.name} onChange={(e) => up('name', e.target.value)} /></F>
            <F fe={fe} id="a-phone" label="Mobile number" k="phone"><input id="a-phone" type="tel" className={inp('phone')} autoComplete="tel" value={form.phone} onChange={(e) => up('phone', e.target.value)} /></F>
            <F fe={fe} id="a-line1" label="Street address" k="line1"><input id="a-line1" className={inp('line1')} autoComplete="address-line1" value={form.line1} onChange={(e) => up('line1', e.target.value)} /></F>
            <F fe={fe} id="a-province" label="Province" k="province">
              <select id="a-province" className={inp('province')} value={form.province} onChange={(e) => up('province', e.target.value)}>
                <option value="">Choose a province</option>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </F>
            <F fe={fe} id="a-city" label="City or municipality" k="city">
              <input id="a-city" className={inp('city')} list={form.province === 'Metro Manila' ? 'a-ncr' : undefined} value={form.city} onChange={(e) => up('city', e.target.value)} />
              {form.province === 'Metro Manila' && <datalist id="a-ncr">{NCR_CITIES.map((c) => <option key={c} value={c} />)}</datalist>}
            </F>
            <F fe={fe} id="a-brgy" label="Barangay" k="barangay"><input id="a-brgy" className={inp('barangay')} value={form.barangay} onChange={(e) => up('barangay', e.target.value)} /></F>
            <F fe={fe} id="a-postal" label="Postal code" k="postalCode"><input id="a-postal" inputMode="numeric" maxLength={4} className={inp('postalCode')} autoComplete="postal-code" value={form.postalCode} onChange={(e) => up('postalCode', e.target.value.replace(/\D/g, ''))} /></F>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-black" checked={form.isDefault} onChange={(e) => up('isDefault', e.target.checked)} /> Use as my default address</label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-primary" aria-busy={busy} disabled={busy}>{busy ? 'Working...' : 'Save address'}</button>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!del} title="Delete address" message={`Delete ${del?.label || 'this address'}? This cannot be undone.`} confirmLabel="Delete" danger busy={busy} onConfirm={remove} onClose={() => !busy && setDel(null)} />
    </div>
  );
}

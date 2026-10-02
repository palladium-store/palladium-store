'use client';
import { useState } from 'react';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Field, Toggle, inputCls } from './Field';

export interface StoreData { name: string; email: string; phone: string; address: string; facebook: string; instagram: string }

export function GeneralSettings({ initial }: { initial: StoreData }) {
  const { toast } = useToast();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof StoreData, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!f.name.trim()) v.name = 'Enter your store name.'; else if (f.name.length > 80) v.name = 'Use 80 characters or fewer.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) v.email = 'Enter a valid email address.';
    if (f.phone.length > 40) v.phone = 'Use 40 characters or fewer.';
    if (f.address.length > 300) v.address = 'Use 300 characters or fewer.';
    if (f.facebook.length > 200) v.facebook = 'Use 200 characters or fewer.';
    if (f.instagram.length > 200) v.instagram = 'Use 200 characters or fewer.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await api('/api/admin/settings/store', { method: 'PUT', body: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), address: f.address.trim(), facebook: f.facebook.trim(), instagram: f.instagram.trim() } });
      toast('Store settings saved.');
    } catch (er) {
      if (er instanceof ApiError) { setErrors(er.fields ?? {}); toast(er.message, 'error'); } else toast('Something went wrong. Please try again.', 'error');
    }
    setSaving(false);
  }
  return (
    <form onSubmit={save} noValidate className="card max-w-3xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Store name" error={errors.name}><input className={inputCls(errors.name)} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Contact email" error={errors.email} hint="Shown to customers and used as the sender for store emails."><input type="email" className={inputCls(errors.email)} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone" error={errors.phone}><input className={inputCls(errors.phone)} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Address" error={errors.address}><input className={inputCls(errors.address)} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Facebook URL" error={errors.facebook}><input className={inputCls(errors.facebook)} value={f.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="https://facebook.com/..." /></Field>
        <Field label="Instagram URL" error={errors.instagram}><input className={inputCls(errors.instagram)} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field>
      </div>
      <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  );
}

type Method = 'QRPH' | 'GCASH' | 'MAYA' | 'CARD' | 'BANK_TRANSFER' | 'COD';
const METHODS: { key: Method; label: string }[] = [
  { key: 'QRPH', label: 'QR Ph (PayMongo, automatic)' }, { key: 'GCASH', label: 'GCash' }, { key: 'MAYA', label: 'Maya' }, { key: 'CARD', label: 'Credit / debit card' }, { key: 'BANK_TRANSFER', label: 'Bank transfer' }, { key: 'COD', label: 'Cash on delivery' },
];
export type PaymentsData = Record<Method, { enabled: boolean; instructions: string }>;

export function PaymentSettings({ initial }: { initial: PaymentsData }) {
  const { toast } = useToast();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const patch = (k: Method, p: Partial<PaymentsData[Method]>) => setF((s) => ({ ...s, [k]: { ...s[k], ...p } }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v: Record<string, string> = {};
    for (const m of METHODS) if (f[m.key].instructions.length > 1000) v[`${m.key}.instructions`] = 'Use 1,000 characters or fewer.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await api('/api/admin/settings/payments', { method: 'PUT', body: f });
      toast('Payment settings saved.');
    } catch (er) {
      if (er instanceof ApiError) { setErrors(er.fields ?? {}); toast(er.message, 'error'); } else toast('Something went wrong. Please try again.', 'error');
    }
    setSaving(false);
  }
  const enabled = METHODS.filter((m) => f[m.key].enabled).length;
  return (
    <form onSubmit={save} noValidate className="max-w-3xl space-y-4">
      <div className="border border-gold bg-gold-soft p-4 text-sm">
        <strong>Payments are confirmed manually.</strong> No payment provider is connected yet. Customers pay using the instructions below and an admin marks each order as paid from the order page after checking the payment.
      </div>
      {enabled === 0 && <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">No payment method is enabled. Customers will not be able to check out.</div>}
      {METHODS.map((m) => (
        <div key={m.key} className="card p-5">
          <Toggle checked={f[m.key].enabled} onChange={(v) => patch(m.key, { enabled: v })} label={m.label} hint={f[m.key].enabled ? 'Available at checkout' : 'Hidden at checkout'} />
          <div className="mt-4"><Field label="Instructions shown to the customer" error={errors[`${m.key}.instructions`]} hint={`${f[m.key].instructions.length}/1000`}>
            <textarea className={inputCls(errors[`${m.key}.instructions`])} rows={3} value={f[m.key].instructions} onChange={(e) => patch(m.key, { instructions: e.target.value })} />
          </Field></div>
        </div>
      ))}
      <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  );
}

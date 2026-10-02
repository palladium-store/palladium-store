'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

export function ProfileForm({ name: n0, phone: p0, email }: { name: string; phone: string; email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(n0);
  const [phone, setPhone] = useState(p0);
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setFe({}); setErr(null);
    try {
      await api('/api/account/profile', { method: 'PATCH', body: { name, phone: phone.trim() || undefined } });
      toast('Profile updated.'); router.refresh();
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not update your profile.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFe(ex.fields); toast(m, 'error');
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      {err && !Object.keys(fe).length && <p className="field-error" role="alert">{err}</p>}
      <div><label htmlFor="p-email" className="label">Email</label><input id="p-email" className="input" value={email} disabled readOnly /><p className="mt-1 text-xs text-mute">To change your email, contact us.</p></div>
      <div><label htmlFor="p-name" className="label">Full name</label><input id="p-name" className={`input ${fe.name ? 'input-error' : ''}`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />{fe.name && <p className="field-error">{fe.name}</p>}</div>
      <div><label htmlFor="p-phone" className="label">Mobile number</label><input id="p-phone" type="tel" className={`input ${fe.phone ? 'input-error' : ''}`} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />{fe.phone && <p className="field-error">{fe.phone}</p>}</div>
      <button type="submit" className="btn-primary" aria-busy={busy} disabled={busy}>{busy ? 'Working...' : 'Save changes'}</button>
    </form>
  );
}

export function PasswordForm() {
  const { toast } = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const up = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFe({}); setErr(null);
    if (f.next !== f.confirm) { setFe({ confirm: 'The passwords do not match.' }); return; }
    setBusy(true);
    try {
      await api('/api/account/password', { body: { current: f.current, next: f.next } });
      toast('Password changed.'); setF({ current: '', next: '', confirm: '' });
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not change your password.';
      setErr(m);
      if (ex instanceof ApiError && ex.fields) setFe({ current: ex.fields.current ?? '', next: ex.fields.next ?? ex.fields.password ?? '' });
      toast(m, 'error');
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      {err && !fe.current && !fe.next && <p className="field-error" role="alert">{err}</p>}
      <div><label htmlFor="pw-cur" className="label">Current password</label><input id="pw-cur" type="password" autoComplete="current-password" className={`input ${fe.current ? 'input-error' : ''}`} value={f.current} onChange={(e) => up('current', e.target.value)} />{fe.current && <p className="field-error">{fe.current}</p>}</div>
      <div><label htmlFor="pw-new" className="label">New password</label><input id="pw-new" type="password" autoComplete="new-password" className={`input ${fe.next ? 'input-error' : ''}`} value={f.next} onChange={(e) => up('next', e.target.value)} />{fe.next ? <p className="field-error">{fe.next}</p> : <p className="mt-1 text-xs text-mute">At least 8 characters, with a letter and a number.</p>}</div>
      <div><label htmlFor="pw-conf" className="label">Confirm new password</label><input id="pw-conf" type="password" autoComplete="new-password" className={`input ${fe.confirm ? 'input-error' : ''}`} value={f.confirm} onChange={(e) => up('confirm', e.target.value)} />{fe.confirm && <p className="field-error">{fe.confirm}</p>}</div>
      <button type="submit" className="btn-primary" aria-busy={busy} disabled={busy}>{busy ? 'Working...' : 'Change password'}</button>
    </form>
  );
}

export function RemoveWishlistButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try { await api('/api/account/wishlist', { method: 'DELETE', body: { productId } }); toast('Removed from your wishlist.'); router.refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not remove it.', 'error'); setBusy(false); }
  }
  return <button type="button" onClick={go} aria-busy={busy} disabled={busy} aria-label={`Remove ${name} from wishlist`} className="mt-2 text-xs text-mute underline underline-offset-4 hover:text-ink disabled:opacity-50">{busy ? 'Working...' : 'Remove'}</button>;
}

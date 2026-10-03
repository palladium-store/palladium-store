'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { safeNext } from './labels';

function Err({ id, msg }: { id: string; msg?: string }) { return msg ? <p id={id} className="field-error" role="alert">{msg}</p> : null; }

export function LoginForm({ next, storeEmail }: { next: string | null; storeEmail: string }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setFe({});
    try {
      const r = await api<{ redirect: string }>('/api/auth/login', { body: { email, password } });
      toast('Welcome back!');
      // Full navigation so server-rendered pages pick up the new session.
      window.location.assign(safeNext(next) ?? r.redirect);
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not sign in.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFe(ex.fields);
      toast(m, 'error');
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {err && <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{err}</p>}
      <div>
        <label htmlFor="l-email" className="label">Email</label>
        <input id="l-email" type="email" autoComplete="email" className={`input ${fe.email ? 'input-error' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fe.email} required />
        <Err id="l-email-err" msg={fe.email} />
      </div>
      <div>
        <label htmlFor="l-pass" className="label">Password</label>
        <input id="l-pass" type="password" autoComplete="current-password" className={`input ${fe.password ? 'input-error' : ''}`} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fe.password} required />
        <Err id="l-pass-err" msg={fe.password} />
      </div>
      <button type="submit" className="btn-primary w-full py-4" aria-busy={busy} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <p className="text-center text-sm text-mute">New to Palladium? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-ink underline underline-offset-4">Create an account</Link></p>
      <p className="text-center text-xs text-mute"><Link href="/forgot-password" className="underline">Forgot your password?</Link> Or contact us at <a href={`mailto:${storeEmail}`} className="underline">{storeEmail}</a></p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string | null }) {
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [source, setSource] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const up = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { try { setSource(localStorage.getItem('pal-src') || undefined); } catch { /* ignore */ } }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setFe({});
    try {
      const r = await api<{ verify?: boolean }>('/api/auth/register', { body: { name: f.name, email: f.email, phone: f.phone.trim() || undefined, password: f.password, source } });
      if (r?.verify) { setSent(true); setBusy(false); return; }
      toast('Your account is ready. Welcome to Palladium!');
      window.location.assign(safeNext(next) ?? '/');
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not create your account.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFe(ex.fields);
      toast(m, 'error');
      setBusy(false);
    }
  }
  if (sent) return <p className="border border-line p-4 text-sm" role="status">Almost there. We emailed a confirmation link to <b>{f.email}</b>. Click it to finish setting up your account and see your past orders.</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {err && <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{err}</p>}
      <div>
        <label htmlFor="r-name" className="label">Full name</label>
        <input id="r-name" autoComplete="name" className={`input ${fe.name ? 'input-error' : ''}`} value={f.name} onChange={(e) => up('name', e.target.value)} aria-invalid={!!fe.name} required />
        <Err id="r-name-err" msg={fe.name} />
      </div>
      <div>
        <label htmlFor="r-email" className="label">Email</label>
        <input id="r-email" type="email" autoComplete="email" className={`input ${fe.email ? 'input-error' : ''}`} value={f.email} onChange={(e) => up('email', e.target.value)} aria-invalid={!!fe.email} required />
        <Err id="r-email-err" msg={fe.email} />
      </div>
      <div>
        <label htmlFor="r-phone" className="label">Mobile number (optional)</label>
        <input id="r-phone" type="tel" autoComplete="tel" className={`input ${fe.phone ? 'input-error' : ''}`} value={f.phone} onChange={(e) => up('phone', e.target.value)} aria-invalid={!!fe.phone} />
        {fe.phone ? <Err id="r-phone-err" msg={fe.phone} /> : <p className="mt-1 text-xs text-mute">e.g. 0917 123 4567</p>}
      </div>
      <div>
        <label htmlFor="r-pass" className="label">Password</label>
        <input id="r-pass" type="password" autoComplete="new-password" className={`input ${fe.password ? 'input-error' : ''}`} value={f.password} onChange={(e) => up('password', e.target.value)} aria-invalid={!!fe.password} aria-describedby="r-pass-hint" required />
        {fe.password ? <Err id="r-pass-err" msg={fe.password} /> : <p id="r-pass-hint" className="mt-1 text-xs text-mute">At least 8 characters, with a letter and a number.</p>}
      </div>
      <button type="submit" className="btn-primary w-full py-4" aria-busy={busy} disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      <p className="text-center text-sm text-mute">Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-ink underline underline-offset-4">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await api('/api/auth/forgot', { body: { email } }); setDone(true); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong.'); }
    setBusy(false);
  }
  if (done) return <p className="border border-line p-4 text-sm" role="status">If an account exists for that email, a reset link is on its way. Check your inbox and spam folder. The link expires in 1 hour.</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {err && <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{err}</p>}
      <div>
        <label htmlFor="f-email" className="label">Email</label>
        <input id="f-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <button type="submit" className="btn-primary w-full py-4" aria-busy={busy} disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
      <p className="text-center text-sm text-mute"><Link href="/login" className="underline underline-offset-4">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await api('/api/auth/reset', { body: { token, password } }); setDone(true); toast('Password updated.'); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : 'Could not reset your password.'); }
    setBusy(false);
  }
  if (!token) return <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.</p>;
  if (done) return <p className="border border-line p-4 text-sm" role="status">Your password has been changed. <Link href="/login" className="font-semibold underline underline-offset-4">Sign in</Link></p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {err && <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{err} <Link href="/forgot-password" className="underline">Request a new link</Link></p>}
      <div>
        <label htmlFor="r-pass" className="label">New password</label>
        <input id="r-pass" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="mt-1 text-xs text-mute">At least 8 characters, with a letter and a number.</p>
      </div>
      <button type="submit" className="btn-primary w-full py-4" aria-busy={busy} disabled={busy}>{busy ? 'Saving...' : 'Set new password'}</button>
    </form>
  );
}

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
      <button type="submit" className="btn-primary w-full py-4" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <p className="text-center text-sm text-mute">New to Palladium? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-ink underline underline-offset-4">Create an account</Link></p>
      <p className="text-center text-xs text-mute">Forgot your password? Contact us at <a href={`mailto:${storeEmail}`} className="underline">{storeEmail}</a></p>
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
  const up = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { try { setSource(localStorage.getItem('pal-src') || undefined); } catch { /* ignore */ } }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setFe({});
    try {
      await api('/api/auth/register', { body: { name: f.name, email: f.email, phone: f.phone.trim() || undefined, password: f.password, source } });
      toast('Your account is ready. Welcome to Palladium!');
      window.location.assign(safeNext(next) ?? '/account');
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : 'Could not create your account.';
      setErr(m); if (ex instanceof ApiError && ex.fields) setFe(ex.fields);
      toast(m, 'error');
      setBusy(false);
    }
  }
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
      <button type="submit" className="btn-primary w-full py-4" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      <p className="text-center text-sm text-mute">Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-ink underline underline-offset-4">Sign in</Link></p>
    </form>
  );
}

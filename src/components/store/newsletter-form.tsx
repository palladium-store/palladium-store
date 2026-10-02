'use client';
import { useId, useState } from 'react';
import { api } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

export function NewsletterForm({ dark = false, buttonLabel = 'Subscribe' }: { dark?: boolean; buttonLabel?: string }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await api('/api/newsletter', { body: { email } });
      setDone(true); setEmail('');
      toast('You are on the list. Thank you!');
    } catch (err) {
      const msg = (err as { fields?: Record<string, string> }).fields?.email ?? (err instanceof Error ? err.message : 'Could not subscribe.');
      setError(msg); toast(msg, 'error');
    } finally { setBusy(false); }
  }
  if (done) return <p className={`text-sm ${dark ? 'text-white' : 'text-ink'}`}>You are subscribed. Watch your inbox for new drops.</p>;
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="sr-only">Email address</label>
      <div className="flex">
        <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
          className={`min-w-0 flex-1 border px-4 py-3 text-sm outline-none transition ${dark ? 'border-white/30 bg-transparent text-white placeholder:text-white/50 focus:border-gold' : 'border-ink bg-white focus:border-gold'}`} aria-invalid={!!error} />
        <button type="submit" aria-busy={busy} disabled={busy} className={dark ? 'btn-gold' : 'btn-primary'}>{busy ? 'Working...' : buttonLabel}</button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </form>
  );
}

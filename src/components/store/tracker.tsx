'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('pal-sid');
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('pal-sid', id);
    }
    return id;
  } catch { return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
}

/** Records one page view per navigation. The traffic source is kept (first touch) in localStorage 'pal-src' for checkout and sign-up. */
export function Tracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin') || last.current === pathname) return;
    last.current = pathname;
    let source: string | undefined;
    try {
      const utm = new URLSearchParams(window.location.search).get('utm_source');
      if (utm) source = utm;
      else if (document.referrer) { const h = new URL(document.referrer).host; if (h && h !== window.location.host) source = h; }
    } catch { /* ignore */ }
    if (source) {
      source = source.slice(0, 60);
      try { if (!localStorage.getItem('pal-src')) localStorage.setItem('pal-src', source); } catch { /* ignore */ }
    }
    const body = JSON.stringify({ sessionId: sessionId(), path: pathname.slice(0, 300), referrer: document.referrer ? document.referrer.slice(0, 300) : undefined, source });
    fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Thin top bar: starts on internal link clicks / GET form submits, completes when the route changes. */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pct, setPct] = useState(0);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (hide.current) clearTimeout(hide.current);
    if (timer.current) clearInterval(timer.current);
    setOn(true);
    setPct(8);
    timer.current = setInterval(() => setPct((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200);
  };
  const done = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPct(100);
    hide.current = setTimeout(() => { setOn(false); setPct(0); }, 250);
  };

  useEffect(() => { done(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(mailto:|tel:)/.test(href)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f?.method?.toLowerCase() === 'get') start();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('submit', onSubmit); };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]" style={{ opacity: on ? 1 : 0, transition: 'opacity 200ms' }}>
      <div className="h-full bg-gold shadow-[0_0_8px_#ffd21f]" style={{ width: `${pct}%`, transition: pct === 0 ? 'none' : 'width 200ms ease-out' }} />
    </div>
  );
}

export function NavProgress() {
  return <Bar />;
}

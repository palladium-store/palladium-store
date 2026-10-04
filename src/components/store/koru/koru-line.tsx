'use client';
import { useEffect, useRef } from 'react';

/** The koru: a fern frond whose curl loosens as `u` goes from 0 (tight) to 1 (open). Same curve as the /koru page. */
export function koruPath(u: number): string {
  const N = 120, L = 300, K = 66 - 36 * u;
  let x = 92 - 26 * u, y = 252, phi = -Math.PI / 2, d = `M${x} ${y}`;
  const ds = L / N;
  for (let i = 1; i <= N; i++) {
    phi += (K * Math.pow(i / N, 2.6)) / N;
    x += Math.cos(phi) * ds; y += Math.sin(phi) * ds;
    d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
const OPEN = koruPath(1);

/** Decorative koru line. Drawn open on the server; with JavaScript it unfurls once when it scrolls into view. */
export function KoruLine({ className = '', strokeWidth = 5 }: { className?: string; strokeWidth?: number }) {
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    const p = path.current;
    if (!p || typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      let t0 = 0;
      const step = (now: number) => {
        if (!t0) t0 = now;
        const t = Math.min(1, Math.max(0, (now - t0 - 250) / 2200));
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        p.setAttribute('d', koruPath(e));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      p.setAttribute('d', koruPath(0));
      raf = requestAnimationFrame(step);
    }, { threshold: 0.35 });
    io.observe(p);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return (
    <svg viewBox="0 0 240 258" className={className} aria-hidden="true" fill="none">
      <path ref={path} d={OPEN} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

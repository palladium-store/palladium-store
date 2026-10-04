'use client';
import { createElement, useEffect, useRef, useState } from 'react';

/**
 * Eases its `.rv` children in the first time the block scrolls into view (styles in koru.css).
 * Content is visible without JavaScript: the block is only "armed" (hidden, waiting) once this has mounted and it is still below the fold.
 */
export function Reveal({ as = 'div', className = '', children, ...rest }: { as?: 'div' | 'section'; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'' | 'armed' | 'in'>('');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) { setPhase('in'); return; }
    setPhase('armed');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      setPhase('in');
      io.disconnect();
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(as as 'div', { ref, className: `k-reveal ${phase} ${className}`, ...rest }, children);
}

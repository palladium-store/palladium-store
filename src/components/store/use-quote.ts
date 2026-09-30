'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/ui/api-client';
import type { CartLine } from './cart-context';
import type { Quote } from './types';

/** Prices the cart through POST /api/cart/price (debounced, latest request wins). */
export function useQuote(lines: CartLine[], opts: { discountCode?: string; province?: string; enabled?: boolean } = {}) {
  const { discountCode, province, enabled = true } = opts;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const key = JSON.stringify([lines, discountCode ?? '', province ?? '']);

  useEffect(() => {
    if (!enabled) { seq.current++; setLoading(false); return; }
    if (!lines.length) { seq.current++; setQuote(null); setError(null); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await api<Quote>('/api/cart/price', { body: { items: lines, discountCode: discountCode || undefined, province: province || undefined } });
        if (seq.current === mine) { setQuote(q); setError(null); }
      } catch (e) {
        if (seq.current === mine) setError(e instanceof Error ? e.message : 'Could not price your cart.');
      } finally {
        if (seq.current === mine) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
    // `key` captures lines, discountCode and province.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  return { quote, loading, error, refresh: () => setNonce((n) => n + 1) };
}

'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartLine { variantId: string; qty: number }
const KEY = 'pal-cart';
const MAX = 99;

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const map = new Map<string, number>();
    for (const l of data as { variantId?: unknown; qty?: unknown }[]) {
      if (l && typeof l.variantId === 'string' && typeof l.qty === 'number' && Number.isInteger(l.qty) && l.qty > 0) map.set(l.variantId, Math.min((map.get(l.variantId) ?? 0) + l.qty, MAX));
    }
    return [...map].map(([variantId, qty]) => ({ variantId, qty }));
  } catch { return []; }
}
function write(lines: CartLine[]) { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ } }

interface Ctx {
  lines: CartLine[]; count: number; ready: boolean;
  add: (variantId: string, qty?: number) => void;
  addMany: (items: CartLine[]) => void;
  set: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  drawerOpen: boolean; openDrawer: () => void; closeDrawer: () => void;
}
const CartCtx = createContext<Ctx | null>(null);
export function useCart(): Ctx {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) setLines(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => { if (ready) write(lines); }, [lines, ready]);

  const addMany = useCallback((items: CartLine[]) => {
    setLines((s) => {
      const next = s.map((l) => ({ ...l }));
      for (const it of items) {
        if (!it.variantId || it.qty < 1) continue;
        const found = next.find((l) => l.variantId === it.variantId);
        if (found) found.qty = Math.min(found.qty + it.qty, MAX); else next.push({ variantId: it.variantId, qty: Math.min(it.qty, MAX) });
      }
      return next;
    });
  }, []);
  const add = useCallback((variantId: string, qty = 1) => addMany([{ variantId, qty }]), [addMany]);
  const set = useCallback((variantId: string, qty: number) => {
    setLines((s) => (qty <= 0 ? s.filter((l) => l.variantId !== variantId) : s.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(Math.floor(qty), MAX) } : l))));
  }, []);
  const remove = useCallback((variantId: string) => setLines((s) => s.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const count = useMemo(() => lines.reduce((a, l) => a + l.qty, 0), [lines]);

  const value = useMemo(() => ({ lines, count, ready, add, addMany, set, remove, clear, drawerOpen, openDrawer, closeDrawer }), [lines, count, ready, add, addMany, set, remove, clear, drawerOpen, openDrawer, closeDrawer]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

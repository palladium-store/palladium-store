'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';

interface Ctx { has: (id: string) => boolean; toggle: (id: string) => Promise<boolean>; busy: string | null }
const WishCtx = createContext<Ctx>({ has: () => false, toggle: async () => false, busy: null });
export const useWishlist = () => useContext(WishCtx);

export function WishlistProvider({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<{ productIds: string[] }>('/api/account/wishlist').then((r) => { if (live) setIds(new Set(r.productIds)); }).catch(() => {});
    return () => { live = false; };
  }, [signedIn]);

  const toggle = useCallback(async (id: string) => {
    const wasIn = ids.has(id);
    setBusy(id);
    setIds((s) => { const n = new Set(s); if (wasIn) n.delete(id); else n.add(id); return n; });
    try {
      await api('/api/account/wishlist', { method: wasIn ? 'DELETE' : 'POST', body: { productId: id } });
      toast(wasIn ? 'Removed from your wishlist.' : 'Saved to your wishlist.');
      return true;
    } catch (e) {
      setIds((s) => { const n = new Set(s); if (wasIn) n.add(id); else n.delete(id); return n; });
      if (e instanceof ApiError && e.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else {
        toast(e instanceof Error ? e.message : 'Could not update your wishlist.', 'error');
      }
      return false;
    } finally {
      setBusy(null);
    }
  }, [ids, router, toast]);

  const value = useMemo(() => ({ has: (id: string) => ids.has(id), toggle, busy }), [ids, toggle, busy]);
  return <WishCtx.Provider value={value}>{children}</WishCtx.Provider>;
}

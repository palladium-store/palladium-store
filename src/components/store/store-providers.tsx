'use client';
import { CartProvider } from './cart-context';
import { WishlistProvider } from './wishlist-context';
import { CartDrawer } from './cart-drawer';
import { Tracker } from './tracker';
import { PalladiumWalletProvider } from './palladium/wallet';
import type { PalladiumClientConfig } from '@/lib/chain-config';

export function StoreProviders({ signedIn, palladium, children }: { signedIn: boolean; palladium: PalladiumClientConfig; children: React.ReactNode }) {
  return (
    <CartProvider>
      <WishlistProvider signedIn={signedIn}>
        <PalladiumWalletProvider config={palladium}>
          {children}
          <CartDrawer />
          <Tracker />
        </PalladiumWalletProvider>
      </WishlistProvider>
    </CartProvider>
  );
}

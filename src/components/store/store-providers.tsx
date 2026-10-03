'use client';
import { CartProvider } from './cart-context';
import { WishlistProvider } from './wishlist-context';
import { CartDrawer } from './cart-drawer';
import { Tracker } from './tracker';
import { PalladiumWalletProvider } from './palladium/wallet';

export function StoreProviders({ signedIn, palladiumDemo = false, children }: { signedIn: boolean; palladiumDemo?: boolean; children: React.ReactNode }) {
  return (
    <CartProvider>
      <WishlistProvider signedIn={signedIn}>
        <PalladiumWalletProvider enabled={palladiumDemo}>
          {children}
          <CartDrawer />
          <Tracker />
        </PalladiumWalletProvider>
      </WishlistProvider>
    </CartProvider>
  );
}

'use client';
import { CartProvider } from './cart-context';
import { WishlistProvider } from './wishlist-context';
import { CartDrawer } from './cart-drawer';
import { Tracker } from './tracker';

export function StoreProviders({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  return (
    <CartProvider>
      <WishlistProvider signedIn={signedIn}>
        {children}
        <CartDrawer />
        <Tracker />
      </WishlistProvider>
    </CartProvider>
  );
}

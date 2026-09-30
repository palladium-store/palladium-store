import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { CartPage } from '@/components/store/cart-page';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false, follow: false } };

export default function Cart() {
  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <h1 className="h-display mb-8 text-4xl sm:text-6xl">Your cart</h1>
      <CartPage />
    </Container>
  );
}

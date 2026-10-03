import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { Container } from '@/components/store/container';
import { CheckoutForm } from '@/components/store/checkout-form';

import { enabledMethods } from '@/lib/payments';
import { DEMO_INSTRUCTIONS } from '@/lib/palladium/demo-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const [user, payments, store] = await Promise.all([getUser(), getSetting('payments'), getSetting('store')]);
  const customer = user ? await prisma.customer.findUnique({ where: { userId: user.id }, select: { phone: true } }) : null;
  const methods = (await enabledMethods()).map((k) => ({ id: k as string, instructions: k === 'PALLADIUM' ? DEMO_INSTRUCTIONS : payments[k as keyof typeof payments].instructions }));
  return (
    <Container className="pb-8 pt-8 sm:pt-12">
      <h1 className="h-display mb-8 text-4xl sm:text-6xl">Checkout</h1>
      <CheckoutForm methods={methods} user={user ? { name: user.name, email: user.email, phone: customer?.phone ?? null } : null} storeEmail={store.email} />
    </Container>
  );
}

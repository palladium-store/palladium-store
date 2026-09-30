import 'server-only';
import type { PaymentMethod } from '@prisma/client';
import { getSetting } from './settings';
import { AppError } from './errors';

export interface PaymentInit { instructions: string; redirectUrl?: string; reference?: string }
export interface PaymentProvider {
  id: string;
  methods: PaymentMethod[];
  /** Called right after an order is created. Return instructions to show, or a redirectUrl for hosted checkouts. */
  initiate(order: { id: string; orderNumber: string; totalCentavos: number; method: PaymentMethod; email: string }): Promise<PaymentInit>;
}

/** Manual provider: the customer pays outside the site and an admin confirms the payment. */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  methods: ['GCASH', 'MAYA', 'BANK_TRANSFER', 'COD', 'CARD'],
  async initiate(order) {
    const cfg = (await getSetting('payments'))[order.method];
    if (!cfg?.enabled) throw new AppError(422, 'METHOD_DISABLED', 'That payment method is not available.');
    return { instructions: cfg.instructions, reference: order.orderNumber };
  },
};

// Register real providers here later (PayMongo, Xendit, Maya Business, GCash), each implementing PaymentProvider and
// calling pal_confirm_order from a verified webhook route (see /api/payments/webhook).
const registry: PaymentProvider[] = [manualProvider];
export function providerFor(method: PaymentMethod): PaymentProvider {
  return registry.find((p) => p.methods.includes(method)) ?? manualProvider;
}
export async function enabledMethods() {
  const s = await getSetting('payments');
  return (Object.keys(s) as PaymentMethod[]).filter((k) => s[k].enabled);
}

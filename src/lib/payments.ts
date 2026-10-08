import 'server-only';
import type { PaymentMethod } from '@prisma/client';
import { getSetting, type PaymentSettings } from './settings';
import { AppError } from './errors';
import { paymongoProvider, paymongoConfigured } from './paymongo';
import { demoEnabled, palladiumDemoProvider } from './palladium/demo-server';
import { palladiumLiveProvider } from './palladium/live-server';
import { livePaymentEnabled } from './palladium/live-config';

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
    const cfg = (await getSetting('payments'))[order.method as keyof PaymentSettings];
    if (!cfg?.enabled) throw new AppError(422, 'METHOD_DISABLED', 'That payment method is not available.');
    return { instructions: cfg.instructions, reference: order.orderNumber };
  },
};

// Register real providers here later (PayMongo, Xendit, Maya Business, GCash), each implementing PaymentProvider and
// calling pal_confirm_order from a verified webhook route (see /api/payments/webhook).
// Lazy so the payments <-> paymongo <-> orders import cycle never touches an uninitialised binding.
const registry = (): PaymentProvider[] => [paymongoProvider, palladiumDemoProvider, manualProvider];
/** PALLADIUM goes to the real chain provider whenever live payments are configured; the demo provider only while the demo alone is on. */
export async function providerFor(method: PaymentMethod): Promise<PaymentProvider> {
  if (method === 'PALLADIUM' && (await livePaymentEnabled())) return palladiumLiveProvider;
  return registry().find((p) => p.methods.includes(method)) ?? manualProvider;
}
/** QR Ph (PayMongo) appears once PAYMONGO_SECRET_KEY is set. PALLADIUM appears when real payments are configured (see palladium/live-config.ts) or, outside production, while the demo is on. */
export async function enabledMethods(): Promise<PaymentMethod[]> {
  const out: PaymentMethod[] = [];
  if (paymongoConfigured()) out.push('QRPH');
  if ((await livePaymentEnabled()) || demoEnabled()) out.push('PALLADIUM');
  return out;
}

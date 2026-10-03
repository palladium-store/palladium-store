import 'server-only';
import type { PaymentProvider } from '@/lib/payments';

/**
 * Server side of the $PALLADIUM DEMO. Off unless PALLADIUM_DEMO_MODE=true is set, so a production store never offers
 * a payment option that costs the customer nothing until the owner deliberately turns the demo on.
 */
export const demoEnabled = () => (process.env.PALLADIUM_DEMO_MODE ?? '').trim().toLowerCase() === 'true';

export const DEMO_INSTRUCTIONS = 'DEMO PAYMENT. Pay with the simulated PALLADIUM wallet. No real cryptocurrency is transferred.';

export const palladiumDemoProvider: PaymentProvider = {
  id: 'palladium-demo',
  methods: ['PALLADIUM'],
  async initiate() { return { instructions: DEMO_INSTRUCTIONS }; },
};

import 'server-only';
import type { PaymentProvider } from '@/lib/payments';

/**
 * Server side of the $PALLADIUM DEMO. Off unless PALLADIUM_DEMO_MODE=true is set, so a production store never offers
 * a payment option that costs the customer nothing until the owner deliberately turns the demo on.
 */
/** Never on the production deployment: a simulated payment must not be able to mark a real order paid (security audit H4). */
export const demoEnabled = () => (process.env.PALLADIUM_DEMO_MODE ?? '').trim().toLowerCase() === 'true' && process.env.VERCEL_ENV !== 'production';

export const DEMO_INSTRUCTIONS = 'DEMO PAYMENT. Pay with the simulated PALLADIUM wallet. No real cryptocurrency is transferred.';

export const palladiumDemoProvider: PaymentProvider = {
  id: 'palladium-demo',
  methods: ['PALLADIUM'],
  async initiate() { return { instructions: DEMO_INSTRUCTIONS }; },
};

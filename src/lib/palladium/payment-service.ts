import { DemoPalladiumPaymentService } from './demo-service';
import type { PalladiumPaymentService } from './types';
export * from './types';

/** The ONLY switch between demo and real payments. See types.ts for the contract the real implementation must satisfy. */
let instance: PalladiumPaymentService | null = null;
export function getPalladiumPaymentService(): PalladiumPaymentService {
  if (!instance) instance = new DemoPalladiumPaymentService();
  return instance;
}

import 'server-only';
import { prisma } from './db';
import { AppError } from './errors';

export interface ShippingQuote { zone: string; rateName: string; courier: string | null; feeCentavos: number; free: boolean }

/** Manual zone-based rates. Replace or extend with courier APIs later by returning the same shape. */
export async function quoteShipping(province: string, weightGrams: number, subtotalCentavos: number): Promise<ShippingQuote> {
  const zone = await prisma.shippingZone.findFirst({ where: { provinces: { has: province } }, include: { rates: true } });
  if (!zone) throw new AppError(422, 'NO_SHIPPING', `We do not ship to ${province} yet.`);
  const rates = zone.rates.filter((r) => weightGrams >= r.minWeightGrams && (r.maxWeightGrams == null || weightGrams <= r.maxWeightGrams));
  const rate = rates.sort((a, b) => a.rateCentavos - b.rateCentavos)[0] ?? zone.rates.sort((a, b) => b.rateCentavos - a.rateCentavos)[0];
  if (!rate) throw new AppError(422, 'NO_SHIPPING', 'No shipping rate is configured for this order.');
  const free = rate.freeOverCentavos != null && subtotalCentavos >= rate.freeOverCentavos;
  return { zone: zone.name, rateName: rate.name, courier: rate.courier, feeCentavos: free ? 0 : rate.rateCentavos, free };
}

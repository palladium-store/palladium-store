import { adminRoute, ok, readJson } from '@/lib/api';
import { shippingZoneSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';
import { AppError } from '@/lib/errors';

export const maxDuration = 30;

export const PUT = adminRoute('MANAGE_SETTINGS', async (req, _c, user) => {
  const zones = z.array(shippingZoneSchema).parse(await readJson(req));
  const names = zones.map((z) => z.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new AppError(422, 'DUPLICATE_ZONE', 'Two zones have the same name. Give each zone a different name.');
  await prisma.$transaction(async (tx) => {
    const keep = zones.map((z) => z.id).filter(Boolean) as string[];
    await tx.shippingZone.deleteMany({ where: { id: { notIn: keep } } });
    for (const z of zones) {
      const zone = z.id ? await tx.shippingZone.update({ where: { id: z.id }, data: { name: z.name, provinces: z.provinces } }) : await tx.shippingZone.create({ data: { name: z.name, provinces: z.provinces } });
      await tx.shippingRate.deleteMany({ where: { zoneId: zone.id } });
      await tx.shippingRate.createMany({ data: z.rates.map((r) => ({ zoneId: zone.id, name: r.name, minWeightGrams: r.minWeightGrams, maxWeightGrams: r.maxWeightGrams ?? null, rateCentavos: r.rateCentavos, freeOverCentavos: r.freeOverCentavos ?? null, courier: r.courier ?? null })) });
    }
  }, { maxWait: 10000, timeout: 25000 });
  await audit(user, 'SHIPPING_UPDATED', 'Settings', 'shipping', `Updated shipping zones (${zones.length})`);
  return ok();
});

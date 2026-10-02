import 'server-only';
import { cache } from 'react';
import { prisma } from './db';

export interface StoreSettings { name: string; email: string; phone: string; address: string; facebook?: string; instagram?: string; freeShippingNote?: string }
export interface PaymentSettings { QRPH: MethodCfg; GCASH: MethodCfg; MAYA: MethodCfg; CARD: MethodCfg; BANK_TRANSFER: MethodCfg; COD: MethodCfg }
export interface MethodCfg { enabled: boolean; instructions: string }
export interface ContentSettings {
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; image: string };
  banners: { title: string; text: string; href: string; cta: string }[];
  brandStory: { title: string; body: string };
  announcement: string;
  policies: { slug: string; title: string; body: string }[];
}

export const DEFAULTS = {
  store: { name: 'Palladium', email: 'hello@palladiumpickleball.com', phone: '+63 917 000 0000', address: 'Metro Manila, Philippines', instagram: '', facebook: '' } as StoreSettings,
  payments: {
    QRPH: { enabled: false, instructions: 'Scan the QR code with any bank or e-wallet app that supports QR Ph (GCash, Maya, BPI, BDO, UnionBank and more). We confirm your payment automatically.' },
    GCASH: { enabled: true, instructions: 'Send the exact amount to GCash 0917 000 0000 (Palladium) and use your order number as the reference. We confirm within business hours.' },
    MAYA: { enabled: true, instructions: 'Send the exact amount to Maya 0917 000 0000 (Palladium) and use your order number as the reference.' },
    CARD: { enabled: false, instructions: 'Card payments are not available yet.' },
    BANK_TRANSFER: { enabled: true, instructions: 'Transfer to BDO account 0000 0000 0000 (Palladium Sports). Email your deposit slip with your order number.' },
    COD: { enabled: true, instructions: 'Pay in cash when your order arrives.' },
  } as PaymentSettings,
  inventory: { allowOversell: false },
  content: {
    hero: { eyebrow: 'Gen4 pickleball, designed in New Zealand', title: 'Play with edge.', subtitle: 'Premium paddles, balls and gear for Filipino players who want more from every rally.', cta: 'Shop paddles', image: '/products/koru.webp' },
    banners: [
      { title: 'Koru Limited Edition', text: 'A numbered run of the Gen4 16mm. Once it is gone, it is gone.', href: '/products/palladium-koru-limited-edition', cta: 'See the paddle' },
      { title: 'Free shipping nationwide', text: 'On orders over ₱3,000.', href: '/shop', cta: 'Start shopping' },
    ],
    brandStory: { title: 'Built in New Zealand. Played in the Philippines.', body: 'Palladium is a New Zealand registered pickleball brand. We design paddles and accessories around one idea: advanced performance engineering that feels simple on court. Every product carries the PalladiumX mark.' },
    announcement: 'Free shipping nationwide over ₱3,000',
    policies: [
      { slug: 'shipping', title: 'Shipping policy', body: 'We ship nationwide from Metro Manila. Orders are packed within 1 to 2 business days. Metro Manila deliveries take 1 to 3 days, Luzon 3 to 5 days, Visayas and Mindanao 5 to 8 days. Tracking numbers are emailed when your order ships.' },
      { slug: 'returns', title: 'Returns and refunds', body: 'Unused items in original packaging can be returned within 7 days of delivery. Contact us with your order number. Refunds go back to your original payment method after the item is received and checked. Grips and opened balls cannot be returned.' },
      { slug: 'privacy', title: 'Privacy policy', body: 'We collect your name, contact details and address to process orders. We do not sell your data. Payment details are never stored on our servers. You can ask us to delete your account at any time.' },
      { slug: 'terms', title: 'Terms of service', body: 'By ordering you agree to these terms. Prices are in Philippine pesos and may change without notice. An order is accepted when we confirm payment or, for cash on delivery, when we confirm your order.' },
    ],
  } as ContentSettings,
};
type Key = keyof typeof DEFAULTS;

export const getSetting = cache(async <K extends Key>(key: K): Promise<(typeof DEFAULTS)[K]> => {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key];
  const v = row.value as object;
  return (Array.isArray(v) ? v : { ...(DEFAULTS[key] as object), ...v }) as (typeof DEFAULTS)[K];
});
export async function setSetting(key: Key, value: unknown) {
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
}

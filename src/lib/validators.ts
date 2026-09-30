import { z } from 'zod';
import { PROVINCES } from './ph';

const trim = (s: string) => s.trim();
export const email = z.string().transform(trim).pipe(z.string().email('Enter a valid email address.').max(160));
export const phMobile = z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(
  z.string().regex(/^(09|\+639|639)\d{9}$/, 'Enter a valid PH mobile number, e.g. 0917 123 4567.'));
export const normalizePhone = (s: string) => s.replace(/[\s-]/g, '').replace(/^\+?63/, '0');
const name = z.string().transform(trim).pipe(z.string().min(2, 'Enter your full name.').max(120));
const text = (max: number, msg = 'Required.') => z.string().transform(trim).pipe(z.string().min(1, msg).max(max));
export const password = z.string().min(8, 'Use at least 8 characters.').max(100).regex(/[A-Za-z]/, 'Include a letter.').regex(/\d/, 'Include a number.');

export const paymentMethod = z.enum(['GCASH', 'MAYA', 'CARD', 'BANK_TRANSFER', 'COD']);
export const shipAddress = z.object({
  name, phone: phMobile,
  line1: text(200, 'Enter your street address.'),
  barangay: text(100, 'Enter your barangay.'),
  city: text(100, 'Enter your city or municipality.'),
  province: z.string().refine((p) => PROVINCES.includes(p), 'Choose a province.'),
  postalCode: z.string().regex(/^\d{4}$/, 'Postal code is 4 digits.'),
});

export const registerSchema = z.object({ name, email, password, source: z.string().max(60).optional(), phone: phMobile.optional().or(z.literal('').transform(() => undefined)) });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20), password });
export const changePasswordSchema = z.object({ current: z.string().min(1), next: password });
export const profileSchema = z.object({ name, phone: phMobile.optional().or(z.literal('').transform(() => undefined)) });

export const cartItems = z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(99) })).min(1, 'Your cart is empty.').max(50);
export const priceCartSchema = z.object({ items: cartItems.or(z.array(z.never()).length(0)), discountCode: z.string().max(40).optional(), province: z.string().optional() });
export const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  items: cartItems,
  email, phone: phMobile,
  ship: shipAddress,
  method: paymentMethod,
  discountCode: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  createAccount: z.boolean().optional(),
  password: z.string().optional(),
  saveAddress: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  source: z.string().max(60).optional(),
});
export const addressSchema = shipAddress.extend({ label: z.string().max(40).optional(), isDefault: z.boolean().optional() }).transform(({ name, ...r }) => ({ recipient: name, ...r }));

export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), title: z.string().max(120).optional(), body: text(2000, 'Write a short review.') });
export const newsletterSchema = z.object({ email });

// ---- admin ----
const centavos = z.number().int().min(0).max(100_000_000);
export const variantSchema = z.object({
  id: z.string().optional(),
  name: text(80), sku: z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().min(2).max(60).regex(/^[A-Z0-9._-]+$/, 'SKU: letters, numbers, dot, dash, underscore.')),
  barcode: z.string().transform(trim).optional().transform((v) => v || null),
  priceCentavos: centavos, compareAtCentavos: centavos.nullable().optional(), costCentavos: centavos.default(0),
  lowStockThreshold: z.number().int().min(0).max(10000).default(5),
  imageUrl: z.string().max(500).nullable().optional(), isActive: z.boolean().default(true),
  initialStock: z.number().int().min(0).max(1_000_000).optional(),
});
export const productSchema = z.object({
  name: text(160), slug: z.string().transform((s) => s.trim().toLowerCase()).pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only.')).optional(),
  categoryId: z.string().min(1, 'Choose a category.'),
  shortDescription: z.string().max(300).optional().nullable(), description: z.string().max(10000).optional().nullable(),
  specs: z.record(z.string().max(300)).optional().nullable(), tags: z.array(z.string().max(40)).max(30).default([]),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED', 'SOLD_OUT']).default('DRAFT'),
  isFeatured: z.boolean().default(false), isLimited: z.boolean().default(false),
  weightGrams: z.number().int().min(0).max(100000).nullable().optional(),
  lengthMm: z.number().int().min(0).nullable().optional(), widthMm: z.number().int().min(0).nullable().optional(), heightMm: z.number().int().min(0).nullable().optional(),
  shippingInfo: z.string().max(1000).nullable().optional(),
  seoTitle: z.string().max(120).nullable().optional(), seoDescription: z.string().max(320).nullable().optional(), ogImageUrl: z.string().max(500).nullable().optional(),
  images: z.array(z.object({ url: z.string().min(1).max(500), alt: z.string().max(200).nullable().optional(), kind: z.enum(['image', 'video']).default('image') })).max(20).default([]),
  variants: z.array(variantSchema).min(1, 'Add at least one variant.').max(50),
}).superRefine((p, ctx) => {
  const skus = p.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) ctx.addIssue({ code: 'custom', message: 'Each variant needs a different SKU.', path: ['variants'] });
});

export const inventoryActionSchema = z.object({
  variantId: z.string().min(1), locationId: z.string().optional(),
  action: z.enum(['RECEIVE', 'ADD', 'REMOVE', 'ADJUST', 'DAMAGED', 'RETURNED']),
  quantity: z.number().int().min(0).max(1_000_000), reason: z.string().max(300).optional(),
});
export const transferSchema = z.object({ variantId: z.string().min(1), fromLocationId: z.string().min(1), toLocationId: z.string().min(1), quantity: z.number().int().min(1), reason: z.string().max(300).optional() });

export const orderStatusSchema = z.object({ status: z.enum(['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']), courier: z.string().max(80).optional(), trackingNumber: z.string().max(120).optional() });
export const trackingSchema = z.object({ courier: z.string().max(80).optional(), trackingNumber: z.string().max(120).optional() });
export const refundSchema = z.object({ amountCentavos: z.number().int().min(1), restock: z.boolean().default(false), items: z.array(z.object({ orderItemId: z.string(), qty: z.number().int().min(1) })).optional(), reason: z.string().max(300).optional() });
export const reasonSchema = z.object({ reason: z.string().max(300).optional() });
export const noteSchema = z.object({ internalNotes: z.string().max(4000) });

export const discountSchema = z.object({
  code: z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/, 'Letters, numbers, dash, underscore.')),
  type: z.enum(['PERCENTAGE', 'FIXED']), value: z.number().int().min(1),
  minOrderCentavos: z.number().int().min(0).default(0), maxDiscountCentavos: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().nullable().optional(), endsAt: z.string().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(), perCustomerLimit: z.number().int().min(1).nullable().optional(),
  productIds: z.array(z.string()).default([]), categoryIds: z.array(z.string()).default([]), isActive: z.boolean().default(true),
}).superRefine((d, ctx) => { if (d.type === 'PERCENTAGE' && d.value > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percentage cannot exceed 100.' }); });

export const shippingZoneSchema = z.object({
  id: z.string().optional(), name: text(60), provinces: z.array(z.string()).default([]),
  rates: z.array(z.object({ id: z.string().optional(), name: text(60), minWeightGrams: z.number().int().min(0).default(0), maxWeightGrams: z.number().int().min(1).nullable().optional(), rateCentavos: centavos, freeOverCentavos: centavos.nullable().optional(), courier: z.string().max(60).nullable().optional() })).min(1),
});
export const staffSchema = z.object({ email, name, role: z.enum(['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'STAFF']), password: password.optional(), isActive: z.boolean().optional() });
export const dateQuery = z.object({ range: z.string().optional(), from: z.string().optional(), to: z.string().optional() });

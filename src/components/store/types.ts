// Client-safe shapes shared by storefront components (no server imports here).
export interface CardProduct {
  id: string; name: string; slug: string; category: string; categorySlug: string; isLimited: boolean;
  price: number; compareAt: number | null; image: string | null; inStock: boolean; rating: number | null; reviewCount: number; variantCount: number;
}
export interface QuoteLine {
  variantId: string; qty: number; productId: string; productName: string; variantName: string; slug: string; sku: string;
  imageUrl: string | null; unitPriceCentavos: number; compareAtCentavos: number | null; lineTotalCentavos: number; available: number; problem: string | null;
}
export interface Quote {
  lines: QuoteLine[]; subtotalCentavos: number; discountCentavos: number; discountCode: string | null; discountError: string | null;
  shippingCentavos: number | null; shippingZone: string | null; shippingError: string | null; totalCentavos: number; ok: boolean;
}
export interface VariantDTO { id: string; name: string; sku: string; priceCentavos: number; compareAtCentavos: number | null; imageUrl: string | null; available: number; lowStock: boolean }
export interface SavedAddress { id: string; label: string | null; recipient: string; phone: string; line1: string; barangay: string; city: string; province: string; postalCode: string; isDefault: boolean }

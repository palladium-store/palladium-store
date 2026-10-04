export const METHOD_LABEL: Record<string, string> = { QRPH: 'QR Ph (scan to pay)', GCASH: 'GCash', MAYA: 'Maya', CARD: 'Credit or debit card', BANK_TRANSFER: 'Bank transfer', COD: 'Cash on delivery', PALLADIUM: 'PALLADIUM (DEMO)' };
export const METHOD_HEADING: Record<string, string> = { QRPH: 'Scan to pay with QR Ph', GCASH: 'Pay with GCash', MAYA: 'Pay with Maya', CARD: 'Pay by card', BANK_TRANSFER: 'Pay by bank transfer', COD: 'Pay on delivery', PALLADIUM: 'Pay with PALLADIUM (DEMO)' };
export const METHOD_SHORT: Record<string, string> = { QRPH: 'Scan with any bank or e-wallet app', GCASH: 'Send by GCash', MAYA: 'Send by Maya', CARD: 'Card', BANK_TRANSFER: 'Deposit or transfer', COD: 'Cash when it arrives', PALLADIUM: 'Simulated, no real crypto' };
export const safeNext = (n: string | undefined | null): string | null => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : null);
/** Policies the storefront shows. "Returns and refunds" was taken off the store; its text stays in settings, so removing this filter brings it back. */
export const storePolicies = <T extends { slug: string }>(policies: T[]): T[] => policies.filter((p) => p.slug !== 'returns');
export const paragraphs =(s: string | null | undefined): string[] => (s ?? '').split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
export function shipCta(cta: string): string { return /paddle/i.test(cta) ? '/shop?category=paddles' : '/shop'; }
export const SORT_VALUES = ['featured', 'newest', 'best', 'price_asc', 'price_desc'];

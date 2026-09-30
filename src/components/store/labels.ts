export const METHOD_LABEL: Record<string, string> = { GCASH: 'GCash', MAYA: 'Maya', CARD: 'Credit or debit card', BANK_TRANSFER: 'Bank transfer', COD: 'Cash on delivery' };
export const METHOD_HEADING: Record<string, string> = { GCASH: 'Pay with GCash', MAYA: 'Pay with Maya', CARD: 'Pay by card', BANK_TRANSFER: 'Pay by bank transfer', COD: 'Pay on delivery' };
export const METHOD_SHORT: Record<string, string> = { GCASH: 'Send by GCash', MAYA: 'Send by Maya', CARD: 'Card', BANK_TRANSFER: 'Deposit or transfer', COD: 'Cash when it arrives' };
export const safeNext = (n: string | undefined | null): string | null => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : null);
export const paragraphs = (s: string | null | undefined): string[] => (s ?? '').split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
export function shipCta(cta: string): string { return /paddle/i.test(cta) ? '/shop?category=paddles' : '/shop'; }
export const SORT_VALUES = ['featured', 'newest', 'best', 'price_asc', 'price_desc'];

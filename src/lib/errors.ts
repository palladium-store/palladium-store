import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

// Business errors raised by PostgreSQL functions look like "CODE: human message".
const PG_CODES: Record<string, number> = {
  INSUFFICIENT_STOCK: 409, RESERVED_UNDERFLOW: 409, INVALID_QUANTITY: 422, EMPTY_CART: 422, INVALID_SHIPPING: 422,
  VARIANT_UNAVAILABLE: 409, PRODUCT_UNAVAILABLE: 409, DISCOUNT_INVALID: 422, ORDER_NOT_FOUND: 404, INVALID_STATE: 409,
  INVALID_REFUND_AMOUNT: 422, INVALID_RETURN_QTY: 422, INVALID_TRANSFER: 422, UNSUPPORTED_ACTION: 422,
};

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join('.') || '_'] ??= i.message;
    return new AppError(422, 'VALIDATION', 'Please check the highlighted fields.', fields);
  }
  const any = e as { message?: string; meta?: { message?: string }; code?: string };
  const text = `${any?.meta?.message ?? ''} ${any?.message ?? ''}`;
  const m = text.match(/\b(INSUFFICIENT_STOCK|RESERVED_UNDERFLOW|INVALID_QUANTITY|EMPTY_CART|INVALID_SHIPPING|VARIANT_UNAVAILABLE|PRODUCT_UNAVAILABLE|DISCOUNT_INVALID|ORDER_NOT_FOUND|INVALID_STATE|INVALID_REFUND_AMOUNT|INVALID_RETURN_QTY|INVALID_TRANSFER|UNSUPPORTED_ACTION)\b:?\s*([^\n"]*)/);
  if (m) return new AppError(PG_CODES[m[1]] ?? 409, m[1], (m[2] || m[1]).trim().replace(/\s+at\s+.*$/, '') || m[1]);
  if (any?.code === 'P2002') return new AppError(409, 'DUPLICATE', 'That value is already in use (duplicate SKU, barcode, slug or email).');
  if (/append-only|cannot be deleted/.test(text)) return new AppError(409, 'PROTECTED', 'This record is protected and cannot be changed or deleted.');
  console.error('[unhandled]', e);
  return new AppError(500, 'INTERNAL', 'Something went wrong. Please try again.');
}

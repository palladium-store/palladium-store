import { route } from '@/lib/api';
import { NextResponse } from 'next/server';

// Placeholder for GCash/Maya/card provider callbacks. When you add a provider: verify its signature here, look up the order by
// reference, then call confirmOrder()/failPayment() from '@/lib/orders'. Never trust an unsigned callback.
export const POST = route(async () => NextResponse.json({ error: { code: 'NOT_CONFIGURED', message: 'No payment provider webhook is configured yet.' } }, { status: 501 }));

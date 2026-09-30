// Business timezone is Asia/Manila (UTC+8, no daylight saving). Database stores UTC.
export const TZ = 'Asia/Manila';
const OFFSET_MS = 8 * 3600 * 1000;

export function startOfManilaDay(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - OFFSET_MS);
}
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export function startOfManilaMonth(d: Date = new Date(), monthDelta = 0): Date {
  const s = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + monthDelta, 1) - OFFSET_MS);
}
export function parseManilaDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - OFFSET_MS);
}
export const ymdManila = (d: Date) => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);

export type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom';
export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days',
  this_month: 'This month', last_month: 'Last month', custom: 'Custom range',
};
export interface DateRange { key: RangeKey; from: Date; to: Date; label: string } // [from, to) in UTC

export function resolveRange(key: string | undefined, from?: string, to?: string, now = new Date()): DateRange {
  const today = startOfManilaDay(now);
  const tomorrow = addDays(today, 1);
  switch (key) {
    case 'yesterday': return { key: 'yesterday', from: addDays(today, -1), to: today, label: RANGE_LABELS.yesterday };
    case '7d': return { key: '7d', from: addDays(today, -6), to: tomorrow, label: RANGE_LABELS['7d'] };
    case '30d': return { key: '30d', from: addDays(today, -29), to: tomorrow, label: RANGE_LABELS['30d'] };
    case 'this_month': return { key: 'this_month', from: startOfManilaMonth(now), to: tomorrow, label: RANGE_LABELS.this_month };
    case 'last_month': return { key: 'last_month', from: startOfManilaMonth(now, -1), to: startOfManilaMonth(now), label: RANGE_LABELS.last_month };
    case 'custom': {
      const f = from ? parseManilaDate(from) : null, t = to ? parseManilaDate(to) : null;
      if (f && t && t >= f) return { key: 'custom', from: f, to: addDays(t, 1), label: `${from} to ${to}` };
      return { key: 'today', from: today, to: tomorrow, label: RANGE_LABELS.today };
    }
    default: return { key: 'today', from: today, to: tomorrow, label: RANGE_LABELS.today };
  }
}

const dt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const dOnly = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric' });
export const fmtDateTime = (d: Date | string) => dt.format(new Date(d));
export const fmtDate = (d: Date | string) => dOnly.format(new Date(d));

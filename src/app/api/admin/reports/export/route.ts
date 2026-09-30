import { adminRoute, qs } from '@/lib/api';
import { resolveRange } from '@/lib/time';
import { buildReport, toCsv, toXlsx, toPdf, type ReportType } from '@/lib/exports';
import { AppError } from '@/lib/errors';
import { audit } from '@/lib/audit';

const TYPES = ['summary', 'products', 'customers', 'payments', 'daily'];
export const GET = adminRoute('VIEW_REPORTS', async (req, _c, user) => {
  const q = qs(req);
  const type = (q.type ?? 'summary') as ReportType, format = q.format ?? 'csv';
  if (!TYPES.includes(type) || !['csv', 'xlsx', 'pdf'].includes(format)) throw new AppError(422, 'BAD_EXPORT', 'Unknown report or format.');
  const range = resolveRange(q.range, q.from, q.to);
  const table = await buildReport(type, range);
  const body = format === 'csv' ? toCsv(table) : format === 'xlsx' ? await toXlsx(table) : await toPdf(table);
  const mime = { csv: 'text/csv; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' }[format]!;
  await audit(user, 'REPORT_EXPORT', 'Report', null, `Exported ${type} report (${format}) for ${range.label}`);
  return new Response(new Uint8Array(body), { headers: { 'content-type': mime, 'content-disposition': `attachment; filename="palladium-${type}-${range.key}.${format}"`, 'cache-control': 'no-store' } });
});

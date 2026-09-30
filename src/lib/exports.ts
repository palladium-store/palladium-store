import 'server-only';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { salesSummary, productSales, customerReport, paymentReport, dailySalesTable, PAYMENT_LABELS } from './queries/reports';
import type { DateRange } from './time';

export type ReportType = 'summary' | 'products' | 'customers' | 'payments' | 'daily';
export interface Table { title: string; headers: string[]; rows: (string | number)[][]; money?: number[] } // money = column indexes holding pesos

const php = (c: number) => Math.round(c) / 100;

/** Builds the tabular data for a report. Money cells are plain pesos (numbers), so Excel can sum them. */
export async function buildReport(type: ReportType, r: DateRange): Promise<Table> {
  const label = r.label;
  if (type === 'products') {
    const rows = await productSales(r, { byVariant: true });
    return { title: `Product sales, ${label}`, headers: ['Product', 'Variant', 'SKU', 'Units sold', 'Gross sales (PHP)', 'Discounts (PHP)', 'Net sales (PHP)'], money: [4, 5, 6],
      rows: rows.map((x) => [x.product, x.variant ?? '', x.sku ?? '', x.units, php(x.grossCentavos), php(x.discountsCentavos), php(x.netCentavos)]) };
  }
  if (type === 'customers') {
    const c = await customerReport(r);
    return { title: `Customer report, ${label}`, headers: ['Metric', 'Count'], rows: [['New customers', c.newCustomers], ['Returning customers', c.returningCustomers], ['Customers who ordered', c.buyers], ['Total customers', c.totalCustomers]] };
  }
  if (type === 'payments') {
    const rows = await paymentReport(r);
    return { title: `Payment methods, ${label}`, headers: ['Method', 'Orders', 'Sales (PHP)', 'Refunds (PHP)', 'Net (PHP)'], money: [2, 3, 4],
      rows: rows.map((x) => [PAYMENT_LABELS[x.method] ?? x.method, x.orders, php(x.salesCentavos), php(x.refundsCentavos), php(x.netCentavos)]) };
  }
  if (type === 'daily') {
    const rows = await dailySalesTable(r);
    return { title: `Daily sales, ${label}`, headers: ['Date', 'Orders', 'Gross (PHP)', 'Discounts (PHP)', 'Refunds (PHP)', 'Net (PHP)', 'Shipping (PHP)'], money: [2, 3, 4, 5, 6],
      rows: rows.map((x) => [x.day, x.orders, php(x.grossCentavos), php(x.discountsCentavos), php(x.refundsCentavos), php(x.netCentavos), php(x.shippingCentavos)]) };
  }
  const s = await salesSummary(r);
  return { title: `Sales summary, ${label}`, headers: ['Metric', 'Value'], rows: [
    ['Total sales (PHP)', php(s.totalSalesCentavos)], ['Gross sales (PHP)', php(s.grossCentavos)], ['Discounts (PHP)', php(s.discountsCentavos)], ['Refunds (PHP)', php(s.refundsCentavos)],
    ['Net sales (PHP)', php(s.netCentavos)], ['Shipping revenue (PHP)', php(s.shippingCentavos)], ['Orders', s.orders], ['Items sold', s.itemsSold], ['Average order value (PHP)', php(s.avgOrderCentavos)], ['New customers', s.newCustomers]] };
}

const esc = (v: string | number) => { const s = String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"` : s; };
export function toCsv(t: Table): Buffer {
  const lines = [t.headers.map(esc).join(','), ...t.rows.map((r) => r.map((c, i) => (typeof c === 'number' && t.money?.includes(i) ? c.toFixed(2) : esc(c))).join(','))];
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}
export async function toXlsx(t: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Palladium';
  const ws = wb.addWorksheet(t.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ''));
  ws.addRow(t.headers).font = { bold: true };
  t.rows.forEach((r) => ws.addRow(r));
  t.money?.forEach((i) => { ws.getColumn(i + 1).numFmt = '"₱"#,##0.00'; });
  ws.columns.forEach((c, i) => { c.width = Math.max(14, Math.min(40, Math.max(...[t.headers[i], ...t.rows.map((r) => r[i])].map((v) => String(v ?? '').length)) + 2)); });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function toPdf(t: Table): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36; // A4 landscape
  const colW = (W - M * 2) / t.headers.length;
  const clip = (s: string, w: number, f = font, size = 9) => { let x = s; while (x.length > 1 && f.widthOfTextAtSize(x, size) > w - 6) x = x.slice(0, -2); return x === s ? s : x + '...'; };
  const fmt = (c: string | number, i: number) => (typeof c === 'number' && t.money?.includes(i) ? c.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(c)); // WinAnsi cannot draw the peso sign
  let page = pdf.addPage([W, H]), y = H - M;
  const head = () => { page.drawText('PALLADIUM', { x: M, y, size: 14, font: bold }); page.drawText(t.title, { x: M, y: y - 18, size: 10, font }); y -= 46; t.headers.forEach((h, i) => page.drawText(clip(h, colW, bold), { x: M + i * colW, y, size: 9, font: bold })); y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: rgb(0, 0, 0) }); y -= 14; };
  head();
  for (const r of t.rows) {
    if (y < M + 20) { page = pdf.addPage([W, H]); y = H - M; head(); }
    r.forEach((c, i) => { const s = clip(fmt(c, i), colW); const right = typeof c === 'number'; page.drawText(s, { x: right ? M + (i + 1) * colW - 6 - font.widthOfTextAtSize(s, 9) : M + i * colW, y, size: 9, font }); });
    y -= 14;
  }
  return Buffer.from(await pdf.save());
}

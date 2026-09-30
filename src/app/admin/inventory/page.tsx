import type { Metadata } from 'next';
import Link from 'next/link';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { listInventory, listLedger } from '@/lib/inventory';
import { getSetting } from '@/lib/settings';
import { can } from '@/lib/rbac';
import { peso } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';
import { Badge, EmptyState, Pagination, statusLabel } from '@/components/ui/bits';
import { PageHeader, StatCard } from '@/components/admin/PageHeader';
import { InventoryActions } from '@/components/admin/InventoryActions';
import { OversellToggle } from '@/components/admin/OversellToggle';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inventory' };

const ACTIONS = ['RECEIVE', 'ADD', 'REMOVE', 'ADJUST', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGED', 'RETURNED', 'RESERVE', 'RELEASE', 'SALE', 'CANCEL_RESTOCK', 'REFUND_RESTOCK', 'INITIAL'];

export default async function InventoryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await guard('MANAGE_INVENTORY');
  const tab = searchParams.tab === 'history' ? 'history' : 'stock';
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const canOversell = can(user.role, 'MANAGE_SETTINGS');
  const allowOversell = canOversell ? (await getSetting('inventory')).allowOversell : false;

  const tabs = (
    <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
      {([['stock', 'Stock'], ['history', 'History']] as const).map(([k, l]) => (
        <Link key={k} href={`/admin/inventory?tab=${k}`} role="tab" aria-selected={tab === k}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-gold text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{l}</Link>
      ))}
    </div>
  );

  if (tab === 'history') {
    const action = ACTIONS.includes(searchParams.action ?? '') ? searchParams.action : undefined;
    const sku = searchParams.sku?.trim() || undefined;
    let variantId = searchParams.variantId || undefined;
    let skuMissing = false;
    if (sku && !variantId) {
      const v = await prisma.productVariant.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } }, select: { id: true } });
      if (v) variantId = v.id; else skuMissing = true;
    }
    const [ledger, variants] = await Promise.all([
      skuMissing ? Promise.resolve({ rows: [], total: 0, page, pageSize: 30 }) : listLedger({ variantId, action, page, pageSize: 30 }),
      prisma.productVariant.findMany({ orderBy: [{ product: { name: 'asc' } }, { position: 'asc' }], select: { id: true, name: true, sku: true, product: { select: { name: true } } } }),
    ]);
    const pages = Math.max(Math.ceil(ledger.total / ledger.pageSize), 1);
    const filtered = !!(variantId || action || sku);
    return (
      <div>
        <PageHeader title="Inventory" subtitle="Every stock movement is recorded in an append-only ledger that cannot be edited or deleted." />
        {tabs}
        <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto] lg:items-end">
          <input type="hidden" name="tab" value="history" />
          <div><label className="label" htmlFor="variantId">Product / variant</label>
            <select id="variantId" name="variantId" defaultValue={searchParams.variantId ?? ''} className="input"><option value="">All variants</option>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.product.name} - {v.name} ({v.sku})</option>)}</select></div>
          <div><label className="label" htmlFor="sku">Or find by SKU</label><input id="sku" name="sku" defaultValue={sku ?? ''} className="input font-mono uppercase" placeholder="SKU" /></div>
          <div><label className="label" htmlFor="action">Action</label>
            <select id="action" name="action" defaultValue={action ?? ''} className="input"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{statusLabel(a)}</option>)}</select></div>
          <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button>{filtered && <Link href="/admin/inventory?tab=history" className="btn-ghost btn-sm">Clear</Link>}</div>
        </form>
        {skuMissing ? <EmptyState title="No variant with that SKU" text={`Check the spelling of "${sku}" or pick a variant from the list.`} />
          : ledger.rows.length === 0 ? <EmptyState title={filtered ? 'No movements match your filters' : 'No stock movements yet'} text="Movements appear here when stock is received, adjusted, sold or returned." />
          : (
            <div className="table-wrap">
              <table className="tbl min-w-[1000px]">
                <thead><tr><th>Date</th><th>Product</th><th>Action</th><th className="text-right">Quantity</th><th className="text-right">Previous</th><th className="text-right">New</th><th>Reason</th><th>Admin</th><th>Order</th></tr></thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</td>
                      <td><div className="font-semibold">{r.product}</div><div className="text-xs text-mute">{r.variant} &middot; <span className="font-mono">{r.sku}</span> &middot; {r.location}</div></td>
                      <td><span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider">{statusLabel(r.action)}</span></td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {r.quantity !== 0 || r.reservedDelta === 0
                          ? <span className={`font-semibold ${r.quantity > 0 ? 'text-emerald-700' : r.quantity < 0 ? 'text-red-600' : 'text-mute'}`}>{r.quantity > 0 ? '+' : ''}{r.quantity}</span>
                          : <span className="text-xs text-mute">{r.reservedDelta > 0 ? '+' : ''}{r.reservedDelta} reserved</span>}
                      </td>
                      <td className="text-right tabular-nums">{r.previousOnHand}</td>
                      <td className="text-right font-semibold tabular-nums">{r.newOnHand}</td>
                      <td className="max-w-[240px] text-mute">{r.reason ?? '-'}</td>
                      <td className="whitespace-nowrap">{r.user ?? <span className="text-mute">System</span>}</td>
                      <td className="whitespace-nowrap">{r.orderNumber ? <Link className="font-semibold underline" href={`/admin/orders?q=${encodeURIComponent(r.orderNumber)}`}>#{r.orderNumber}</Link> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <Pagination page={page} pages={pages} total={ledger.total} base="/admin/inventory" params={{ tab: 'history', variantId: searchParams.variantId, sku, action }} />
        {canOversell && <OversellToggle initial={allowOversell} />}
      </div>
    );
  }

  const q = searchParams.q?.trim() || undefined;
  const status = searchParams.status === 'low' || searchParams.status === 'out' ? searchParams.status : undefined;
  const [inv, locations] = await Promise.all([
    listInventory({ q, status, page, pageSize: 25 }),
    prisma.location.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  const pages = Math.max(Math.ceil(inv.total / inv.pageSize), 1);
  const filtered = !!(q || status);
  return (
    <div>
      <PageHeader title="Inventory" subtitle="Track stock levels by variant and location, and record every change with a reason." />
      {tabs}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Units on hand" value={inv.totals.units.toLocaleString('en-PH')} />
        <StatCard label="Inventory value (at cost)" value={peso(inv.totals.valueCentavos)} />
        <StatCard label="Low stock" value={inv.totals.low} tone={inv.totals.low ? 'warn' : undefined} hint="At or below alert level" />
        <StatCard label="Out of stock" value={inv.totals.out} tone={inv.totals.out ? 'bad' : undefined} hint="Nothing available" />
      </div>
      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={q ?? ''} className="input" placeholder="Product, variant, SKU or barcode" /></div>
        <div><label className="label" htmlFor="status">Stock level</label>
          <select id="status" name="status" defaultValue={status ?? ''} className="input"><option value="">All</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button>{filtered && <Link href="/admin/inventory" className="btn-ghost btn-sm">Clear</Link>}</div>
      </form>
      {inv.rows.length === 0 ? <EmptyState title={filtered ? 'No inventory matches your filters' : 'No inventory yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Add products with variants to start tracking stock.'} />
        : (
          <div className="table-wrap">
            <table className="tbl min-w-[1200px]">
              <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Location</th><th className="text-right">On hand</th><th className="text-right">Reserved</th><th className="text-right">Available</th><th className="text-right">Alert at</th><th className="text-right">Sold</th><th className="text-right">Received</th><th className="text-right">Value</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {inv.rows.map((r) => (
                  <tr key={`${r.variantId}-${r.locationId}`}>
                    <td className="max-w-[220px] font-semibold"><Link href={`/admin/products/${r.productId}`} className="hover:text-gold-deep">{r.product}</Link></td>
                    <td>{r.variant}</td>
                    <td className="font-mono text-xs">{r.sku}</td>
                    <td className="whitespace-nowrap">{r.location}</td>
                    <td className="text-right font-semibold tabular-nums">{r.onHand}</td>
                    <td className="text-right tabular-nums">{r.reserved}</td>
                    <td className="text-right tabular-nums">{r.available}</td>
                    <td className="text-right tabular-nums text-mute">{r.threshold}</td>
                    <td className="text-right tabular-nums">{r.unitsSold}</td>
                    <td className="text-right tabular-nums">{r.unitsReceived}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{peso(r.valueCentavos)}</td>
                    <td><Badge status={r.status} label={r.status === 'OK' ? 'OK' : r.status === 'LOW' ? 'Low' : 'Out'} /></td>
                    <td><InventoryActions row={{ variantId: r.variantId, locationId: r.locationId, location: r.location, product: r.product, variant: r.variant, sku: r.sku, onHand: r.onHand, reserved: r.reserved }} locations={locations} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <Pagination page={inv.page} pages={pages} total={inv.total} base="/admin/inventory" params={{ q, status }} />
      {canOversell && <OversellToggle initial={allowOversell} />}
    </div>
  );
}

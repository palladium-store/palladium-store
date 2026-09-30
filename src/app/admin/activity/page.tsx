import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { guard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { EmptyState, Pagination, statusLabel } from '@/components/ui/bits';
import { PageHeader, one, type SP } from '@/components/admin/parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity log' };
const SIZE = 30;

export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  await guard('VIEW_AUDIT');
  const q = one(searchParams.q)?.trim();
  const entity = one(searchParams.entity);
  const page = Math.max(parseInt(one(searchParams.page) ?? '1', 10) || 1, 1);
  const where: Prisma.AdminActivityLogWhereInput = {
    ...(entity ? { entity } : {}),
    ...(q ? { OR: [{ summary: { contains: q, mode: 'insensitive' } }, { userName: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total, entities] = await Promise.all([
    prisma.adminActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * SIZE, take: SIZE }),
    prisma.adminActivityLog.count({ where }),
    prisma.adminActivityLog.groupBy({ by: ['entity'], orderBy: { entity: 'asc' } }),
  ]);
  const pages = Math.max(Math.ceil(total / SIZE), 1);
  const filtered = !!(q || entity);

  return (
    <div>
      <PageHeader title="Activity log" subtitle="A record of every change made by staff. Times are Asia/Manila." />
      <form method="get" action="/admin/activity" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
        <div><label className="label" htmlFor="a-q">Search</label><input id="a-q" className="input" type="search" name="q" defaultValue={q} placeholder="Admin name or text in the summary" /></div>
        <div><label className="label" htmlFor="a-entity">Entity</label>
          <select id="a-entity" className="input" name="entity" defaultValue={entity ?? ''}><option value="">All entities</option>{entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}</select></div>
        <div className="flex items-end gap-2"><button className="btn-primary btn-sm !py-2.5" type="submit">Apply</button>{filtered && <Link className="btn-ghost btn-sm !py-2.5" href="/admin/activity">Clear</Link>}</div>
      </form>

      {rows.length === 0 ? <EmptyState title={filtered ? 'No activity matches these filters' : 'No activity recorded yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Staff actions such as order updates and stock changes will be listed here.'} /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Date and time</th><th>Admin</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-mute">{fmtDateTime(r.createdAt)}</td>
              <td className="whitespace-nowrap font-medium">{r.userName}</td>
              <td className="whitespace-nowrap">{statusLabel(r.action)}</td>
              <td className="whitespace-nowrap text-mute">{r.entity}</td>
              <td className="min-w-[260px]">{r.summary}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      <Pagination page={Math.min(page, pages)} pages={pages} total={total} base="/admin/activity" params={{ q, entity }} />
    </div>
  );
}

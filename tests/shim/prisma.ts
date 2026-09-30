// Test shim for @prisma/client: runs $queryRaw / $executeRaw against a local PostgreSQL through psql.
// Lets the raw-SQL parts of the app (seed, catalog, inventory, reports) be tested without installing Prisma.
import { spawnSync } from 'node:child_process';

export class Sql { constructor(public strings: readonly string[], public values: unknown[]) {} }
const sql = (strings: TemplateStringsArray | readonly string[], ...values: unknown[]) => new Sql(strings, values);
export const Prisma = {
  sql, empty: new Sql([''], []),
  join: (parts: Sql[], sep = ',') => new Sql(['', ...Array(Math.max(parts.length - 1, 0)).fill(sep), ''], parts),
  Sql,
};
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Sql) return render(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return `'${v.toISOString()}'::timestamp`;
  if (Array.isArray(v)) return v.length ? `ARRAY[${v.map(lit).join(',')}]::text[]` : 'ARRAY[]::text[]';
  return `'${String(v).replace(/'/g, "''")}'`;
};
function render(s: Sql): string { return s.strings.reduce((a, str, i) => a + str + (i < s.values.length ? lit(s.values[i]) : ''), ''); }
function psql(q: string): string {
  const r = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', process.env.TEST_DB ?? 'palladium_seed', '-c', q], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { const err = new Error(r.stderr) as Error & { meta?: { message: string } }; err.meta = { message: r.stderr }; throw err; }
  return r.stdout.trim();
}
const toSql = (a: TemplateStringsArray | Sql, vals: unknown[]) => (a instanceof Sql ? a : sql(a, ...vals));
export class PrismaClient {
  async $queryRaw<T = unknown>(a: TemplateStringsArray | Sql, ...vals: unknown[]): Promise<T> {
    const out = psql(`SELECT COALESCE(json_agg(t),'[]'::json) FROM (${render(toSql(a, vals))}) t`);
    return JSON.parse(out || '[]') as T;
  }
  async $executeRaw(a: TemplateStringsArray | Sql, ...vals: unknown[]): Promise<number> { psql(render(toSql(a, vals))); return 1; }
  async $disconnect() {}
}

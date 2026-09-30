'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { peso } from '@/lib/money';

const INK = '#0b0b0c', GOLD = '#e6b422', GRID = '#e4e2dc', MUTE = '#6b6b70', GREY = '#b8b6ae';

const compact = (centavos: number) => {
  const p = centavos / 100;
  if (p >= 1_000_000) return `₱${+(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1000) return `₱${+(p / 1000).toFixed(1)}k`;
  return `₱${Math.round(p)}`;
};
const trunc = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface SalesPoint { label: string; salesCentavos: number; orders: number }

function SalesTip({ active, payload }: { active?: boolean; payload?: { payload: SalesPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{p.label}</div>
      <div className="mt-1">Sales: <b>{peso(p.salesCentavos)}</b></div>
      <div>Orders: <b>{p.orders}</b></div>
    </div>
  );
}

function Empty({ text, height }: { text: string; height: number }) {
  return <div className="flex items-center justify-center border border-dashed border-line bg-bone/50 text-sm text-mute" style={{ height }}>{text}</div>;
}

/** Sales over time (net sales including shipping, in pesos). */
export function SalesChart({ data, height = 300 }: { data: SalesPoint[]; height?: number }) {
  if (!data.some((d) => d.salesCentavos > 0 || d.orders > 0)) return <Empty text="No sales in this date range yet." height={height} />;
  return (
    <div style={{ height }} role="img" aria-label="Sales over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact(Number(v))} allowDecimals={false} />
          <Tooltip content={<SalesTip />} cursor={{ stroke: INK, strokeWidth: 1 }} />
          <Area type="monotone" dataKey="salesCentavos" name="Sales" stroke={INK} strokeWidth={2} fill="url(#salesFill)" activeDot={{ r: 4, fill: GOLD, stroke: INK }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BarDatum { name: string; value: number }

/** Horizontal bars. `format` picks how values are shown, because functions cannot cross the server/client boundary. */
export function BarsChart({ data, format, unit = '', label, emptyText = 'No data for this range.', accent = 'gold' }: {
  data: BarDatum[]; format: 'peso' | 'number'; unit?: string; label: string; emptyText?: string; accent?: 'gold' | 'ink';
}) {
  const height = Math.max(200, data.length * 40 + 30);
  if (!data.length || !data.some((d) => d.value > 0)) return <Empty text={emptyText} height={200} />;
  const fmt = (v: number) => (format === 'peso' ? peso(v) : `${Math.round(v).toLocaleString('en-PH')}${unit ? ` ${unit}` : ''}`);
  const fill = accent === 'gold' ? GOLD : INK;
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} tickFormatter={(v) => (format === 'peso' ? compact(Number(v)) : String(v))} />
          <YAxis type="category" dataKey="name" width={118} tick={{ fill: INK, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => trunc(String(v))} interval={0} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v) => [fmt(Number(v)), label]} contentStyle={{ border: `1px solid ${GRID}`, borderRadius: 0, fontSize: 12 }} />
          <Bar dataKey="value" name={label} maxBarSize={22}>
            {data.map((d, i) => <Cell key={`${d.name}-${i}`} fill={i === 0 ? fill : accent === 'gold' ? '#f0cf6b' : GREY} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

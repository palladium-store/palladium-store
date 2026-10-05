'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { peso } from '@/lib/money';
import { useAdminTheme } from './theme';

// Chart colours for each admin theme: the paddle's red as the accent. Recharts draws SVG with plain colour values, so they live here.
const PALETTES = {
  dark: { INK: '#f4f1ed', ACCENT: '#ff5a4e', ACCENT_DEEP: '#dc211b', GRID: 'rgba(244,241,237,0.09)', MUTE: '#a8a19e', GREY: '#5c5558', PANEL: '#151215', BORDER: 'rgba(244,241,237,0.14)', HOVER: 'rgba(255,255,255,0.04)', SOFT: 'rgba(255,90,78,0.45)' },
  light: { INK: '#171314', ACCENT: '#dc211b', ACCENT_DEEP: '#b81a14', GRID: 'rgba(23,19,20,0.09)', MUTE: '#696262', GREY: '#bdb4b4', PANEL: '#ffffff', BORDER: 'rgba(23,19,20,0.14)', HOVER: 'rgba(23,19,20,0.04)', SOFT: 'rgba(220,33,27,0.32)' },
};
const usePalette = () => PALETTES[useAdminTheme().theme];

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
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-lg">
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
  const { INK, ACCENT, GRID, MUTE } = usePalette();
  if (!data.some((d) => d.salesCentavos > 0 || d.orders > 0)) return <Empty text="No sales in this date range yet." height={height} />;
  return (
    <div style={{ height }} role="img" aria-label="Sales over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact(Number(v))} allowDecimals={false} />
          <Tooltip content={<SalesTip />} cursor={{ stroke: MUTE, strokeWidth: 1 }} />
          <Area type="monotone" dataKey="salesCentavos" name="Sales" stroke={ACCENT} strokeWidth={2} fill="url(#salesFill)" activeDot={{ r: 4, fill: ACCENT, stroke: INK }} />
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
  const { INK, ACCENT_DEEP, GRID, MUTE, GREY, PANEL, BORDER, HOVER, SOFT } = usePalette();
  const height = Math.max(200, data.length * 40 + 30);
  if (!data.length || !data.some((d) => d.value > 0)) return <Empty text={emptyText} height={200} />;
  const fmt = (v: number) => (format === 'peso' ? peso(v) : `${Math.round(v).toLocaleString('en-PH')}${unit ? ` ${unit}` : ''}`);
  const fill = accent === 'gold' ? ACCENT_DEEP : INK;
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: MUTE, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} tickFormatter={(v) => (format === 'peso' ? compact(Number(v)) : String(v))} />
          <YAxis type="category" dataKey="name" width={118} tick={{ fill: INK, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => trunc(String(v))} interval={0} />
          <Tooltip cursor={{ fill: HOVER }} formatter={(v) => [fmt(Number(v)), label]} contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12, color: INK }} labelStyle={{ color: INK }} itemStyle={{ color: INK }} />
          <Bar dataKey="value" name={label} maxBarSize={22} radius={[0, 6, 6, 0]}>
            {data.map((d, i) => <Cell key={`${d.name}-${i}`} fill={i === 0 ? fill : accent === 'gold' ? SOFT : GREY} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

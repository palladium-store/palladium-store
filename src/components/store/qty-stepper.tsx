'use client';
export function QtyStepper({ value, min = 1, max, onChange, disabled, label = 'Quantity' }: { value: number; min?: number; max: number; onChange: (n: number) => void; disabled?: boolean; label?: string }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const btn = 'flex h-10 w-10 items-center justify-center text-lg transition hover:bg-bone disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <div className="inline-flex items-center border border-line bg-white" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={dec} disabled={disabled || value <= min} aria-label={`Decrease ${label.toLowerCase()}`}>&minus;</button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={inc} disabled={disabled || value >= max} aria-label={`Increase ${label.toLowerCase()}`}>+</button>
    </div>
  );
}

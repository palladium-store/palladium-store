export function Stars({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span className={`relative inline-block whitespace-nowrap leading-none ${className}`} style={{ fontSize: size }} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="text-line" aria-hidden="true">★★★★★</span>
      <span className="absolute inset-y-0 left-0 overflow-hidden text-gold" style={{ width: `${pct}%` }} aria-hidden="true">★★★★★</span>
    </span>
  );
}

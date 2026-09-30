export function Logo({ light = false, className = 'text-2xl' }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-start font-display leading-none tracking-tightest ${light ? 'text-white' : 'text-ink'} ${className}`}>
      palladium<sup className="ml-0.5 text-[0.55em] leading-none text-gold">x</sup>
    </span>
  );
}

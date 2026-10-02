/** Palladium wordmark. `light` is for dark backgrounds (white lettering); the default is for light backgrounds (black lettering). The X stays red on both. */
export function Logo({ light = false, className = 'h-7' }: { light?: boolean; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={light ? '/brand/logo-light.webp' : '/brand/logo-dark.webp'} alt="Palladium" width={720} height={163} className={`w-auto ${className}`} />;
}

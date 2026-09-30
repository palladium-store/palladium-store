import Image from 'next/image';

/** Fills its (relative, sized) parent. Local /uploads files skip the optimizer. */
export function Img({ src, alt, sizes = '100vw', className = '', priority }: { src: string | null | undefined; alt: string; sizes?: string; className?: string; priority?: boolean }) {
  const s = src || '/products/xmark.webp';
  return <Image src={s} alt={alt} fill sizes={sizes} priority={priority} unoptimized={s.startsWith('/uploads')} className={className} />;
}

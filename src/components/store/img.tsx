import Image from 'next/image';

/** Fills its (relative, sized) parent. Supabase public files go through the Next image optimizer (resized and cached); local /uploads and other remote files skip it. */
export function Img({ src, alt, sizes = '100vw', className = '', priority }: { src: string | null | undefined; alt: string; sizes?: string; className?: string; priority?: boolean }) {
  if (!src) {
    return (
      <div role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center bg-[#f4f4f4] text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
        Photo coming soon
      </div>
    );
  }
  const s = src;
  return <Image src={s} alt={alt} fill sizes={sizes} priority={priority} unoptimized={s.startsWith('/uploads') || (s.startsWith('http') && !/^https:\/\/[^/]*\.supabase\.co\/storage\/v1\/object\/public\//.test(s))} className={className} />;
}

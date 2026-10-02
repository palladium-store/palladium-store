/** Browser-side image optimisation for admin uploads. Resizes large photos and re-encodes them as WebP so they upload fast,
 *  stay under the host's request-size limit (about 4.5 MB on Vercel) and load quickly in the store. Never throws: on any
 *  problem the original file is returned unchanged. */
const MAX_SIDE = 2400;
const TARGET_BYTES = 3.5 * 1024 * 1024;
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', q));

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.includes(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    let scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    let best: Blob | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      best = await toBlob(canvas, 0.88);
      if (best && best.size <= TARGET_BYTES) break;
      scale *= 0.8; // still too big: shrink and try again
    }
    bmp.close?.();
    if (!best) return file;
    // Keep the original when it is already small and re-encoding did not help.
    if (file.size <= TARGET_BYTES && best.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([best], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  }
}

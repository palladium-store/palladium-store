import 'server-only';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppError } from './errors';

const DIR = () => path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const TYPES: Record<string, { ext: string; max: number; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', max: 8e6, kind: 'image' }, 'image/png': { ext: 'png', max: 8e6, kind: 'image' },
  'image/webp': { ext: 'webp', max: 8e6, kind: 'image' }, 'image/avif': { ext: 'avif', max: 8e6, kind: 'image' },
  'video/mp4': { ext: 'mp4', max: 40e6, kind: 'video' }, 'video/webm': { ext: 'webm', max: 40e6, kind: 'video' },
};
export const CONTENT_TYPES: Record<string, string> = Object.fromEntries(Object.entries(TYPES).map(([mime, v]) => [v.ext, mime]));

/** Storage driver. Local disk today; swap this file for S3/R2/Cloudinary and keep the same return shape. */
export async function saveUpload(file: File): Promise<{ url: string; kind: 'image' | 'video' }> {
  const t = TYPES[file.type];
  if (!t) throw new AppError(422, 'BAD_FILE', 'Upload a JPG, PNG, WebP, AVIF, MP4 or WebM file.');
  if (file.size > t.max) throw new AppError(422, 'FILE_TOO_LARGE', `File is too large (max ${Math.round(t.max / 1e6)} MB).`);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${t.ext}`;
  await mkdir(DIR(), { recursive: true });
  await writeFile(path.join(DIR(), name), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/${name}`, kind: t.kind };
}
export async function readUpload(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!/^[\w.-]+$/.test(name)) return null;
  try { return { data: await readFile(path.join(DIR(), name)), type: CONTENT_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream' }; } catch { return null; }
}

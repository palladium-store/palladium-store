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

const SB_URL = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SB_BUCKET = () => process.env.SUPABASE_BUCKET ?? 'palladium';
const useSupabase = () => Boolean(SB_URL() && SB_KEY());

/**
 * Storage driver. Uses Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
 * (required on serverless hosts such as Vercel), otherwise the local disk (UPLOAD_DIR).
 * The bucket must exist and be PUBLIC. Returns the same shape either way.
 */
export async function saveUpload(file: File): Promise<{ url: string; kind: 'image' | 'video' }> {
  const t = TYPES[file.type];
  if (!t) throw new AppError(422, 'BAD_FILE', 'Upload a JPG, PNG, WebP, AVIF, MP4 or WebM file.');
  if (file.size > t.max) throw new AppError(422, 'FILE_TOO_LARGE', `File is too large (max ${Math.round(t.max / 1e6)} MB).`);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${t.ext}`;
  if (useSupabase()) {
    const res = await fetch(`${SB_URL()}/storage/v1/object/${SB_BUCKET()}/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(), 'content-type': file.type, 'cache-control': '31536000' },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!res.ok) throw new AppError(502, 'STORAGE_FAILED', `Image storage rejected the upload (${res.status}). Check the Supabase bucket and keys.`);
    return { url: `${SB_URL()}/storage/v1/object/public/${SB_BUCKET()}/${name}`, kind: t.kind };
  }
  if (process.env.VERCEL) throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'Image storage is not set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.');
  try {
    await mkdir(DIR(), { recursive: true });
    await writeFile(path.join(DIR(), name), Buffer.from(await file.arrayBuffer()));
  } catch {
    throw new AppError(500, 'STORAGE_FAILED', 'Could not save the file on the server.');
  }
  return { url: `/uploads/${name}`, kind: t.kind };
}
export async function readUpload(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!/^[\w.-]+$/.test(name)) return null;
  try { return { data: await readFile(path.join(DIR(), name)), type: CONTENT_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream' }; } catch { return null; }
}

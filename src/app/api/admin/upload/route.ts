import { adminRoute, ok } from '@/lib/api';
import { saveUpload } from '@/lib/storage';
import { AppError } from '@/lib/errors';

export const POST = adminRoute('MANAGE_PRODUCTS', async (req) => {
  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) throw new AppError(422, 'NO_FILE', 'Choose a file to upload.');
  const out = [];
  for (const f of files.slice(0, 10)) out.push(await saveUpload(f));
  return ok({ files: out }, 201);
});

import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { categorySchema, resolveCategory } from '@/lib/categories';

export const POST = adminRoute('MANAGE_PRODUCTS', async (req, _c, user) => {
  const data = await resolveCategory(categorySchema.parse(await readJson(req)));
  const created = await prisma.category.create({ data });
  await audit(user, 'CATEGORY_CREATED', 'Category', created.id, `Created category ${created.name}`);
  return ok({ id: created.id }, 201);
});

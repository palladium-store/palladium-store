import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { categorySchema, resolveCategory } from '@/lib/categories';

export const PUT = adminRoute('MANAGE_PRODUCTS', async (req, ctx: { params: { id: string } }, user) => {
  await prisma.category.findUniqueOrThrow({ where: { id: ctx.params.id } });
  const data = await resolveCategory(categorySchema.parse(await readJson(req)), ctx.params.id);
  await prisma.category.update({ where: { id: ctx.params.id }, data });
  await audit(user, 'CATEGORY_UPDATED', 'Category', ctx.params.id, `Updated category ${data.name}`);
  return ok();
});

/** A category that still holds products or sub-categories cannot be deleted, so nothing is ever orphaned. */
export const DELETE = adminRoute('MANAGE_PRODUCTS', async (_req, ctx: { params: { id: string } }, user) => {
  const c = await prisma.category.findUniqueOrThrow({ where: { id: ctx.params.id } });
  const [products, children] = await Promise.all([prisma.product.count({ where: { categoryId: c.id } }), prisma.category.count({ where: { parentId: c.id } })]);
  if (products) throw new AppError(409, 'IN_USE', `${c.name} still has ${products} product${products === 1 ? '' : 's'}. Move them to another category first.`);
  if (children) throw new AppError(409, 'IN_USE', `${c.name} has ${children} sub-categor${children === 1 ? 'y' : 'ies'}. Move or delete those first.`);
  await prisma.category.delete({ where: { id: c.id } });
  await audit(user, 'CATEGORY_DELETED', 'Category', c.id, `Deleted category ${c.name}`);
  return ok();
});

import { z } from 'zod';
import { prisma } from './db';
import { AppError } from './errors';
import { slugify } from './products';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(60, 'Use 60 characters or fewer.'),
  slug: z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes.').optional().or(z.literal('')),
  parentId: z.string().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** Resolves the slug (auto from the name when blank) and checks it is unique. */
export async function resolveCategory(input: CategoryInput, selfId?: string) {
  const slug = input.slug ? input.slug : slugify(input.name).replace(/^product$/, 'category');
  const clash = await prisma.category.findFirst({ where: { slug, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (clash) throw new AppError(409, 'DUPLICATE', 'A category with that URL already exists.', { slug: 'Already in use. Choose a different URL.' });
  const nameClash = await prisma.category.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' }, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (nameClash) throw new AppError(409, 'DUPLICATE', 'A category with that name already exists.', { name: 'Already in use.' });
  const parentId = input.parentId || null;
  if (parentId) {
    if (parentId === selfId) throw new AppError(422, 'VALIDATION', 'A category cannot be its own parent.', { parentId: 'Choose a different parent.' });
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
    if (!parent) throw new AppError(422, 'VALIDATION', 'That parent category no longer exists.', { parentId: 'Choose a different parent.' });
    // One level only: the parent must be top-level, and a category that already has sub-categories cannot itself be nested.
    if (selfId && (await prisma.category.count({ where: { parentId: selfId } })) > 0) throw new AppError(422, 'VALIDATION', 'This category has sub-categories, so it must stay top-level.', { parentId: 'Remove its sub-categories first.' });
    if (parent.parentId) throw new AppError(422, 'VALIDATION', 'Categories can only be nested one level deep.', { parentId: 'Choose a top-level category.' });
  }
  return { name: input.name, slug, parentId, sortOrder: input.sortOrder };
}

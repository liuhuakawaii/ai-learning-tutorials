import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { generateSlug } from '../../utils/slug';

export class CategoryService {
  async list() {
    return prisma.category.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(name: string, description?: string) {
    const slug = generateSlug(name);
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) throw AppError.conflict('分类已存在');

    return prisma.category.create({
      data: { name, slug, description },
    });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw AppError.notFound('分类不存在');

    const updateData: any = { ...data };
    if (data.name) {
      updateData.slug = generateSlug(data.name);
    }

    return prisma.category.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!category) throw AppError.notFound('分类不存在');
    if (category._count.posts > 0) {
      throw AppError.badRequest('该分类下还有文章，无法删除');
    }

    await prisma.category.delete({ where: { id } });
  }
}

export const categoryService = new CategoryService();

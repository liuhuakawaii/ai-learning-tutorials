import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { generateSlug } from '../../utils/slug';

export class TagService {
  async list() {
    return prisma.tag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async popular(limit = 10) {
    return prisma.tag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { posts: { _count: 'desc' } },
      take: limit,
    });
  }

  async create(name: string) {
    const slug = generateSlug(name);
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) throw AppError.conflict('标签已存在');

    return prisma.tag.create({ data: { name, slug } });
  }

  async delete(id: string) {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) throw AppError.notFound('标签不存在');

    await prisma.tag.delete({ where: { id } });
  }
}

export const tagService = new TagService();

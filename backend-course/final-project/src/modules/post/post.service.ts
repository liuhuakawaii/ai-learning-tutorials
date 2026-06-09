import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { generateUniqueSlug } from '../../utils/slug';

type PostStatus = 'DRAFT' | 'PUBLISHED';

export class PostService {
  async list(options: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    tagId?: string;
    status?: PostStatus;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    const { page, limit, search, categoryId, tagId, status, sortBy, order } = options;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : { status: 'PUBLISHED' as const }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { content: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(tagId ? { tags: { some: { id: tagId } } } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          status: true,
          viewCount: true,
          createdAt: true,
          publishedAt: true,
          author: {
            select: { id: true, username: true, avatar: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
          tags: { select: { id: true, name: true, slug: true } },
          _count: { select: { comments: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: order || 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    return { posts, total };
  }

  async getBySlug(slug: string) {
    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, username: true, avatar: true, bio: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
        comments: {
          where: { parentId: null }, // 只获取顶级评论
          include: {
            author: { select: { id: true, username: true, avatar: true } },
            replies: {
              include: { author: { select: { id: true, username: true, avatar: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!post) throw AppError.notFound('文章不存在');

    // 增加阅读量（异步，不阻塞响应）
    prisma.post.update({ where: { slug }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    return post;
  }

  async create(authorId: string, data: {
    title: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
    categoryId?: string;
    tags?: string[];
  }) {
    const slug = generateUniqueSlug(data.title);

    const post = await prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        slug,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        authorId,
        categoryId: data.categoryId,
        tags: data.tags ? { connect: data.tags.map((id) => ({ id })) } : undefined,
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

    return post;
  }

  async update(id: string, userId: string, userRole: string, data: {
    title?: string;
    content?: string;
    excerpt?: string;
    coverImage?: string;
    categoryId?: string | null;
    tags?: string[];
  }) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('文章不存在');

    // 检查权限：只有作者和管理员可以修改
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw AppError.forbidden('无权修改此文章');
    }

    return prisma.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined
          ? { title: data.title, slug: generateUniqueSlug(data.title) }
          : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
        ...(data.categoryId !== undefined
          ? {
              category: data.categoryId
                ? { connect: { id: data.categoryId } }
                : { disconnect: true },
            }
          : {}),
        ...(data.tags !== undefined
          ? { tags: { set: data.tags.map((tagId) => ({ id: tagId })) } }
          : {}),
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async publish(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('文章不存在');
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw AppError.forbidden('无权操作此文章');
    }

    return prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('文章不存在');
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw AppError.forbidden('无权删除此文章');
    }

    await prisma.post.delete({ where: { id } });
  }
}

export const postService = new PostService();

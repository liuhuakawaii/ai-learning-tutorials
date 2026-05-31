import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { generateSlug, generateUniqueSlug } from '../../utils/slug';
import { Prisma, PostStatus } from '@prisma/client';

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

    const where: Prisma.PostWhereInput = {};

    // 默认只显示已发布的文章（非管理员）
    if (status) {
      where.status = status;
    } else {
      where.status = 'PUBLISHED';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tagId) {
      where.tags = { some: { id: tagId } };
    }

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

    const updateData: Prisma.PostUpdateInput = {};
    if (data.title !== undefined) {
      updateData.title = data.title;
      updateData.slug = generateUniqueSlug(data.title);
    }
    if (data.content !== undefined) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.categoryId !== undefined) {
      updateData.category = data.categoryId
        ? { connect: { id: data.categoryId } }
        : { disconnect: true };
    }
    if (data.tags !== undefined) {
      updateData.tags = { set: data.tags.map((id) => ({ id })) };
    }

    return prisma.post.update({
      where: { id },
      data: updateData,
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

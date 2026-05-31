import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';

export class CommentService {
  async listByPost(postId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId, parentId: null }, // 只获取顶级评论
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          replies: {
            include: {
              author: { select: { id: true, username: true, avatar: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comment.count({ where: { postId, parentId: null } }),
    ]);

    return { comments, total };
  }

  async create(postId: string, authorId: string, content: string, parentId?: string) {
    // 验证文章存在
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound('文章不存在');

    // 如果是回复，验证父评论存在且属于同一文章
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== postId) {
        throw AppError.badRequest('父评论不存在');
      }
    }

    return prisma.comment.create({
      data: { content, authorId, postId, parentId },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async update(id: string, userId: string, content: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw AppError.notFound('评论不存在');
    if (comment.authorId !== userId) throw AppError.forbidden('无权修改此评论');

    return prisma.comment.update({
      where: { id },
      data: { content },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw AppError.notFound('评论不存在');
    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw AppError.forbidden('无权删除此评论');
    }

    await prisma.comment.delete({ where: { id } });
  }
}

export const commentService = new CommentService();

import prisma from '../../lib/prisma';
import { AppError } from '../../utils/errors';

export class UserService {
  async list(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    });

    if (!user) throw AppError.notFound('用户不存在');
    return user;
  }

  async delete(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw AppError.notFound('用户不存在');

    await prisma.user.delete({ where: { id } });
  }
}

export const userService = new UserService();

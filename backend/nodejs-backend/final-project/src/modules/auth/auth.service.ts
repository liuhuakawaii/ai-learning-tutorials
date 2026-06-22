import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { config } from '../../config';
import { AppError } from '../../utils/errors';

const SALT_ROUNDS = 10;

export class AuthService {
  async register(email: string, username: string, password: string) {
    // 检查邮箱是否已注册
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw AppError.conflict('该邮箱已注册');
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw AppError.conflict('该用户名已被占用');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    // 生成 Token
    const token = this.generateToken(user.id, user.email, user.role);

    return { user, token };
  }

  async login(email: string, password: string) {
    // 查找用户
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw AppError.unauthorized('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('邮箱或密码错误');
    }

    // 生成 Token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

  async updateProfile(userId: string, data: { username?: string; bio?: string; avatar?: string }) {
    if (data.username) {
      const existing = await prisma.user.findFirst({
        where: { username: data.username, id: { not: userId } },
      });
      if (existing) throw AppError.conflict('该用户名已被占用');
    }

    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, username: true, avatar: true, bio: true, role: true },
    });
  }

  private generateToken(id: string, email: string, role: string): string {
    return jwt.sign({ id, email, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }
}

export const authService = new AuthService();

/**
 * 认证服务
 * 提供用户注册、登录、Token 刷新等核心认证能力
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getPrismaClient } from '../models/schema';

/** JWT 负载结构 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

/** 认证配置 */
interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
}

/**
 * 认证服务
 * 处理用户认证相关的所有业务逻辑
 */
export class AuthService {
  private prisma = getPrismaClient();
  private config: AuthConfig;

  constructor(config?: Partial<AuthConfig>) {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || 'lowcode-default-secret',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      bcryptRounds: 10,
      ...config,
    };
  }

  /**
   * 用户注册
   * @returns 创建的用户信息（不含密码）
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    tenantId?: string;
  }) {
    // 检查邮箱是否已被注册
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new Error('该邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(data.password, this.config.bcryptRounds);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        tenantId: data.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    // 生成 Token
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * 用户登录
   * 验证邮箱和密码，返回 Token
   */
  async login(email: string, password: string) {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error('邮箱或密码错误');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('邮箱或密码错误');
    }

    // 生成 Token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || undefined,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      token,
    };
  }

  /**
   * 刷新 Token
   * 使用旧 Token 换取新 Token，延长登录有效期
   */
  async refreshToken(oldToken: string) {
    const payload = this.verifyToken(oldToken);
    if (!payload) {
      throw new Error('Token 无效或已过期');
    }

    // 确认用户仍然存在且有效
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      throw new Error('用户不存在');
    }

    return this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || undefined,
    });
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.config.bcryptRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * 生成 JWT Token
   */
  private generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 验证 JWT Token
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.config.jwtSecret) as JwtPayload;
    } catch {
      return null;
    }
  }
}

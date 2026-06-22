/**
 * 认证中间件
 * 提供 JWT 验证和角色权限守卫
 */

import { type Request, type Response, type NextFunction } from 'express';
import { AuthService } from './service';

/** 扩展请求类型，附加用户信息 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    tenantId?: string;
  };
}

const authService = new AuthService();

/**
 * JWT 认证中间件
 * 从请求头的 Bearer Token 中解析用户信息
 * 不会拒绝未认证请求，仅解析 Token 并附加用户信息
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 未提供 Token，继续处理（部分接口允许匿名访问）
    return next();
  }

  const token = authHeader.substring(7);
  const payload = authService.verifyToken(token);

  if (payload) {
    req.user = payload;
  }

  next();
}

/**
 * 角色权限守卫
 * 要求用户必须具有指定角色才能访问
 * @param allowedRoles 允许的角色列表
 */
export function roleGuard(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '请先登录',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
      });
    }

    next();
  };
}

/**
 * 强制认证中间件
 * 要求请求必须携带有效的 Token
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '请先登录',
    });
  }
  next();
}

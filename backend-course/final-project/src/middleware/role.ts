import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * 角色权限中间件：检查用户角色是否在允许列表中
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized('请先登录');
    }

    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden('无权执行此操作');
    }

    next();
  };
}

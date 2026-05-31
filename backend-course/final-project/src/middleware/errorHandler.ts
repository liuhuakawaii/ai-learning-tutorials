import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../lib/logger';

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // AppError（已知业务错误）
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode);
  }

  // Prisma 错误
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    switch (prismaErr.code) {
      case 'P2002':
        return sendError(res, 'CONFLICT', '数据已存在（唯一约束冲突）', 409);
      case 'P2025':
        return sendError(res, 'NOT_FOUND', '记录不存在', 404);
      case 'P2003':
        return sendError(res, 'BAD_REQUEST', '关联数据不存在', 400);
      default:
        logger.error('Prisma error', { code: prismaErr.code, message: err.message });
        return sendError(res, 'DATABASE_ERROR', '数据库操作失败', 500);
    }
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, 'UNAUTHORIZED', 'Token 无效或已过期', 401);
  }

  // 未知错误
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return sendError(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}

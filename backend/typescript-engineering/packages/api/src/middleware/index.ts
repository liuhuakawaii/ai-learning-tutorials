import type { RequestContext } from '@ts-tool-platform/shared-types';
import { generateId } from '@ts-tool-platform/shared-types';

/** 中间件函数类型 */
export type Middleware = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

/**
 * 请求日志中间件
 * 记录请求进入和离开的时间，用于性能监控
 */
export const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`[${ctx.requestId}] 请求进入 at ${ctx.timestamp.toISOString()}`);
  await next();
  const duration = Date.now() - start;
  console.log(`[${ctx.requestId}] 请求完成，耗时 ${duration}ms`);
};

/**
 * 认证中间件
 * 验证请求上下文中是否包含用户信息
 * 生产环境应替换为 JWT 验证等真实认证逻辑
 */
export const authGuard: Middleware = async (ctx, next) => {
  if (!ctx.userId) {
    throw new Error('认证失败：缺少用户身份信息');
  }
  await next();
};

/**
 * 角色授权中间件
 * 验证用户是否具有指定角色
 */
export function requireRole(...roles: string[]): Middleware {
  return async (ctx, next) => {
    if (!ctx.userRole || !roles.includes(ctx.userRole)) {
      throw new Error(`权限不足：需要角色 ${roles.join(' 或 ')}`);
    }
    await next();
  };
}

/** 创建请求上下文 */
export function createContext(userId?: string, userRole?: string): RequestContext {
  return {
    userId,
    userRole,
    requestId: generateId(),
    timestamp: new Date(),
  };
}

/**
 * 中间件管道执行器
 * 按顺序执行中间件数组，支持洋葱模型
 */
export async function runMiddleware(middlewares: Middleware[], ctx: RequestContext): Promise<void> {
  let index = 0;
  const next = async (): Promise<void> => {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      await middleware(ctx, next);
    }
  };
  await next();
}

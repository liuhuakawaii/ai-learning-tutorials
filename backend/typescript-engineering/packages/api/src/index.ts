/**
 * @ts-tool-platform/api
 *
 * 平台 API 服务入口
 * 导出路由、数据库、中间件等模块
 */

export { db, InMemoryDB } from './db/index';
export { userRoutes, toolRoutes } from './routers/index';
export { requestLogger, authGuard, requireRole, createContext, runMiddleware } from './middleware/index';
export type { Middleware } from './middleware/index';

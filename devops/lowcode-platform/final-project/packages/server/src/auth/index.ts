/**
 * 认证与权限模块入口
 * 提供 JWT 认证、RBAC 权限模型和数据行级权限控制
 */

export { AuthService } from './service';
export { authMiddleware, roleGuard, type AuthRequest } from './middleware';
export { RBACManager, type Permission, type Role as RBACRole } from './rbac';

# 第二阶段：Auth & DB 报告

## 场景引入

第一阶段搭建了路由骨架，现在需要为应用注入"灵魂"——用户认证和数据持久化。你需要决定用什么方案管理登录状态（Session vs JWT）、数据库用什么 ORM、权限模型怎么设计、表单数据怎么校验。这些是 SaaS 产品的基础设施，设计得当后续开发事半功倍，设计不当则处处掣肘。

- 认证方案：iron-session + bcryptjs，Session 存储 userId/teamId
- 数据库：PostgreSQL + Prisma ORM，8 个模型（User/Team/TeamMember/Project/Document/AuditLog/Plan/Subscription）
- 权限模型：RBAC（owner/admin/member），11 个动作，`can()` 函数查询
- 服务端校验：Zod schema + `parseFormData` 工具函数，所有写操作均有校验
- Seed 数据：2 用户 + 1 团队 + 3 项目 + 3 套餐

## 常见误区

1. **Session 中存储过多信息**：Session Cookie 有大小限制（约 4KB），只存储 `userId` 和 `teamId`，其他信息（角色、权限）在需要时从数据库查询。

2. **密码用 MD5 或 SHA256 哈希**：这些算法太快，容易被暴力破解。必须使用 bcrypt（或 argon2），它内置盐值和慢哈希机制。

3. **Prisma schema 不加索引**：频繁查询的字段（如 `email`、`teamId`）必须加索引，否则数据量增长后查询会变慢。

4. **Zod 校验只在客户端做**：`parseFormData` 必须在 Server Action 中调用，客户端的 React Hook Form 只是体验优化。

## 工程建议

1. **Session 设置合理的过期时间**：iron-session 默认不过期，建议设置 `cookieOptions.maxAge` 为 7 天，过期后用户需要重新登录。

2. **Prisma 的 `@relation` 字段使用 `onDelete: Cascade`**：删除用户时自动清理关联的 TeamMember、Project 等数据，避免产生孤儿记录。

3. **权限函数 `can()` 支持组合条件**：`can(userId, 'project:delete', { teamId, projectId })` 同时检查团队角色和资源所有权。

4. **Seed 脚本用 `upsert` 代替 `create`**：确保重复运行不会产生重复数据，方便开发环境重置。

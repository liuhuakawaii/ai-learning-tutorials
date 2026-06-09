# Blog API — 博客平台后端

> 课程最终项目：一个架构完整、代码优雅的商业级博客平台 REST API

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 3. 启动数据库（Docker 方式）
docker-compose up -d postgres redis

# 4. 数据库迁移
pnpm prisma generate
pnpm prisma migrate dev --name init

# 5. 启动开发服务器
pnpm dev
```

访问：
- API: http://localhost:3000/api
- Swagger 文档: http://localhost:3000/api-docs
- 健康检查: http://localhost:3000/health

## Docker 一键部署

```bash
docker-compose up -d
```

## 本地验证

```bash
pnpm build

# Prisma 校验需要 DATABASE_URL，可先复制 .env.example 为 .env
pnpm prisma validate
```

## 课程阶段映射

| 阶段 | 对应项目能力 |
|------|--------------|
| 第一阶段 | Express 应用入口、路由、中间件、统一错误处理 |
| 第二阶段 | Prisma schema、迁移、CRUD、分页和关联查询 |
| 第三阶段 | JWT、RBAC、上传、Swagger、日志和 Docker |
| 第四阶段 | Redis、缓存、实时/异步能力和安全加固扩展点 |

## 验收建议

- `pnpm build` 通过
- `pnpm prisma validate` 通过
- `/health` 可访问
- Swagger 文档可打开
- 注册、登录、创建文章、评论、分类、标签核心链路可手工跑通

## 技术栈

Express + TypeScript + Prisma + PostgreSQL + Redis

## 项目结构

```
src/
├── config/          # 配置管理
├── lib/             # 基础设施（数据库、Redis、日志）
├── middleware/       # 中间件（认证、权限、验证、错误处理）
├── modules/         # 业务模块（按功能划分）
│   ├── auth/        # 认证模块
│   ├── user/        # 用户模块
│   ├── post/        # 文章模块
│   ├── category/    # 分类模块
│   ├── tag/         # 标签模块
│   └── comment/     # 评论模块
├── routes/          # 路由汇总
├── utils/           # 工具函数
└── app.ts           # 应用入口
```

## 架构说明

每个业务模块遵循四层架构：

```
模块/
├── *.schema.ts    # 验证层（Zod Schema）
├── *.controller.ts # 控制层（接收请求、返回响应）
├── *.service.ts    # 服务层（业务逻辑）
└── *.routes.ts     # 路由层（URL 映射）
```

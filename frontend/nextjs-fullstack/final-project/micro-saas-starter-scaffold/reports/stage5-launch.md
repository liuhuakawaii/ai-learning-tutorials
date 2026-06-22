# 第五阶段：部署报告

## 场景引入

项目开发完成，最后一个阶段是将应用部署到生产环境。你需要配置环境变量、执行数据库迁移、选择部署方式（Vercel 或 Docker）、设置监控和健康检查。部署不是"把代码传上去"这么简单——环境差异、迁移失败、配置遗漏都可能导致上线失败。

- 环境变量：`.env.example` 包含 DATABASE_URL 和 SESSION_SECRET
- 数据库迁移：`prisma db push`（开发）或 `prisma migrate dev`（生产）
- 构建命令：`npm run build` → `npm run start`
- Docker：可使用 `node:20-alpine` 基础镜像 + `npm run build` + `npm run start`
- 监控：可接入 Vercel Analytics 或自建健康检查端点

## 常见误区

1. **用 `prisma db push` 代替 `prisma migrate deploy`**：`db push` 不生成迁移文件，无法追踪历史，不适合生产环境。生产必须用 `migrate deploy`。

2. **环境变量只配了 DATABASE_URL 和 SESSION_SECRET**：还需要配置 `NEXT_PUBLIC_URL`、SMTP 配置（如果涉及邮件）、S3 配置（如果涉及文件上传）等。

3. **Docker 镜像用 `node:latest` 基础镜像**：`latest` 标签不保证版本一致性，且镜像体积大（约 900MB）。应该用 `node:20-alpine`（约 170MB）。

4. **没有健康检查端点**：负载均衡器和监控系统需要一个 `/api/health` 端点来判断服务是否正常，否则只能通过用户投诉发现问题。

## 工程建议

1. **使用 `.env.example` 作为环境变量文档**：列出所有必需变量（不含真实值），新成员和 CI/CD 环境参考此文件配置。

2. **构建命令集成迁移**：`"build": "prisma generate && prisma migrate deploy && next build"` 确保每次部署自动执行迁移。

3. **Docker 使用多阶段构建**：依赖阶段 → 构建阶段 → 运行阶段，最终镜像只包含 standalone 输出，体积控制在 200MB 以内。

4. **健康检查端点验证数据库连接**：`/api/health` 不要只返回 200，应该执行 `SELECT 1` 验证数据库连接，确保整个链路正常。

# Production Launch Kit

这是 Docker + CI/CD 课程的贯穿项目模板。它提供一个最小 API、Dockerfile、Compose、CI workflow、部署脚本、备份脚本和回滚脚本。

## 本地检查

```bash
npm run check
npm start
```

API：

- http://localhost:4190/health
- http://localhost:4190/version

## Docker

```bash
docker compose up --build
```

## 课程映射

- 第一阶段：理解 `Dockerfile.api`、`.dockerignore` 和非 root 用户。
- 第二阶段：理解 `docker-compose.yml` 的 service、network、volume 和 healthcheck。
- 第三阶段：理解 `.github/workflows/ci.yml` 的检查、构建和镜像步骤。
- 第四阶段：补域名、HTTPS、反向代理和数据库迁移。
- 第五阶段：完善健康检查、资源限制、监控、备份和回滚。

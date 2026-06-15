# 从零到一：Docker + CI/CD + 云部署实战课程

> 面向前端和全栈开发者的上线能力课：从 Docker 基础、Compose 编排、GitHub Actions，到日志、健康检查、回滚和生产部署。

## 适合谁

- 会写项目，但部署总靠平台默认配置或手工操作
- 想理解 Docker、镜像、容器、环境变量和 CI/CD
- 想把前端、后端、数据库、缓存稳定部署上线

## 学完能做什么

- 为 Node / Next.js / Python 项目写 Dockerfile
- 用 Docker Compose 编排应用、数据库、Redis
- 用 GitHub Actions 做测试、构建、发布
- 管理环境变量、日志、健康检查和回滚
- 把项目部署到 VPS、云平台或容器服务

## 技术栈

| 类别 | 技术 |
|------|------|
| 容器 | Docker |
| 编排 | Docker Compose |
| CI/CD | GitHub Actions |
| 反向代理 | Nginx / Caddy |
| 应用 | Node.js / Next.js / FastAPI |
| 数据 | PostgreSQL / Redis |
| 运维 | 日志、健康检查、备份、回滚 |

## 贯穿项目

本课程使用 `Production Launch Kit` 作为贯穿项目。仓库提供一个可检查的上线模板：

```bash
cd docker-cicd-course/final-project/production-launch-kit
npm run check
npm start
```

API：

- http://localhost:4190/health
- http://localhost:4190/version

如果本机有 Docker，可以继续运行：

```bash
docker compose up --build
```

它包含最小 API、Dockerfile、Compose、CI workflow、部署、备份和回滚脚本。

## 学习路线

### 第一阶段：Docker 基础

1. 为什么需要容器
2. 镜像、容器、仓库、卷、网络
3. Dockerfile 基础语法
4. 多阶段构建
5. .dockerignore 与构建上下文
6. 镜像体积和安全基础
7. 阶段实战：容器化一个 Node API

### 第二阶段：Compose 编排

1. docker-compose.yml 结构
2. service、network、volume
3. 应用 + PostgreSQL + Redis
4. 环境变量与 secrets 思路
5. 数据持久化和备份
6. healthcheck 与启动顺序
7. 阶段实战：本地生产模拟环境

### 第三阶段：CI/CD

1. CI/CD 是什么
2. GitHub Actions workflow
3. 安装依赖、lint、test、build
4. 构建 Docker 镜像
5. 推送镜像到 registry
6. 部署触发与回滚
7. 阶段实战：自动构建发布流水线

### 第四阶段：云部署

1. 部署选型：Vercel、Railway、VPS、容器服务
2. Nginx / Caddy 反向代理
3. HTTPS 与域名
4. 数据库迁移
5. 日志收集
6. 备份与恢复
7. 阶段实战：VPS 部署全栈项目

### 第五阶段：生产稳定性

1. 健康检查
2. 进程守护和重启策略
3. 资源限制：CPU、内存、磁盘
4. 灰度发布和回滚
5. 监控与告警
6. 安全基线：最小权限、密钥、依赖扫描
7. 阶段实战：生产发布 checklist

## 最终项目

**Production Launch Kit：全栈项目上线模板**

功能包括：

- 前端 + API + PostgreSQL + Redis
- Dockerfile 和 Compose
- GitHub Actions CI
- 自动部署脚本
- 健康检查、日志、备份、回滚文档

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 不要先学 Kubernetes，先把 Docker、Compose、CI/CD、部署闭环打牢。
2. 所有部署步骤都要脚本化，减少手工操作。
3. 每个项目都应该有启动、迁移、备份、回滚文档。

## 参考官方文档

- Dockerfile best practices：https://docs.docker.com/build/building/best-practices/
- Docker Compose：https://docs.docker.com/compose/
- GitHub Actions：https://docs.github.com/en/actions


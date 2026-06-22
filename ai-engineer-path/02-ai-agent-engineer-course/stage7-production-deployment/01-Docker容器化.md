# 01 Docker 容器化

> "在我机器上能跑"是开发最大的谎言——Docker 让所有机器都一样。

## 场景引入

你的 AI Agent 平台在本地开发环境跑得好好的，部署到服务器却报错：Python 版本不对、系统库缺失、环境变量没传。同事克隆代码后又遇到不同的问题，排查半天发现是操作系统差异导致的。容器化的核心价值就是把应用和它的运行环境打包成一个不可变的单元，确保从开发到生产每个环节行为一致。

## 学习目标

- 编写多阶段 Dockerfile 优化镜像大小
- 理解 Docker 安全最佳实践
- 实现前后端容器化

## 后端 Dockerfile

```dockerfile
# backend/Dockerfile
# 多阶段构建
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

# 只复制安装好的依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 非 root 用户运行
RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 前端 Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Docker 安全最佳实践

1. **用 slim/alpine 基础镜像**
2. **非 root 用户运行**
3. **不要安装不需要的包**
4. **定期扫描漏洞**
5. **不要在镜像中存储密钥**

## 练习

### 练习 1：镜像构建

1. 编写后端多阶段 Dockerfile
2. 编写前端多阶段 Dockerfile
3. 优化镜像大小（目标 < 200MB）

### 练习 2：安全扫描

1. 用 `docker scout` 扫描镜像漏洞
2. 修复高危漏洞
3. 配置自动化扫描

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 镜像太大 | 没用多阶段构建 | 分离构建和运行阶段 |
| 构建缓存失效 | COPY 顺序不对 | 先 COPY 依赖文件，再 COPY 代码 |
| 权限问题 | 用 root 运行 | 创建非 root 用户 |

## 工程建议

生产环境镜像务必使用多阶段构建，将构建工具和运行时分离，镜像体积可从 1GB+ 缩减到 200MB 以内。始终用非 root 用户运行容器进程，并定期用 `docker scout` 或 Trivy 扫描基础镜像漏洞。`.dockerignore` 文件不可省略，避免将 `.git`、`node_modules`、`.env` 等敏感文件打包进镜像。

## 本节要点

- 多阶段构建减小镜像大小
- 非 root 用户运行提升安全性
- .dockerignore 排除不需要的文件

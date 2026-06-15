# 01 Docker 容器化

> "在我机器上能跑"是开发最大的谎言——Docker 让所有机器都一样。

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

## 本节要点

- 多阶段构建减小镜像大小
- 非 root 用户运行提升安全性
- .dockerignore 排除不需要的文件

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 镜像太大 | 没用多阶段构建 | 分离构建和运行阶段 |
| 构建缓存失效 | COPY 顺序不对 | 先 COPY 依赖文件，再 COPY 代码 |
| 权限问题 | 用 root 运行 | 创建非 root 用户 |

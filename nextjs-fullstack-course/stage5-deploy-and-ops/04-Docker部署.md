# 第四课：Docker 部署

## 学习目标

完成本课学习后，你将能够：

1. 理解 Docker 的基本概念
2. 为 Next.js 项目编写 Dockerfile
3. 使用 Docker Compose 管理多服务
4. 优化 Docker 镜像大小

---

## 一、Docker 基础

### 1.1 什么是 Docker

> **Docker 是一个容器化平台，让你可以将应用和依赖打包成一个标准化的单元（容器），在任何环境中都能一致运行。**

### 1.2 核心概念

```
镜像（Image）：
  → 应用的只读模板
  → 包含代码、运行时、依赖
  → 类似"安装包"

容器（Container）：
  → 镜像的运行实例
  → 可以启动、停止、删除
  → 类似"运行中的程序"

Dockerfile：
  → 构建镜像的指令文件
  → 类似"安装脚本"
```

### 1.3 生活类比

```
Docker = 集装箱

镜像 = 集装箱设计图
  → 定义要装什么
  → 可以复制多份

容器 = 实际的集装箱
  → 按设计图制造
  → 可以装船运输

Dockerfile = 装箱指南
  → 一步步说明怎么装
```

---

## 二、Next.js Dockerfile

### 2.1 基础 Dockerfile

```dockerfile
# Dockerfile

# 1. 依赖阶段
FROM node:18-alpine AS deps
WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 2. 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. 运行阶段
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# 设置权限
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动命令
CMD ["node", "server.js"]
```

### 2.2 next.config.js 配置

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

---

## 三、构建和运行

### 3.1 构建镜像

```bash
# 构建
docker build -t my-nextjs-app .

# 查看镜像
docker images
```

### 3.2 运行容器

```bash
# 运行
docker run -p 3000:3000 my-nextjs-app

# 后台运行
docker run -d -p 3000:3000 --name myapp my-nextjs-app

# 查看运行中的容器
docker ps

# 查看日志
docker logs myapp

# 停止容器
docker stop myapp
```

---

## 四、Docker Compose

### 4.1 docker-compose.yml

```yaml
# docker-compose.yml
version: '3'

services:
  # Next.js 应用
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/mydb
      - SESSION_SECRET=your-secret-key-at-least-32-chars
      - NEXT_PUBLIC_URL=http://localhost:3000
    depends_on:
      - db

  # PostgreSQL 数据库
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 4.2 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止所有服务
docker-compose down

# 重新构建
docker-compose up -d --build
```

---

## 五、优化镜像

### 5.1 多阶段构建

```dockerfile
# 使用多阶段构建减小镜像大小
FROM node:18-alpine AS deps
# ... 安装依赖

FROM node:18-alpine AS builder
# ... 构建应用

FROM node:18-alpine AS runner
# ... 只复制运行时需要的文件
```

### 5.2 使用 Alpine 镜像

```dockerfile
# 使用 Alpine 版本减小基础镜像大小
FROM node:18-alpine  # ~170MB
# vs
FROM node:18         # ~900MB
```

### 5.3 .dockerignore

```
# .dockerignore
node_modules
.next
.git
*.md
.env.local
```

---

## 六、数据库迁移

### 6.1 启动时迁移

```dockerfile
# Dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

### 6.2 使用初始化脚本

```yaml
# docker-compose.yml
services:
  app:
    build: .
    command: >
      sh -c "npx prisma migrate deploy && node server.js"
```

---

## 七、生产环境配置

### 7.1 环境变量

```yaml
# docker-compose.prod.yml
version: '3'

services:
  app:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - NEXT_PUBLIC_URL=${NEXT_PUBLIC_URL}
    restart: always
    ports:
      - "3000:3000"

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - app
    restart: always

volumes:
  postgres_data:
```

### 7.2 Nginx 配置

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

---

## 八、CI/CD 集成

### 8.1 GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: yourusername/myapp:latest
```

---

## 九、动手练习

### 练习 1：创建 Dockerfile

1. 为项目创建 Dockerfile
2. 构建镜像
3. 运行容器
4. 访问应用

### 练习 2：使用 Docker Compose

1. 创建 docker-compose.yml
2. 包含应用和数据库
3. 启动所有服务
4. 测试应用

### 练习 3：优化镜像

1. 使用多阶段构建
2. 添加 .dockerignore
3. 对比镜像大小

---

## 十、小结

```
本课核心要点：

1. Docker 容器化应用，保证环境一致性
2. 多阶段构建减小镜像大小
3. Docker Compose 管理多服务
4. 环境变量通过 docker-compose 配置
5. 生产环境使用 Nginx 反向代理
```

下一课我们将学习日志和错误监控。

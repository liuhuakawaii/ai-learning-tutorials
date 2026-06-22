# 第四课：Docker 部署

## 场景引入

你的 Next.js 项目在开发机上运行完美，但部署到生产服务器后频繁报错——开发机是 macOS，生产服务器是 Ubuntu；本地 Node.js 版本是 20，服务器上是 16；本地用的 PostgreSQL 16，服务器上是 14。"在我电脑上是好的"成了团队最常说的话。你需要一种方式，把应用和它的所有依赖（运行时、系统库、数据库客户端）打包成一个标准化的单元，在任何机器上都能一致运行。

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

## 参考答案

### 练习一：创建 Dockerfile

**思路**：为 Next.js 项目编写多阶段构建的 Dockerfile，使用 standalone 输出模式最小化最终镜像，配置非 root 用户运行。

**答案**：

```dockerfile
# Dockerfile

# 阶段 1：安装依赖
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# 阶段 2：构建应用
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 阶段 3：运行（只包含必要文件）
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

```bash
# 构建镜像
docker build -t my-nextjs-app .

# 运行容器
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/mydb" \
  -e SESSION_SECRET="your-secret-key-at-least-32-chars" \
  my-nextjs-app

# 访问 http://localhost:3000 验证
```

**要点**：
- `output: 'standalone'` 是关键配置，让 Next.js 生成自包含的构建产物，无需 `node_modules`
- 多阶段构建确保最终镜像不包含源码、开发依赖和构建工具
- 使用非 root 用户（`nextjs`）运行容器，提高安全性

### 练习二：使用 Docker Compose

**思路**：编写 `docker-compose.yml`，将 Next.js 应用和 PostgreSQL 数据库编排在一起，通过环境变量连接各服务。

**答案**：

```yaml
# docker-compose.yml
version: '3'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/mydb
      - SESSION_SECRET=dev-secret-key-at-least-32-characters
      - NEXT_PUBLIC_URL=http://localhost:3000
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

```bash
# 启动所有服务
docker-compose up -d

# 查看日志（确认应用和数据库都正常启动）
docker-compose logs -f

# 访问 http://localhost:3000 测试

# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据库）
docker-compose down -v
```

**要点**：
- `depends_on` 配合 `healthcheck` 确保数据库就绪后才启动应用，避免连接失败
- 数据使用 Docker Volume 持久化，`docker-compose down` 不会丢失数据
- `db` 服务的端口映射到宿主机 `5432`，方便用数据库工具直连调试

### 练习三：优化镜像

**思路**：使用 `.dockerignore` 排除不需要的文件，利用多阶段构建分离构建和运行环境，对比优化前后的镜像大小。

**答案**：

```
# .dockerignore
node_modules
.next
.git
.gitignore
*.md
.env*
.env.local
.env.development
.env.production
Dockerfile
docker-compose*.yml
nginx.conf
README.md
.vscode
.idea
coverage
```

```dockerfile
# 优化后的 Dockerfile（多阶段构建）
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm install bcryptjs

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

```bash
# 对比镜像大小

# 优化前（无 .dockerignore，单阶段）
docker build -t myapp:before -f Dockerfile.before .
docker images myapp:before

# 优化后（.dockerignore + 多阶段）
docker build -t myapp:after .
docker images myapp:after

# 典型对比结果：
# myapp:before  ~1.2GB
# myapp:after   ~150MB
```

**要点**：
- `.dockerignore` 排除 `node_modules` 和 `.next` 是最关键的优化，避免复制平台不兼容的二进制文件
- 运行阶段使用 `npm ci --omit=dev` 只安装生产依赖，大幅减小 `node_modules` 体积
- Alpine 基础镜像比标准镜像小约 80%（170MB vs 900MB）

---

## 十、常见误区

1. **把 `node_modules` 复制到镜像中**：`COPY . .` 会把本地的 `node_modules` 也复制进去，导致镜像体积膨胀且可能包含平台不兼容的二进制文件。应该先 `COPY package*.json` 再 `RUN npm ci`。

2. **在生产镜像中保留开发依赖**：`npm ci` 默认安装所有依赖包括 `devDependencies`。生产构建应该用 `npm ci --omit=dev`，或者分两阶段：构建阶段装全量依赖，运行阶段只装生产依赖。

3. **用 `root` 用户运行容器**：默认情况下 Docker 容器以 root 用户运行，如果应用被攻破，攻击者获得的就是 root 权限。应该创建专用的非 root 用户运行应用。

4. **在 Dockerfile 中硬编码密钥**：Dockerfile 的每一层都会被缓存和分发，任何写入的密钥都可能泄露。密钥应该通过运行时的环境变量或 Docker Secrets 传入。

---

## 十一、工程建议

1. **使用多阶段构建最小化镜像**：依赖阶段 → 构建阶段 → 运行阶段，最终镜像只包含运行时需要的文件，Next.js standalone 模式可以将镜像控制在 100MB 以内。

2. **`.dockerignore` 排除所有不需要的文件**：`node_modules`、`.next`、`.git`、`*.md`、`.env*` 都应该排除，加快构建速度并避免泄露敏感信息。

3. **使用 `docker-compose` 管理本地开发环境**：将应用、数据库、Redis 等服务统一用 docker-compose 管理，新成员只需 `docker-compose up` 即可启动完整环境。

4. **镜像 Tag 使用 Git commit SHA 而非 `latest`**：`latest` 标签无法追溯具体版本，使用 `myapp:abc1234` 这样的 commit SHA 可以精确回滚到任意版本。

---

## 十二、小结

```
本课核心要点：

1. Docker 容器化应用，保证环境一致性
2. 多阶段构建减小镜像大小
3. Docker Compose 管理多服务
4. 环境变量通过 docker-compose 配置
5. 生产环境使用 Nginx 反向代理
```

下一课我们将学习日志和错误监控。

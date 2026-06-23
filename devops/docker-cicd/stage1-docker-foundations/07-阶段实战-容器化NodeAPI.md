# 阶段实战：容器化 Node API

> 前置知识：Dockerfile 基础、构建缓存与多阶段构建、Volume 与网络、安全基础（第 1-6 课）

## 你的任务

你手上有一个 TypeScript 写的 Node.js API。需求很明确：

- 镜像体积小于 200MB
- 不能把 node_modules 和 .env 打进镜像
- 必须用非 root 用户运行
- 要有健康检查端点
- 要支持开发和生产两种模式

这不是一个 demo——这是你在真实项目中写 Dockerfile 时会遇到的全部要求。接下来你会踩到几个典型的坑，每个坑都值得停下来想清楚。

## 项目结构

```
node-api-docker/
├── Dockerfile
├── .dockerignore
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── routes/health.ts
    └── utils/logger.ts
```

### package.json

```json
{
  "name": "node-api-docker",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.4.5",
    "eslint": "^8.46.0",
    "tsx": "^3.12.7",
    "typescript": "^5.1.6",
    "vitest": "^0.34.1"
  }
}
```

### src/index.ts

```typescript
import express from 'express';
import { healthRouter } from './routes/health';
import { logger } from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use('/health', healthRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker!',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});
```

### src/routes/health.ts

```typescript
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

## 第一步：写 Dockerfile（先踩坑）

先试着写一个最简单的 Dockerfile：

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
```

构建一下：

```bash
docker build -t node-api:bad .
docker images node-api:bad
```

你会发现镜像超过 1GB。为什么？

- 基础镜像 `node:18` 是 Debian，带了大量不需要的系统工具
- `COPY . .` 把 node_modules、.git、.env 全部拷进去了
- devDependencies 没有清理，TypeScript 编译器、ESLint、Vitest 全在生产镜像里

## 第二步：加 .dockerignore

```dockerignore
node_modules
dist
.git
.env
.env.*
*.md
.vscode
.idea
__tests__
vitest.config.ts
```

这一步解决"不该进去的东西进去了"的问题。但镜像体积还是太大——基础镜像和 devDependencies 的问题还没解决。

## 第三步：多阶段构建

```dockerfile
# ---- 阶段一：安装依赖 ----
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 阶段二：构建 ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN npm prune --production

# ---- 阶段三：生产运行 ----
FROM node:18-alpine AS production
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeuser -u 1001 -G nodejs
WORKDIR /app
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./
ENV NODE_ENV=production
USER nodeuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

构建并验证：

```bash
docker build -t node-api:1.0 .
docker images node-api:1.0
# 应该在 150MB 以下

docker run --rm node-api:1.0 whoami
# 应该输出：nodeuser
```

几个关键设计决策：

**为什么用 `alpine`？** Debian 基础镜像约 900MB，Alpine 约 50MB。Alpine 用 musl libc 而不是 glibc，大部分 Node.js 应用兼容性没问题，但如果你用了需要原生编译的模块（如某些 bcrypt 版本），可能需要额外处理。

**为什么用 `tini`？** PID 1 进程在 Linux 中有特殊职责——收割僵尸进程、转发信号。Node.js 不是为 PID 1 设计的，不装 tini 的话，`docker stop` 会等 10 秒才生效（SIGTERM 没被正确处理）。

**为什么 `npm prune --production`？** 构建阶段需要 TypeScript 编译器，但运行阶段只需要编译产物。prune 掉 devDependencies 可以减少几十 MB 的 node_modules。

## 第四步：开发模式

生产镜像不含源代码和开发工具，开发时需要热更新。用 bind mount 解决：

```bash
docker run -d \
  --name api-dev \
  -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/package.json:/app/package.json \
  node:18-alpine \
  sh -c "npm install && npx tsx watch src/index.ts"
```

开发和生产用不同的镜像和启动方式，这是正确的。不要试图用同一个 Dockerfile 同时服务两种场景——它们的需求是矛盾的。

## 验收清单

```
docker build -t node-api:1.0 .                    # 构建成功
docker images node-api                             # 体积 < 200MB
docker run --rm node-api whoami                    # 输出 nodeuser
docker run -d --name api -p 3000:3000 node-api:1.0
curl http://localhost:3000/health                  # 返回 ok
docker inspect --format='{{.State.Health.Status}}' api  # healthy
```

## 练习

### 练习一：环境变量注入

运行容器时传入 `NODE_ENV=staging` 和 `PORT=8080`，验证应用确实读到了这些值。注意 `-p` 映射的端口要和 PORT 一致。

### 练习二：日志持久化

修改 `src/utils/logger.ts`，让日志同时写入 `/app/logs/app.log` 文件。用 Named Volume 挂载日志目录，验证容器重启后日志还在。

### 练习三：资源限制

用 `--memory=256m --cpus=0.5` 启动容器，用 `docker stats` 观察实际资源消耗。故意写一个内存泄漏的接口，观察 OOM Kill 的行为。

---

## 参考答案

### 练习一

```bash
docker run -d -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=staging \
  --name api-staging \
  node-api:1.0

curl http://localhost:8080
# 预期输出包含 "env": "staging"

docker exec api-staging env | grep -E "PORT|NODE_ENV"
docker rm -f api-staging
```

### 练习二

修改 logger.ts 增加文件输出：

```typescript
import fs from 'fs';
import path from 'path';

const logDir = '/app/logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logStream = fs.createWriteStream(
  path.join(logDir, 'app.log'),
  { flags: 'a' }
);

export const logger = {
  info: (message: string) => {
    const entry = JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString() });
    console.log(entry);
    logStream.write(entry + '\n');
  },
  error: (message: string, error?: Error) => {
    const entry = JSON.stringify({ level: 'error', message, error: error?.message, timestamp: new Date().toISOString() });
    console.error(entry);
    logStream.write(entry + '\n');
  },
};
```

```bash
docker run -d -p 3000:3000 -v api-logs:/app/logs --name api node-api:1.0
curl http://localhost:3000
docker exec api cat /app/logs/app.log
docker rm -f api
# 重新启动，日志依然在
docker run -d -p 3000:3000 -v api-logs:/app/logs --name api2 node-api:1.0
docker exec api2 cat /app/logs/app.log
```

### 练习三

```bash
docker run -d -p 3000:3000 \
  --memory=256m --cpus=0.5 \
  --name api-limited node-api:1.0

docker stats api-limited --no-stream
# 观察 MEM USAGE / LIMIT 列

docker inspect --format='{{.HostConfig.Memory}}' api-limited
# 输出 268435456（256MB 的字节数）
```

写一个内存泄漏接口来观察 OOM：

```typescript
const leak: Buffer[] = [];
app.get('/leak', (req, res) => {
  leak.push(Buffer.alloc(1024 * 1024)); // 每次请求泄漏 1MB
  res.json({ leaked: leak.length });
});
```

多次请求 `/leak` 后，`docker inspect api-limited` 会看到 OOM Killed。

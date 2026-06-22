# 第七课：阶段实战——容器化 Node API

> **课程定位**：综合运用第一阶段所有知识，完成一个完整的容器化项目
> **前置知识**：Dockerfile 基础、构建缓存与多阶段构建、Volume 与网络、安全基础（第 1-6 课）
> **预计时长**：60 分钟

---

## 场景引入

经过前六课的学习，你已经掌握了 Docker 的核心概念和基本操作。现在是时候把这些知识串起来了：你手上有一个 TypeScript 写的 Node.js API，需要把它容器化，要求镜像体积小、安全性高、支持开发和生产两种模式。这是你第一次独立完成一个完整的容器化项目——就像在真实工作中，拿到一个项目需求从零开始搭建。

---

## 学习目标

完成本课后，你将拥有一个生产就绪的容器化 Node.js API，具备：

1. 多阶段构建的 Dockerfile
2. 开发和生产两种运行模式
3. 非 root 用户运行
4. 健康检查端点
5. 完整的 .dockerignore
6. 构建和运行文档

---

## 一、项目结构

```
node-api-docker/
├── Dockerfile              # 多阶段 Dockerfile
├── Dockerfile.dev          # 开发专用 Dockerfile（可选）
├── .dockerignore
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── index.ts            # 入口文件
    ├── routes/
    │   └── health.ts       # 健康检查路由
    └── utils/
        └── logger.ts       # 日志工具
```

---

## 二、应用代码

### 2.1 package.json

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

### 2.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3 src/index.ts

```typescript
import express from 'express';
import { healthRouter } from './routes/health';
import { logger } from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// 路由
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

### 2.4 src/routes/health.ts

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

### 2.5 src/utils/logger.ts

```typescript
export const logger = {
  info: (message: string) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: Error) => {
    console.error(JSON.stringify({ level: 'error', message, error: error?.message, timestamp: new Date().toISOString() }));
  },
};
```

---

## 三、Dockerfile（生产环境）

```dockerfile
# ============================================
# 多阶段构建 Dockerfile
# ============================================

# ---- 阶段一：安装依赖 ----
FROM node:18-alpine AS deps

WORKDIR /app

# 只复制依赖相关文件
COPY package.json package-lock.json ./

# 安装所有依赖（包括 devDependencies，构建阶段需要）
RUN npm ci

# ---- 阶段二：构建 ----
FROM node:18-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码和配置
COPY package.json tsconfig.json ./
COPY src/ ./src/

# 编译 TypeScript
RUN npm run build

# 清理 devDependencies
RUN npm prune --production

# ---- 阶段三：生产运行 ----
FROM node:18-alpine AS production

# 安装 tini（正确的 init 进程）
RUN apk add --no-cache tini

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# 从 builder 阶段复制必要文件
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./

# 设置环境变量
ENV NODE_ENV=production

# 切换到非 root 用户
USER nodeuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 使用 tini 作为入口
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "dist/index.js"]
```

---

## 四、.dockerignore

```dockerignore
# ---- 依赖和缓存 ----
node_modules
npm-debug.log*
.npm

# ---- 构建产物 ----
dist
build
coverage

# ---- 版本控制 ----
.git
.gitignore

# ---- IDE ----
.vscode
.idea
*.swp

# ---- 环境变量（安全！）----
.env
.env.*

# ---- Docker ----
Dockerfile*
docker-compose*.yml
.dockerignore

# ---- 文档 ----
README.md
*.md
docs

# ---- 测试 ----
*.test.ts
*.spec.ts
__tests__
vitest.config.ts
```

---

## 五、构建和运行

### 5.1 生产模式

```bash
# 构建镜像
docker build -t node-api:1.0 .

# 查看镜像大小
docker images node-api

# 运行容器
docker run -d \
  --name api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  node-api:1.0

# 测试
curl http://localhost:3000
curl http://localhost:3000/health

# 查看日志
docker logs api

# 查看容器状态
docker ps

# 停止并删除
docker rm -f api
```

### 5.2 开发模式

```bash
# 使用 bind mount 挂载源代码
docker run -d \
  --name api-dev \
  -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/package.json:/app/package.json \
  node:18-alpine \
  sh -c "npm install && npx tsx watch src/index.ts"
```

---

## 六、镜像优化验证

```bash
# 查看镜像层信息
docker history node-api:1.0

# 查看镜像详细信息
docker inspect node-api:1.0

# 扫描安全漏洞（如果有 Docker Scout）
docker scout cves node-api:1.0

# 验证非 root 用户
docker run --rm node-api:1.0 whoami
# 应该输出：nodeuser

# 验证健康检查
docker run -d --name health-test -p 3001:3000 node-api:1.0
sleep 5
docker inspect --format='{{.State.Health.Status}}' health-test
# 应该输出：healthy
docker rm -f health-test
```

---

## 七、验收清单

```
阶段一验收标准：

  ✅ 镜像能成功构建
     docker build -t node-api:1.0 .

  ✅ 容器启动后可访问健康检查
     curl http://localhost:3000/health

  ✅ 不把 node_modules 和密钥打进镜像
     检查 .dockerignore 和 Dockerfile

  ✅ 使用非 root 用户
     docker run --rm node-api whoami

  ✅ 使用多阶段构建
     检查 Dockerfile 有多个 FROM

  ✅ 镜像体积合理（Alpine + 多阶段 < 200MB）
     docker images node-api
```

---

## 八、扩展练习

### 练习一：添加环境变量支持

```bash
# 运行时传入不同环境变量
docker run -d -p 3000:3000 \
  -e PORT=8080 \
  -e NODE_ENV=staging \
  node-api:1.0

# 验证环境变量生效
curl http://localhost:8000
```

### 练习二：添加日志持久化

```bash
# 使用 volume 持久化日志
docker run -d -p 3000:3000 \
  -v api-logs:/app/logs \
  node-api:1.0
```

### 练习三：资源限制

```bash
# 限制内存和 CPU
docker run -d -p 3000:3000 \
  --memory=256m \
  --cpus=0.5 \
  node-api:1.0

# 查看资源使用
docker stats api
```

---

## 常见误区

- **"容器化就是写个 Dockerfile"**：完整的容器化方案包括 Dockerfile、.dockerignore、健康检查、安全配置、文档，缺少任何一环都不算生产就绪。
- **"本地能 build 能 run 就行了"**：本地环境和 CI/CD 环境可能不同（操作系统、网络、权限）。应该在干净的环境中验证构建，确保可重复。
- **"开发和生产用同一个 Dockerfile 就够了"**：开发需要热更新、调试工具、详细日志；生产需要最小体积、非 root 用户、健康检查。用 `--target` 区分开发和生产阶段是更好的做法。
- **"镜像体积不重要，服务器磁盘够用"**：镜像体积影响构建速度、传输速度、部署速度，也影响安全扫描的范围。更小的镜像意味着更少的攻击面和更快的交付。

---

## 工程建议

- **为项目写一份 Docker 使用文档**：包括构建命令、运行命令、环境变量说明、健康检查地址，让新同事能一条命令跑起来。
- **用 `HEALTHCHECK` 指令定义健康检查**：不要只依赖外部监控，容器自身的健康检查能让 Docker 自动重启不健康的服务。
- **构建完用 `docker history` 检查镜像层**：确认没有意外的大文件或敏感信息进入镜像，每一层的大小都应该合理。
- **把容器化验收清单加入 CI**：自动化检查是否使用非 root 用户、是否有多阶段构建、镜像体积是否在合理范围内。

---

## 小结

本课综合运用了第一阶段的所有知识：

1. **Dockerfile 基础**：FROM、RUN、COPY、WORKDIR、EXPOSE、CMD
2. **多阶段构建**：deps → builder → production，减小镜像体积
3. **.dockerignore**：排除 node_modules、.git、.env 等不需要的文件
4. **安全实践**：非 root 用户、tini init 进程、不硬编码密钥
5. **健康检查**：HEALTHCHECK 指令 + /health 端点

你现在已经拥有一个生产就绪的容器化 Node.js API。下一阶段我们将学习 Docker Compose，把多个服务编排在一起。

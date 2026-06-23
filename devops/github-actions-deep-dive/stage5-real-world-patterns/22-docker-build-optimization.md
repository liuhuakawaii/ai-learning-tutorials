# Docker 构建优化

> Docker build 每次都要 5 分钟？因为你每次都重新下载依赖、重新编译。BuildKit 缓存、多阶段构建、多平台构建——这些技术能把构建时间从分钟级降到秒级。

## BuildKit 基础

BuildKit 是 Docker 的新一代构建引擎，从 Docker 23.0 开始默认启用。

```yaml
- uses: docker/setup-buildx-action@v3
```

`setup-buildx-action` 创建一个 BuildKit builder 实例。后续的 `docker build` 都会使用 BuildKit。

## 层缓存

### 本地缓存

```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    cache-from: type=local,src=/tmp/.buildx-cache
    cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
```

`mode=max` 缓存所有中间层，不只是最终镜像的层。这在多阶段构建中特别有用。

**注意**：`cache-from` 和 `cache-to` 不能用同一个目录。先读旧缓存，构建后写新缓存。

### GitHub Actions 缓存

```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha` 使用 GitHub Actions 的缓存后端。不需要额外配置，自动利用 Actions 的缓存额度。

### Registry 缓存

```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: my-registry/my-app:latest
    cache-from: type=registry,ref=my-registry/my-app:buildcache
    cache-to: type=registry,ref=my-registry/my-app:buildcache,mode=max
```

把缓存存在镜像仓库里。适合跨 CI 系统共享缓存。

## Dockerfile 优化

### 层顺序

```dockerfile
# 不好：COPY . . 之后才安装依赖
# 任何文件变化都会重新安装依赖
FROM node:20
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

# 好：先复制依赖文件，再复制源码
FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

关键原则：**把不常变的层放在前面**。`package.json` 变化频率远低于源码，所以先复制它、安装依赖，再复制源码。

### 多阶段构建

```dockerfile
# 阶段 1：安装依赖
FROM node:20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 阶段 2：构建
FROM deps AS build
COPY . .
RUN npm run build

# 阶段 3：运行（只包含运行时需要的文件）
FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

最终镜像只包含 `dist/` 和 `node_modules`，没有源码、开发依赖和构建工具。镜像更小，攻击面更小。

### 使用 distroless 镜像

```dockerfile
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["dist/index.js"]
```

distroless 镜像没有 shell、没有包管理器、没有多余的工具。更安全，但调试不方便。

## 多平台构建

### QEMU 模拟

```yaml
- uses: docker/setup-qemu-action@v3

- uses: docker/setup-buildx-action@v3

- uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: my-registry/my-app:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

QEMU 模拟 ARM64 构建。**速度很慢**——比原生构建慢 5-10 倍。

### 原生构建（推荐）

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform: [amd64, arm64]
        include:
          - platform: amd64
            runner: ubuntu-latest
          - platform: arm64
            runner: ubuntu-latest-arm64  # GitHub 的 ARM64 Runner
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/${{ matrix.platform }}
          push: true
          tags: my-registry/my-app:${{ matrix.platform }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  manifest:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-buildx-action@v3
      - run: |
          docker buildx imagetools create \
            my-registry/my-app:latest \
            --tag my-registry/my-app:latest \
            my-registry/my-app:amd64 \
            my-registry/my-app:arm64
```

原生构建比 QEMU 快得多，但需要 ARM64 Runner。

## 镜像推送

### 推送到 GitHub Container Registry

```yaml
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
```

`GITHUB_TOKEN` 自动可用，不需要额外配置。

### 标签策略

```yaml
- uses: docker/metadata-action@v5
  id: meta
  with:
    images: ghcr.io/${{ github.repository }}
    tags: |
      type=ref,event=branch
      type=ref,event=pr
      type=semver,pattern={{version}}
      type=sha

- uses: docker/build-push-action@v5
  with:
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
```

`metadata-action` 自动生成标签：
- `main` 分支：`main`
- PR #123：`pr-123`
- Tag v1.2.3：`1.2.3`, `1.2`, `1`
- Commit abc123：`sha-abc123`

## 练习

### 练习一：优化 Dockerfile

优化以下 Dockerfile，目标：
1. 减少镜像大小
2. 利用层缓存加速构建
3. 减少攻击面

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    nodejs \
    npm

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
RUN npm test

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 参考答案

```dockerfile
# 阶段 1：安装依赖
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# 阶段 2：构建
FROM deps AS build
COPY . .
RUN npm run build

# 阶段 3：测试（可选，CI 里单独跑）
FROM build AS test
RUN npm test

# 阶段 4：运行
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=deps /prod_modules ./node_modules
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

**优化点**：
1. **基础镜像**：`node:20-slim` 比 `ubuntu:22.04` 小得多，且预装 Node.js
2. **层缓存**：先复制 `package.json`，再复制源码。依赖没变时跳过 `npm ci`
3. **多阶段构建**：最终镜像只包含运行时需要的文件
4. **生产依赖**：`--only=production` 只安装生产依赖
5. **安全**：`USER node` 不用 root 运行
6. **环境变量**：`NODE_ENV=production` 启用生产模式优化

**预期效果**：
- 原始镜像：~1.5GB
- 优化后镜像：~200MB
- 构建时间（缓存命中时）：从 5 分钟降到 30 秒

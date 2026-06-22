# Docker 完全指南

> 从零开始，彻底搞懂 Docker —— 后端开发者的必备技能

## 场景引入

你刚入职一家公司，Leader 给你一个项目让你跑起来。你克隆了代码，发现 README 写着"需要 Node 18、PostgreSQL 15、Redis 7"。你花了一上午装环境，结果 PostgreSQL 版本不对，Redis 配置冲突，最后折腾到下午才跑起来。隔壁同事用 Docker，一条命令 `docker compose up -d`，三分钟搞定。这不是个例——"在我电脑上能跑"是开发团队最经典的痛点。Docker 通过容器化技术，把应用和它需要的一切（代码、运行时、库、配置）打包成一个标准化单元，让"到处都能跑"成为现实。本课将从零开始，带你彻底掌握 Docker 的核心概念和实操技能。

## 学习目标

完成本课时后，你将能够：

- 理解 Docker 的核心概念（镜像、容器、仓库）
- 熟练使用 Docker 命令管理容器
- 编写 Dockerfile 将 Node.js 应用容器化
- 使用 Docker Compose 编排多容器应用
- 理解 Docker 网络、数据持久化、镜像优化

---

## 一、Docker 是什么

### 1.1 没有 Docker 时的痛苦

想象一个场景：你在自己的电脑上开发了一个 Node.js 应用，运行得很好。然后你把它部署到服务器上，结果：

- 服务器上的 Node.js 版本和你电脑上的不一样
- 服务器上没有安装你需要的系统依赖
- 你的同事电脑上装了不同版本的 PostgreSQL
- "在我电脑上明明能跑啊！" —— 经典名言

这就是 **环境不一致** 的问题。每个开发者的电脑环境不同，服务器环境也不同，导致同一个应用在不同机器上表现不一样。

### 1.2 Docker 的解决方案：集装箱类比

Docker 的 logo 是一只鲸鱼背着集装箱。这个比喻非常贴切：

```
没有 Docker 的世界（散装运输）：
┌─────────────────────────────────────────────┐
│  服务器                                      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  │Node │ │依赖A│ │依赖B│ │配置 │  散放着  │
│  └─────┘ └─────┘ └─────┘ └─────┘          │
│  容易冲突、版本混乱、难以迁移                  │
└─────────────────────────────────────────────┘

有 Docker 的世界（集装箱运输）：
┌─────────────────────────────────────────────┐
│  服务器                                      │
│  ┌─────────────────────────────┐            │
│  │  Docker 容器（集装箱）        │            │
│  │  ┌─────┐ ┌─────┐ ┌─────┐  │            │
│  │  │Node │ │依赖A│ │依赖B│  │  打包在一起 │
│  │  └─────┘ └─────┘ └─────┘  │            │
│  │  + 配置 + 环境变量           │            │
│  └─────────────────────────────┘            │
│  环境一致、随处运行、隔离安全                  │
└─────────────────────────────────────────────┘
```

**Docker 就是把你的应用和它需要的一切（代码、运行时、库、环境变量、配置文件）打包成一个标准化的单元，这个单元可以在任何安装了 Docker 的机器上运行，而且行为完全一致。**

### 1.3 虚拟机 vs 容器

你可能听过虚拟机（VM），Docker 容器和虚拟机都能实现环境隔离，但方式完全不同：

```
虚拟机（Virtual Machine）：
┌──────────────────────────────────────────┐
│  硬件                                     │
│  ┌──────────────────────────────────┐    │
│  │  Hypervisor（虚拟化层）            │    │
│  │  ┌──────────┐  ┌──────────┐     │    │
│  │  │ Guest OS │  │ Guest OS │     │    │
│  │  │ (完整OS) │  │ (完整OS) │     │    │
│  │  │ ┌──────┐ │  │ ┌──────┐ │     │    │
│  │  │ │ App  │ │  │ │ App  │ │     │    │
│  │  │ └──────┘ │  │ └──────┘ │     │    │
│  │  └──────────┘  └──────────┘     │    │
│  └──────────────────────────────────┘    │
│  Host OS（宿主机操作系统）                  │
└──────────────────────────────────────────┘

Docker 容器：
┌──────────────────────────────────────────┐
│  硬件                                     │
│  ┌──────────────────────────────────┐    │
│  │  Host OS（宿主机操作系统）          │    │
│  │  ┌──────────────────────────┐    │    │
│  │  │  Docker Engine           │    │    │
│  │  │  ┌────────┐ ┌────────┐  │    │    │
│  │  │  │ 容器 1 │ │ 容器 2 │  │    │    │
│  │  │  │ ┌────┐ │ │ ┌────┐ │  │    │    │
│  │  │  │ │App │ │ │ │App │ │  │    │    │
│  │  │  │ └────┘ │ │ └────┘ │  │    │    │
│  │  │  └────────┘ └────────┘  │    │    │
│  │  └──────────────────────────┘    │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

| 对比项 | 虚拟机 | Docker 容器 |
|--------|--------|-------------|
| 启动时间 | 分钟级 | 秒级 |
| 资源占用 | 大（每个 VM 需要完整 OS） | 小（共享宿主机内核） |
| 隔离级别 | 强（完全独立的 OS） | 进程级隔离 |
| 镜像大小 | GB 级 | MB 级 |
| 性能 | 有损耗 | 接近原生 |
| 适用场景 | 需要不同 OS 的场景 | 应用级别的环境隔离 |

**简单总结：虚拟机是模拟一台完整的电脑，Docker 容器是模拟一个独立的应用运行环境。对于后端开发，Docker 容器更轻量、更高效。**

### 1.4 Docker 的三大核心概念

#### 镜像（Image）

镜像是一个**只读模板**，包含了运行应用所需的一切：代码、运行时、库、环境变量、配置文件。

你可以把镜像理解为一个**类（Class）**，或者一张**光盘** —— 它本身不能运行，但可以用它来创建容器。

```
镜像示例：
┌─────────────────────────────┐
│  node:20-alpine 镜像         │
│  ┌───────────────────────┐  │
│  │  Alpine Linux (基础)   │  │
│  │  + Node.js 20         │  │
│  │  + npm                │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  postgres:15 镜像            │
│  ┌───────────────────────┐  │
│  │  Debian Linux (基础)   │  │
│  │  + PostgreSQL 15      │  │
│  │  + 默认配置            │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

#### 容器（Container）

容器是镜像的**运行实例**。如果镜像是类，容器就是对象；如果镜像是光盘，容器就是播放中的电影。

一个镜像可以创建多个容器，就像一个类可以 new 出多个对象。

```
node:20-alpine 镜像
    │
    ├── 创建 → 容器 A（运行你的博客 API）
    ├── 创建 → 容器 B（运行另一个 Node.js 应用）
    └── 创建 → 容器 C（用于测试）
```

#### 仓库（Registry）

仓库是存储和分发镜像的服务。最常用的是 **Docker Hub**（https://hub.docker.com），就像 npm 是 JavaScript 包的仓库一样。

```
Docker Hub（类比 npm）：
├── node          （官方 Node.js 镜像）
├── postgres      （官方 PostgreSQL 镜像）
├── redis         （官方 Redis 镜像）
├── nginx         （官方 Nginx 镜像）
└── 你自己的镜像   （push 上去分享给别人）
```

### 1.5 为什么后端开发必须学 Docker

1. **环境一致性**：开发、测试、生产环境完全一样
2. **快速部署**：一条命令启动整个应用
3. **依赖隔离**：不同项目用不同版本的 Node.js/PostgreSQL，互不干扰
4. **团队协作**：新人入职，一条命令就能跑起整个项目
5. **行业标准**：几乎所有公司都在用 Docker

---

## 二、Docker 安装（Windows）

### 2.1 前提条件：WSL 2

Docker Desktop 在 Windows 上依赖 **WSL 2**（Windows Subsystem for Linux 2）。WSL 2 让 Windows 可以运行 Linux 环境，Docker 容器本质上是 Linux 进程，所以需要它。

#### 检查是否已安装 WSL 2

打开 PowerShell（管理员模式），运行：

```powershell
wsl --list --verbose
```

如果看到类似这样的输出，说明已经安装了：

```
  NAME              STATE           VERSION
* Ubuntu            Running         2
```

如果没有安装，运行：

```powershell
wsl --install
```

安装完成后**重启电脑**。

### 2.2 安装 Docker Desktop

1. 访问 https://www.docker.com/products/docker-desktop/
2. 点击 "Download for Windows"
3. 运行下载的安装程序
4. 安装过程中：
   - 勾选 "Use WSL 2 instead of Hyper-V"
   - 其他选项保持默认
5. 安装完成后重启电脑
6. 启动 Docker Desktop（开始菜单搜索 "Docker"）

### 2.3 验证安装

打开终端（PowerShell 或 Git Bash），运行：

```bash
# 检查 Docker 版本
docker --version
# 输出类似：Docker version 24.0.7, build afdd53b

# 检查 Docker Compose 版本
docker compose version
# 输出类似：Docker Compose version v2.23.3

# 运行测试容器
docker run hello-world
```

如果看到 "Hello from Docker!" 的消息，说明安装成功。

### 2.4 Docker Desktop 界面介绍

Docker Desktop 提供了一个图形界面：

- **Containers**：查看和管理运行中的容器
- **Images**：查看本地镜像
- **Volumes**：查看数据卷
- **Dev Environments**：开发环境（一般不用）

但大多数时候我们用命令行操作，更高效。

### 2.5 配置镜像加速（国内用户）

国内访问 Docker Hub 速度较慢，可以配置镜像加速器。

在 Docker Desktop 中：Settings → Docker Engine，在 JSON 中添加：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
```

点击 "Apply & Restart"。

---

## 三、Docker 核心命令

### 3.1 镜像相关命令

#### docker pull —— 拉取镜像

从 Docker Hub 下载镜像到本地：

```bash
# 拉取 Node.js 20 的 Alpine 版本
docker pull node:20-alpine

# 拉取 PostgreSQL 15
docker pull postgres:15-alpine

# 拉取 Redis 7
docker pull redis:7-alpine

# 拉取时不指定标签，默认是 latest
docker pull node
```

**标签（Tag）是什么？** 镜像名后面的 `:20-alpine` 就是标签，表示版本号和变体。`node:20-alpine` 表示 Node.js 20 的 Alpine Linux 版本（更小）。

#### docker images —— 列出本地镜像

```bash
docker images

# 输出示例：
# REPOSITORY   TAG           IMAGE ID       CREATED        SIZE
# node         20-alpine     a1b2c3d4e5f6   2 weeks ago    130MB
# postgres     15-alpine     f6e5d4c3b2a1   3 weeks ago    240MB
```

#### docker rmi —— 删除镜像

```bash
# 删除指定镜像
docker rmi node:20-alpine

# 删除所有未使用的镜像
docker image prune

# 删除所有未使用的镜像（包括没有标签的）
docker image prune -a
```

### 3.2 容器相关命令

#### docker run —— 创建并启动容器（最核心的命令）

```bash
docker run [选项] 镜像名 [命令]
```

常用选项详解：

```bash
docker run \
  -d \                    # 后台运行（detach），不占用终端
  -p 3000:3000 \          # 端口映射，宿主机端口:容器端口
  --name my-app \         # 给容器起个名字
  -e NODE_ENV=production \# 设置环境变量
  -v ./data:/app/data \   # 数据卷挂载，宿主机路径:容器路径
  --rm \                  # 容器停止后自动删除
  node:20-alpine          # 使用的镜像
```

**端口映射详解（-p）：**

```
你的电脑（宿主机）              Docker 容器
┌──────────────┐              ┌──────────────┐
│              │              │              │
│  浏览器访问    │   -p 3000:3000   │  Express 监听 │
│  localhost:3000 │ ──────────→ │  0.0.0.0:3000 │
│              │              │              │
└──────────────┘              └──────────────┘
```

容器有自己独立的网络，外部无法直接访问。`-p` 把宿主机的端口映射到容器的端口，这样外部就能通过宿主机端口访问容器内的服务。

#### 实际示例：运行 PostgreSQL

```bash
docker run -d \
  --name my-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blog_db \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

这条命令做了什么：
1. 后台运行一个 PostgreSQL 容器
2. 容器名叫 `my-postgres`
3. 把宿主机的 5432 端口映射到容器的 5432 端口
4. 设置了数据库用户名、密码、默认数据库
5. 把数据库数据持久化到 `postgres_data` 卷

#### docker ps —— 查看容器

```bash
# 查看运行中的容器
docker ps

# 输出示例：
# CONTAINER ID   IMAGE             STATUS          PORTS                    NAMES
# a1b2c3d4e5f6   postgres:15-alpine  Up 5 minutes  0.0.0.0:5432->5432/tcp   my-postgres

# 查看所有容器（包括已停止的）
docker ps -a
```

#### docker logs —— 查看容器日志

```bash
# 查看日志
docker logs my-postgres

# 实时跟踪日志（类似 tail -f）
docker logs -f my-postgres

# 查看最近 100 行
docker logs --tail 100 my-postgres

# 显示时间戳
docker logs -t my-postgres
```

#### docker exec —— 进入容器内部

```bash
# 进入容器的交互式 Shell
docker exec -it my-postgres /bin/sh

# 在容器内执行单条命令
docker exec my-postgres psql -U postgres -c "SELECT 1;"
```

`-it` 是两个选项的组合：
- `-i`：交互模式（interactive）
- `-t`：分配伪终端（tty）

进入容器后，你可以像操作一个 Linux 系统一样操作它。输入 `exit` 退出。

#### docker start / stop / restart

```bash
# 停止容器
docker stop my-postgres

# 启动已停止的容器
docker start my-postgres

# 重启容器
docker restart my-postgres
```

#### docker rm —— 删除容器

```bash
# 删除已停止的容器
docker rm my-postgres

# 强制删除运行中的容器
docker rm -f my-postgres

# 删除所有已停止的容器
docker container prune
```

### 3.3 实操：用 Docker 运行 PostgreSQL 并连接

让我们实际操作一下：

```bash
# 第 1 步：拉取 PostgreSQL 镜像
docker pull postgres:15-alpine

# 第 2 步：运行容器
docker run -d \
  --name blog-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blog_db \
  postgres:15-alpine

# 第 3 步：确认容器运行中
docker ps

# 第 4 步：查看日志，等待 "ready to accept connections"
docker logs -f blog-postgres

# 第 5 步：进入容器，用 psql 连接数据库
docker exec -it blog-postgres psql -U postgres

# 在 psql 中可以执行 SQL：
# \l          -- 列出所有数据库
# \c blog_db  -- 切换到 blog_db
# \dt         -- 列出所有表
# \q          -- 退出 psql

# 第 6 步：停止并删除容器
docker stop blog-postgres
docker rm blog-postgres
```

---

## 四、Dockerfile 详解

### 4.1 Dockerfile 是什么

Dockerfile 是一个**文本文件**，包含了一系列指令，告诉 Docker 如何构建一个镜像。就像一个**菜谱** —— 按照步骤操作，就能做出一道菜（镜像）。

```
菜谱（Dockerfile）        →  做菜（docker build）  →  成品（镜像）
原材料（基础镜像 + 代码）     构建过程                  可以运行的容器
```

### 4.2 指令详解

#### FROM —— 基础镜像

```dockerfile
FROM node:20-alpine
```

每个 Dockerfile 必须以 `FROM` 开头，指定基础镜像。就像做菜要先有锅和灶。

**为什么选 `alpine` 版本？**

| 镜像 | 大小 | 说明 |
|------|------|------|
| `node:20` | ~1GB | 完整 Debian 系统 + Node.js |
| `node:20-slim` | ~200MB | 精简版 Debian + Node.js |
| `node:20-alpine` | ~130MB | Alpine Linux + Node.js（最小） |

Alpine Linux 是一个极小的 Linux 发行版，只有 5MB 左右，加上 Node.js 也就 130MB。

#### WORKDIR —— 工作目录

```dockerfile
WORKDIR /app
```

设置后续指令的工作目录。如果目录不存在，会自动创建。类似于在终端中 `cd /app`。

#### COPY —— 复制文件

```dockerfile
# 把宿主机的 package.json 复制到容器的 /app/ 目录
COPY package.json ./

# 把宿主机的所有文件复制到容器的 /app/ 目录
COPY . .
```

**注意**：`COPY . .` 会复制当前目录下的所有文件，但可以通过 `.dockerignore` 排除不需要的文件。

#### .dockerignore —— 排除文件

创建 `.dockerignore` 文件，类似于 `.gitignore`：

```
node_modules
dist
.env
.git
*.log
.DS_Store
```

这很重要！如果不排除 `node_modules`，构建时会把宿主机的 `node_modules`（可能是 Windows 编译的）复制到 Linux 容器中，导致不兼容。

#### RUN —— 执行命令

```dockerfile
# 安装依赖
RUN npm install --production
```

`RUN` 在**构建时**执行命令，结果会保存到镜像中。

**为什么多条 RUN 要合并？** 每条 `RUN` 都会创建一个新的镜像层。层数越多，镜像越大。

```dockerfile
# 不推荐：3 层
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# 推荐：1 层
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean
```

#### ENV —— 环境变量

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```

设置环境变量，在容器运行时可用。

#### EXPOSE —— 声明端口

```dockerfile
EXPOSE 3000
```

声明容器运行时监听的端口。**注意**：这只是声明，不会实际开放端口。实际开放需要用 `docker run -p`。

#### CMD —— 启动命令

```dockerfile
CMD ["node", "dist/app.js"]
```

指定容器启动时执行的命令。每个 Dockerfile 只能有一个 `CMD`。

#### ENTRYPOINT —— 入口点

```dockerfile
ENTRYPOINT ["node"]
CMD ["dist/app.js"]
```

`ENTRYPOINT` 和 `CMD` 的区别：
- `ENTRYPOINT` 是固定的命令前缀，不会被 `docker run` 后面的参数覆盖
- `CMD` 是默认参数，可以被 `docker run` 后面的参数覆盖

```bash
# 使用上面的 ENTRYPOINT + CMD：
docker run my-app                    # 执行：node dist/app.js
docker run my-app src/index.js       # 执行：node src/index.js（CMD 被覆盖）
```

#### ARG —— 构建参数

```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine
```

`ARG` 只在构建时可用，运行时不可用（与 `ENV` 不同）。

### 4.3 多阶段构建（Multi-stage Build）

多阶段构建是 Docker 的一个强大特性，可以显著减小最终镜像的大小。

**问题**：构建 TypeScript 项目需要 `typescript`、`tsx` 等开发依赖，但运行时不需要。如果把它们都打包进镜像，会浪费空间。

**解决方案**：分两个阶段 —— 第一阶段编译，第二阶段只复制编译结果。

```dockerfile
# ============ 第一阶段：构建 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存）
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 devDependencies）
RUN npm ci

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 编译 TypeScript
RUN npm run build

# ============ 第二阶段：生产 ============
FROM node:20-alpine AS production

WORKDIR /app

# 只复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖（没有 typescript、tsx 等开发工具）
RUN npm ci --only=production

# 从第一阶段复制编译产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 声明端口
EXPOSE 3000

# 启动命令
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
```

**镜像大小对比**：

```
单阶段构建：~800MB（包含所有 devDependencies、TypeScript 源码等）
多阶段构建：~200MB（只有生产依赖和编译后的 JS）
```

### 4.4 完整示例：博客 API 的 Dockerfile

```dockerfile
# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 并安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码和配置
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 编译 TypeScript
RUN pnpm build

# ============ 生产阶段 ============
FROM node:20-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache tini

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 并只安装生产依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# 从构建阶段复制必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 创建上传和日志目录
RUN mkdir -p uploads logs

# 设置非 root 用户（安全最佳实践）
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

# 声明端口
EXPOSE 3000

# 使用 tini 作为 init 进程（正确处理信号）
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
```

---

## 五、Docker Compose（多容器编排）

### 5.1 为什么需要 Compose

一个真实项目通常需要多个服务：
- Node.js 应用
- PostgreSQL 数据库
- Redis 缓存

如果用 `docker run` 逐个启动，需要记住每个容器的配置（端口、环境变量、网络等），非常麻烦。

**Docker Compose 让你用一个 YAML 文件定义所有服务，一条命令启动整个项目。**

```
没有 Compose：
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d --name redis -p 6379:6379 redis:7
docker run -d --name app -p 3000:3000 --link postgres --link redis my-app

有 Compose：
docker compose up -d    # 一条命令搞定
```

### 5.2 docker-compose.yml 语法详解

```yaml
version: '3.8'    # Compose 文件版本（3.8 是常用版本）

services:          # 定义所有服务
  # ============ 应用服务 ============
  app:
    build: .                        # 从当前目录的 Dockerfile 构建
    ports:
      - "3000:3000"                 # 端口映射，宿主机:容器
    environment:                    # 环境变量
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/blog_db
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env                        # 也可以从文件读取环境变量
    depends_on:                     # 依赖关系
      postgres:
        condition: service_healthy  # 等 postgres 健康检查通过后再启动
      redis:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads        # 命名卷：数据持久化
      - ./logs:/app/logs            # 绑定挂载：宿主机目录映射
    restart: unless-stopped         # 重启策略
    networks:
      - app-network                 # 加入自定义网络

  # ============ PostgreSQL 数据库 ============
  postgres:
    image: postgres:15-alpine       # 使用官方镜像
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=blog_db
    ports:
      - "5432:5432"                 # 可选：暴露端口方便本地调试
    volumes:
      - postgres_data:/var/lib/postgresql/data   # 数据持久化！
    healthcheck:                    # 健康检查
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s                  # 每 5 秒检查一次
      timeout: 5s                   # 超时时间
      retries: 5                    # 重试次数
    restart: unless-stopped
    networks:
      - app-network

  # ============ Redis 缓存 ============
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

# ============ 命名卷定义 ============
volumes:
  postgres_data:                    # PostgreSQL 数据卷
  redis_data:                       # Redis 数据卷
  uploads:                          # 上传文件卷

# ============ 网络定义 ============
networks:
  app-network:                      # 自定义网络
    driver: bridge
```

### 5.3 关键配置详解

#### image vs build

```yaml
# 使用现有镜像（从 Docker Hub 拉取）
image: postgres:15-alpine

# 从 Dockerfile 构建镜像
build: .
# 或者指定 Dockerfile 路径
build:
  context: .
  dockerfile: Dockerfile
```

#### ports —— 端口映射

```yaml
ports:
  - "3000:3000"       # 宿主机 3000 → 容器 3000
  - "8080:80"         # 宿主机 8080 → 容器 80
  - "127.0.0.1:3000:3000"  # 只允许本地访问
```

#### volumes —— 数据持久化

```yaml
volumes:
  # 命名卷（Docker 管理，推荐用于数据库数据）
  - postgres_data:/var/lib/postgresql/data

  # 绑定挂载（直接映射宿主机目录，适合开发时热更新）
  - ./src:/app/src
```

**为什么数据库必须用命名卷？** 如果用 `docker rm` 删除容器，容器内的所有数据都会丢失。命名卷独立于容器存在，删除容器后数据仍然保留。

#### depends_on + healthcheck

```yaml
depends_on:
  postgres:
    condition: service_healthy   # 等健康检查通过
```

仅仅用 `depends_on` 不够 —— 它只保证容器启动顺序，不保证服务就绪。PostgreSQL 容器启动后还需要几秒钟初始化数据库。`healthcheck` + `condition: service_healthy` 确保 PostgreSQL 真正准备好接受连接后，应用才启动。

#### restart —— 重启策略

```yaml
restart: no               # 不自动重启（默认）
restart: always           # 总是重启
restart: unless-stopped   # 除非手动停止，否则总是重启（推荐）
restart: on-failure       # 只在非正常退出时重启
```

#### networks —— 容器间通信

在同一个 Compose 文件中的服务，默认就在同一个网络中。容器之间可以用**服务名**作为主机名互相访问：

```javascript
// 在 app 容器中连接 postgres，用服务名 "postgres" 作为主机名
const dbUrl = 'postgresql://postgres:postgres@postgres:5432/blog_db'
//                                                  ^^^^^^^^
//                                                  服务名，不是 localhost
```

---

## 六、实战：博客 API 容器化

### 6.1 编写 .dockerignore

```
node_modules
dist
.env
.git
.gitignore
*.md
logs/*
uploads/*
.DS_Store
```

### 6.2 编写 Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm build

# 生产阶段
FROM node:20-alpine AS production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p uploads logs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
```

### 6.3 编写 docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/blog_db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=change-this-in-production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=blog_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 6.4 构建与启动

```bash
# 构建镜像（-t 指定镜像名称和标签）
docker compose build

# 启动所有服务（-d 后台运行）
docker compose up -d

# 查看运行状态
docker compose ps

# 查看日志（实时跟踪所有服务）
docker compose logs -f

# 只查看 app 的日志
docker compose logs -f app
```

### 6.5 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"123456"}'

# 查看 Swagger 文档
# 浏览器打开 http://localhost:3000/api-docs
```

### 6.6 常用管理命令

```bash
# 停止所有服务
docker compose stop

# 停止并删除所有容器、网络
docker compose down

# 停止并删除所有容器、网络、数据卷（⚠️ 数据会丢失）
docker compose down -v

# 重新构建并启动（代码修改后）
docker compose up -d --build

# 进入 app 容器
docker compose exec app sh

# 在 app 容器中执行 Prisma 迁移
docker compose exec app npx prisma migrate dev

# 查看资源占用
docker stats
```

---

## 七、Docker 网络详解

### 7.1 容器间通信

在 Docker Compose 中，所有服务自动加入同一个网络。容器之间可以用**服务名**作为主机名互相访问：

```
┌─────────────────────────────────────────────┐
│  Docker 网络 (app-network)                   │
│                                              │
│  ┌──────┐    ┌──────────┐    ┌───────┐     │
│  │ app  │───→│ postgres │    │ redis │     │
│  │:3000 │    │  :5432   │    │ :6379 │     │
│  └──────┘    └──────────┘    └───────┘     │
│     │                             ↑         │
│     └─────────────────────────────┘         │
│     通过服务名访问：                           │
│     postgres:5432, redis:6379               │
└─────────────────────────────────────────────┘
```

### 7.2 为什么用服务名而不是 localhost

在容器内部，`localhost` 指的是容器自己，不是宿主机。要访问其他容器，必须用服务名：

```javascript
// ❌ 错误：localhost 指的是 app 容器自己
const dbUrl = 'postgresql://postgres:postgres@localhost:5432/blog_db'

// ✅ 正确：用服务名 "postgres" 访问数据库容器
const dbUrl = 'postgresql://postgres:postgres@postgres:5432/blog_db'
```

---

## 八、数据持久化

### 8.1 容器是临时的

容器被删除后，容器内的所有数据都会丢失。所以数据库数据、上传文件等重要数据必须持久化。

### 8.2 Volume vs Bind Mount

```yaml
volumes:
  # 命名卷（Named Volume）
  # Docker 管理，数据存储在 Docker 的数据目录中
  # 适合：数据库数据、生产环境
  - postgres_data:/var/lib/postgresql/data

  # 绑定挂载（Bind Mount）
  # 直接映射宿主机的目录
  # 适合：开发时的代码热更新、日志文件
  - ./src:/app/src
  - ./logs:/app/logs
```

### 8.3 数据备份

```bash
# 备份 PostgreSQL 数据
docker compose exec postgres pg_dump -U postgres blog_db > backup.sql

# 恢复数据
cat backup.sql | docker compose exec -T postgres psql -U postgres blog_db
```

---

## 九、镜像优化

### 9.1 选择小基础镜像

```dockerfile
# ❌ 大（~1GB）
FROM node:20

# ✅ 小（~130MB）
FROM node:20-alpine
```

### 9.2 利用构建缓存

Docker 会缓存每一层的构建结果。如果某一层的输入没有变化，就直接使用缓存。

**技巧**：把不常变化的指令放前面，常变化的放后面。

```dockerfile
# ✅ 优化：先复制依赖文件，再复制源代码
COPY package.json pnpm-lock.yaml ./    # 不常变化，会被缓存
RUN npm install                         # 不常变化，会被缓存
COPY . .                                # 源代码常变化
RUN npm run build                       # 源代码变化才重新构建
```

```dockerfile
# ❌ 不优化：每次修改源代码都要重新安装依赖
COPY . .
RUN npm install
RUN npm run build
```

### 9.3 减少层数

```dockerfile
# ❌ 3 层
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# ✅ 1 层
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
```

---

## 十、常用 Docker 命令速查表

| 命令 | 说明 |
|------|------|
| `docker pull <镜像>` | 拉取镜像 |
| `docker images` | 列出本地镜像 |
| `docker rmi <镜像>` | 删除镜像 |
| `docker image prune` | 清理无用镜像 |
| `docker run -d -p <端口> --name <名称> <镜像>` | 创建并启动容器 |
| `docker ps` | 查看运行中的容器 |
| `docker ps -a` | 查看所有容器 |
| `docker logs -f <容器>` | 实时查看日志 |
| `docker exec -it <容器> /bin/sh` | 进入容器 |
| `docker stop <容器>` | 停止容器 |
| `docker start <容器>` | 启动容器 |
| `docker restart <容器>` | 重启容器 |
| `docker rm -f <容器>` | 强制删除容器 |
| `docker container prune` | 清理停止的容器 |
| `docker stats` | 查看资源占用 |
| `docker compose up -d` | 启动所有服务 |
| `docker compose down` | 停止并删除所有容器 |
| `docker compose down -v` | 同上，包括数据卷 |
| `docker compose logs -f` | 查看所有服务日志 |
| `docker compose ps` | 查看服务状态 |
| `docker compose build` | 构建镜像 |
| `docker compose up -d --build` | 重新构建并启动 |
| `docker compose exec <服务> <命令>` | 在服务中执行命令 |

---

## 十一、动手练习

### 练习 1：用 Docker 运行 Redis 并操作

```bash
# 拉取并运行 Redis
docker run -d --name my-redis -p 6379:6379 redis:7-alpine

# 进入 Redis 容器
docker exec -it my-redis redis-cli

# 在 Redis 中执行命令
SET name "hello"
GET name
KEYS *
EXIT

# 清理
docker rm -f my-redis
```

### 练习 2：为自己的项目编写 Dockerfile

选择你之前课程中写的一个 Node.js 项目，为它编写 Dockerfile：

1. 使用 `node:20-alpine` 作为基础镜像
2. 设置工作目录
3. 复制依赖文件并安装
4. 复制源代码
5. 声明端口
6. 设置启动命令

### 练习 3：编写完整的 docker-compose.yml

为博客项目编写 docker-compose.yml，包含：

1. Node.js 应用服务
2. PostgreSQL 数据库
3. Redis 缓存
4. 正确的环境变量、端口映射、数据卷
5. 健康检查和依赖关系

---

## 参考答案

### 练习 1：用 Docker 运行 Redis 并操作

**思路**：使用 `docker run` 启动 Redis 容器，通过 `docker exec` 进入容器执行命令，最后清理容器。

**答案**：

```bash
# 1. 拉取 Redis Alpine 镜像
docker pull redis:7-alpine

# 2. 后台运行 Redis 容器
docker run -d --name my-redis -p 6379:6379 redis:7-alpine

# 3. 查看容器运行状态
docker ps

# 4. 进入 Redis 容器的交互式命令行
docker exec -it my-redis redis-cli

# 5. 在 redis-cli 中执行以下命令
SET name "hello"
# 返回 OK
GET name
# 返回 "hello"
SET counter 100
INCR counter
# 返回 101
KEYS *
# 返回所有 key 列表
EXIT

# 6. 查看 Redis 容器日志
docker logs my-redis

# 7. 停止并删除容器
docker stop my-redis
docker rm my-redis
# 或者一步完成：docker rm -f my-redis
```

**要点**：
- `docker run -d` 后台运行，`-p` 做端口映射，`--name` 给容器起名
- `docker exec -it` 进入容器，`-i` 保持标准输入开放，`-t` 分配伪终端
- 容器用完后及时清理（`docker rm -f`），避免占用资源
- Alpine 镜像体积小（约 30MB），适合 Redis 这类轻量服务

### 练习 2：为自己的项目编写 Dockerfile

**思路**：采用两阶段构建——第一阶段安装依赖并编译 TypeScript，第二阶段只复制运行时需要的文件，减小镜像体积。

**答案**：

```dockerfile
# ============ 第一阶段：构建 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层，依赖没变时不会重新安装）
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 devDependencies）
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 如果使用了 Prisma，生成 Client
RUN npx prisma generate

# 编译 TypeScript
RUN pnpm build

# ============ 第二阶段：生产 ============
FROM node:20-alpine AS production

WORKDIR /app

# 只复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# 从构建阶段复制编译产物和 Prisma 相关文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 创建必要目录
RUN mkdir -p uploads logs

# 声明应用端口
EXPOSE 3000

# 启动命令：先执行数据库迁移，再启动应用
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
```

**要点**：
- 多阶段构建让最终镜像不包含 TypeScript、tsx 等开发工具，体积从约 800MB 降到约 200MB
- 先复制 `package.json` 再 `COPY . .`，依赖没变时能命中 Docker 缓存，构建速度快 10 倍
- 使用 `node:20-alpine` 而非 `node:20`，基础镜像从 1GB 缩小到 130MB
- `--frozen-lockfile` 确保安装的版本和 lock 文件完全一致

### 练习 3：编写完整的 docker-compose.yml

**思路**：定义三个服务（app、postgres、redis），配置健康检查确保依赖服务就绪后再启动应用，使用命名卷持久化数据库数据。

**答案**：

```yaml
version: '3.8'

services:
  # ============ 应用服务 ============
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/blog_db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET:-change-this-in-production}
      - SESSION_SECRET=${SESSION_SECRET:-change-this-in-production}
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - app-network

  # ============ PostgreSQL 数据库 ============
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=blog_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  # ============ Redis 缓存 ============
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

# ============ 命名卷 ============
volumes:
  postgres_data:
  redis_data:
  uploads:

# ============ 网络 ============
networks:
  app-network:
    driver: bridge
```

**要点**：
- `depends_on` + `condition: service_healthy` 确保 PostgreSQL 真正就绪后才启动 app，比单纯 `depends_on` 可靠
- 数据库密码不应硬编码在 compose 文件中，应通过 `.env` 文件或环境变量注入
- 容器间通信用服务名（`postgres:5432`）而非 `localhost`，因为 `localhost` 在容器内指向容器自己
- 命名卷（`postgres_data`）独立于容器存在，`docker rm` 后数据不丢失

---

## 常见误区

1. **把 `node_modules` 复制到容器中**：Windows 编译的 `node_modules` 包含原生模块（如 bcrypt），直接复制到 Linux 容器中会因为架构不兼容而报错。应该在 Dockerfile 中用 `npm ci` 重新安装。

2. **不用 `.dockerignore` 文件**：`COPY . .` 会把 `.git`、`node_modules`、`.env` 等不需要的文件全部复制到镜像中，导致构建缓慢且可能泄露敏感信息。必须创建 `.dockerignore` 排除这些文件。

3. **数据不持久化**：数据库数据直接存在容器内部，`docker rm` 删除容器后数据全部丢失。必须用命名卷（Volume）持久化数据库数据、上传文件等重要数据。

4. **容器间通信用 `localhost`**：在容器 A 中用 `localhost:5432` 连接容器 B 的 PostgreSQL，结果连不上。容器有自己独立的网络，`localhost` 指的是容器自己。必须用服务名（如 `postgres:5432`）访问其他容器。

---

## 工程建议

1. **先复制依赖文件再复制源代码**：`COPY package.json ./ → RUN npm ci → COPY . .`。这样依赖没变时会命中 Docker 缓存，不需要重新安装依赖，构建速度提升 10 倍。

2. **用 Alpine 基础镜像减小体积**：`node:20` 约 1GB，`node:20-alpine` 约 130MB。Alpine 是极小的 Linux 发行版，对于 Node.js 应用完全够用。

3. **健康检查要在 Compose 中配置**：`healthcheck` + `condition: service_healthy` 确保依赖服务真正就绪后才启动应用。比单纯的 `depends_on`（只保证启动顺序）可靠得多。

4. **本地开发用绑定挂载，生产用命名卷**：开发时 `./src:/app/src` 实现代码热更新；生产时 `postgres_data:/var/lib/postgresql/data` 确保数据持久化且不依赖宿主机路径。

---

## 小结

本课时我们从零开始学习了 Docker：

| 概念 | 说明 |
|------|------|
| **镜像** | 只读模板，包含运行应用的一切 |
| **容器** | 镜像的运行实例 |
| **Dockerfile** | 构建镜像的配方 |
| **Docker Compose** | 多容器编排工具 |
| **Volume** | 数据持久化 |
| **Network** | 容器间通信 |

**核心记忆**：
- `docker run` 创建并启动容器
- `Dockerfile` 定义如何构建镜像
- `docker-compose.yml` 定义如何编排多个服务
- 数据要持久化，用 Volume
- 容器间通信用服务名，不用 localhost

Docker 是后端开发的基础设施，几乎所有的现代项目都在使用。掌握它之后，你会发现部署和环境管理变得异常简单。

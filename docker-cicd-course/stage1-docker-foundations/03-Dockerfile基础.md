# 第三课：Dockerfile 基础

> **课程定位**：学会用 Dockerfile 描述应用的运行环境，包括构建上下文和 .dockerignore
> **前置知识**：理解镜像、容器的概念（第二课）
> **预计时长**：50 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 Dockerfile 的工作原理
2. 掌握常用指令：FROM、RUN、COPY、WORKDIR、EXPOSE、CMD
3. 理解构建上下文和 .dockerignore 的作用
4. 掌握构建缓存优化策略

---

## 一、Dockerfile 是什么

### 1.1 一句话定义

> **Dockerfile 是一个文本文件，包含了一系列指令，告诉 Docker 如何构建一个镜像。**

```
类比：

  Dockerfile   ≈  菜谱
  docker build ≈  按照菜谱做菜
  镜像         ≈  做好的半成品菜

  菜谱说：
    1. 准备一个干净的盘子     → FROM
    2. 放入米饭              → COPY
    3. 加入调料              → RUN
    4. 最后撒上葱花           → CMD
```

### 1.2 一个最简单的 Dockerfile

```dockerfile
# 基于 Node.js 18 的 Alpine 版本
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package.json .

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/index.js"]
```

---

## 二、核心指令详解

### 2.1 FROM —— 指定基础镜像

每个 Dockerfile 的第一行必须是 `FROM`，它指定了构建的基础镜像。

```
选择基础镜像的原则：

  ┌──────────────────────────────────────────────────┐
  │  镜像大小对比（Node.js 18）                       │
  │                                                   │
  │  node:18          ~900MB  ← 完整版，包含很多工具   │
  │  node:18-slim     ~200MB  ← 精简版，够用          │
  │  node:18-alpine   ~170MB  ← Alpine 版，最小       │
  └──────────────────────────────────────────────────┘

  建议：
  - 开发环境：node:18（工具全，方便调试）
  - 生产环境：node:18-alpine（体积小，安全）
  - 特殊需求：node:18-slim（兼容性好，体积适中）
```

### 2.2 RUN —— 执行命令

`RUN` 指令在构建时执行命令，结果会保存为新的一层。

```
RUN 的两种形式：

  Shell 形式（推荐用于简单命令）：
    RUN npm install
    # 等同于：/bin/sh -c "npm install"

  Exec 形式（推荐用于避免 shell 问题）：
    RUN ["npm", "install"]
    # 直接执行，不经过 shell
```

**最佳实践：合并 RUN 指令减少层数**

```dockerfile
# ❌ 不好：每条 RUN 创建一层
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN rm -rf /var/lib/apt/lists/*

# ✅ 好：合并为一层
RUN apt-get update \
    && apt-get install -y curl wget \
    && rm -rf /var/lib/apt/lists/*
```

### 2.3 COPY —— 复制文件

`COPY` 把文件从构建上下文复制到镜像中。

```dockerfile
# 复制单个文件
COPY package.json /app/

# 复制整个目录
COPY src/ /app/src/

# 使用通配符
COPY package*.json /app/

# 多文件复制
COPY package.json package-lock.json /app/
```

```
COPY vs ADD：

  COPY：纯粹的文件复制（推荐）
  ADD：复制 + 自动解压 + 支持 URL（不推荐）

  建议：除非需要自动解压，否则始终用 COPY
  原因：ADD 的行为不直观，容易出错
```

### 2.4 WORKDIR —— 设置工作目录

```dockerfile
# 设置工作目录（不存在会自动创建）
WORKDIR /app

# 后续的 RUN、COPY、CMD 等指令都在这个目录下执行
COPY . .              # 复制到 /app/
RUN npm install       # 在 /app/ 下执行
CMD ["node", "index.js"]  # 在 /app/ 下执行
```

```
WORKDIR vs RUN cd：

  ❌ 错误：RUN cd /app && npm install
     下一条 RUN 还是在根目录

  ✅ 正确：WORKDIR /app
           RUN npm install
     下一条 RUN 也在 /app 目录
```

### 2.5 EXPOSE —— 声明端口

```dockerfile
# 声明容器运行时监听的端口
EXPOSE 3000

# 声明多个端口
EXPOSE 3000 3001
```

```
EXPOSE 的含义：

  EXPOSE 只是声明，不是实际映射。
  它告诉使用者"这个镜像需要使用 3000 端口"。

  实际映射需要在 docker run 时指定：
    docker run -p 3000:3000 my-app

  类比：
    EXPOSE ≈ 菜谱上写的"需要烤箱"
    -p     ≈ 你实际打开烤箱
```

### 2.6 CMD —— 容器启动命令

```dockerfile
# Exec 形式（推荐）
CMD ["node", "src/index.js"]

# Shell 形式
CMD node src/index.js
```

```
CMD vs ENTRYPOINT：

  CMD：
    - 容器启动时的默认命令
    - 可以被 docker run 的参数覆盖
    - 一个 Dockerfile 只有最后一个 CMD 生效

  ENTRYPOINT：
    - 容器的主命令，不容易被覆盖
    - docker run 的参数会追加到 ENTRYPOINT 后面

  示例：
    # Dockerfile
    ENTRYPOINT ["node"]
    CMD ["src/index.js"]

    # 运行
    docker run my-app              → node src/index.js
    docker run my-app other.js     → node other.js
```

### 2.7 ENV —— 设置环境变量

```dockerfile
# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 在后续指令中使用
RUN echo $NODE_ENV

# 容器运行时也有效（应用可通过 process.env 获取）
CMD ["node", "src/index.js"]
```

### 2.8 ARG —— 构建参数

```dockerfile
# 定义构建时的变量
ARG NODE_VERSION=18

# 在 FROM 中使用
FROM node:${NODE_VERSION}-alpine
```

```bash
# 构建时传入参数
docker build --build-arg NODE_VERSION=20 .
```

```
ARG vs ENV：

  ARG：只在构建时有效，容器运行时不存在
  ENV：构建时和运行时都有效

  安全建议：
    密码、密钥等敏感信息不要用 ARG 或 ENV
    应该在运行时通过 docker run -e 或 .env 文件传入
```

---

## 三、构建上下文与 .dockerignore

### 3.1 什么是构建上下文

```
docker build 命令：

  docker build -t my-app .
                      ↑
                      这个 "." 就是构建上下文

  构建上下文 = docker build 时发送给 Docker 引擎的文件集合

  ┌─────────────────────────────────────────┐
  │           构建上下文                      │
  │                                          │
  │  ./                                      │
  │  ├── Dockerfile                          │
  │  ├── package.json          ← 会被发送    │
  │  ├── package-lock.json     ← 会被发送    │
  │  ├── src/                  ← 会被发送    │
  │  ├── node_modules          ← 不需要发送  │
  │  └── .git                   ← 不需要发送  │
  └─────────────────────────────────────────┘
```

### 3.2 为什么构建上下文很重要

```
问题：

  如果你的项目有 500MB（包括 node_modules、.git 等），
  每次 docker build 都要发送 500MB 给 Docker 引擎。

  没有 .dockerignore：
    每次 docker build 发送 300MB → 构建慢
    node_modules 进入镜像        → 镜像大
    .env 进入镜像               → 安全风险

  有 .dockerignore：
    每次 docker build 发送 5MB   → 构建快 60 倍
    只复制需要的文件             → 镜像小
    敏感文件被排除               → 安全
```

### 3.3 .dockerignore 语法

```
.dockerignore 的语法和 .gitignore 类似：

  # 注释
  node_modules          ← 排除 node_modules 目录
  *.log                 ← 排除所有 .log 文件
  .git                  ← 排除 .git 目录
  !package-lock.json    ← 例外：不排除

  规则详解：
  ┌──────────────────┬────────────────────────────────┐
  │  模式             │  含义                          │
  ├──────────────────┼────────────────────────────────┤
  │  node_modules    │  排除 node_modules 目录         │
  │  *.log           │  排除所有 .log 结尾的文件        │
  │  **/*.log        │  排除任意深度的 .log 文件        │
  │  .env*           │  排除所有 .env 开头的文件        │
  │  !important.log  │  例外规则：不排除               │
  └──────────────────┴────────────────────────────────┘
```

### 3.4 Node.js 项目的 .dockerignore 模板

```dockerignore
# ---- 依赖和缓存 ----
node_modules
npm-debug.log*
.npm

# ---- 构建产物 ----
dist
build
.next
coverage

# ---- 版本控制 ----
.git
.gitignore

# ---- IDE ----
.vscode
.idea

# ---- 环境变量（安全！）----
.env
.env.local
.env.*.local

# ---- Docker 相关 ----
Dockerfile*
docker-compose*.yml
.dockerignore

# ---- 测试 ----
*.test.js
*.test.ts
__tests__
```

### 3.5 安全考量：敏感文件泄露

```
危险：敏感文件进入镜像

  如果 .env 包含数据库密码、API 密钥：
    DATABASE_URL=postgres://user:password@host/db
    API_KEY=sk-1234567890

  如果没有 .dockerignore 排除 .env：
    docker build → .env 进入镜像 → 推送到仓库 → 任何人可以查看

  即使后来删除了 .env：
    镜像的分层存储中仍然保留着旧层
    可以通过 docker history 看到

安全检查清单：
  ✅ .env 文件是否被排除？
  ✅ 密钥文件（*.pem, *.key）是否被排除？
  ✅ .git 目录是否被排除？
  ✅ 配置文件中的密码是否用环境变量替代？
```

### 3.6 使用 BuildKit 的秘密挂载

```dockerfile
# 如果构建时确实需要密钥（如 npm 私有仓库认证）
# 使用 BuildKit 的 secret mount，不会进入镜像

# syntax=docker/dockerfile:1
FROM node:18-alpine

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

```bash
# 构建时传入密钥
echo "//registry.npmjs.org/:_authToken=xxx" > .npmrc
docker build --secret id=npmrc,src=.npmrc -t my-app .
rm .npmrc
```

### 3.7 构建命令详解

```bash
# 基本构建
docker build -t my-app:1.0 .

# 指定 Dockerfile 路径
docker build -f Dockerfile.prod -t my-app:prod .

# 传入构建参数
docker build --build-arg NODE_ENV=production -t my-app .

# 不使用缓存
docker build --no-cache -t my-app .

# 指定目标阶段（多阶段构建时）
docker build --target production -t my-app .
```

---

## 四、完整示例：Node.js API

### 4.1 项目结构

```
my-api/
├── Dockerfile
├── .dockerignore
├── package.json
├── package-lock.json
└── src/
    └── index.js
```

### 4.2 应用代码

```javascript
// src/index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Docker!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 4.3 Dockerfile

```dockerfile
# 1. 基础镜像
FROM node:18-alpine

# 2. 设置工作目录
WORKDIR /app

# 3. 复制依赖文件（利用缓存）
COPY package.json package-lock.json ./

# 4. 安装依赖
RUN npm ci --only=production

# 5. 复制源代码
COPY src/ ./src/

# 6. 创建非 root 用户（安全）
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeuser -u 1001
USER nodeuser

# 7. 暴露端口
EXPOSE 3000

# 8. 启动命令
CMD ["node", "src/index.js"]
```

### 4.4 .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
Dockerfile
docker-compose.yml
README.md
```

### 4.5 构建和运行

```bash
# 构建镜像
docker build -t my-api:1.0 .

# 运行容器
docker run -d --name api -p 3000:3000 my-api:1.0

# 测试
curl http://localhost:3000
curl http://localhost:3000/health

# 查看日志
docker logs api

# 停止并删除
docker rm -f api
```

---

## 五、构建缓存优化

### 5.1 缓存的工作原理

```
Docker 逐层构建，每一层都会检查是否有缓存：

  Step 1: FROM node:18-alpine    → 缓存命中（基础镜像没变）
  Step 2: WORKDIR /app           → 缓存命中
  Step 3: COPY package.json .    → 检查文件是否变化
    - 如果 package.json 没变 → 缓存命中
    - 如果 package.json 变了 → 缓存失效，后续全部重建
  Step 4: RUN npm install        → 依赖 Step 3
  Step 5: COPY src/ ./src/       → 检查文件是否变化
```

### 5.2 优化策略：先复制依赖文件

```dockerfile
# ❌ 不好：每次修改代码都要重新安装依赖
COPY . .
RUN npm install

# ✅ 好：依赖没变就不需要重新安装
COPY package.json package-lock.json ./
RUN npm install
COPY . .
```

```
为什么这样优化？

  场景：你修改了 src/index.js

  ❌ 不好的写法：
    COPY . .                    ← 缓存失效（文件变了）
    RUN npm install             ← 缓存失效，重新安装依赖（30秒+）

  ✅ 好的写法：
    COPY package.json ...       ← 缓存命中（package.json 没变）
    RUN npm install             ← 缓存命中，跳过！
    COPY . .                    ← 缓存失效（文件变了）
    后续步骤重建...

  节省时间：npm install 可能需要 30 秒以上
```

---

## 六、常见错误和解决

### 6.1 COPY failed: file not found

```
原因：文件不在构建上下文中

  检查：
  1. 文件是否在当前目录下
  2. 是否被 .dockerignore 排除了
  3. 文件名大小写是否正确
```

### 6.2 npm install 失败

```
原因：网络问题或依赖冲突

  解决方案：
  1. 使用 npm ci 代替 npm install（更可靠）
  2. 在 Dockerfile 中设置 npm 镜像源
     RUN npm config set registry https://registry.npmmirror.com
  3. 使用 --no-cache 重新构建
```

### 6.3 权限问题

```
原因：容器内默认是 root 用户

  解决方案：创建专用用户并切换
  RUN addgroup -g 1001 -S nodejs \
      && adduser -S nodeuser -u 1001
  USER nodeuser
```

### 6.4 .dockerignore 不生效

```
可能原因：

  1. 文件名拼写错误
     ❌ .docker-ignore
     ✅ .dockerignore

  2. 文件不在构建上下文根目录
     ❌ ./src/.dockerignore
     ✅ ./.dockerignore

  3. 构建上下文路径不对
     在项目根目录执行 docker build .
```

---

## 七、动手练习

### 练习一：基础 Dockerfile

为以下 Node.js 脚本编写 Dockerfile：

```javascript
// app.js
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Docker!\n');
});
server.listen(3000, () => console.log('Server on port 3000'));
```

要求：使用 node:18-alpine、WORKDIR /app、暴露 3000 端口。

### 练习二：带依赖的项目

```bash
mkdir express-docker && cd express-docker
npm init -y
npm install express
# 创建 src/index.js（Express 示例）
# 编写 Dockerfile
# 创建 .dockerignore
docker build -t express-demo .
docker run -d -p 3000:3000 express-demo
```

### 练习三：调试构建过程

```bash
# 1. 故意在 Dockerfile 中写一个错误
# 2. 运行 docker build，观察错误信息
# 3. 使用中间镜像调试
docker build -t debug-app .
docker run -it <last-successful-image-id> /bin/sh
```

---

## 小结

1. **Dockerfile 是镜像的构建配方**，由一系列指令组成
2. **核心指令**：FROM（基础镜像）、RUN（执行命令）、COPY（复制文件）、WORKDIR（工作目录）、EXPOSE（声明端口）、CMD（启动命令）
3. **构建上下文**是发送给 Docker 引擎的文件集合，用 `.dockerignore` 排除不需要的文件
4. **构建缓存**：按层缓存，先复制依赖文件再复制源码可以大幅加速构建
5. **安全实践**：使用非 root 用户、排除 .env、不泄露敏感信息

---

## 下一课预告

下一课我们将学习构建缓存深入和多阶段构建——如何把构建环境和运行环境分开，大幅减小镜像体积。

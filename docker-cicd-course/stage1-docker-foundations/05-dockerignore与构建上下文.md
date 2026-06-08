# 第五课：.dockerignore 与构建上下文

> **课程定位**：掌握构建上下文的精确控制，优化构建速度和安全性
> **前置知识**：Dockerfile 基础（第三课）
> **预计时长**：25 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解构建上下文的工作机制
2. 编写有效的 `.dockerignore` 文件
3. 知道哪些文件应该排除、哪些应该保留
4. 理解 `.dockerignore` 对构建速度和安全性的影响

---

## 一、构建上下文回顾

### 1.1 构建上下文是什么

```
docker build -t my-app .
                    ↑
                    构建上下文路径

  执行 docker build 时：
  1. Docker CLI 把"构建上下文"发送给 Docker Daemon
  2. Docker Daemon 在上下文中执行 Dockerfile 的指令
  3. COPY 和 ADD 指令只能访问上下文中的文件

  ┌─────────────────────────────────────────┐
  │           构建上下文                      │
  │                                          │
  │  项目目录下的所有文件                      │
  │  ├── Dockerfile                          │
  │  ├── package.json                        │
  │  ├── src/                                │
  │  ├── node_modules/    ← 可能几百MB       │
  │  ├── .git/            ← 可能几百MB       │
  │  └── .env             ← 含有敏感信息     │
  └─────────────────────────────────────────┘

  问题：node_modules 和 .git 不需要进入镜像，
       但每次构建都要发送给 Docker Daemon
```

### 1.2 没有 .dockerignore 的代价

```
一个典型的 Node.js 项目：

  项目总大小（含 node_modules）：~300MB
  实际需要的文件：~5MB

  没有 .dockerignore：
    每次 docker build 发送 300MB → 构建慢
    node_modules 进入镜像        → 镜像大
    .env 进入镜像               → 安全风险

  有 .dockerignore：
    每次 docker build 发送 5MB   → 构建快 60 倍
    只复制需要的文件             → 镜像小
    敏感文件被排除               → 安全
```

---

## 二、.dockerignore 语法

### 2.1 基本规则

```
.dockerignore 的语法和 .gitignore 类似：

  # 注释
  node_modules          ← 排除 node_modules 目录
  *.log                 ← 排除所有 .log 文件
  .git                  ← 排除 .git 目录
  !package-lock.json    ← 例外：不排除 package-lock.json

  规则详解：
  ┌──────────────────┬────────────────────────────────┐
  │  模式             │  含义                          │
  ├──────────────────┼────────────────────────────────┤
  │  node_modules    │  排除 node_modules 目录         │
  │  *.log           │  排除所有 .log 结尾的文件        │
  │  **/*.log        │  排除任意深度的 .log 文件        │
  │  .env*           │  排除所有 .env 开头的文件        │
  │  !important.log  │  例外规则：不排除               │
  │  # 注释          │  注释行                         │
  └──────────────────┴────────────────────────────────┘
```

### 2.2 匹配规则

```dockerignore
# 排除所有 .md 文件
*.md

# 但保留 README.md
!README.md

# 排除根目录下的 build 目录
/build

# 排除任意位置的 build 目录
**/build

# 排除 temp 目录下的所有文件
temp/*

# 排除所有隐藏文件
.*

# 但保留 .dockerignore 自身（可选）
!.dockerignore
```

---

## 三、Node.js 项目的 .dockerignore

### 3.1 推荐模板

```dockerignore
# ---- 依赖和缓存 ----
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn

# ---- 构建产物 ----
dist
build
.next
coverage

# ---- 版本控制 ----
.git
.gitignore

# ---- IDE 和编辑器 ----
.vscode
.idea
*.swp
*.swo
*~

# ---- 环境变量（安全！）----
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# ---- Docker 相关 ----
Dockerfile*
docker-compose*.yml
.dockerignore

# ---- 文档 ----
README.md
LICENSE
CHANGELOG.md
docs

# ---- 测试 ----
__tests__
*.test.js
*.test.ts
*.spec.js
*.spec.ts
jest.config.js
vitest.config.ts

# ---- 系统文件 ----
.DS_Store
Thumbs.db
```

### 3.2 分场景模板

```dockerignore
# ---- 生产环境专用 ----

# 排除所有开发依赖
node_modules
*.test.*
*.spec.*
__tests__
coverage

# 排除开发工具配置
.eslintrc*
.prettierrc*
tsconfig.json    # 如果构建阶段已经编译完成
jest.config.*

# 排除文档
*.md
docs

# 排除 CI/CD 配置
.github
.gitlab-ci.yml
```

---

## 四、其他项目的 .dockerignore

### 4.1 Python 项目

```dockerignore
# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv
.venv
pip-log.txt
pip-delete-this-directory.txt

# 测试
.pytest_cache
.coverage
htmlcov

# IDE
.vscode
.idea
```

### 4.2 Go 项目

```dockerignore
# Go
vendor
*.exe
*.exe~
*.dll
*.so
*.dylib

# 测试
*.test
*.out
coverage.txt

# IDE
.vscode
.idea
```

### 4.3 通用模板

```dockerignore
# 版本控制
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# 环境变量
.env
.env.*

# Docker
Dockerfile*
docker-compose*.yml
.dockerignore

# 文档
README.md
LICENSE
*.md

# 系统
.DS_Store
Thumbs.db
```

---

## 五、安全考量

### 5.1 敏感文件泄露风险

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
```

### 5.2 安全检查清单

```
构建前检查：

  ✅ .env 文件是否被排除？
  ✅ 密钥文件是否被排除？
  ✅ .git 目录是否被排除？（可能包含敏感提交信息）
  ✅ 私钥文件（*.pem, *.key）是否被排除？
  ✅ 配置文件中的密码是否用环境变量替代？

  验证方法：
  docker build -t test .
  docker run -it test /bin/sh
  # 在容器内检查是否有敏感文件
  ls -la /app/
  cat /app/.env  # 应该不存在
```

### 5.3 使用 BuildKit 的秘密挂载

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

---

## 六、构建速度优化

### 6.1 对比实验

```bash
# 没有 .dockerignore
time docker build -t test:no-ignore .
# 输出：Sending build context to Docker daemon  312MB
# 耗时：45 秒

# 有 .dockerignore
time docker build -t test:with-ignore .
# 输出：Sending build context to Docker daemon  2.5MB
# 耗时：3 秒

# 速度提升：15 倍
```

### 6.2 检查构建上下文大小

```bash
# 构建时会显示上下文大小
docker build -t my-app .
# Sending build context to Docker daemon  2.56MB

# 如果数字很大，检查 .dockerignore 是否生效
```

---

## 七、常见问题

### 7.1 .dockerignore 不生效

```
可能原因：

1. 文件名拼写错误
   ❌ .docker-ignore
   ❌ dockerignore
   ✅ .dockerignore

2. 文件不在构建上下文根目录
   ❌ ./src/.dockerignore
   ✅ ./.dockerignore

3. 规则写法错误
   ❌ /node_modules/    ← 前后加斜杠可能不识别
   ✅ node_modules

4. 构建上下文路径不对
   ❌ docker build -f ../Dockerfile .
   ✅ 在项目根目录执行 docker build .
```

### 7.2 排除了需要的文件

```
问题：COPY package.json . 报错 "file not found"

原因：package.json 被 .dockerignore 排除了

解决：使用 ! 例外规则
```

```dockerignore
# 排除所有 json
*.json

# 但保留 package.json
!package.json
!package-lock.json
```

### 7.3 调试 .dockerignore

```bash
# 方法一：查看发送的上下文大小
docker build -t test .
# Sending build context to Docker daemon  X.XMB

# 方法二：使用 BuildKit 的检查功能
DOCKER_BUILDKIT=1 docker build --progress=plain -t test .

# 方法三：在 Dockerfile 中列出文件
RUN ls -la /app/
```

---

## 八、动手练习

### 练习一：创建 .dockerignore

```bash
# 1. 查看当前项目的文件结构
find . -maxdepth 2 -type f | head -30

# 2. 估算项目大小
du -sh . node_modules .git

# 3. 创建 .dockerignore，排除不需要的文件

# 4. 再次构建，对比上下文大小
docker build -t test:optimized .
```

### 练习二：安全检查

```bash
# 1. 创建一个包含 .env 的项目
echo "DB_PASSWORD=secret123" > .env

# 2. 不使用 .dockerignore 构建
docker build -t test:unsafe .

# 3. 检查镜像中是否有 .env
docker run -it test:unsafe cat /app/.env

# 4. 添加 .dockerignore 后重新构建
echo ".env" >> .dockerignore
docker build -t test:safe .

# 5. 验证 .env 不在镜像中
docker run -it test:safe cat /app/.env
```

### 练习三：优化构建速度

```bash
# 1. 计时：没有 .dockerignore 的构建
time docker build -t speed-test:1 .

# 2. 添加 .dockerignore
# 3. 计时：有 .dockerignore 的构建
time docker build -t speed-test:2 .

# 4. 对比结果
```

---

## 小结

本课的核心要点：

1. **构建上下文**是 `docker build` 发送给 Docker Daemon 的文件集合
2. **`.dockerignore`** 排除不需要的文件，和 `.gitignore` 语法类似
3. **安全**：必须排除 `.env`、密钥等敏感文件
4. **速度**：排除 `node_modules`、`.git` 等大目录可以大幅加速构建
5. **推荐模板**：Node.js 项目至少排除 `node_modules`、`.git`、`.env`、`Dockerfile`

---

## 下一课预告

下一课我们将学习镜像体积优化和安全基础——如何让镜像更小、更安全。

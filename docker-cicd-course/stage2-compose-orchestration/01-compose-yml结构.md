# 第一课：compose.yml 结构

> **课程定位**：理解 Docker Compose 的核心概念和文件结构
> **前置知识**：Docker 基础、Dockerfile（第一阶段）
> **预计时长**：30 分钟

---

## 场景引入

你的项目有三个服务：Node.js API、PostgreSQL 数据库、Redis 缓存。每次启动项目，你都要打开三个终端窗口，分别执行三条 `docker run` 命令，还要记清楚网络名、端口映射、环境变量。某天你漏了一个参数，数据库连接不上，排查了半小时。你开始想：能不能把这些命令写成一个配置文件，一条命令搞定？

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 Docker Compose 解决什么问题
2. 掌握 compose.yml 的基本结构
3. 理解 service、network、volume 的关系
4. 使用 docker compose 命令管理多容器应用

---

## 一、为什么需要 Docker Compose

### 1.1 单容器的局限

```
一个真实的 Web 应用通常需要多个服务：

  ┌─────────────────────────────────────────┐
  │           你的应用                        │
  │                                          │
  │  ┌────────┐  ┌────────┐  ┌────────┐    │
  │  │ Web App│  │Database│  │ Cache  │    │
  │  │ Node.js│  │Postgres│  │ Redis  │    │
  │  └────────┘  └────────┘  └────────┘    │
  └─────────────────────────────────────────┘

  如果用 docker run 逐个启动：

  docker network create app-net
  docker volume create pgdata
  docker run -d --name postgres --network app-net -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=secret postgres:14
  docker run -d --name redis --network app-net redis:7
  docker run -d --name app --network app-net -p 3000:3000 -e DATABASE_URL=... my-app

  问题：
  ├── 命令太长，容易出错
  ├── 启动顺序难控制
  ├── 环境变量散落在命令中
  └── 无法一键启停所有服务
```

### 1.2 Docker Compose 的解决方案

```
Docker Compose = 用一个 YAML 文件描述所有服务，一条命令管理

  docker compose up -d      ← 启动所有服务
  docker compose down       ← 停止所有服务
  docker compose logs       ← 查看所有日志
  docker compose ps         ← 查看所有状态
```

---

## 二、compose.yml 基本结构

### 2.1 最小示例

```yaml
# compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
```

### 2.2 完整结构

```yaml
# 顶层配置
name: my-project           # 项目名称（可选）

# 服务定义
services:
  app:                     # 服务名称
    build: .               # 构建配置
    ports:                 # 端口映射
      - "3000:3000"
    environment:           # 环境变量
      - NODE_ENV=production
    depends_on:            # 依赖关系
      - postgres
    networks:              # 网络
      - app-network

  postgres:
    image: postgres:14     # 使用现成镜像
    volumes:               # 数据卷
      - pgdata:/var/lib/postgresql/data
    networks:
      - app-network

# 网络定义
networks:
  app-network:
    driver: bridge

# 卷定义
volumes:
  pgdata:
```

### 2.3 顶层元素说明

```
compose.yml 的四个顶层元素：

  ┌─────────────────────────────────────────────────────┐
  │  services     定义各个服务（容器）                    │
  │  networks     定义网络                               │
  │  volumes      定义持久化卷                           │
  │  configs      定义配置文件（高级）                    │
  └─────────────────────────────────────────────────────┘

  其中 services 是必须的，其他可选。
```

---

## 三、services 详解

### 3.1 镜像来源

```yaml
services:
  # 方式一：使用现成镜像
  postgres:
    image: postgres:14

  # 方式二：从 Dockerfile 构建
  app:
    build: .                        # 使用当前目录的 Dockerfile
    build:
      context: .                    # 构建上下文
      dockerfile: Dockerfile.prod   # 指定 Dockerfile

  # 方式三：同时指定 image 和 build
  app:
    build: .
    image: my-app:1.0               # 构建后打上这个标签
```

### 3.2 端口映射

```yaml
services:
  app:
    ports:
      - "3000:3000"           # 宿主机端口:容器端口
      - "8080:80"             # 宿主机 8080 映射到容器 80
      - "127.0.0.1:3000:3000" # 只允许本地访问
      - "3000"               # 随机分配宿主机端口
```

### 3.3 环境变量

```yaml
services:
  app:
    # 方式一：直接定义
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://user:pass@postgres:5432/db

    # 方式二：从 .env 文件读取
    env_file:
      - .env

    # 方式三：字典格式
    environment:
      NODE_ENV: production
      PORT: "3000"
```

> 这里只展示语法。如何安全地管理环境变量（.env 文件策略、多环境配置、密钥管理），详见第四课。

### 3.4 依赖关系

```yaml
services:
  app:
    depends_on:
      postgres:
        condition: service_healthy    # 等 postgres 健康后再启动
      redis:
        condition: service_started    # 等 redis 启动后

  postgres:
    image: postgres:14
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```

> `depends_on` 只保证容器启动，不保证服务就绪。配合 `healthcheck` + `condition: service_healthy` 才能确保服务真正可用。详见第六课。

---

## 四、常用命令

```bash
# 启动所有服务（后台运行）
docker compose up -d

# 启动并重新构建镜像
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并删除卷
docker compose down -v

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs
docker compose logs -f          # 实时跟踪
docker compose logs app         # 只看 app 的日志

# 重启某个服务
docker compose restart app

# 进入容器
docker compose exec app sh

# 执行一次性命令
docker compose run --rm app npm test

# 查看 compose 配置（检查语法）
docker compose config
```

---

## 五、动手练习

### 练习一：最小 Compose

创建一个最简单的 compose.yml：

```yaml
# compose.yml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
```

```bash
docker compose up -d
curl http://localhost:8080
docker compose down
```

### 练习二：多服务

```yaml
# compose.yml
services:
  app:
    image: node:18-alpine
    command: sh -c "echo 'Hello from Node' && sleep 3600"
    
  redis:
    image: redis:7
```

```bash
docker compose up -d
docker compose ps
docker compose logs app
docker compose down
```

---

## 常见误区

- **"depends_on 保证服务可用"**：`depends_on` 只保证容器启动，不保证服务就绪。数据库容器启动后还需要几秒初始化，必须配合 `healthcheck` + `condition: service_healthy` 才能确保服务真正可用。
- **"Compose 文件名必须是 docker-compose.yml"**：新版 Docker Compose 支持 `compose.yml` 作为默认文件名，不需要 `docker-` 前缀。两者都支持，但推荐用更简洁的 `compose.yml`。
- **"docker compose down 会删除所有数据"**：默认情况下 `down` 只停止和删除容器，不会删除 Volume 中的数据。加 `-v` 参数才会删除 Volume。
- **"Compose 只能用于开发环境"**：Compose 也适用于小型生产部署。对于不需要 Kubernetes 级别编排的项目，Compose 是更简单实用的选择。

---

## 工程建议

- **用 `docker compose config` 检查语法**：修改 compose.yml 后先跑 `config` 验证，避免启动时才发现格式错误。
- **为服务配置 `restart: unless-stopped`**：生产环境中服务崩溃后自动重启，但手动停止后不会自动启动，兼顾可靠性和可控性。
- **用 `docker compose logs -f service-name` 定位问题**：不要看所有服务的日志混在一起，按服务名过滤更高效。
- **把 compose.yml 纳入版本控制**：compose.yml 是项目基础设施配置，应该和代码一起维护，但 `.env` 文件不要提交。

---

## 小结

1. **Docker Compose** 用一个 YAML 文件管理多容器应用
2. **services** 定义各个容器，**networks** 定义网络，**volumes** 定义持久化卷
3. **`docker compose up -d`** 启动，**`docker compose down`** 停止
4. **`depends_on`** 控制服务启动顺序，配合 `healthcheck` 更可靠

---

## 下一课预告

下一课我们将深入学习 service、network、volume 的详细配置。

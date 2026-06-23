# docker-compose.yml 结构

> 前置知识：Docker 基础、Dockerfile（第一阶段）

## 三条命令引发的思考

你的项目有三个服务：Node.js API、PostgreSQL、Redis。每次启动项目：

```bash
# 终端 1
docker run -d --name my-db -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:14

# 终端 2
docker run -d --name my-redis redis:7

# 终端 3
docker run -d --name my-api -p 3000:3000 -e DATABASE_URL=postgres://postgres:secret@my-db:5432/mydb -e REDIS_URL=redis://my-redis:6379 --network app-net my-api:1.0
```

三条命令，十几个参数。某天你漏了 `--network`，API 连不上数据库，排查了半小时。某天同事想跑这个项目，问你"需要哪些环境变量"，你翻了半天才找全。

问题不是"能不能跑"，而是"能不能一条命令跑、能不能让别人也一条命令跑"。docker-compose.yml 就是来解决这个问题的。

## compose.yml 长什么样

把上面三条命令翻译成配置文件：

```yaml
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/mydb
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

volumes:
  pgdata:
```

一条命令启动：

```bash
docker compose up
```

一条命令销毁：

```bash
docker compose down
```

## 文件结构

compose.yml 的顶层只有四种元素：

```yaml
services:    # 你要跑哪些容器
  api:
    ...
  db:
    ...

networks:    # 容器之间怎么通信（可选，默认自动创建）
  default:
    driver: bridge

volumes:     # 数据怎么持久化（可选）
  pgdata:

configs:     # 配置文件注入（可选）
  app-config:
    file: ./config.json
```

90% 的场景只需要 `services` 和 `volumes`。`networks` 用默认行为就行，`configs` 是进阶用法。

## service 的核心字段

```yaml
services:
  api:
    # ---- 镜像来源（二选一）----
    image: node:18-alpine       # 直接用现成镜像
    build:                      # 或者从 Dockerfile 构建
      context: .
      dockerfile: Dockerfile
      target: production        # 多阶段构建时指定目标阶段

    # ---- 网络 ----
    ports:
      - "3000:3000"             # 宿主机端口:容器端口

    # ---- 环境 ----
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://...
    env_file:
      - .env                    # 从文件读取环境变量

    # ---- 存储 ----
    volumes:
      - ./src:/app/src          # bind mount（开发用）
      - api-logs:/app/logs      # named volume（持久化）

    # ---- 依赖与健康检查 ----
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

    # ---- 资源限制 ----
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"

    # ---- 重启策略 ----
    restart: unless-stopped
```

不是每个字段都需要写。一个最简单的 service 只需要 `image`（或 `build`）：

```yaml
services:
  redis:
    image: redis:7
```

## 常见的坑

### 坑一：启动顺序不等于就绪顺序

`depends_on` 只保证容器"启动了"，不保证服务"就绪了"。PostgreSQL 容器启动后还需要几秒钟初始化数据库，在这段时间内 API 连接会失败。

解决方式：用 `healthcheck` + `condition: service_healthy`。上面的 compose.yml 已经展示了这个模式。

### 坑二：环境变量里的敏感信息

```yaml
# 不推荐：密码直接写在 compose.yml 里
environment:
  POSTGRES_PASSWORD: my-secret-password
```

compose.yml 会被提交到 Git。密码不应该出现在版本控制中。

```yaml
# 推荐：从 .env 文件读取
env_file:
  - .env
```

```bash
# .env（加入 .gitignore）
POSTGRES_PASSWORD=actual-secret
```

### 坑三：bind mount 在生产环境的陷阱

```yaml
volumes:
  - ./src:/app/src  # 开发时用，热更新很方便
```

bind mount 把宿主机的文件直接映射到容器里。开发时很方便——改代码不需要重新构建。但生产环境不能用：宿主机上的文件状态不可控，而且绑定了宿主机的文件系统路径。

生产环境应该用 Named Volume 持久化数据，用镜像打包代码。

## 用 Compose 做开发 vs 做生产

同一个 compose.yml 通常不能同时服务开发和生产。推荐用 override 文件：

```yaml
# compose.yml（基础配置）
services:
  api:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/mydb

# compose.override.yml（开发覆盖，自动加载）
services:
  api:
    volumes:
      - ./src:/app/src
    environment:
      NODE_ENV: development
```

生产环境只加载基础配置：

```bash
docker compose -f compose.yml up -d
```

开发环境自动加载 override：

```bash
docker compose up -d
```

## 练习

### 练习一：补全 compose.yml

以下 compose.yml 缺少几个关键配置。补全它，使得：
- API 能连上数据库
- 数据库数据持久化
- 一条命令启动所有服务

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ???

  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
```

### 练习二：健康检查

为上面的 db service 添加健康检查，使用 `pg_isready -U postgres` 命令。然后修改 api 的 `depends_on`，让它等数据库真正就绪后再启动。

### 练习三：开发环境 override

创建一个 `compose.override.yml`，实现：
- API 使用 bind mount 挂载 `./src` 目录
- API 的 NODE_ENV 设为 development
- 额外启动一个 adminer 服务（`adminer` 镜像，端口 8080）方便查看数据库

---

## 参考答案

### 练习一

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/postgres
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

关键点：api 的 `DATABASE_URL` 里 host 写 `db`（service 名），不是 `localhost`。Compose 会自动创建网络，容器间通过 service 名互相访问。

### 练习二

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/postgres
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### 练习三

```yaml
# compose.override.yml
services:
  api:
    volumes:
      - ./src:/app/src
    environment:
      NODE_ENV: development

  adminer:
    image: adminer
    ports:
      - "8080:8080"
```

adminer 启动后访问 `http://localhost:8080`，用 `db` 作为数据库地址、`postgres` 用户、`secret` 密码连接。

# 02 Docker Compose 编排

> 一个命令启动整个系统——Docker Compose 是开发和部署的瑞士军刀。

## 场景引入

你的 AI Agent 平台需要 PostgreSQL、Redis、后端 API、前端和 Nginx 五个服务协同工作。手动逐个启动容器，光是环境变量和网络配置就要折腾半天，而且启动顺序还有依赖——后端要等数据库就绪才能跑。Docker Compose 让你用一个 YAML 文件描述整个系统，一条命令全部启动。

## 学习目标

- 编写完整的 Docker Compose 配置
- 管理环境变量和密钥
- 配置健康检查和依赖关系

## 完整编排

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-agent}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-agent_platform}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-agent}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:-redis123}
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redis123}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-agent}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-agent_platform}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

volumes:
  pgdata:
  redisdata:
```

## 环境变量管理

```bash
# .env.example
POSTGRES_USER=agent
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=agent_platform
REDIS_PASSWORD=change_me_in_production
SECRET_KEY=change_me_in_production
OPENAI_API_KEY=sk-xxx
```

## 练习

### 练习 1：Compose 编排

编写完整的 Docker Compose 配置：

1. 包含所有服务（postgres、redis、backend、frontend、nginx）
2. 配置健康检查
3. 配置依赖关系

### 练习 2：环境管理

1. 创建 .env.example
2. 开发和生产环境区分
3. 密钥管理

---

## 参考答案

### 练习 1

**思路**：Docker Compose 编排的核心是用 `depends_on` + `healthcheck` 控制服务启动顺序——`depends_on` 只等容器启动，`condition: service_healthy` 才等服务真正就绪。所有敏感配置通过环境变量注入，不硬编码在 YAML 中。

**答案**：

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-agent}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-agent_platform}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-agent} -d ${POSTGRES_DB:-agent_platform}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-redis123} --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redis123}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-agent}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-agent_platform}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ENVIRONMENT: ${ENVIRONMENT:-production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      backend:
        condition: service_healthy

  nginx:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
```

**要点**：
- `depends_on` 配合 `condition: service_healthy` 才能确保依赖服务真正就绪——没有 healthcheck 的 depends_on 只等容器启动，不等服务可用
- `restart: unless-stopped` 让服务在崩溃后自动重启，但手动 `docker compose stop` 后不会自动重启
- 常见错误：healthcheck 的 `start_period` 设太短——数据库初始化需要时间，start_period 太短会导致健康检查在初始化完成前就开始计数失败

### 练习 2

**思路**：环境管理的核心是 `.env.example`（模板）+ `.env`（实际值，gitignore）+ 环境区分（开发/生产用不同的覆盖文件）。密钥通过 Docker Secrets 或外部密钥管理服务注入，不写在 `.env` 文件里。

**答案**：

```bash
# .env.example —— 提交到 Git，作为模板
# === 数据库 ===
POSTGRES_USER=agent
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=agent_platform
POSTGRES_PORT=5432

# === Redis ===
REDIS_PASSWORD=change_me_in_production
REDIS_PORT=6379

# === 后端 ===
BACKEND_PORT=8000
SECRET_KEY=change_me_in_production
OPENAI_API_KEY=sk-xxx
ENVIRONMENT=production
LOG_LEVEL=info

# === 前端 ===
FRONTEND_PORT=3000

# === 监控 ===
GRAFANA_PASSWORD=admin
```

```yaml
# docker-compose.override.yml —— 开发环境覆盖（自动加载）
# 用法：docker compose up 自动加载 docker-compose.yml + docker-compose.override.yml
services:
  backend:
    build:
      target: builder  # 开发用构建阶段（带热重载）
    volumes:
      - ./backend/app:/app/app  # 代码热重载
    environment:
      ENVIRONMENT: development
      LOG_LEVEL: debug
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  postgres:
    ports:
      - "5432:5432"  # 开发时暴露端口方便用 DBeaver 等工具连接

  # 开发环境额外服务
  adminer:
    image: adminer
    ports:
      - "8080:8080"
```

```yaml
# docker-compose.prod.yml —— 生产环境覆盖
# 用法：docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
services:
  backend:
    environment:
      ENVIRONMENT: production
      LOG_LEVEL: warning
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

  postgres:
    # 生产时不暴露端口
    ports: []

  # 生产环境添加监控
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

```bash
# .gitignore 中必须包含
.env
.env.local
.env.production
docker-compose.override.yml
```

密钥管理（Docker Secrets）：

```yaml
# docker-compose.prod.yml 中使用 secrets
services:
  backend:
    secrets:
      - db_password
      - secret_key
      - openai_key
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      SECRET_KEY_FILE: /run/secrets/secret_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  secret_key:
    file: ./secrets/secret_key.txt
  openai_key:
    file: ./secrets/openai_key.txt
```

**要点**：
- `.env.example` 是团队协作的契约——新成员 clone 后 `cp .env.example .env` 再改值即可启动
- 开发和生产用不同的 Compose 覆盖文件，不要在同一个 `docker-compose.yml` 里用 `if` 判断环境
- 常见错误：把 `.env` 文件提交到 Git——密钥泄露到公开仓库后被扫描机器人秒级利用。必须 `.gitignore`

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 服务启动失败 | 依赖服务没就绪 | 配置 healthcheck 和 depends_on |
| 环境变量没生效 | .env 文件没加载 | 检查 .env 文件路径 |
| 数据丢失 | 没配 volumes | 持久化关键数据 |

## 工程建议

生产环境和开发环境应使用不同的 Compose 覆盖文件（`docker-compose.override.yml`），避免端口映射和调试工具泄露到生产。`.env` 文件必须加入 `.gitignore`，敏感密钥建议通过 Docker Secrets 或外部密钥管理服务注入。健康检查（healthcheck）不是可选项——没有它 `depends_on` 只等容器启动，不等服务就绪。

## 本节要点

- Docker Compose 一键启动开发环境
- 健康检查确保服务真正可用
- 环境变量管理密钥和配置
- 依赖关系确保服务启动顺序

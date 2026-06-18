# 02 Docker Compose 编排

> 一个命令启动整个系统——Docker Compose 是开发和部署的瑞士军刀。

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

## 本节要点

- Docker Compose 一键启动开发环境
- 健康检查确保服务真正可用
- 环境变量管理密钥和配置
- 依赖关系确保服务启动顺序

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 服务启动失败 | 依赖服务没就绪 | 配置 healthcheck 和 depends_on |
| 环境变量没生效 | .env 文件没加载 | 检查 .env 文件路径 |
| 数据丢失 | 没配 volumes | 持久化关键数据 |

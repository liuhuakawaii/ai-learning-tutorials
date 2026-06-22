# 第6课：Docker 化部署

> **课程定位**：使用 Docker 容器化部署数据产品
> **前置知识**：第5课（权限和公开分享）
> **预计时长**：50 分钟

---

## 场景引入

你的数据产品在本地跑得好好的，Python 3.11、PostgreSQL 15、Redis 7，一切正常。换到服务器上部署，系统自带 Python 3.8，pip 装依赖各种报错，PostgreSQL 版本不兼容，折腾了一天才跑起来。同事说"你为什么不写个 Dockerfile？"你开始意识到：本地能跑不等于能部署，环境一致性是数据产品上线的最后一道坎。

---

## 学习目标

1. 编写 Dockerfile
2. 使用 docker-compose 编排服务
3. 部署到生产环境

---

## 一、Dockerfile

### 1.1 API 服务

```dockerfile
# api/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 1.2 前端服务

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 二、Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: jobs_data
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # API 服务
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/jobs_data
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  # 前端
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 三、部署命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f api

# 停止服务
docker-compose down

# 备份数据库
docker exec db pg_dump -U postgres jobs_data > backup.sql
```

---

## 四、生产环境配置

### 4.1 环境变量

```yaml
# .env
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://host:6379
SECRET_KEY=your-secret-key
DEBUG=false
```

### 4.2 Nginx 配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 常见误区

- **在容器里存持久化数据**：Docker 容器是临时的，重启后数据会丢失。数据库文件、上传的文件必须挂载到 volume 或使用外部存储。
- **用 `latest` 标签**：`postgres:latest` 在不同时间拉取可能指向不同版本，导致生产环境行为不可预测。始终指定明确版本号。
- **Dockerfile 里 COPY 整个项目**：每次改一行代码就要重新安装所有依赖。应该先 COPY 依赖文件（`requirements.txt`），安装依赖后再 COPY 代码，利用 Docker 缓存层。
- **所有服务用同一个 Dockerfile**：API 服务、前端、定时任务的运行环境和资源需求不同，应该各自有独立的 Dockerfile 和服务定义。

---

## 工程建议

1. **docker-compose 分环境管理**：`docker-compose.yml` 放基础配置，`docker-compose.override.yml` 放开发环境覆盖（如挂载代码目录），生产环境用独立的 `docker-compose.prod.yml`。
2. **健康检查不能少**：在 docker-compose 里为每个服务配置 `healthcheck`，确保依赖服务真正就绪后再启动下游服务。
3. **日志输出到 stdout/stderr**：不要把日志写到容器内的文件里，统一输出到标准输出，由 Docker 日志驱动收集，方便集中查看和分析。
4. **镜像瘦身**：使用 `slim` 或 `alpine` 基础镜像，删除构建工具和缓存文件，减小镜像体积，加快部署速度。

---

## 动手练习

### 练习一

为项目编写 Dockerfile。

### 练习二

编写 docker-compose.yml 编排所有服务。

---

## 小结

1. **Dockerfile**：构建镜像
2. **docker-compose**：编排多服务
3. **生产配置**：环境变量、Nginx

---

---

## 参考答案

### 练习一

**思路**：为数据产品的三个核心组件分别编写 Dockerfile：FastAPI 后端、Vue/React 前端、定时任务调度器。每个 Dockerfile 遵循最小镜像原则，利用多阶段构建减小体积，并合理利用缓存层加速构建。

**答案**：

```dockerfile
# api/Dockerfile - FastAPI 后端服务
FROM python:3.11-slim AS base

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再复制业务代码
COPY . .

# 非 root 用户运行
RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

```dockerfile
# frontend/Dockerfile - 前端静态资源
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html
# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1
```

```dockerfile
# scheduler/Dockerfile - 定时任务调度器
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN adduser --disabled-password --no-create-home appuser
USER appuser

# 定时任务不需要暴露端口
CMD ["python", "scheduler.py"]
```

```txt
# api/requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
redis==5.0.1
apscheduler==3.10.4
```

**要点**：
- 三个服务各自有独立的 Dockerfile，运行环境和资源需求隔离
- 前端用多阶段构建（`AS builder`），构建工具不进入最终镜像，nginx 镜像只有几十 MB
- 依赖文件（`requirements.txt`）先 COPY 再 `pip install`，代码改动不会触发依赖重新安装
- 添加 `HEALTHCHECK` 指令，Docker 可以自动检测服务健康状态

---

### 练习二

**思路**：用 docker-compose 编排所有服务（数据库、缓存、API、前端、调度器），配置服务依赖、健康检查、数据持久化和环境变量分离。开发环境和生产环境使用不同的 override 文件。

**答案**：

```yaml
# docker-compose.yml - 基础配置
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-jobs_data}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-jobs_data}
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: ${DEBUG:-false}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  scheduler:
    build: ./scheduler
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-jobs_data}
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

```yaml
# docker-compose.override.yml - 开发环境覆盖（自动加载）
version: '3.8'

services:
  api:
    volumes:
      - ./api:/app
    environment:
      DEBUG: "true"
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

```yaml
# docker-compose.prod.yml - 生产环境
version: '3.8'

services:
  api:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    environment:
      DEBUG: "false"
```

```env
# .env.example
POSTGRES_DB=jobs_data
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-strong-password-here
SECRET_KEY=your-secret-key-change-in-production
DEBUG=false
```

**要点**：
- `depends_on` + `condition: service_healthy` 确保数据库和缓存真正就绪后才启动 API，而非仅仅容器启动
- 敏感信息（密码、密钥）通过 `.env` 文件注入，不硬编码在 docker-compose.yml 中
- 开发环境用 `docker-compose.override.yml` 自动覆盖（挂载代码目录、开启热重载），生产环境用 `docker-compose.prod.yml` 指定副本数和资源限制
- 数据库和 Redis 的数据通过 named volumes 持久化，容器重建不丢数据

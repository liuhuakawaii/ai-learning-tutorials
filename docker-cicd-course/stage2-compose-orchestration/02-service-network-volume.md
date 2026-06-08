# 第二课：service、network、volume

> **课程定位**：深入理解 Compose 的三大核心概念
> **前置知识**：compose.yml 基本结构（第一课）
> **预计时长**：35 分钟

---

## 学习目标

1. 掌握 service 的完整配置选项
2. 理解自定义网络的配置和用途
3. 掌握 Named Volume 和 Bind Mount 的使用场景

---

## 一、Service 详解

### 1.1 完整配置示例

```yaml
services:
  app:
    # 镜像来源
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: my-app:1.0

    # 运行配置
    container_name: my-app
    restart: unless-stopped
    working_dir: /app
    user: "1001:1001"

    # 端口
    ports:
      - "3000:3000"

    # 环境变量
    environment:
      NODE_ENV: production
    env_file:
      - .env

    # 数据卷
    volumes:
      - ./src:/app/src          # Bind Mount
      - uploads:/app/uploads    # Named Volume

    # 网络
    networks:
      - app-network

    # 依赖
    depends_on:
      postgres:
        condition: service_healthy

    # 健康检查
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # 资源限制
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

    # 日志配置
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 1.2 restart 策略

```yaml
services:
  app:
    restart: no            # 不自动重启（默认）
    restart: always        # 总是重启
    restart: on-failure    # 只在非正常退出时重启
    restart: unless-stopped # 除非手动停止，否则总是重启
```

```
策略选择：

  开发环境：no 或 on-failure
  生产环境：unless-stopped
  关键服务：always
```

---

## 二、Network 详解

### 2.1 默认网络

```yaml
# 不指定网络时，Compose 自动创建默认网络
services:
  app:
    image: node:18
  postgres:
    image: postgres:14

# 两个服务自动在同一网络中，可以用服务名互相访问
# app 可以通过 "postgres:5432" 连接数据库
```

### 2.2 自定义网络

```yaml
services:
  app:
    networks:
      - frontend
      - backend

  postgres:
    networks:
      - backend

  nginx:
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
```

```
网络隔离：

  ┌─────────────────────────────────────────┐
  │  frontend 网络                           │
  │  ┌────────┐  ┌────────┐                │
  │  │  app   │  │  nginx  │                │
  │  └────────┘  └────────┘                │
  │       │                                  │
  │  ─────┼────── backend 网络 ─────────── │
  │       │                                  │
  │  ┌────────┐  ┌────────┐                │
  │  │  app   │  │postgres│                │
  │  └────────┘  └────────┘                │
  └─────────────────────────────────────────┘

  nginx 只能访问 app，不能直接访问 postgres
  app 可以访问 postgres
```

---

## 三、Volume 详解

### 3.1 Named Volume

```yaml
services:
  postgres:
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:                  # 顶层声明
    driver: local          # 存储驱动
```

```
Named Volume 特点：
  - Docker 管理存储位置
  - 容器删除后数据保留
  - 适合数据库等有状态服务
  - 可以在多个容器间共享
```

### 3.2 Bind Mount

```yaml
services:
  app:
    volumes:
      - ./src:/app/src              # 开发时挂载源代码
      - ./config/app.conf:/etc/app.conf:ro  # 只读挂载
```

```
Bind Mount 特点：
  - 直接映射宿主机目录
  - 实时同步
  - 适合开发环境
  - 依赖宿主机的目录结构
```

### 3.3 只读挂载

```yaml
services:
  app:
    volumes:
      - ./config:/app/config:ro     # ro = read only
      - pgdata:/data:rw             # rw = read write（默认）
```

---

## 四、实战：完整 compose.yml

```yaml
# compose.yml - 完整示例
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:secret@postgres:5432/mydb
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - app-network
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  pgdata:
  redis-data:
```

---

## 五、动手练习

### 练习一：自定义网络隔离

创建两个网络，验证网络隔离效果。

### 练习二：数据持久化

```bash
# 1. 启动 PostgreSQL
docker compose up -d postgres

# 2. 创建测试数据
docker compose exec postgres psql -U postgres -c "CREATE TABLE test (id int);"

# 3. 停止并删除容器
docker compose down

# 4. 重新启动，验证数据是否还在
docker compose up -d postgres
docker compose exec postgres psql -U postgres -c "SELECT * FROM test;"
```

---

## 小结

1. **Service**：定义容器的完整配置，包括镜像、端口、环境变量、卷、网络等
2. **Network**：默认网络支持服务名访问，自定义网络实现隔离
3. **Volume**：Named Volume 适合持久化数据，Bind Mount 适合开发环境
4. **`depends_on` + `healthcheck`**：确保服务按正确顺序启动

---

## 下一课预告

下一课我们将实战搭建 App + PostgreSQL + Redis 的完整开发环境。

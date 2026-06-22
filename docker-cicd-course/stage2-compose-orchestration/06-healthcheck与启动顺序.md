# 第六课：healthcheck 与启动顺序

> **课程定位**：确保服务按正确顺序启动，提高系统可靠性
> **前置知识**：Compose 基础（第 1-5 课）
> **预计时长**：25 分钟

---

## 场景引入

你执行 `docker compose up -d`，所有服务都显示 "Up"，但 API 一启动就报错：`ECONNREFUSED 127.0.0.1:5432`。你检查了数据库容器，确实在运行。问题是：PostgreSQL 容器虽然启动了，但数据库还没初始化完成，API 就急着去连接了。`depends_on` 只管"容器启动"，不管"服务就绪"。

---

## 学习目标

1. 理解为什么需要健康检查
2. 掌握 Dockerfile 和 Compose 中的 healthcheck 配置
3. 理解 depends_on 的 condition 选项
4. 学会设计可靠的启动顺序

---

## 一、为什么需要健康检查

### 1.1 启动顺序问题

```
问题场景：

  app 依赖 postgres，但 postgres 启动需要几秒钟。

  docker compose up:
    1. postgres 开始启动（还没准备好）
    2. app 开始启动
    3. app 尝试连接 postgres → 连接失败 💀
    4. app 崩溃退出

  depends_on 只保证"容器已启动"，不保证"服务已就绪"。
```

### 1.2 健康检查的作用

```
健康检查 = 定期验证服务是否真正可用

  ┌─────────────────────────────────────────┐
  │           容器状态                        │
  │                                          │
  │  Created → Running → Healthy            │
  │                      ↑                   │
  │                      │                   │
  │               healthcheck 通过后         │
  └─────────────────────────────────────────┘

  depends_on + condition: service_healthy
  = 等服务真正可用后再启动依赖它的服务
```

---

## 二、配置健康检查

### 2.1 在 Dockerfile 中配置

```dockerfile
# Node.js API
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```
参数说明：

  --interval=30s      每 30 秒检查一次
  --timeout=3s        超时时间 3 秒
  --start-period=5s   启动后等 5 秒再开始检查
  --retries=3         连续失败 3 次标记为 unhealthy
```

### 2.2 在 Compose 中配置

```yaml
services:
  postgres:
    image: postgres:14
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

---

## 三、常见服务的健康检查

### 3.1 PostgreSQL

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### 3.2 MySQL

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### 3.3 Redis

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### 3.4 HTTP 服务

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 3.5 MongoDB

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## 四、depends_on 条件

```yaml
services:
  app:
    depends_on:
      # 等待服务启动（默认）
      redis:
        condition: service_started

      # 等待服务健康（推荐）
      postgres:
        condition: service_healthy

      # 等待服务完成（用于一次性任务）
      db-init:
        condition: service_completed_successfully
```

---

## 五、完整的启动顺序示例

```yaml
services:
  # 1. 数据库先启动
  postgres:
    image: postgres:14
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 2. Redis 启动
  redis:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 3. 数据库初始化（可选）
  db-init:
    image: postgres:14
    depends_on:
      postgres:
        condition: service_healthy
    command: psql -U postgres -c "CREATE TABLE IF NOT EXISTS users (id serial, name text);"
    # 完成后退出

  # 4. 应用启动
  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      db-init:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 5. Nginx 反向代理（依赖 app 健康）
  nginx:
    image: nginx:alpine
    depends_on:
      app:
        condition: service_healthy
```

```
启动顺序：

  postgres (healthy) ──→ db-init (completed) ──→ app (healthy) ──→ nginx
  redis (healthy)    ─────────────────────────┘
```

---

## 六、调试健康检查

```bash
# 查看容器健康状态
docker compose ps

# 输出示例：
# NAME        STATUS
# postgres    Up (healthy)
# redis       Up (healthy)
# app         Up (starting)    ← 还在启动中
# nginx       Up

# 查看健康检查日志
docker inspect --format='{{json .State.Health}}' container_name

# 手动测试健康检查命令
docker compose exec postgres pg_isready -U postgres
docker compose exec redis redis-cli ping
```

---

## 七、动手练习

### 练习一：配置健康检查

```bash
# 1. 为 PostgreSQL 添加健康检查
# 2. 使用 depends_on condition: service_healthy
# 3. 验证 app 等 postgres 健康后才启动
docker compose up -d
docker compose ps  # 观察状态变化
```

### 练习二：模拟启动失败

```bash
# 1. 故意配置错误的数据库密码
# 2. 观察 app 的行为
# 3. 修复后重新启动
```

---

## 常见误区

- **"depends_on 保证服务可用"**：`depends_on` 默认只保证容器启动（`service_started`），不保证服务就绪。必须用 `condition: service_healthy` 配合 `healthcheck` 才能确保服务真正可用。
- **"健康检查命令越复杂越好"**：健康检查应该简单、快速、可靠。`pg_isready` 比 `psql -c "SELECT 1"` 更合适，因为它只检查连接能力，不执行查询。
- **"start_period 设置越长越安全"**：`start_period` 过长会延迟发现问题。应该根据服务的实际启动时间设置，通常 5-30 秒足够。
- **"所有服务都需要健康检查"**：一次性任务（如数据库初始化脚本）不需要健康检查。只有长期运行的服务才需要。

---

## 工程建议

- **为每个数据库和缓存服务配置健康检查**：PostgreSQL 用 `pg_isready`，Redis 用 `redis-cli ping`，MySQL 用 `mysqladmin ping`。这些命令轻量且可靠。
- **HTTP 服务的健康端点应该检查依赖**：`/health` 端点应该验证数据库和缓存连接，而不只是返回 200。这样能反映服务的真实状态。
- **用 `docker compose ps` 观察启动过程**：启动后查看各服务的健康状态（healthy/unhealthy/starting），确认所有服务就绪后再测试。
- **合理设置检查间隔**：数据库初始化需要时间，`interval: 5s` 配合 `retries: 5` 给出 25 秒的等待窗口。HTTP 服务可以用更长的间隔（30s）减少开销。

---

## 小结

1. **健康检查**：定期验证服务是否真正可用
2. **depends_on + condition: service_healthy**：确保服务就绪后再启动依赖服务
3. **常见服务**：PostgreSQL 用 `pg_isready`，Redis 用 `redis-cli ping`，HTTP 用 `curl`
4. **调试**：`docker compose ps` 查看健康状态

---

## 下一课预告

下一课是阶段实战——搭建本地生产模拟环境。

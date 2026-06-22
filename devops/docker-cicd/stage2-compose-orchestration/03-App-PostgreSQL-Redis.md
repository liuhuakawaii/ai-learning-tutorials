# 第三课：App + PostgreSQL + Redis

> **课程定位**：实战搭建一个完整的本地开发环境
> **前置知识**：compose.yml 结构、service/network/volume（第 1-2 课）
> **预计时长**：45 分钟

---

## 场景引入

你已经分别跑过 Node.js、PostgreSQL、Redis 的容器，但从来没有把它们串在一起。现在你要搭建一个完整的本地开发环境：API 需要连数据库，需要查缓存，三个服务要能互相通信。你不想每次开机都敲三条 `docker run`，也不想每次给新同事演示时花半小时教他们搭环境。

---

## 学习目标

完成本课后，你将拥有一个包含应用、数据库、缓存的完整 Compose 环境。

---

## 一、项目结构

```
fullstack-app/
├── docker-compose.yml
├── .env.example
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js
└── web/
    ├── Dockerfile
    ├── package.json
    └── src/
        └── index.js
```

---

## 二、应用代码

### 2.1 API 服务 (Express + PostgreSQL + Redis)

```javascript
// api/src/index.js
const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());

// PostgreSQL 连接
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis 连接
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    await pgPool.query('SELECT 1');
    await redisClient.ping();
    res.json({ status: 'ok', postgres: 'connected', redis: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 初始化数据库
app.get('/init', async (req, res) => {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    res.json({ message: 'Table created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 访问计数（使用 Redis 缓存）
app.get('/visits', async (req, res) => {
  try {
    // 先查 Redis 缓存
    const cached = await redisClient.get('visit_count');
    if (cached) {
      return res.json({ count: parseInt(cached), source: 'cache' });
    }

    // 缓存未命中，查数据库
    const result = await pgPool.query('SELECT COUNT(*) FROM visits');
    const count = parseInt(result.rows[0].count);

    // 写入缓存，60 秒过期
    await redisClient.setEx('visit_count', 60, count.toString());

    res.json({ count, source: 'database' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 记录访问
app.post('/visits', async (req, res) => {
  try {
    await pgPool.query('INSERT INTO visits DEFAULT VALUES');
    // 清除缓存
    await redisClient.del('visit_count');
    res.json({ message: 'Visit recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await redisClient.connect();
  console.log(`API running on port ${PORT}`);
});
```

```json
// api/package.json
{
  "name": "api",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.1",
    "redis": "^4.6.7"
  }
}
```

```dockerfile
# api/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

---

## 三、docker-compose.yml

```yaml
services:
  # ---- API 服务 ----
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:secret@postgres:5432/mydb
      REDIS_URL: redis://redis:6379
      PORT: "3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  # ---- PostgreSQL ----
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
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

  # ---- Redis ----
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  pgdata:
  redis-data:
```

---

## 四、运行和测试

```bash
# 启动所有服务
docker compose up -d

# 查看状态
docker compose ps

# 初始化数据库
curl http://localhost:3000/init

# 记录几次访问
curl -X POST http://localhost:3000/visits
curl -X POST http://localhost:3000/visits
curl -X POST http://localhost:3000/visits

# 查询访问次数（第一次从数据库，后续从缓存）
curl http://localhost:3000/visits
curl http://localhost:3000/visits

# 健康检查
curl http://localhost:3000/health

# 查看日志
docker compose logs -f api

# 停止
docker compose down
```

---

## 五、验收标准

```
✅ docker compose up 一条命令启动
✅ 数据库重启后数据不丢（验证 volume 持久化）
✅ API 等数据库健康后再启动（depends_on + healthcheck）
✅ .env.example 完整
```

---

## 常见误区

- **"数据库密码写在 compose.yml 里方便"**：compose.yml 应该提交到 Git，密码写在里面会泄露。用环境变量替换（`${POSTGRES_PASSWORD}`）+ `.env` 文件管理敏感信息。
- **"容器启动了就代表服务可用"**：PostgreSQL 容器启动后还需要几秒初始化数据库，此时连接会失败。必须用 `healthcheck` 确保数据库就绪后再启动依赖服务。
- **"本地开发不需要健康检查"**：没有健康检查，`docker compose up` 后服务可能在启动中就崩溃了，你看到的日志是混乱的。健康检查让启动过程可观察、可预测。
- **"端口映射到宿主机的数据库是安全的"**：本地开发可以，但要意识到这会让宿主机上任何程序都能访问数据库。生产环境绝不应该暴露数据库端口。

---

## 工程建议

- **用 `depends_on` + `condition: service_healthy` 控制启动顺序**：确保 PostgreSQL 和 Redis 就绪后再启动 API，避免启动时连接失败。
- **为每个服务配置健康检查**：PostgreSQL 用 `pg_isready`，Redis 用 `redis-cli ping`，API 用 HTTP 健康端点。这是可靠编排的基础。
- **用 `.env.example` 记录所有环境变量**：新同事只需要 `cp .env.example .env` 然后填入实际值，就能跑起整个项目。
- **数据库数据必须用 Named Volume 持久化**：`docker compose down` 不会删除 Volume，但 `docker compose down -v` 会。操作前确认是否需要保留数据。

---

## 小结

1. **Compose 编排**：用一个文件定义 app、postgres、redis 三个服务
2. **健康检查 + depends_on**：确保服务按正确顺序启动
3. **Volume 持久化**：数据库数据在容器重启后保留
4. **服务名访问**：容器间通过服务名（`postgres`、`redis`）互相访问

---

## 下一课预告

下一课我们将学习环境变量管理——如何安全地管理配置和密钥。

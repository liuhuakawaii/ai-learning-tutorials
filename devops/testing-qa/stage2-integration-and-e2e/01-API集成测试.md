# API 集成测试

## 场景引入

你写了一个用户注册接口，单元测试覆盖了密码加密和邮箱校验，上线后却发现：用户注册成功了，但数据库里存了两条重复记录。原因是单元测试只验证了单个函数的输入输出，没有测试「请求 → 中间件 → 路由 → 数据库」这条完整链路。

集成测试验证的是**模块之间的契约**——当真实数据库、真实服务器参与时，系统行为是否符合预期。

## 学习目标

- 理解集成测试与单元测试的边界
- 使用 Supertest 测试 Express API
- 掌握事务回滚策略保持测试隔离
- 学会独立测试中间件

---

## 使用 Supertest 测试 API

```typescript
// src/app.ts
import express from 'express'
import { userRouter } from './routes/user'

export const app = express()
app.use(express.json())
app.use('/api/users', userRouter)
```

```typescript
// src/routes/user.ts
import { Router } from 'express'
import { db } from './db'

export const userRouter = Router()

userRouter.get('/', async (_req, res) => {
  const users = await db.query('SELECT id, name, email FROM users')
  res.json({ data: users.rows })
})

userRouter.post('/', async (req, res) => {
  const { name, email } = req.body
  if (!name || !email) {
    return res.status(400).json({ error: 'name 和 email 为必填项' })
  }
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: '该邮箱已注册' })
  }
  const result = await db.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email',
    [name, email]
  )
  res.status(201).json({ data: result.rows[0] })
})
```

```typescript
// tests/user.integration.test.ts
import request from 'supertest'
import { app } from '../src/app'
import { db } from '../src/db'

afterAll(async () => { await db.end() })

describe('GET /api/users', () => {
  it('应返回用户列表', async () => {
    const res = await request(app).get('/api/users').expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('POST /api/users', () => {
  it('缺少必填字段时返回 400', async () => {
    const res = await request(app)
      .post('/api/users').send({ name: '张三' }).expect(400)
    expect(res.body.error).toBe('name 和 email 为必填项')
  })

  it('正常注册返回 201', async () => {
    const res = await request(app)
      .post('/api/users').send({ name: '李四', email: 'lisi@test.com' }).expect(201)
    expect(res.body.data).toMatchObject({ name: '李四', email: 'lisi@test.com' })
  })

  it('重复邮箱返回 409', async () => {
    await request(app).post('/api/users').send({ name: '王五', email: 'dup@test.com' })
    const res = await request(app)
      .post('/api/users').send({ name: '王六', email: 'dup@test.com' }).expect(409)
    expect(res.body.error).toBe('该邮箱已注册')
  })
})
```

---

## 事务回滚策略

每次测试在同一个连接上开启事务，结束后回滚，确保测试隔离且不产生脏数据。

```typescript
// tests/setup.ts
import { Pool } from 'pg'

export const testPool = new Pool({
  host: 'localhost', port: 5432,
  database: 'myapp_test', user: 'postgres', password: 'postgres'
})

let client: any

export async function beginTransaction() {
  client = await testPool.connect()
  await client.query('BEGIN')
}

export async function rollbackTransaction() {
  await client.query('ROLLBACK')
  client.release()
}

export function getTestDb() { return client }
```

```typescript
// tests/user-db.integration.test.ts
import { beginTransaction, rollbackTransaction, getTestDb } from './setup'

describe('POST /api/users - 数据库验证', () => {
  beforeEach(beginTransaction)
  afterEach(rollbackTransaction)

  it('注册后数据库中有记录', async () => {
    await request(app)
      .post('/api/users')
      .send({ name: '赵七', email: 'zhaoqi@test.com' })
      .expect(201)

    const result = await getTestDb().query(
      'SELECT * FROM users WHERE email = $1', ['zhaoqi@test.com']
    )
    expect(result.rows.length).toBe(1)
    expect(result.rows[0].name).toBe('赵七')
  })
})
```

### Testcontainers 化测试数据库

```typescript
// tests/global-setup.ts
import { GenericContainer } from 'testcontainers'

export default async function globalSetup() {
  const container = await new GenericContainer('postgres:16')
    .withEnvironment({
      POSTGRES_DB: 'myapp_test',
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres'
    })
    .withExposedPorts(5432)
    .start()

  process.env.TEST_DB_PORT = container.getMappedPort(5432).toString()
  globalThis.__DB_CONTAINER__ = container
}
```

---

## 测试中间件

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '未提供认证令牌' })
  try {
    (req as any).user = jwt.verify(token, process.env.JWT_SECRET!)
    next()
  } catch {
    return res.status(401).json({ error: '认证令牌无效' })
  }
}
```

```typescript
// tests/auth-middleware.test.ts
import { authMiddleware } from '../src/middleware/auth'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret'
process.env.JWT_SECRET = SECRET

function mockReqRes(authHeader?: string) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} } as any
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any
  return { req, res, next: jest.fn() }
}

describe('authMiddleware', () => {
  it('无 token 返回 401', () => {
    const { req, res, next } = mockReqRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('无效 token 返回 401', () => {
    const { req, res, next } = mockReqRes('Bearer bad-token')
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('有效 token 调用 next', () => {
    const token = jwt.sign({ userId: 1 }, SECRET)
    const { req, res, next } = mockReqRes(`Bearer ${token}`)
    authMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toMatchObject({ userId: 1 })
  })
})
```

---

## 常见误区

1. **把数据库操作当单元测试**：直接在单元测试里调数据库，变慢且难隔离。集成测试用独立数据库 + 事务回滚。
2. **测试之间有顺序依赖**：测试 A 插入的数据被测试 B 依赖。每个测试应自给自足。
3. **不清理外部资源**：测试创建文件、调第三方 API 但没清理或 mock。
4. **全用真实数据库跑 CI**：考虑 Testcontainers 按需创建，或 SQLite 内存库替代。

---

## 工程建议

- 测试数据库和开发库完全隔离，CI 中用 Testcontainers
- `beforeEach` + 事务回滚比 `afterEach` 清理更快更可靠
- Supertest 直接传 app 实例，不需要真正监听端口
- `.env.test` 单独配置，避免误连生产库
- 集成测试放 `tests/integration/`，和单元测试分开

---

## 小结

- 集成测试验证模块协作，弥补单元测试覆盖不到的交互
- Supertest 无需启动真实服务器即可测试 HTTP 接口
- 事务回滚确保测试隔离，不产生脏数据
- 中间件可独立测试，不依赖完整应用

---

## 练习

### 练习一：查询接口测试
为 `GET /api/users/:id` 编写测试：用户存在返回 200，不存在返回 404。

### 练习二：事务回滚验证
在一个测试中插入数据，在下一个测试中查询同一数据，确认不存在。

### 练习三：认证集成测试
为 `GET /api/profile` 编写测试：无 token 返回 401，有效 token 返回用户信息。

---

## 参考答案

### 练习一

```typescript
describe('GET /api/users/:id', () => {
  it('用户存在返回 200', async () => {
    const createRes = await request(app)
      .post('/api/users').send({ name: '测试', email: 'find@test.com' })
    const res = await request(app).get(`/api/users/${createRes.body.data.id}`).expect(200)
    expect(res.body.data.name).toBe('测试')
  })

  it('用户不存在返回 404', async () => {
    const res = await request(app).get('/api/users/99999').expect(404)
    expect(res.body.error).toBe('用户不存在')
  })
})
```

### 练习二

```typescript
describe('事务回滚验证', () => {
  beforeEach(beginTransaction)
  afterEach(rollbackTransaction)

  it('测试1：插入数据', async () => {
    await request(app).post('/api/users').send({ name: '临时', email: 'temp@test.com' }).expect(201)
  })

  it('测试2：数据应不存在', async () => {
    const result = await getTestDb().query('SELECT * FROM users WHERE email = $1', ['temp@test.com'])
    expect(result.rows.length).toBe(0)
  })
})
```

### 练习三

```typescript
describe('GET /api/profile', () => {
  it('无 token 返回 401', async () => {
    await request(app).get('/api/profile').expect(401)
  })

  it('有效 token 返回用户信息', async () => {
    const token = jwt.sign({ userId: 1 }, SECRET)
    const res = await request(app)
      .get('/api/profile').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body).toHaveProperty('userId', 1)
  })
})
```

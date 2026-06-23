# API 集成测试

## 从一个线上 bug 说起

你写了一个用户注册接口，单元测试覆盖了密码加密和邮箱校验。上线后发现：用户注册成功了，但数据库里存了两条重复记录。

原因是单元测试只验证了单个函数的输入输出，没有测试「请求 → 中间件 → 路由 → 数据库」这条完整链路。集成测试验证的就是模块之间的契约。

## Supertest：不用启动服务器就能测 API

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

测试：

```typescript
// tests/user.integration.test.ts
import request from 'supertest'
import { app } from '../src/app'
import { db } from '../src/db'

afterAll(async () => { await db.end() })

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

关键点：Supertest 直接传 app 实例，不需要真正监听端口。

## 事务回滚：测试隔离的核心策略

每个测试在同一连接上开启事务，结束后回滚，确保不产生脏数据：

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

`beforeEach` + 事务回滚比 `afterEach` 清理更快更可靠。

## Testcontainers：CI 中的数据库

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

CI 中不需要预装数据库，Testcontainers 按需创建 Docker 容器。

## 中间件独立测试

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

  it('有效 token 调用 next', () => {
    const token = jwt.sign({ userId: 1 }, SECRET)
    const { req, res, next } = mockReqRes(`Bearer ${token}`)
    authMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toMatchObject({ userId: 1 })
  })
})
```

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
  })
})
```

### 练习二

```typescript
describe('事务回滚验证', () => {
  beforeEach(beginTransaction)
  afterEach(rollbackTransaction)

  it('测试1：插入数据', async () => {
    await request(app).post('/api/users')
      .send({ name: '临时', email: 'temp@test.com' }).expect(201)
  })

  it('测试2：数据应不存在', async () => {
    const result = await getTestDb().query(
      'SELECT * FROM users WHERE email = $1', ['temp@test.com']
    )
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

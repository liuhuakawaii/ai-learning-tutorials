# 数据库 Fixture

## 场景引入

你的测试跑得好好的，某天同事加了一个新测试，往数据库插入了一条同名数据。你的测试开始随机失败——因为数据库里已经有了一条旧数据。你加了 `beforeEach` 清理表，结果测试变慢了 3 倍。再后来你发现清理逻辑有 bug，误删了另一个测试的数据。

测试数据管理是集成测试中最常见也最头疼的问题。本课讲如何用工厂模式、种子策略和数据隔离来解决它。

## 学习目标

- 理解测试数据管理的核心挑战
- 掌握工厂模式生成测试数据
- 掌握数据库种子和清理策略
- 学会使用 Faker.js 生成逼真测试数据

## 测试数据管理的挑战

测试数据面临三个核心矛盾：

1. **隔离性**：每个测试应该独立运行，不被其他测试影响
2. **真实性**：测试数据应该接近生产数据的结构和分布
3. **效率**：数据准备和清理不能太慢，否则测试套件跑不动

## 工厂模式（Factory Pattern）

工厂模式的核心思想：**不要在测试中直接写对象字面量，用工厂函数生成**。

```typescript
// factories/user-factory.ts
import { faker } from '@faker-js/faker/locale/zh_CN'

interface CreateUserOptions {
  name?: string
  email?: string
  role?: 'admin' | 'user' | 'guest'
  verified?: boolean
}

export function buildUser(overrides: CreateUserOptions = {}) {
  return {
    id: faker.string.uuid(),
    name: overrides.name ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email(),
    role: overrides.role ?? 'user',
    verified: overrides.verified ?? true,
    createdAt: new Date().toISOString(),
  }
}

// 使用：只覆盖关心的字段，其余自动生成
const admin = buildUser({ role: 'admin', verified: true })
const guest = buildUser({ role: 'guest' })
```

### 工厂 + 数据库持久化

工厂函数只生成内存对象，要写入数据库还需要一个持久化步骤：

```typescript
export async function createTestUser(options: CreateUserOptions = {}) {
  const userData = buildUser(options)
  const [savedUser] = await db('users').insert(userData).returning('*')
  return savedUser
}
```

### 处理关联数据

真实业务中，数据之间有关联关系。工厂应该处理这种依赖：

```typescript
export async function createTestOrder(options: { userId?: string } = {}) {
  const userId = options.userId ?? (await createTestUser()).id

  const orderData = {
    id: faker.string.uuid(),
    userId,
    status: 'pending' as const,
    totalAmount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    createdAt: new Date().toISOString(),
  }

  const [savedOrder] = await db('orders').insert(orderData).returning('*')
  return savedOrder
}
```

## 数据库种子（Seeding）策略

### 方案一：事务回滚（推荐）

每个测试在事务中运行，结束后回滚，数据完全隔离：

```typescript
// test-utils/database.ts
import { db } from '../database/connection'
import { beforeEach, afterEach } from 'vitest'

let transaction: any

beforeEach(async () => {
  transaction = await db.transaction()
})

afterEach(async () => {
  await transaction.rollback()
})

export function getTestDb() {
  return transaction
}
```

```typescript
it('创建订单后库存减少', async () => {
  const trx = getTestDb()

  await trx('products').where('id', 'prod-1').update({ stock: 10 })
  await trx('orders').insert({ productId: 'prod-1', quantity: 3 })

  const product = await trx('products').where('id', 'prod-1').first()
  expect(product.stock).toBe(7)
  // afterEach 自动回滚，prod-1 的 stock 恢复原值
})
```

**事务回滚的优势**：速度快（不需要 DELETE 操作）、完全隔离、不会误删数据。

### 方案二：共享种子 + 每测试清理

```typescript
export async function seedTestData() {
  await db('users').insert([
    { id: 'user-1', name: '张三', email: 'zhangsan@test.com', role: 'admin' },
    { id: 'user-2', name: '李四', email: 'lisi@test.com', role: 'user' },
  ])
}

beforeAll(async () => {
  await seedTestData()
})

afterEach(async () => {
  await db('orders').whereNotIn('id', ['seed-order-1']).del()
})
```

### 方案三：独立测试数据库

每个测试文件使用独立的数据库，隔离性最好但配置复杂，适合大型项目。

## 共享 Fixture 的陷阱

```typescript
// ❌ 危险：多个测试共享同一个对象
const sharedUser = { id: '1', name: '张三', role: 'admin' }

it('测试 A 修改了用户角色', () => {
  sharedUser.role = 'superadmin'
  expect(sharedUser.role).toBe('superadmin')
})

it('测试 B 期望用户是 admin', () => {
  // 💥 失败！因为测试 A 已经把 role 改成了 superadmin
  expect(sharedUser.role).toBe('admin')
})
```

**正确做法：每个测试创建独立的数据**

```typescript
// ✅ 每个测试生成独立数据
it('测试 A', () => {
  const user = buildUser({ role: 'admin' })
  user.role = 'superadmin'
  expect(user.role).toBe('superadmin')
})

it('测试 B', () => {
  const user = buildUser({ role: 'admin' })
  expect(user.role).toBe('admin')  // 不受影响
})
```

## 使用 Faker.js 生成逼真数据

```bash
npm install -D @faker-js/faker
```

```typescript
// factories/product-factory.ts
import { faker } from '@faker-js/faker/locale/zh_CN'

export function buildProduct(overrides: Partial<{
  name: string
  price: number
  category: string
  inStock: boolean
}> = {}) {
  return {
    id: faker.string.uuid(),
    name: overrides.name ?? faker.commerce.productName(),
    price: overrides.price ?? parseFloat(faker.commerce.price({ min: 10, max: 5000 })),
    category: overrides.category ?? faker.commerce.department(),
    inStock: overrides.inStock ?? faker.datatype.boolean(),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    createdAt: faker.date.past({ years: 1 }),
  }
}

// 批量生成
const products = Array.from({ length: 50 }, () => buildProduct())

// 生成特定场景的数据
const expensiveProduct = buildProduct({ price: 9999, inStock: true })
```

**Faker 的使用原则：**

1. 在工厂函数中使用 Faker，不要在测试中直接调用
2. 用 `overrides` 参数覆盖测试关心的字段
3. `locale/zh_CN` 生成中文数据，更适合国内项目
4. 需要确定性数据时用 `faker.seed(123)` 固定随机种子

## 常见误区

1. **每个测试都从零开始建数据**：极其缓慢，应该用种子 + 工厂组合
2. **用硬编码 ID**：`userId: '123'` 容易冲突，用 `faker.string.uuid()`
3. **清理逻辑不覆盖所有表**：漏掉关联表导致数据残留
4. **测试间依赖执行顺序**：测试应该是独立的，不依赖其他测试创建的数据

## 工程建议

1. **工厂函数放在 `factories/` 目录**，按领域拆分文件
2. **事务回滚是首选方案**，除非被测代码本身就使用事务
3. **在 CI 中用 Docker 启动测试数据库**，确保环境一致
4. **种子数据保持最小化**：只放"所有测试都需要的基础数据"
5. **Faker 用于填充非关键字段**：测试断言依赖的字段应该显式设置

## 小结

测试数据管理的核心原则：**每个测试创建自己需要的数据，测试结束后自动清理**。工厂模式负责生成数据，Faker 负责填充逼真内容，事务回滚负责隔离和清理。避免共享可变的 Fixture 对象，它是测试间相互干扰的主要来源。

## 练习

### 练习一：实现订单工厂

为一个电商系统实现 `createTestOrder` 工厂函数，要求：
- 自动创建关联的用户和商品（如果未提供）
- 支持覆盖订单状态、总金额
- 返回完整的订单对象（包含关联数据）

### 练习二：事务回滚方案

为 Vitest 编写一个 `withTransaction` 测试工具，让每个测试在事务中运行并自动回滚。要求：
- `beforeEach` 开启事务
- `afterEach` 回滚事务
- 提供一个函数让测试代码获取事务内的数据库连接

---

## 参考答案

### 练习一

**思路**：工厂函数处理依赖关系，`buildXxx` 生成内存对象，`createXxx` 写入数据库。

**答案**：

```typescript
import { faker } from '@faker-js/faker/locale/zh_CN'
import { db } from '../database/connection'

interface OrderOptions {
  userId?: string
  productId?: string
  status?: 'pending' | 'paid' | 'shipped' | 'completed'
  quantity?: number
  unitPrice?: number
}

export async function createTestOrder(options: OrderOptions = {}) {
  let userId = options.userId
  if (!userId) {
    const [user] = await db('users').insert({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: 'user',
    }).returning('*')
    userId = user.id
  }

  let productId = options.productId
  let unitPrice = options.unitPrice
  if (!productId) {
    unitPrice = unitPrice ?? parseFloat(faker.commerce.price({ min: 10, max: 500 }))
    const [product] = await db('products').insert({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: unitPrice,
      stock: 100,
    }).returning('*')
    productId = product.id
  }

  const quantity = options.quantity ?? faker.number.int({ min: 1, max: 5 })
  const totalAmount = (unitPrice ?? 99.9) * quantity

  const [order] = await db('orders').insert({
    id: faker.string.uuid(),
    userId, productId, quantity,
    unitPrice: unitPrice ?? 99.9,
    totalAmount,
    status: options.status ?? 'pending',
    createdAt: new Date().toISOString(),
  }).returning('*')

  return { order, userId, productId }
}
```

**要点**：`createTestOrder` 处理了所有依赖关系，调用者只关心订单本身。

### 练习二

**思路**：用 `beforeEach`/`afterEach` 管理事务生命周期，通过闭包暴露事务对象。

**答案**：

```typescript
import { beforeEach, afterEach } from 'vitest'
import knex, { Knex } from 'knex'

const db = knex({
  client: 'pg',
  connection: { host: 'localhost', port: 5432, user: 'test', password: 'test', database: 'test_db' },
})

let transaction: Knex.Transaction

export function getTrx(): Knex.Transaction {
  if (!transaction) throw new Error('事务未初始化，请在测试中调用')
  return transaction
}

beforeEach(async () => {
  transaction = await db.transaction()
})

afterEach(async () => {
  await transaction.rollback()
})
```

```typescript
// 使用示例
it('创建订单', async () => {
  const trx = getTrx()
  await trx('users').insert({ id: 'u1', name: '张三', email: 'a@b.com' })
  await trx('orders').insert({ id: 'o1', userId: 'u1', amount: 100 })
  const order = await trx('orders').where('id', 'o1').first()
  expect(order.amount).toBe(100)
})
```

**要点**：事务回滚是最高效的数据隔离方案，`getTrx()` 保证每个测试拿到独立的事务。

# Mock 策略

## 场景引入

你在测试一个用户注册流程：调用第三方邮件服务发送验证邮件、写入数据库、返回结果。测试跑一次要 3 秒，而且经常因为邮件服务超时而失败。你决定"Mock 掉外部调用"，于是把整个邮件模块替换成空函数。测试秒过，信心满满。上线后发现——邮件根本没发出去，因为 Mock 掩盖了一个真实的序列化 bug。

这就是 Mock 的双刃剑：用对了，测试快且稳定；用错了，测试快但骗人。本课讲清楚什么时候该 Mock、什么时候不该 Mock，以及如何用 Vitest 的 Mock 工具写出可靠的测试。

## 学习目标

- 理解 Mock 的本质和适用边界
- 掌握 `vi.fn()` 和 `vi.mock()` 的使用方式
- 理解依赖注入与隐式 Mock 的取舍
- 能判断一个依赖是否值得 Mock

## 什么时候该 Mock

### 原则：Mock 外部边界，不 Mock 内部逻辑

Mock 的目标是**隔离不可控因素**，而不是让测试"看起来通过"。以下三类依赖应该 Mock：

**1. 外部 API 调用**

第三方服务不可控——可能超时、可能收费、可能变更返回格式：

```typescript
globalThis.fetch = vi.fn()

describe('sendVerificationEmail', () => {
  it('发送成功时返回 true', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
    } as Response)
    const result = await sendVerificationEmail('user@test.com', '123456')
    expect(result).toBe(true)
  })

  it('发送失败时返回 false', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false, status: 500,
    } as Response)
    const result = await sendVerificationEmail('user@test.com', '123456')
    expect(result).toBe(false)
  })
})
```

**2. 数据库操作**

数据库需要连接、有状态、清理麻烦。在单元测试中 Mock 掉数据库层是常见做法。通过依赖注入接口，测试中传入 Mock 实现：

```typescript
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  create(data: CreateUserInput): Promise<User>
}

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(email: string, password: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(email)
    if (existing) throw new Error('邮箱已注册')
    return this.userRepo.create({ email, password: await hash(password) })
  }
}
```

```typescript
function createMockUserRepo(): UserRepository {
  return { findByEmail: vi.fn(), create: vi.fn() }
}

it('邮箱已注册时抛出错误', async () => {
  const mockRepo = createMockUserRepo()
  vi.mocked(mockRepo.findByEmail).mockResolvedValueOnce({
    id: '1', email: 'exists@test.com', password: 'hashed',
  })
  const service = new AuthService(mockRepo)
  await expect(service.register('exists@test.com', 'pw')).rejects.toThrow('邮箱已注册')
})
```

**3. 时间与定时器**

时间相关的逻辑如果依赖真实时间，测试结果会随运行时间变化。Mock 时间是必须的（详见第 5 课）。

### 什么时候不该 Mock

**不要 Mock 你自己的纯函数。** 纯函数没有副作用，直接测试输入输出即可：

```typescript
export function calculateDiscount(price: number, tier: 'gold' | 'silver' | 'bronze'): number {
  const rates = { gold: 0.8, silver: 0.9, bronze: 0.95 }
  return Math.round(price * rates[tier] * 100) / 100
}

// ✅ 正确：直接测试
it('黄金会员打八折', () => {
  expect(calculateDiscount(100, 'gold')).toBe(80)
})
```

**不要 Mock 轻量的、稳定的标准库调用。** `JSON.parse`、`Array.prototype.map` 等——Mock 它们只会增加维护成本。

## vi.fn() 创建 Mock 函数

`vi.fn()` 创建一个可追踪调用行为的函数：

```typescript
it('追踪调用参数和次数', () => {
  const logAction = vi.fn()
  logAction('click', { button: 'submit' })
  logAction('click', { button: 'cancel' })

  expect(logAction).toHaveBeenCalledTimes(2)
  expect(logAction).toHaveBeenNthCalledWith(1, 'click', { button: 'submit' })
})

it('自定义返回值', () => {
  const fetchUser = vi.fn().mockResolvedValue({ id: '1', name: '张三' })
  expect(fetchUser()).resolves.toEqual({ id: '1', name: '张三' })
})

it('根据参数返回不同值', () => {
  const getPrice = vi.fn()
    .mockReturnValueOnce(100)
    .mockReturnValueOnce(200)
    .mockReturnValue(0)

  expect(getPrice()).toBe(100)
  expect(getPrice()).toBe(200)
  expect(getPrice()).toBe(0)
})
```

## vi.mock() 模块级 Mock

`vi.mock()` 在模块级别替换整个模块的导出，适用于 Mock 第三方库或内部模块：

```typescript
// vi.mock 必须在文件顶层，不能放在 describe 或 it 内部
vi.mock('../utils/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

import { processOrder } from './order-service'
import { logError, logInfo } from '../utils/logger'

describe('processOrder', () => {
  it('成功时记录 info 日志', async () => {
    await processOrder('ORD-001')
    expect(logInfo).toHaveBeenCalledWith('开始处理订单 ORD-001')
    expect(logInfo).toHaveBeenCalledWith('订单 ORD-001 处理完成')
  })
})
```

## 依赖注入 vs 隐式 Mock

有两种方式隔离依赖，各有取舍：

| 场景 | 推荐方式 |
|------|----------|
| 第三方库（axios、lodash） | `vi.mock()` — 你不想改源码 |
| 内部基础设施（日志、配置） | `vi.mock()` — 频繁使用但稳定 |
| 核心业务依赖（仓库、服务） | 依赖注入 — 需要灵活替换 |
| React 组件测试 | `vi.mock()` — 组件通常不接受所有依赖为 props |

**隐式 Mock（vi.mock）**：不需要修改源码，但与模块路径耦合，重构时测试也得改。

**依赖注入**：通过构造函数接收依赖，测试中传入 Mock 对象，更灵活但需要改源码。

## Mock 的维护成本

Mock 不是免费的。每多一个 Mock，就多一份维护负担：

```typescript
// ❌ 过度 Mock：Mock 了太多内部细节
vi.mock('../utils/validator')
vi.mock('../utils/formatter')
vi.mock('../utils/cache')
vi.mock('../utils/logger')
vi.mock('../utils/config')
// 当任何一个模块重构时，这些 Mock 都可能失效
```

**判断标准：** 如果一个 Mock 让你的测试更容易碎（改源码就要改测试），说明 Mock 得太多了。

```typescript
// ✅ 每个测试前重置 Mock
beforeEach(() => {
  vi.restoreAllMocks()
})
```

## 常见误区

1. **Mock 一切**：连自己的纯函数都 Mock，导致测试与实现强耦合
2. **Mock 了但不验证**：只 Mock 了返回值，没验证被测函数是否正确调用了依赖
3. **Mock 数据不现实**：用简化数据，上线后遇到边界值才出问题
4. **忘记重置 Mock**：`vi.fn()` 的调用记录在测试间共享，导致断言污染

## 工程建议

1. **先写不 Mock 的测试**，遇到真实的痛点再 Mock
2. **Mock 粒度要粗**：Mock 整个模块或接口，不要 Mock 单个方法的中间步骤
3. **给 Mock 数据起名字**：用 `createTestUser()` 而不是直接写对象字面量
4. **定期审查 Mock**：如果一个 Mock 很久没更新过，可能它 Mock 的东西已经不存在了
5. **在测试失败时先怀疑 Mock**：Mock 是测试中最容易过时的部分

## 小结

Mock 是测试隔离的工具，不是让测试通过的捷径。核心原则：**Mock 外部边界，测试内部行为**。`vi.fn()` 创建可追踪的函数，`vi.mock()` 替换整个模块，依赖注入提供更灵活的替换方式。每次 Mock 前问自己：这个 Mock 是让测试更可靠，还是在掩盖真实行为？

## 练习

### 练习一：判断哪些该 Mock

以下场景中，哪些依赖应该 Mock？为什么？
- A. 测试价格计算函数，内部调用了 `Math.round`
- B. 测试用户注册流程，需要调用短信验证码 API
- C. 测试字符串格式化工具，内部使用 `Intl.DateTimeFormat`
- D. 测试订单导出功能，需要查询数据库获取订单列表

### 练习二：实现 Mock 函数

有一个 `NotificationService` 类，依赖 `EmailSender` 接口发送邮件。请用依赖注入 + `vi.fn()` 写出测试，验证"发送通知失败时记录错误日志但不抛出异常"。

---

## 参考答案

### 练习一

**思路**：判断标准是"这个依赖是否不可控、不稳定、有副作用"。

**答案**：
- A. 不该 Mock。`Math.round` 是稳定的原生函数，直接测试计算结果即可。
- B. 该 Mock。第三方短信 API 不可控，可能收费、超时、有频率限制。
- C. 不该 Mock。`Intl.DateTimeFormat` 是稳定的浏览器/Node 内置 API。
- D. 该 Mock。数据库是有状态的外部依赖，单元测试中应该隔离。

### 练习二

**思路**：通过构造函数注入 `EmailSender`，用 `vi.fn()` 模拟失败场景。

**答案**：

```typescript
export class NotificationService {
  constructor(
    private emailSender: { send: (to: string, subject: string, body: string) => Promise<boolean> },
    private logger: { error: (msg: string) => void }
  ) {}

  async notify(userId: string, message: string): Promise<void> {
    try {
      await this.emailSender.send(userId, '通知', message)
    } catch (error) {
      this.logger.error(`通知发送失败: ${userId}`)
    }
  }
}

it('发送失败时记录错误但不抛出', async () => {
  const mockSender = { send: vi.fn().mockRejectedValue(new Error('SMTP 超时')) }
  const mockLogger = { error: vi.fn() }
  const service = new NotificationService(mockSender, mockLogger)

  await service.notify('user@test.com', '你有新消息')

  expect(mockLogger.error).toHaveBeenCalledWith('通知发送失败: user@test.com')
  expect(mockSender.send).toHaveBeenCalledOnce()
})
```

**要点**：依赖注入让 Mock 变得简单——只需构造一个满足接口的对象即可，不需要 `vi.mock()`。

# Mock 策略

## 一个 Mock 掩盖的 bug

你在测试用户注册流程：调用第三方邮件服务发送验证邮件、写入数据库、返回结果。测试跑一次要 3 秒，经常因为邮件服务超时失败。你 Mock 掉了整个邮件模块。测试秒过。上线后发现邮件根本没发出去——Mock 掩盖了一个真实的序列化 bug。

Mock 的双刃剑：用对了，测试快且稳定；用错了，测试快但骗人。

## 核心原则：Mock 外部边界，不 Mock 内部逻辑

Mock 的目标是隔离不可控因素，而不是让测试"看起来通过"。

**应该 Mock 的三类依赖**：

```typescript
// 1. 外部 API 调用（不可控、可能收费、可能超时）
globalThis.fetch = vi.fn()
vi.mocked(globalThis.fetch).mockResolvedValueOnce({
  ok: true, status: 200,
} as Response)

// 2. 数据库操作（有状态、清理麻烦）
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  create(data: CreateUserInput): Promise<User>
}
function createMockUserRepo(): UserRepository {
  return { findByEmail: vi.fn(), create: vi.fn() }
}

// 3. 时间与定时器（依赖真实时间会导致测试不稳定）
vi.useFakeTimers()
```

**不该 Mock 的**：

```typescript
// 你自己的纯函数——直接测试输入输出
export function calculateDiscount(price: number, tier: 'gold' | 'silver'): number {
  const rates = { gold: 0.8, silver: 0.9 }
  return Math.round(price * rates[tier] * 100) / 100
}
// 正确做法：
test('黄金会员打八折', () => { expect(calculateDiscount(100, 'gold')).toBe(80) })

// 稳定的标准库——JSON.parse、Array.map 等
// Mock 它们只会增加维护成本
```

## vi.fn()：追踪调用行为

```typescript
it('追踪调用参数和次数', () => {
  const logAction = vi.fn()
  logAction('click', { button: 'submit' })
  logAction('click', { button: 'cancel' })

  expect(logAction).toHaveBeenCalledTimes(2)
  expect(logAction).toHaveBeenNthCalledWith(1, 'click', { button: 'submit' })
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

## vi.mock()：模块级替换

```typescript
// vi.mock 必须在文件顶层
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
  })
})
```

## 依赖注入 vs 隐式 Mock

```
场景                          推荐方式
──────────────────────────────────────────
第三方库（axios、lodash）      vi.mock() — 你不想改源码
内部基础设施（日志、配置）      vi.mock() — 频繁使用但稳定
核心业务依赖（仓库、服务）      依赖注入 — 需要灵活替换
React 组件测试                vi.mock() — 组件通常不接受所有依赖为 props
```

依赖注入更灵活——通过构造函数接收依赖，测试中传入 Mock 对象：

```typescript
export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(email: string, password: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(email)
    if (existing) throw new Error('邮箱已注册')
    return this.userRepo.create({ email, password: await hash(password) })
  }
}

// 测试中：
const mockRepo = createMockUserRepo()
vi.mocked(mockRepo.findByEmail).mockResolvedValueOnce({
  id: '1', email: 'exists@test.com', password: 'hashed',
})
const service = new AuthService(mockRepo)
await expect(service.register('exists@test.com', 'pw')).rejects.toThrow('邮箱已注册')
```

## Mock 的维护成本

每多一个 Mock，就多一份维护负担。判断标准：如果一个 Mock 让你的测试更容易碎（改源码就要改测试），说明 Mock 得太多了。

```typescript
// 每个测试前重置 Mock
beforeEach(() => {
  vi.restoreAllMocks()
})
```

## 练习

### 练习一：判断哪些该 Mock

- A. 测试价格计算函数，内部调用了 `Math.round`
- B. 测试用户注册流程，需要调用短信验证码 API
- C. 测试字符串格式化工具，内部使用 `Intl.DateTimeFormat`
- D. 测试订单导出功能，需要查询数据库获取订单列表

### 练习二：实现 NotificationService 测试

`NotificationService` 类依赖 `EmailSender` 接口发送邮件。用依赖注入 + `vi.fn()` 写测试，验证"发送通知失败时记录错误日志但不抛出异常"。

---

## 参考答案

### 练习一

- A. 不该 Mock。`Math.round` 是稳定的原生函数。
- B. 该 Mock。第三方短信 API 不可控，可能收费、超时。
- C. 不该 Mock。`Intl.DateTimeFormat` 是稳定的内置 API。
- D. 该 Mock。数据库是有状态的外部依赖。

### 练习二

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

依赖注入让 Mock 变得简单——只需构造一个满足接口的对象即可。

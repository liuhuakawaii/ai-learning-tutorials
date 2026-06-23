# Vitest 单元测试

你接手了一个 TypeScript 项目，业务逻辑复杂，没有任何测试。每次想重构一个函数，都要手动走一遍所有调用方确认没坏。改完不敢发，发了线上炸。

这不是你能力问题，是缺安全网。单元测试就是那个安全网。

## 为什么是 Vitest

Jest 对 TypeScript 和 ESM 靠 Babel/ts-jest 补丁，配置复杂。Vitest 基于 Vite 构建，原生理解 TypeScript 和 ESM，零配置就能跑。项目用 Vite 的话，vitest 直接复用 vite.config.ts 的 alias 和 plugin，不用配两遍。

```bash
npm install -D vitest @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true, environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: { provider: "v8", reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts", "src/types/**"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
})
```

## 第一个测试

从项目里真实存在的函数开始，不要写 `add(1, 2) === 3`：

```typescript
// src/utils/permission.ts
type Role = "admin" | "editor" | "viewer"
const ROLE_HIERARCHY: Record<Role, number> = { admin: 3, editor: 2, viewer: 1 }

export function canAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function filterByPermission<T extends { requiredRole: Role }>(items: T[], userRole: Role): T[] {
  return items.filter((item) => canAccess(userRole, item.requiredRole))
}
```

```typescript
// src/utils/permission.test.ts
import { describe, it, expect } from "vitest"
import { canAccess, filterByPermission } from "./permission"

describe("canAccess", () => {
  it("admin 可以访问所有级别", () => {
    expect(canAccess("admin", "viewer")).toBe(true)
    expect(canAccess("admin", "editor")).toBe(true)
  })
  it("viewer 只能访问 viewer", () => {
    expect(canAccess("viewer", "viewer")).toBe(true)
    expect(canAccess("viewer", "editor")).toBe(false)
  })
})

describe("filterByPermission", () => {
  const articles = [
    { title: "公开文章", requiredRole: "viewer" as Role },
    { title: "编辑内部", requiredRole: "editor" as Role },
  ]
  it("viewer 只能看到公开文章", () => { expect(filterByPermission(articles, "viewer")).toHaveLength(1) })
  it("空数组返回空数组", () => { expect(filterByPermission([], "admin")).toEqual([]) })
})
```

运行：`npx vitest run`（单次）或 `npx vitest`（watch 模式）。

## Mock：隔离外部依赖

测试只验证被测函数的逻辑，不验证数据库能不能连。Mock 把外部依赖替换成假的。

```typescript
// src/services/order.ts
export interface PaymentGateway { charge(userId: string, amount: number): Promise<{ transactionId: string }> }
export interface OrderRepository { save(order: Order): Promise<Order>; findById(id: string): Promise<Order | null> }
export interface Order { id: string; userId: string; amount: number; status: "pending" | "paid"; transactionId?: string }

export class OrderService {
  constructor(private repo: OrderRepository, private payment: PaymentGateway) {}

  async createOrder(userId: string, amount: number): Promise<Order> {
    return this.repo.save({ id: crypto.randomUUID(), userId, amount, status: "pending" })
  }

  async payOrder(orderId: string): Promise<Order> {
    const order = await this.repo.findById(orderId)
    if (!order) throw new Error("Order not found")
    if (order.status === "paid") throw new Error("Already paid")
    const result = await this.payment.charge(order.userId, order.amount)
    order.status = "paid"; order.transactionId = result.transactionId
    return this.repo.save(order)
  }
}
```

```typescript
// src/services/order.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrderService, type OrderRepository, type PaymentGateway, type Order } from "./order"

describe("OrderService", () => {
  let service: OrderService
  let mockRepo: OrderRepository
  let mockPayment: PaymentGateway

  beforeEach(() => {
    mockRepo = { save: vi.fn().mockImplementation(async (o: Order) => o), findById: vi.fn() }
    mockPayment = { charge: vi.fn().mockResolvedValue({ transactionId: "txn_001" }) }
    service = new OrderService(mockRepo, mockPayment)
  })

  it("创建订单应保存到仓库", async () => {
    const order = await service.createOrder("user_001", 9900)
    expect(mockRepo.save).toHaveBeenCalledOnce()
    expect(order.status).toBe("pending")
  })

  it("支付订单应调用支付网关", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue({ id: "o1", userId: "u1", amount: 9900, status: "pending" })
    const result = await service.payOrder("o1")
    expect(mockPayment.charge).toHaveBeenCalledWith("u1", 9900)
    expect(result.status).toBe("paid")
  })

  it("订单不存在时应抛出错误", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)
    await expect(service.payOrder("nonexistent")).rejects.toThrow("Order not found")
  })
})
```

`vi.fn()` 创建假函数，记录调用次数和参数。`vi.mocked()` 加上类型，方便 `.mockResolvedValue()` 等方法的推导。

## Mock 全局 fetch

```typescript
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => { mockFetch.mockReset() })

it("应返回城市温度", async () => {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ temperature: 28 }) })
  const temp = await getCityTemperature("北京")
  expect(temp).toBe(28)
})
```

## 快照测试

快照适合验证"复杂对象的结构没有意外变化"。Vitest 把第一次结果存成文件，后续运行对比。

```typescript
it("生产环境配置结构应保持稳定", () => {
  expect(buildAppConfig("prod")).toMatchSnapshot()
})
```

陷阱：输出频繁变化时快照不断更新，最终没人看 diff 就 `--update`。快照适合稳定的数据结构，不适合频繁变动的 UI 输出。

## 异步测试

```typescript
import { vi } from "vitest"

it("应正确模拟时间推进", () => {
  vi.useFakeTimers()
  let count = 0
  const timer = setInterval(() => { count++ }, 1000)
  vi.advanceTimersByTime(3000)
  expect(count).toBe(3)
  clearInterval(timer)
  vi.useRealTimers()
})
```

`vi.useFakeTimers()` 替换定时器为可控的假定时器。`vi.advanceTimersByTime(3000)` 快进 3 秒，不用真的等。

## 覆盖率

```bash
npx vitest run --coverage
```

设阈值，CI 里低于就失败：

```typescript
// vitest.config.ts
coverage: { thresholds: { statements: 80, branches: 75, functions: 80, lines: 80 } }
```

80% 是合理底线。追求 100% 的代价是给不可能出 bug 的代码写测试，收益递减。覆盖率告诉你"哪些代码没被测到"，不告诉你"测的质量怎么样"。

## 练习

### 练习一：为权限函数写测试

```typescript
type Permission = "read" | "write" | "delete"
function checkPermission(userPermissions: Permission[], required: Permission): boolean {
  return userPermissions.includes(required)
}
```

### 练习二：Mock 外部 API

用 `vi.stubGlobal("fetch", ...)` Mock 全局 fetch，为 `fetchUserProfile(userId)` 写测试，覆盖成功和失败路径。

### 练习三：快照 + 行为混合测试

给 `createErrorResponse(code, message)` 写测试，快照测试验证结构，行为测试验证消息格式。

---

## 参考答案

### 练习一

```typescript
describe("checkPermission", () => {
  it("有权限时返回 true", () => { expect(checkPermission(["read", "write"], "read")).toBe(true) })
  it("没有权限时返回 false", () => { expect(checkPermission(["read"], "write")).toBe(false) })
  it("空权限列表返回 false", () => { expect(checkPermission([], "read")).toBe(false) })
})
```

### 练习二

```typescript
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("fetchUserProfile", () => {
  beforeEach(() => { mockFetch.mockReset() })
  it("应返回用户资料", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "1", name: "张三" }) })
    expect((await fetchUserProfile("1")).name).toBe("张三")
  })
  it("用户不存在时应抛出错误", async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(fetchUserProfile("999")).rejects.toThrow("User 999 not found")
  })
})
```

### 练习三

```typescript
function createErrorResponse(code: number, message: string) {
  return { success: false, error: { code, message, timestamp: Date.now() } }
}
// 快照验证结构：expect(createErrorResponse(404, "不存在")).toMatchSnapshot({ error: { timestamp: expect.any(Number) } })
// 行为验证消息：expect(createErrorResponse(500, "内部错误").error.code).toBe(500)
```

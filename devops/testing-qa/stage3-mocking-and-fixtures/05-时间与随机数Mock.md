# 时间与随机数 Mock

## 场景引入
你在测试一个"优惠券过期"的逻辑：优惠券有效期 7 天，过期后不能使用。测试跑得好好的。两周后，所有相关测试都失败了——因为优惠券真的过期了。你写了一个 `createdAt` 用今天的日期，但两周后"今天"已经不是当初的"今天"了。

类似的问题还有：测试倒计时功能需要等 60 秒、测试 UUID 生成每次结果不同。这些"不确定性"是测试的大敌。本课讲如何用 Vitest 控制时间和随机数，让测试变得确定、快速、可重复。

## 学习目标

- 掌握 `vi.useFakeTimers()` 和 `vi.setSystemTime()` 控制时间
- 学会测试定时器相关逻辑（setTimeout/setInterval）
- 学会 Mock `Math.random` 和 `crypto.randomUUID`

## vi.useFakeTimers() 控制时间

`vi.useFakeTimers()` 会替换全局的时间相关 API（`Date`、`setTimeout`、`setInterval`、`clearTimeout`、`clearInterval`）：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('时间控制', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('可以快进时间', () => {
    const callback = vi.fn()
    setTimeout(callback, 5000)

    vi.advanceTimersByTime(3000)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(callback).toHaveBeenCalledOnce()
  })
})
```

## vi.setSystemTime() 设置系统时间

`vi.setSystemTime()` 固定 `new Date()` 的返回值：

```typescript
describe('优惠券过期检测', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('7 天内的优惠券未过期', () => {
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    const coupon = {
      code: 'SAVE20',
      createdAt: new Date('2024-01-10T10:00:00Z'),
      validDays: 7,
    }
    expect(isCouponValid(coupon)).toBe(true)
  })

  it('超过 7 天的优惠券已过期', () => {
    vi.setSystemTime(new Date('2024-01-20T10:00:00Z'))
    const coupon = {
      code: 'SAVE20',
      createdAt: new Date('2024-01-10T10:00:00Z'),
      validDays: 7,
    }
    expect(isCouponValid(coupon)).toBe(false)
  })
})
```

## 测试 setTimeout

```typescript
export class AutoSaveService {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private saveFn: () => Promise<void>, private delayMs: number = 5000) {}

  schedule(): void {
    this.cancel()
    this.timer = setTimeout(async () => {
      await this.saveFn()
      this.timer = null
    }, this.delayMs)
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
```

```typescript
describe('AutoSaveService', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('5 秒后自动保存', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const service = new AutoSaveService(saveFn, 5000)

    service.schedule()
    expect(saveFn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(saveFn).toHaveBeenCalledOnce()
  })

  it('取消后不再保存', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const service = new AutoSaveService(saveFn, 5000)

    service.schedule()
    service.cancel()

    await vi.advanceTimersByTimeAsync(10000)
    expect(saveFn).not.toHaveBeenCalled()
  })
})
```

## 测试 setInterval

```typescript
export class PollingService {
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(private fetchFn: () => Promise<void>, private intervalMs: number = 10000) {}

  start(): void {
    this.stop()
    this.intervalId = setInterval(() => this.fetchFn(), this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }
}

describe('PollingService', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('每 10 秒轮询一次，停止后不再轮询', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined)
    const service = new PollingService(fetchFn, 10000)
    service.start()

    await vi.advanceTimersByTimeAsync(25000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    service.stop()
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetchFn).toHaveBeenCalledTimes(2) // 停止后没有新增调用
  })
})
```

## 测试日期相关逻辑

```typescript
export function getDaysRemaining(deadline: Date): number {
  const diff = deadline.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

describe('截止日期计算', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('还有 3 天到期', () => {
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    expect(getDaysRemaining(new Date('2024-01-18T10:00:00Z'))).toBe(3)
  })

  it('已过期返回 0', () => {
    vi.setSystemTime(new Date('2024-01-20T10:00:00Z'))
    expect(getDaysRemaining(new Date('2024-01-15T10:00:00Z'))).toBe(0)
  })
})
```

## Mock Math.random

```typescript
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

describe('generateInviteCode', () => {
  beforeEach(() => {
    let callCount = 0
    const sequence = [0.1, 0.5, 0.9, 0.0, 0.3, 0.7, 0.2, 0.8]
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return sequence[callCount++ % sequence.length]
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('生成 8 位邀请码', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toBe('C4ZATXBN')
  })

  it('只包含大写字母和数字', () => {
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/)
  })
})
```

## Mock crypto.randomUUID

```typescript
export function createResource(name: string) {
  return { id: crypto.randomUUID(), name, createdAt: new Date() }
}

describe('createResource', () => {
  beforeEach(() => {
    let counter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      counter++
      return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('生成的资源有唯一 ID', () => {
    const resource = createResource('测试资源')
    expect(resource.id).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('多次创建生成不同 ID', () => {
    expect(createResource('资源1').id).not.toBe(createResource('资源2').id)
  })
})
```

## 常见误区

1. **忘记 `vi.useRealTimers()`**：Fake Timers 不会在测试结束后自动恢复
2. **用 `vi.advanceTimersByTime` 测试异步代码**：异步操作需要 `vi.advanceTimersByTimeAsync`
3. **Mock Math.random 后忘记恢复**：`vi.restoreAllMocks()` 必须在 `afterEach` 中调用
4. **Fake Timers 与真实定时器混用**：某些库内部使用 `setTimeout`，Fake Timers 可能导致它们无法正常工作

```typescript
// ✅ 正确的清理模式
afterEach(() => {
  vi.restoreAllMocks()   // 恢复 Math.random 等 Mock
  vi.useRealTimers()     // 恢复真实时间
})
```

## 工程建议

1. **在 `vitest.setup.ts` 中不全局启用 Fake Timers**：只在需要的测试中启用
2. **Fake Timers 和 Mock 要成对清理**：`afterEach` 中同时恢复
3. **测试异步定时器时用 `vi.advanceTimersByTimeAsync`**：它会等待 Promise 解析
4. **Mock 随机数时使用固定序列**：不要返回常量，用序列表达"每次不同但可预测"
5. **优先用 `vi.setSystemTime`**：不要 Mock `Date` 构造函数本身

## 小结

时间和随机数是测试中两大"不确定性"来源。`vi.useFakeTimers()` 和 `vi.setSystemTime()` 让你完全控制时间，`vi.spyOn(Math, 'random')` 和 `vi.spyOn(crypto, 'randomUUID')` 让随机数变得可预测。核心原则：**测试应该确定、快速、可重复**。

## 练习

### 练习一：测试倒计时

实现一个 `Countdown` 类，支持 `start(seconds)` 开始倒计时、每秒触发 `onTick(remaining)` 回调、倒计时结束触发 `onComplete()` 回调。写出完整的测试。

### 练习二：Mock 随机数生成验证码

有一个 `generateVerificationCode()` 函数，生成 6 位数字验证码（使用 `Math.random`）。请 Mock `Math.random` 并写出测试，验证验证码长度为 6、只包含数字、结果可预测。

---

## 参考答案

### 练习一

**思路**：用 Fake Timers 控制时间流逝，验证每秒的回调和最终的完成回调。

**答案**：

```typescript
export class Countdown {
  private timerId: ReturnType<typeof setInterval> | null = null
  private remaining = 0

  constructor(private onTick: (r: number) => void, private onComplete: () => void) {}

  start(seconds: number): void {
    this.remaining = seconds
    this.onTick(this.remaining)
    this.timerId = setInterval(() => {
      this.remaining--
      if (this.remaining <= 0) { clearInterval(this.timerId!); this.onComplete() }
      else { this.onTick(this.remaining) }
    }, 1000)
  }
}

describe('Countdown', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('每秒触发 onTick', async () => {
    const onTick = vi.fn()
    new Countdown(onTick, vi.fn()).start(3)
    expect(onTick).toHaveBeenCalledWith(3)
    await vi.advanceTimersByTimeAsync(1000)
    expect(onTick).toHaveBeenCalledWith(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(onTick).toHaveBeenCalledWith(1)
  })

  it('倒计时结束触发 onComplete', async () => {
    const onComplete = vi.fn()
    new Countdown(vi.fn(), onComplete).start(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
```

### 练习二

**思路**：Mock `Math.random` 返回固定序列，验证输出的确定性。

**答案**：

```typescript
export function generateVerificationCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10).toString()
  return code
}

describe('generateVerificationCode', () => {
  beforeEach(() => {
    let i = 0
    const seq = [0.123, 0.456, 0.789, 0.012, 0.345, 0.678]
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length])
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('生成 6 位纯数字验证码', () => {
    const code = generateVerificationCode()
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('结果可预测', () => {
    expect(generateVerificationCode()).toBe('147036')
  })
})
```

**要点**：Mock `Math.random` 返回固定序列而非常量，这样既能验证结果可预测，又能测试"每次不同"的逻辑。

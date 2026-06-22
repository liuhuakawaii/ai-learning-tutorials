# 01 - Vitest 单元测试

## 场景引入

你接手了一个 TypeScript 项目，业务逻辑复杂，重构时总是担心破坏已有功能。手动测试效率低、覆盖不全，你需要一套可靠的自动化测试体系。Vitest 作为新一代测试框架，原生支持 TypeScript 和 ESM，正在成为越来越多团队的首选。

## 学习目标

- 理解 Vitest 与 Jest 的差异，能在项目中正确选型
- 掌握 Vitest 的配置方法，适配不同项目场景
- 熟练使用 describe/it/expect 编写结构化测试
- 掌握 Mock、Spy、快照测试等进阶技巧
- 能够编写异步测试，处理 Promise 和定时器场景

## 一、Vitest vs Jest：为什么选择 Vitest

Vitest 基于 Vite 构建，天然支持 TypeScript、ESM 和 JSX，无需额外配置转译。相比 Jest，它有三个核心优势：原生 ESM 支持、共享 Vite 配置、更快的执行速度。

```typescript
// src/utils/math.ts
export function add(a: number, b: number): number {
  return a + b
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero')
  return a / b
}
```

```typescript
// src/utils/math.test.ts
import { describe, it, expect } from 'vitest'
import { add, divide } from './math'

describe('math utils', () => {
  it('should add two numbers correctly', () => {
    expect(add(1, 2)).toBe(3)
  })

  it('should throw when dividing by zero', () => {
    expect(() => divide(1, 0)).toThrow('Division by zero')
  })
})
```

## 二、配置与项目搭建

```bash
npm install -D vitest @vitest/coverage-v8 typescript
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/types/**'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 三、核心 API：describe/it/expect

describe 用于组织测试用例，it 定义单个测试，expect 进行断言。

```typescript
import { describe, it, expect } from 'vitest'

interface User {
  id: string
  name: string
  role: 'admin' | 'user'
}

function formatUserDisplay(user: User): string {
  const roleLabel = user.role === 'admin' ? '管理员' : '用户'
  return `${user.name} (${roleLabel})`
}

describe('formatUserDisplay', () => {
  it('管理员应显示管理员标签', () => {
    const user: User = { id: '1', name: '张三', role: 'admin' }
    expect(formatUserDisplay(user)).toBe('张三 (管理员)')
  })

  it('普通用户应显示用户标签', () => {
    const user: User = { id: '2', name: '李四', role: 'user' }
    expect(formatUserDisplay(user)).toBe('李四 (用户)')
  })
})
```

常用断言方法：`toBe`（严格相等）、`toEqual`（深度相等）、`toContain`（包含）、`toMatch`（正则匹配）、`toThrow`（异常抛出）、`toBeTruthy`/`toBeFalsy`（真假值）。

## 四、Mock 与 Spy

Mock 替换函数实现，Spy 监听函数调用。两者在测试隔离中至关重要。

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface EmailService {
  send(to: string, subject: string, body: string): Promise<boolean>
}

function createNotificationManager(emailService: EmailService) {
  return {
    async notifyUser(userId: string, message: string) {
      const email = `${userId}@example.com`
      await emailService.send(email, '通知', message)
    },
  }
}

describe('NotificationManager', () => {
  let mockEmailService: EmailService
  let manager: ReturnType<typeof createNotificationManager>

  beforeEach(() => {
    mockEmailService = { send: vi.fn().mockResolvedValue(true) }
    manager = createNotificationManager(mockEmailService)
  })

  it('应调用邮件服务发送通知', async () => {
    await manager.notifyUser('user1', '你有一条新消息')
    expect(mockEmailService.send).toHaveBeenCalledWith(
      'user1@example.com', '通知', '你有一条新消息'
    )
  })
})
```

模块级 Mock 使用 `vi.mock()` 替换整个模块，`vi.mocked()` 获取类型安全的 Mock 引用。

## 五、快照测试与覆盖率

快照测试适合验证复杂输出结构是否发生变化。

```typescript
import { describe, it, expect } from 'vitest'

function buildApiResponse<T>(data: T, message = 'success') {
  return { code: 200, message, data, timestamp: Date.now() }
}

describe('API 响应构建', () => {
  it('应生成正确的响应结构', () => {
    const response = buildApiResponse({ id: 1, name: '测试' })
    expect(response).toMatchSnapshot({ timestamp: expect.any(Number) })
  })
})
```

覆盖率阈值配置：

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
}
```

## 六、异步测试

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('异步操作', () => {
  it('应正确处理成功的 Promise', async () => {
    const result = await Promise.resolve('成功')
    expect(result).toBe('成功')
  })

  it('应捕获 rejected 的 Promise', async () => {
    await expect(Promise.reject(new Error('失败'))).rejects.toThrow('失败')
  })
})

describe('定时器操作', () => {
  it('应模拟定时器执行', () => {
    vi.useFakeTimers()
    let count = 0
    const timer = setInterval(() => { count++ }, 1000)

    vi.advanceTimersByTime(3000)
    expect(count).toBe(3)

    clearInterval(timer)
    vi.useRealTimers()
  })
})
```

## 常见误区

1. **过度 Mock**：Mock 应该只用于外部依赖（网络请求、数据库、文件系统），不要 Mock 被测模块的内部逻辑，否则测试失去意义。

2. **测试实现细节**：不要断言函数内部调用了哪些私有方法，应该断言函数的输入输出行为。测试应该能承受重构而不失败。

3. **忽略边界条件**：只测试正常路径是不够的。空数组、null 值、超大输入等边界场景才是 bug 的高发区。

4. **快照测试滥用**：快照测试适合验证稳定的数据结构，不适合频繁变化的 UI 输出。过大的快照文件难以审查。

## 工程建议

1. **测试文件就近放置**：将 `*.test.ts` 文件放在被测代码旁边，而不是集中在一个 `tests/` 目录。这样更容易发现哪些模块缺少测试。

2. **使用 describe 分层组织**：第一层按模块划分，第二层按函数划分，第三层按场景划分。测试报告的结构清晰，失败时能快速定位。

3. **beforeEach 清理状态**：每个测试用例应该相互独立，不依赖执行顺序。使用 `beforeEach` 重置 Mock，避免测试之间的状态污染。

4. **覆盖率是底线不是目标**：80% 的行覆盖率是合理的底线，但不要追求 100%。覆盖率只能告诉你哪些代码没有被测到，不能告诉你测试质量如何。

## 小结

本课学习了 Vitest 的核心用法：从项目配置到基本 API，从 Mock/Spy 到异步测试。Vitest 原生支持 TypeScript 和 ESM，配合 Vite 生态，在现代前端项目中具有明显优势。

## 练习

### 练习一：基础测试编写

为以下函数编写完整的单元测试，覆盖正常情况和边界条件：

```typescript
export function parseQueryString(url: string): Record<string, string> {
  const questionMarkIndex = url.indexOf('?')
  if (questionMarkIndex === -1) return {}
  const queryString = url.slice(questionMarkIndex + 1)
  if (!queryString) return {}
  return queryString.split('&').reduce((params, pair) => {
    const [key, value] = pair.split('=')
    params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    return params
  }, {} as Record<string, string>)
}
```

### 练习二：Mock 与异步测试

编写测试验证以下函数的异步行为，使用 Mock 模拟网络请求：

```typescript
async function fetchWithRetry(
  url: string,
  options = { retries: 3, retryDelay: 1000 }
): Promise<unknown> {
  for (let i = 0; i <= options.retries; i++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      if (i === options.retries) throw error
      await new Promise((r) => setTimeout(r, options.retryDelay * Math.pow(2, i)))
    }
  }
}
```

### 练习三：快照测试

为一个配置生成器函数编写快照测试，验证输出结构的稳定性：

```typescript
function createConfig(env: 'dev' | 'staging' | 'prod') {
  const configs = {
    dev: { database: { host: 'localhost', port: 5432, pool: 5 }, cache: { enabled: false, ttl: 0 }, logging: { level: 'debug', format: 'pretty' } },
    staging: { database: { host: 'staging-db.internal', port: 5432, pool: 10 }, cache: { enabled: true, ttl: 300 }, logging: { level: 'info', format: 'json' } },
    prod: { database: { host: 'prod-db.internal', port: 5432, pool: 20 }, cache: { enabled: true, ttl: 3600 }, logging: { level: 'warn', format: 'json' } },
  }
  return configs[env]
}
```

---

## 参考答案

### 练习一

**思路**：测试无参数、空参数、单参数、多参数、特殊字符编码等场景。

**答案**：

```typescript
import { describe, it, expect } from 'vitest'
import { parseQueryString } from './parseQueryString'

describe('parseQueryString', () => {
  it('无查询参数时应返回空对象', () => {
    expect(parseQueryString('https://example.com')).toEqual({})
  })
  it('只有 ? 没有参数时应返回空对象', () => {
    expect(parseQueryString('https://example.com?')).toEqual({})
  })
  it('应解析多个参数', () => {
    expect(parseQueryString('https://example.com?a=1&b=2')).toEqual({ a: '1', b: '2' })
  })
  it('应处理 URL 编码的字符', () => {
    expect(parseQueryString('https://example.com?name=%E5%BC%A0%E4%B8%89')).toEqual({ name: '张三' })
  })
  it('应处理没有值的参数', () => {
    expect(parseQueryString('https://example.com?key')).toEqual({ key: '' })
  })
})
```

**要点**：空输入和边界条件是测试重点；URL 编码是常见遗漏点。

### 练习二

**思路**：使用 `vi.useFakeTimers()` 控制时间，`vi.stubGlobal` 替换 `fetch`。

**答案**：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from './fetchWithRetry'

describe('fetchWithRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('首次请求成功时应直接返回结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ id: 1 }),
    }))
    const result = await fetchWithRetry('https://api.example.com/data')
    expect(result).toEqual({ id: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('超过重试次数时应抛出错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('持续失败')))
    const promise = fetchWithRetry('https://api.example.com/data', { retries: 2, retryDelay: 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(promise).rejects.toThrow('持续失败')
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
```

**要点**：`vi.useFakeTimers()` 避免测试等待真实延迟；`vi.stubGlobal` 替换全局 `fetch`。

### 练习三

**思路**：为三种环境分别编写快照测试，并验证业务逻辑。

**答案**：

```typescript
import { describe, it, expect } from 'vitest'
import { createConfig } from './createConfig'

describe('createConfig', () => {
  it('开发环境配置应保持稳定', () => { expect(createConfig('dev')).toMatchSnapshot() })
  it('预发布环境配置应保持稳定', () => { expect(createConfig('staging')).toMatchSnapshot() })
  it('生产环境配置应保持稳定', () => { expect(createConfig('prod')).toMatchSnapshot() })

  it('各环境的数据库连接池大小应递增', () => {
    const dev = createConfig('dev')
    const staging = createConfig('staging')
    const prod = createConfig('prod')
    expect(dev.database.pool).toBeLessThan(staging.database.pool)
    expect(staging.database.pool).toBeLessThan(prod.database.pool)
  })
})
```

**要点**：快照测试验证整体结构，行为测试验证业务逻辑；使用 `vitest run --update` 更新快照。

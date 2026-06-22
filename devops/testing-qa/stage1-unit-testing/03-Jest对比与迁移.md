# Jest 对比与迁移

## 场景引入

你的团队已经在用 Jest，但项目迁移到 Vite 后配置越来越复杂。你需要了解两个框架的差异，评估是否值得迁移，以及如何平滑完成迁移。

## 学习目标

- 理解 Jest 和 Vitest 的核心 API 差异
- 掌握配置文件的对应关系
- 了解 Mock API 的差异
- 掌握迁移的完整步骤

## 核心 API 差异

```typescript
// 测试组织 API 两者通用
describe('套件', () => {
  beforeAll(() => {})
  beforeEach(() => {})
  afterEach(() => {})
  afterAll(() => {})
  test('用例', () => { expect(true).toBe(true) })
  it('另一种写法', () => {})
  test.skip('跳过', () => {})
  test.only('只运行', () => {})
})

// 断言 API 两者通用
expect(value).toBe(expected)
expect(value).toEqual(expected)
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeNaN()
expect(value).toBeGreaterThan(n)
expect(value).toBeLessThan(n)
expect(value).toBeCloseTo(n, p)
expect(str).toContain(substr)
expect(str).toMatch(regex)
expect(arr).toHaveLength(n)
expect(fn).toThrow(msg)
```

## Mock API 差异

这是两个框架之间最大的差异点。

```typescript
// Jest 风格
const mockFn = jest.fn()
jest.mock('./module', () => ({ getData: jest.fn() }))
jest.spyOn(object, 'method')
jest.useFakeTimers()
jest.advanceTimersByTime(1000)
jest.clearAllMocks()

// Vitest 风格
import { vi } from 'vitest'
const mockFn = vi.fn()
vi.mock('./module', () => ({ getData: vi.fn() }))
vi.spyOn(object, 'method')
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.clearAllMocks()
```

### Mock 返回值

```typescript
// Jest
mockFn.mockReturnValue('value')
mockFn.mockResolvedValue('async')
mockFn.mockRejectedValue(new Error('fail'))

// Vitest（完全相同的 API）
mockFn.mockReturnValue('value')
mockFn.mockResolvedValue('async')
mockFn.mockRejectedValue(new Error('fail'))
```

## 配置差异

### Jest 配置

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.{js,ts}'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text', 'lcov'],
}
```

### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
    // TypeScript 支持开箱即用，无需 transform
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
```

### 配置映射表

| Jest | Vitest |
|------|--------|
| testEnvironment | environment |
| roots + testMatch | include |
| transform | 自动处理 |
| moduleNameMapper | resolve.alias |
| setupFilesAfterSetup | setupFiles |
| collectCoverageFrom | coverage.include |
| coverageReporters | coverage.reporter |

## 模块系统差异

```typescript
// Jest 默认 CommonJS，ESM 需要额外配置
// Vitest 原生支持 ESM，直接使用 import/export

// Vitest 同时处理 ESM 和 CJS
import { greet } from './module'       // ESM
const { greet } = require('./legacy') // CJS
```

## 从 Jest 迁移到 Vitest

### 迁移步骤

```bash
# 1. 安装
npm install -D vitest

# 2. 创建 vitest.config.ts（参考配置映射表）

# 3. 更新 package.json
# "test": "vitest", "test:run": "vitest run"

# 4. 全局替换
# jest.fn() → vi.fn()
# jest.mock() → vi.mock()
# jest.spyOn() → vi.spyOn()

# 5. 添加 import
# import { vi } from 'vitest'

# 6. 运行测试
npm test
```

### 迁移前后对比

```typescript
// 迁移前（Jest）
import { UserService } from './userService'
jest.mock('./database', () => ({
  db: { query: jest.fn(), insert: jest.fn() },
}))

describe('UserService', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('getUserById', async () => {
    ;(db.query as jest.Mock).mockResolvedValue([{ id: 1 }])
    const user = await new UserService().getUserById(1)
    expect(user).toEqual({ id: 1 })
  })
})

// 迁移后（Vitest）
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { UserService } from './userService'
vi.mock('./database', () => ({
  db: { query: vi.fn(), insert: vi.fn() },
}))

describe('UserService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('getUserById', async () => {
    vi.mocked(db.query).mockResolvedValue([{ id: 1 }])
    const user = await new UserService().getUserById(1)
    expect(user).toEqual({ id: 1 })
  })
})
```

### 类型定义

```typescript
// Jest：需要 @types/jest
// Vitest：内置类型，添加 tsconfig.json 配置即可
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

## 常见误区

### 误区一：认为迁移需要重写所有测试

API 兼容性高，大部分测试只需查找替换。

### 误区二：忽略类型定义更新

迁移后移除 `@types/jest`，添加 `vitest/globals`。

### 误区三：没有清理 Jest 依赖

记得 `npm uninstall jest ts-jest @types/jest`。

## 工程建议

1. **渐进式迁移**：新模块先用 Vitest，旧模块逐步迁移
2. **自动化替换**：使用 codemod 工具减少手动错误
3. **类型检查**：迁移后运行 TypeScript 编译
4. **CI 验证**：迁移期间同时运行两套测试

## 小结

- 核心 API 高度兼容，迁移成本低
- 主要差异在 Mock API（jest → vi）和配置格式
- Vitest 原生支持 ESM 和 TypeScript，配置更简单
- 建议渐进式迁移，先在新模块使用

## 练习

### 练习一：API 映射

将以下 Jest 代码转换为 Vitest：

```typescript
const mockFn = jest.fn()
jest.mock('./module', () => ({ getData: jest.fn() }))
jest.useFakeTimers()
```

### 练习二：配置迁移

将 Jest 配置转换为 Vitest 配置：

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
}
```

---

## 参考答案

### 练习一

**答案**：
```typescript
import { vi } from 'vitest'
const mockFn = vi.fn()
vi.mock('./module', () => ({ getData: vi.fn() }))
vi.useFakeTimers()
```

### 练习二

**答案**：
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./jest.setup.ts'],
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
```

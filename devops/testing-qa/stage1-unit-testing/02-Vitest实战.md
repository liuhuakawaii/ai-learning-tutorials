# Vitest 实战

## 场景引入

你正在搭建新项目，需要选择测试框架。Jest 是主流选择，但配置复杂——特别是 ESM、TypeScript 或 Vite 项目。Vitest 作为 Vite 生态的测试框架，开箱即用地解决了这些痛点。这一课，我们从零搭建 Vitest 环境，掌握核心 API。

## 学习目标

- 理解 Vitest 相对于 Jest 的优势
- 掌握安装配置和核心 API
- 熟练使用 expect 断言链
- 配置 --watch 模式和 --reporter

## 为什么选择 Vitest

- **Vite 生态集成**：共享 Vite 配置，无需维护两套构建配置
- **原生 ESM 支持**：不需要转译，开箱即用
- **更快的执行速度**：按需转译，启动速度远快于 Jest

## 安装配置

```bash
npm install -D vitest
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    globals: true,           // 全局 API，不需要 import
    environment: 'node',     // node | jsdom | happy-dom
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
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

## describe/it/test 组织

```typescript
import { describe, test, expect } from 'vitest'
import { Calculator } from './calculator'

describe('Calculator', () => {
  test('加法运算', () => {
    const calc = new Calculator()
    expect(calc.add(1, 2)).toBe(3)
  })

  describe('高级运算', () => {
    test('幂运算', () => {
      const calc = new Calculator()
      expect(calc.power(2, 3)).toBe(8)
    })
  })
})
```

## expect 断言链

### 相等性

```typescript
test('相等性断言', () => {
  expect(1 + 1).toBe(2)                    // 严格相等
  expect({ a: 1 }).toEqual({ a: 1 })       // 深度相等
  expect(0.1 + 0.2).toBeCloseTo(0.3)       // 浮点近似
})
```

### 布尔与存在性

```typescript
test('布尔断言', () => {
  expect(true).toBeTruthy()
  expect(false).toBeFalsy()
  expect(null).toBeNull()
  expect(undefined).toBeUndefined()
  expect('hello').toBeDefined()
})
```

### 数字与字符串

```typescript
test('数字断言', () => {
  expect(10).toBeGreaterThan(5)
  expect(5).toBeLessThan(10)
  expect(10).toBeGreaterThanOrEqual(10)
})

test('字符串断言', () => {
  expect('Hello World').toContain('World')
  expect('user@email.com').toMatch(/@email\.com$/)
})
```

### 数组

```typescript
test('数组断言', () => {
  expect([1, 2, 3]).toHaveLength(3)
  expect(['a', 'b', 'c']).toContain('b')
  expect([{ id: 1 }]).toContainEqual({ id: 1 })
})
```

### 异常

```typescript
test('异常断言', () => {
  expect(() => { throw new Error('fail') }).toThrow('fail')
  expect(() => { throw new Error('fail') }).toThrow(/fail/)
})
```

## beforeEach / afterEach

```typescript
describe('数据库操作', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.connect()
  })

  afterEach(() => {
    db.disconnect()
  })

  test('插入记录', () => {
    db.run('INSERT INTO users (name) VALUES (?)', ['张三'])
    expect(db.query('SELECT * FROM users')).toHaveLength(1)
  })
})
```

## --watch 模式与 --reporter

```bash
# watch 模式（默认）
vitest

# 等价于
vitest --watch

# reporter 配置
vitest run --reporter=verbose
vitest run --reporter=json
vitest run --reporter=junit   # CI 集成
```

## 完整示例

```typescript
// src/utils.ts
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error('size 必须大于 0')
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}
```

```typescript
// src/utils.test.ts
import { describe, test, expect } from 'vitest'
import { capitalize, chunk } from './utils'

describe('capitalize', () => {
  test('首字母大写', () => {
    expect(capitalize('hello')).toBe('Hello')
  })
  test('空字符串返回空字符串', () => {
    expect(capitalize('')).toBe('')
  })
  test('单个字符', () => {
    expect(capitalize('a')).toBe('A')
  })
})

describe('chunk', () => {
  test('按指定大小分组', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  test('空数组返回空数组', () => {
    expect(chunk([], 3)).toEqual([])
  })
  test('size 为 0 抛出异常', () => {
    expect(() => chunk([1, 2], 0)).toThrow('size 必须大于 0')
  })
})
```

## 常见误区

### 误区一：用 console.log 代替断言

```typescript
// 错误
test('计算', () => { console.log(calculate(1, 2)) })

// 正确
test('计算', () => { expect(calculate(1, 2)).toBe(3) })
```

### 误区二：忘记 return Promise

```typescript
// 错误：断言可能在 Promise 完成前执行
test('异步', () => { fetchData().then(d => expect(d).toBe('ok')) })

// 正确
test('异步', () => { return fetchData().then(d => expect(d).toBe('ok')) })
```

### 误区三：滥用 snapshot 测试

Snapshot 适合验证大型结构的稳定性，不要用来代替精确断言。

## 工程建议

1. **globals 配置**：设置 `globals: true` 省去每个文件的 import
2. **environment 选择**：纯 Node 逻辑用 `node`，涉及 DOM 用 `jsdom`
3. **watch 模式开发**：开发时用 `vitest`，CI 中用 `vitest run`
4. **测试文件位置**：放在源文件旁边（`utils.ts` 和 `utils.test.ts`）

## 小结

- Vitest 原生支持 ESM 和 TypeScript，与 Vite 生态无缝集成
- 使用 describe/it/test 组织测试，expect 断言链验证结果
- beforeEach/afterEach 管理测试生命周期
- watch 模式提供即时反馈，reporter 配置支持 CI 集成

## 练习

### 练习一：基础断言

编写测试验证 `isEven(n: number): boolean` 函数，覆盖偶数、奇数、0、负数。

### 练习二：异常测试

编写测试验证 `divide(a, b)` 在除数为 0 时抛出异常。

---

## 参考答案

### 练习一

**答案**：
```typescript
describe('isEven', () => {
  test('偶数返回 true', () => { expect(isEven(2)).toBe(true) })
  test('奇数返回 false', () => { expect(isEven(1)).toBe(false) })
  test('0 是偶数', () => { expect(isEven(0)).toBe(true) })
  test('负偶数', () => { expect(isEven(-2)).toBe(true) })
})
```

### 练习二

**答案**：
```typescript
describe('divide', () => {
  test('正常除法', () => { expect(divide(10, 2)).toBe(5) })
  test('除数为 0 抛出异常', () => {
    expect(() => divide(10, 0)).toThrow('除数不能为 0')
  })
})
```

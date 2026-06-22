# TDD 实践

## 场景引入

产品经理给了你一个需求："实现折扣计算器，支持满减、百分比折扣、VIP 折扣，多种折扣可叠加。"你开始写代码，逻辑越来越复杂，各种 if-else 嵌套，不确定边界情况是否处理正确。

换一种方式：你先写测试。从最简单的"满 100 减 10"开始，测试通过后再加"百分比折扣"。每一步都有测试保护。这就是 TDD 的力量。

## 学习目标

- 掌握 TDD 的红-绿-重构循环
- 学会从需求拆解测试用例
- 通过实战理解 TDD 的完整流程
- 理解 TDD 的优势和适用场景

## 红-绿-重构循环

```
1. 红（Red）     → 写一个失败的测试
2. 绿（Green）   → 写最少量的代码让测试通过
3. 重构（Refactor）→ 优化代码，保持测试通过
```

先写测试迫使你思考"函数应该做什么"，而不是"怎么实现"。这帮你明确需求、设计接口、建立安全网。

## 从需求到测试用例

```
需求：折扣计算器
- 满减：满 100 减 10
- 百分比折扣：打 8 折
- VIP 折扣：VIP 用户额外 95 折
- 多种折扣可叠加
- 折扣后价格不低于 0
```

拆解顺序：无折扣 → 满减 → 百分比 → VIP → 叠加 → 边界情况

## TDD 实战：折扣计算器

### 第一轮：无折扣

```typescript
// 红：写失败的测试
import { describe, test, expect } from 'vitest'
import { calculateDiscount } from './discount'

type DiscountRule =
  | { type: 'fixed'; threshold: number; amount: number }
  | { type: 'percentage'; rate: number }
  | { type: 'vip'; rate: number }

describe('calculateDiscount', () => {
  test('无折扣规则时返回原价', () => {
    expect(calculateDiscount(100, [])).toBe(100)
  })
})

// 绿：最简实现
export function calculateDiscount(price: number, rules: DiscountRule[]): number {
  return price
}
```

### 第二轮：满减折扣

```typescript
// 红
test('满 100 减 10', () => {
  const rules: DiscountRule[] = [{ type: 'fixed', threshold: 100, amount: 10 }]
  expect(calculateDiscount(100, rules)).toBe(90)
})

test('未达到门槛不打折', () => {
  const rules: DiscountRule[] = [{ type: 'fixed', threshold: 100, amount: 10 }]
  expect(calculateDiscount(50, rules)).toBe(50)
})

// 绿
export function calculateDiscount(price: number, rules: DiscountRule[]): number {
  let finalPrice = price
  for (const rule of rules) {
    if (rule.type === 'fixed' && finalPrice >= rule.threshold) {
      finalPrice -= rule.amount
    }
  }
  return finalPrice
}
```

### 第三轮：百分比折扣

```typescript
// 红
test('打 8 折', () => {
  const rules: DiscountRule[] = [{ type: 'percentage', rate: 0.2 }]
  expect(calculateDiscount(100, rules)).toBe(80)
})

// 绿
export function calculateDiscount(price: number, rules: DiscountRule[]): number {
  let finalPrice = price
  for (const rule of rules) {
    if (rule.type === 'fixed' && finalPrice >= rule.threshold) {
      finalPrice -= rule.amount
    } else if (rule.type === 'percentage' || rule.type === 'vip') {
      finalPrice = Math.round(finalPrice * (1 - rule.rate) * 100) / 100
    }
  }
  return finalPrice
}
```

### 第四轮：折扣叠加 + 边界

```typescript
// 红
test('多种折扣叠加', () => {
  const rules: DiscountRule[] = [
    { type: 'fixed', threshold: 100, amount: 10 },
    { type: 'percentage', rate: 0.1 },
    { type: 'vip', rate: 0.05 },
  ]
  // 100 → 满减90 → 9折81 → VIP95折76.95
  expect(calculateDiscount(100, rules)).toBeCloseTo(76.95, 1)
})

test('折扣后价格不低于 0', () => {
  const rules: DiscountRule[] = [{ type: 'fixed', threshold: 0, amount: 200 }]
  expect(calculateDiscount(100, rules)).toBe(0)
})

// 绿：添加价格下限
export function calculateDiscount(price: number, rules: DiscountRule[]): number {
  let finalPrice = price
  for (const rule of rules) {
    if (rule.type === 'fixed' && finalPrice >= rule.threshold) {
      finalPrice -= rule.amount
    } else if (rule.type === 'percentage' || rule.type === 'vip') {
      finalPrice = Math.round(finalPrice * (1 - rule.rate) * 100) / 100
    }
  }
  return Math.max(0, finalPrice)
}
```

### 重构

```typescript
// 当前实现已经清晰，运行所有测试确认通过
// 如果需要进一步优化，可以用 switch 替代 if-else
```

## TDD 的优势

### 设计驱动

写测试时你必须回答：输入是什么？输出是什么？边界情况有哪些？这些问题在写实现之前就应该有答案。

### 文档化

```typescript
describe('calculateDiscount', () => {
  test('满 100 减 10', () => { /* ... */ })
  test('未达到门槛不打折', () => { /* ... */ })
  test('打 8 折', () => { /* ... */ })
  test('多种折扣叠加', () => { /* ... */ })
  test('折扣后价格不低于 0', () => { /* ... */ })
})
// 测试就是最好的文档
```

### 安全网

重构时，测试是你的安全网。改了实现，跑一遍测试，就知道有没有改坏。

## TDD 的挑战

```typescript
// 不适合的场景：
// 1. 探索性编程：你还不知道要做什么
// 2. UI 代码：视觉效果很难用测试描述
// 3. 性能优化：优化后行为不变，测试不变
// 4. 一次性脚本：不需要长期维护的代码
```

## 常见误区

### 误区一：跳过红步骤

```typescript
// 不好：直接写实现再补测试
function calculateDiscount(price: number, rules: DiscountRule[]): number {
  // 写了一大堆代码
  return finalPrice
}
test('计算折扣', () => { expect(calculateDiscount(100, rules)).toBe(76.95) })

// 好：先写测试，测试驱动实现
```

### 误区二：一次写太多测试

```typescript
// 不好：一次写 10 个测试再写实现
// 好：一次写一个测试，实现后通过，再写下一次
```

### 误区三：重构时修改测试

重构应该只修改实现，不修改测试。如果需要改测试，说明测试写得太细（测试了实现细节）。

## 工程建议

1. **从小处开始**：先在一个小模块实践 TDD
2. **保持测试简洁**：每个测试只验证一个行为
3. **及时重构**：绿灯后立即重构
4. **测试命名要清晰**：测试名称就是需求文档
5. **不追求完美覆盖率**：80% 已经很好

## 小结

- TDD 核心是红-绿-重构循环
- 从需求拆解测试用例，从简单到复杂
- 优势：设计驱动、文档化、安全网
- 挑战：学习曲线、适用场景、维护成本

## 练习

### 练习一：TDD 实现字符串反转

使用 TDD 实现 `reverseString(str: string): string`，覆盖普通字符串、空字符串、单个字符、回文。

### 练习二：TDD 实现数组去重

使用 TDD 实现 `uniqueArray<T>(arr: T[]): T[]`，覆盖数字数组、字符串数组、空数组。

---

## 参考答案

### 练习一

**答案**：
```typescript
// 测试
describe('reverseString', () => {
  test('反转普通字符串', () => {
    expect(reverseString('hello')).toBe('olleh')
  })
  test('空字符串', () => {
    expect(reverseString('')).toBe('')
  })
  test('单个字符', () => {
    expect(reverseString('a')).toBe('a')
  })
  test('回文', () => {
    expect(reverseString('madam')).toBe('madam')
  })
})

// 实现
export function reverseString(str: string): string {
  return str.split('').reverse().join('')
}
```

### 练习二

**答案**：
```typescript
// 测试
describe('uniqueArray', () => {
  test('数字数组去重', () => {
    expect(uniqueArray([1, 2, 2, 3])).toEqual([1, 2, 3])
  })
  test('空数组', () => {
    expect(uniqueArray([])).toEqual([])
  })
  test('保留顺序', () => {
    expect(uniqueArray([3, 1, 2, 1, 3])).toEqual([3, 1, 2])
  })
})

// 实现
export function uniqueArray<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}
```

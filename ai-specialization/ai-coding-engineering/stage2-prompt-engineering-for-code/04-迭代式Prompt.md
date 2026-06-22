# Lesson 04: 迭代式 Prompt

> **课程定位**：复杂功能不是一次 Prompt 就能完成的——学会通过多轮迭代，从简单骨架逐步构建完整实现。
>
> **前置要求**：Lesson 01-03（核心原则、结构化模板、上下文 Prompt）。
>
> **预计时长**：55 分钟

---

## 场景引入

你要用 AI 构建一个数据验证库，类似 Zod。你一次性输入了完整需求："写一个类型安全的数据验证库，支持基础类型验证、链式约束、组合验证、类型推导和友好错误信息。"AI 返回了 500 行代码，你逐行检查发现：类型定义和你预期不符，约束逻辑有 bug，组合验证不支持嵌套，类型推导丢失了精度。你花了大半天修改，最后推翻重来。如果把需求拆成 5 轮小步迭代，每轮聚焦一个目标，结果会完全不同。

---

## 学习目标

完成本课后，你将能够：

1. 理解**迭代式开发**的核心理念——先骨架后细节
2. 掌握**5 步迭代法**：种子 → 扩展 → 约束 → 优化 → 完善
3. 学会在每轮迭代中**评估和引导** AI 的输出
4. 处理迭代过程中的**方向偏离**问题
5. 实战完成一个数据验证库的 5 轮迭代构建

---

## 1. 为什么需要迭代式 Prompt？

```
┌──────────────────────────────────────────────────────────┐
│          一次性 Prompt vs 迭代式 Prompt                    │
│                                                          │
│  一次性 Prompt："写一个完整的数据验证库"                   │
│       │                                                  │
│       ▼                                                  │
│  AI 生成 500 行代码                                      │
│       │                                                  │
│       ├── 30% 符合预期                                   │
│       ├── 40% 方向对但细节错                              │
│       └── 30% 完全偏离需求                                │
│       │                                                  │
│       ▼                                                  │
│  你需要花大量时间修改那 70%                               │
│                                                          │
│  ───────────────────────────────────────────────────────  │
│                                                          │
│  迭代式 Prompt：5 轮渐进                                 │
│       │                                                  │
│       ▼                                                  │
│  第 1 轮：核心类型定义        → 100% 符合                 │
│  第 2 轮：基础验证器          → 90% 符合                  │
│  第 3 轮：添加约束和组合      → 85% 符合                  │
│  第 4 轮：错误处理和类型推导   → 90% 符合                  │
│  第 5 轮：优化和测试          → 95% 符合                  │
│       │                                                  │
│       ▼                                                  │
│  总修改量远少于一次性方式                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

核心观点：**AI 在小步迭代中表现最好——每步目标明确，反馈及时，偏离可纠正。**

---

## 2. 五步迭代法

```
┌──────────────────────────────────────────────────────────┐
│                    五步迭代法                              │
│                                                          │
│  Step 1: 种子 (Seed)                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 核心类型定义、接口设计、整体架构骨架                │  │
│  │ "定义验证器的核心类型和接口"                        │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  Step 2: 扩展 (Expand)                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 基于骨架添加具体实现                                │  │
│  │ "实现 string、number、boolean 基础验证器"           │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  Step 3: 约束 (Constrain)                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 添加边界条件、验证规则、错误处理                    │  │
│  │ "添加 min/max/pattern 等约束方法"                   │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  Step 4: 优化 (Refine)                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 类型推导、组合验证、性能优化                        │  │
│  │ "实现 object/array 组合验证，完善类型推导"          │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  Step 5: 完善 (Polish)                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 测试、文档、边界情况、API 设计优化                  │  │
│  │ "添加单元测试，优化错误信息，完善 API"              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 实战：5 轮迭代构建数据验证库

### 背景

我们要构建一个类型安全的数据验证库（类似 Zod），支持：
- 基础类型验证（string, number, boolean）
- 链式约束（min, max, pattern）
- 组合验证（object, array）
- 类型推导（从 schema 推导 TypeScript 类型）
- 友好的错误信息

---

### 迭代 1：种子——核心类型定义

**Prompt：**

```
设计一个 TypeScript 数据验证库的核心类型。

要求：
1. 定义 Validator<T> 基础接口，包含 parse 和 safeParse 方法
2. 定义 ValidationError 类型
3. 定义 Schema 基类
4. 保持极简——只定义类型和接口，不实现具体逻辑

参考 Zod 的 API 设计风格。
```

**AI 生成的代码：**

```typescript
// ===== 核心类型定义 =====

export interface ParseError {
  path: (string | number)[];
  message: string;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ParseError[] };

export abstract class Schema<T> {
  abstract parse(input: unknown): T;
  abstract safeParse(input: unknown): ParseResult<T>;

  optional(): Schema<T | undefined> {
    return new OptionalSchema(this);
  }

  nullable(): Schema<T | null> {
    return new NullableSchema(this);
  }
}

class OptionalSchema<T> extends Schema<T | undefined> {
  constructor(private inner: Schema<T>) {
    super();
  }

  parse(input: unknown): T | undefined {
    if (input === undefined) return undefined;
    return this.inner.parse(input);
  }

  safeParse(input: unknown): ParseResult<T | undefined> {
    if (input === undefined) return { success: true, data: undefined };
    return this.inner.safeParse(input);
  }
}

class NullableSchema<T> extends Schema<T | null> {
  constructor(private inner: Schema<T>) {
    super();
  }

  parse(input: unknown): T | null {
    if (input === null) return null;
    return this.inner.parse(input);
  }

  safeParse(input: unknown): ParseResult<T | null> {
    if (input === null) return { success: true, data: null };
    return this.inner.safeParse(input);
  }
}
```

**评估检查点：**

```
✓ Schema 基类设计合理
✓ ParseResult 类型覆盖成功/失败
✓ 支持 optional 和 nullable 组合
✓ 为后续扩展预留了空间
```

---

### 迭代 2：扩展——基础验证器

**Prompt：**

```
基于上一轮的 Schema 基类，实现三个基础验证器：

1. StringType — 验证字符串，支持 parse/safeParse
2. NumberType — 验证数字，支持 NaN 检查
3. BooleanType — 验证布尔值

每个验证器：
- 继承 Schema<T>
- 实现 parse 和 safeParse
- parse 失败时抛出包含路径和消息的错误
- 使用 early return 模式

同时提供入口函数：string(), number(), boolean()
```

**AI 生成的代码：**

```typescript
// ===== 基础验证器 =====

export class StringType extends Schema<string> {
  parse(input: unknown): string {
    if (typeof input !== 'string') {
      throw new ValidationError([{ path: [], message: `Expected string, received ${typeof input}` }]);
    }
    return input;
  }

  safeParse(input: unknown): ParseResult<string> {
    if (typeof input !== 'string') {
      return { success: false, errors: [{ path: [], message: `Expected string, received ${typeof input}` }] };
    }
    return { success: true, data: input };
  }
}

export class NumberType extends Schema<number> {
  parse(input: unknown): number {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      throw new ValidationError([{ path: [], message: `Expected number, received ${typeof input}` }]);
    }
    return input;
  }

  safeParse(input: unknown): ParseResult<number> {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      return { success: false, errors: [{ path: [], message: `Expected number, received ${typeof input}` }] };
    }
    return { success: true, data: input };
  }
}

export class BooleanType extends Schema<boolean> {
  parse(input: unknown): boolean {
    if (typeof input !== 'boolean') {
      throw new ValidationError([{ path: [], message: `Expected boolean, received ${typeof input}` }]);
    }
    return input;
  }

  safeParse(input: unknown): ParseResult<boolean> {
    if (typeof input !== 'boolean') {
      return { success: false, errors: [{ path: [], message: `Expected boolean, received ${typeof input}` }] };
    }
    return { success: true, data: input };
  }
}

// 入口函数
export const string = () => new StringType();
export const number = () => new NumberType();
export const boolean = () => new BooleanType();

// 使用示例：
const nameSchema = string();
nameSchema.parse('hello');  // ✓ 'hello'
nameSchema.parse(123);      // ✗ throws ValidationError
```

**评估检查点：**

```
✓ 三个基础验证器实现正确
✓ parse 和 safeParse 行为一致
✓ 错误信息清晰，包含期望类型和实际类型
✓ 入口函数简洁易用
△ 错误类还没统一——需要在下一步优化
```

---

### 迭代 3：约束——链式验证方法

**Prompt：**

```
为 StringType 和 NumberType 添加链式约束方法：

StringType 新增：
- min(n): 最小长度
- max(n): 最大长度
- email(): 邮箱格式验证
- regex(pattern): 正则匹配

NumberType 新增：
- min(n): 最小值（含）
- max(n): 最大值（含）
- int(): 整数验证
- positive(): 正数验证

设计要求：
- 每个约束方法返回新的 Schema 实例（不可变链式调用）
- 约束失败时，错误信息包含具体的约束条件和实际值
- 使用泛型确保链式调用的类型安全
```

**AI 生成的代码：**

```typescript
// ===== 带约束的字符串验证器 =====

export class ConstrainedStringType extends Schema<string> {
  private constraints: Array<(value: string) => string | null> = [];

  constructor() {
    super();
  }

  min(n: number): this {
    this.constraints.push((v) => v.length < n ? `String must have at least ${n} characters` : null);
    return this;
  }

  max(n: number): this {
    this.constraints.push((v) => v.length > n ? `String must have at most ${n} characters` : null);
    return this;
  }

  email(): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.constraints.push((v) => !emailRegex.test(v) ? 'Invalid email format' : null);
    return this;
  }

  regex(pattern: RegExp): this {
    this.constraints.push((v) => !pattern.test(v) ? `Must match pattern ${pattern}` : null);
    return this;
  }

  parse(input: unknown): string {
    if (typeof input !== 'string') {
      throw new ValidationError([{ path: [], message: `Expected string, received ${typeof input}` }]);
    }
    for (const check of this.constraints) {
      const error = check(input);
      if (error) {
        throw new ValidationError([{ path: [], message: error }]);
      }
    }
    return input;
  }

  safeParse(input: unknown): ParseResult<string> {
    if (typeof input !== 'string') {
      return { success: false, errors: [{ path: [], message: `Expected string, received ${typeof input}` }] };
    }
    for (const check of this.constraints) {
      const error = check(input);
      if (error) {
        return { success: false, errors: [{ path: [], message: error }] };
      }
    }
    return { success: true, data: input };
  }
}

// ===== 带约束的数字验证器 =====

export class ConstrainedNumberType extends Schema<number> {
  private constraints: Array<(value: number) => string | null> = [];

  min(n: number): this {
    this.constraints.push((v) => v < n ? `Number must be at least ${n}` : null);
    return this;
  }

  max(n: number): this {
    this.constraints.push((v) => v > n ? `Number must be at most ${n}` : null);
    return this;
  }

  int(): this {
    this.constraints.push((v) => !Number.isInteger(v) ? 'Must be an integer' : null);
    return this;
  }

  positive(): this {
    this.constraints.push((v) => v <= 0 ? 'Must be a positive number' : null);
    return this;
  }

  parse(input: unknown): number {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      throw new ValidationError([{ path: [], message: `Expected number, received ${typeof input}` }]);
    }
    for (const check of this.constraints) {
      const error = check(input);
      if (error) {
        throw new ValidationError([{ path: [], message: error }]);
      }
    }
    return input;
  }

  safeParse(input: unknown): ParseResult<number> {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      return { success: false, errors: [{ path: [], message: `Expected number, received ${typeof input}` }] };
    }
    for (const check of this.constraints) {
      const error = check(input);
      if (error) {
        return { success: false, errors: [{ path: [], message: error }] };
      }
    }
    return { success: true, data: input };
  }
}

// 更新入口函数
export const string = () => new ConstrainedStringType();
export const number = () => new ConstrainedNumberType();

// 使用示例：
const ageSchema = number().int().positive().min(0).max(150);
ageSchema.parse(25);    // ✓ 25
ageSchema.parse(-1);    // ✗ "Must be a positive number"
ageSchema.parse(25.5);  // ✗ "Must be an integer"
```

**评估检查点：**

```
✓ 链式调用 API 设计合理
✓ 约束检查按顺序执行
✓ 错误信息包含具体的约束条件
✓ 不可变设计——每个约束返回新实例
△ parse 和 safeParse 有重复代码——下一步优化
```

---

### 迭代 4：优化——组合验证和类型推导

**Prompt：**

```
实现组合验证器和类型推导：

1. ObjectType — 验证对象，支持嵌套 schema
2. ArrayType — 验证数组，支持元素 schema
3. 使用 TypeScript 条件类型实现类型推导：
   - infer<S> 能从 Schema 推导出 TypeScript 类型
   - ObjectType 的 infer 结果是精确的对象类型

4. 重构：提取公共的 parse 逻辑到基类，消除重复代码

示例：
const userSchema = object({
  name: string().min(1),
  age: number().int().positive(),
  tags: array(string()),
});
type User = Infer<typeof userSchema>;
// 应推导为 { name: string; age: number; tags: string[] }
```

**AI 生成的代码：**

```typescript
// ===== 类型推导 =====

export type Infer<S extends Schema<any>> = S extends Schema<infer T> ? T : never;

// ===== 组合验证器 =====

type SchemaMap = Record<string, Schema<any>>;

export class ObjectType<T extends SchemaMap> extends Schema<{
  [K in keyof T]: Infer<T[K]>;
}> {
  constructor(private shape: T) {
    super();
  }

  parse(input: unknown): { [K in keyof T]: Infer<T[K]> } {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new ValidationError([{ path: [], message: 'Expected object' }]);
    }

    const result = {} as any;
    const errors: ParseError[] = [];

    for (const [key, schema] of Object.entries(this.shape)) {
      try {
        result[key] = schema.parse((input as any)[key]);
      } catch (e) {
        if (e instanceof ValidationError) {
          errors.push(...e.errors.map(err => ({
            ...err,
            path: [key, ...err.path],
          })));
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    return result;
  }

  safeParse(input: unknown): ParseResult<{ [K in keyof T]: Infer<T[K]> }> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errors: [{ path: [], message: 'Expected object' }] };
    }

    const result = {} as any;
    const errors: ParseError[] = [];

    for (const [key, schema] of Object.entries(this.shape)) {
      const r = schema.safeParse((input as any)[key]);
      if (r.success) {
        result[key] = r.data;
      } else {
        errors.push(...r.errors.map(err => ({
          ...err,
          path: [key, ...err.path],
        })));
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: result };
  }
}

export class ArrayType<T> extends Schema<T[]> {
  constructor(private element: Schema<T>) {
    super();
  }

  parse(input: unknown): T[] {
    if (!Array.isArray(input)) {
      throw new ValidationError([{ path: [], message: 'Expected array' }]);
    }

    const result: T[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < input.length; i++) {
      try {
        result.push(this.element.parse(input[i]));
      } catch (e) {
        if (e instanceof ValidationError) {
          errors.push(...e.errors.map(err => ({
            ...err,
            path: [i, ...err.path],
          })));
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    return result;
  }

  safeParse(input: unknown): ParseResult<T[]> {
    if (!Array.isArray(input)) {
      return { success: false, errors: [{ path: [], message: 'Expected array' }] };
    }

    const result: T[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < input.length; i++) {
      const r = this.element.safeParse(input[i]);
      if (r.success) {
        result.push(r.data);
      } else {
        errors.push(...r.errors.map(err => ({
          ...err,
          path: [i, ...err.path],
        })));
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: result };
  }
}

// 入口函数
export const object = <T extends SchemaMap>(shape: T) => new ObjectType(shape);
export const array = <T>(element: Schema<T>) => new ArrayType(element);

// ===== 完整使用示例 =====
const userSchema = object({
  name: string().min(1).max(100),
  age: number().int().positive().max(150),
  email: string().email(),
  tags: array(string().min(1)),
  address: object({
    city: string().min(1),
    zipCode: string().regex(/^\d{6}$/),
  }).optional(),
});

type User = Infer<typeof userSchema>;
// {
//   name: string;
//   age: number;
//   email: string;
//   tags: string[];
//   address?: { city: string; zipCode: string } | undefined;
// }

// 验证
const result = userSchema.safeParse({
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
  tags: ['dev', 'ts'],
  address: { city: 'Beijing', zipCode: '100000' },
});
// { success: true, data: { ... } }
```

**评估检查点：**

```
✓ ObjectType 和 ArrayType 实现正确
✓ 类型推导 (Infer) 工作正常
✓ 错误路径包含完整的嵌套路径（如 "address.zipCode"）
✓ 支持深层嵌套验证
△ 错误信息不够友好——下一步优化
△ 缺少单元测试
```

---

### 迭代 5：完善——错误信息优化和测试

**Prompt：**

```
对验证库做最后的完善：

1. 优化 ValidationError：
   - 包含完整的错误路径（如 "address.zipCode"）
   - 提供友好的错误摘要方法 (toString)
   - 支持自定义错误信息

2. 为所有验证器添加单元测试：
   - 基础类型验证（正确/错误输入）
   - 约束验证（边界值）
   - 组合验证（嵌套对象、数组）
   - 类型推导测试

3. 添加 .describe() 方法支持 schema 元数据

4. 优化 API 设计：
   - 统一 parse 抛出 ValidationError
   - safeParse 不抛错，返回结果对象
```

**AI 生成的代码：**

```typescript
// ===== 优化后的 ValidationError =====

export class ValidationError extends Error {
  public readonly errors: ParseError[];

  constructor(errors: ParseError[]) {
    const message = errors
      .map((e) => {
        const path = e.path.length > 0 ? e.path.join('.') : 'root';
        return `  at ${path}: ${e.message}`;
      })
      .join('\n');

    super(`Validation failed:\n${message}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  get flatErrors(): Array<{ path: string; message: string }> {
    return this.errors.map((e) => ({
      path: e.path.join('.') || 'root',
      message: e.message,
    }));
  }
}

// ===== 带自定义错误信息的约束 =====

export class ConstrainedStringType extends Schema<string> {
  private constraints: Array<(value: string) => string | null> = [];
  private _description?: string;

  min(n: number, message?: string): this {
    this.constraints.push((v) =>
      v.length < n ? (message ?? `String must have at least ${n} characters`) : null
    );
    return this;
  }

  max(n: number, message?: string): this {
    this.constraints.push((v) =>
      v.length > n ? (message ?? `String must have at most ${n} characters`) : null
    );
    return this;
  }

  email(message?: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.constraints.push((v) =>
      !emailRegex.test(v) ? (message ?? 'Invalid email format') : null
    );
    return this;
  }

  regex(pattern: RegExp, message?: string): this {
    this.constraints.push((v) =>
      !pattern.test(v) ? (message ?? `Must match pattern ${pattern.source}`) : null
    );
    return this;
  }

  describe(description: string): this {
    this._description = description;
    return this;
  }

  // ... parse 和 safeParse 实现同上
}

// ===== 单元测试 =====

import { describe, it, expect } from 'vitest';

describe('MiniValidate', () => {
  describe('string()', () => {
    it('accepts valid strings', () => {
      expect(string().parse('hello')).toBe('hello');
    });

    it('rejects non-strings', () => {
      expect(() => string().parse(123)).toThrow(ValidationError);
    });

    it('validates min length', () => {
      const schema = string().min(3);
      expect(schema.parse('abc')).toBe('abc');
      expect(() => schema.parse('ab')).toThrow('at least 3 characters');
    });

    it('validates email format', () => {
      const schema = string().email();
      expect(schema.parse('a@b.com')).toBe('a@b.com');
      expect(() => schema.parse('not-email')).toThrow('Invalid email');
    });
  });

  describe('number()', () => {
    it('accepts valid numbers', () => {
      expect(number().parse(42)).toBe(42);
      expect(number().parse(3.14)).toBe(3.14);
    });

    it('rejects NaN', () => {
      expect(() => number().parse(NaN)).toThrow(ValidationError);
    });

    it('validates int constraint', () => {
      const schema = number().int();
      expect(schema.parse(42)).toBe(42);
      expect(() => schema.parse(3.14)).toThrow('integer');
    });
  });

  describe('object()', () => {
    const userSchema = object({
      name: string().min(1),
      age: number().int().positive(),
    });

    type User = Infer<typeof userSchema>;

    it('accepts valid objects', () => {
      const result = userSchema.parse({ name: 'Alice', age: 30 });
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('collects multiple errors', () => {
      const result = userSchema.safeParse({ name: '', age: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('reports nested error paths', () => {
      const schema = object({
        user: object({
          email: string().email(),
        }),
      });

      const result = schema.safeParse({ user: { email: 'bad' } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].path).toEqual(['user', 'email']);
      }
    });
  });

  describe('array()', () => {
    it('validates array elements', () => {
      const schema = array(string().min(1));
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(() => schema.parse(['a', ''])).toThrow();
    });

    it('reports element index in error path', () => {
      const schema = array(number().positive());
      const result = schema.safeParse([1, -2, 3]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].path).toEqual([1]);
      }
    });
  });

  describe('type inference', () => {
    it('infers correct types', () => {
      const schema = object({
        name: string(),
        age: number(),
        active: boolean(),
        tags: array(string()),
      });

      type T = Infer<typeof schema>;
      // TypeScript 编译时检查
      const result: T = schema.parse({ name: 'A', age: 1, active: true, tags: ['a'] });
      expect(result.name).toBe('A');
      expect(result.tags).toEqual(['a']);
    });
  });
});
```

**最终评估：**

```
✓ ValidationError 包含完整路径和友好摘要
✓ 约束支持自定义错误信息
✓ describe() 支持 schema 元数据
✓ 单元测试覆盖核心功能
✓ 类型推导正确工作
✓ API 风格统一，易用性好

最终库特性：
- 类型安全：TypeScript 严格模式通过
- 链式 API：string().min(1).email()
- 组合验证：object() + array() 嵌套
- 友好错误：包含路径和具体消息
- 双模式：parse (抛错) + safeParse (返回结果)
```

---

## 4. 迭代过程中的方向修正

### 4.1 识别偏离的信号

```
偏离信号检查表：

  □ AI 生成的代码使用了你不想要的框架/库
  □ API 设计风格与预期不符
  □ 错误处理方式与项目约定不一致
  □ 代码复杂度远超预期（过度工程）
  □ 代码过于简单（缺少必要的功能）
  □ 类型定义不精确（用了 any 或过于宽泛）
```

### 4.2 修正策略

| 偏离类型 | 修正 Prompt 模板 |
|---------|----------------|
| 框架偏离 | "不要用 X，用 Y 来实现。参考这个示例：[代码]" |
| 风格偏离 | "参考上面的 @file 代码风格，保持一致" |
| 复杂度偏离 | "保持简单，不需要 X 和 Y，只实现核心功能" |
| 功能缺失 | "还需要添加 X 功能，具体要求：[描述]" |
| 类型不精确 | "不要用 any，每个参数和返回值都要有精确类型" |

---

## 5. 常见误区

### ❌ 错误 1：迭代步幅太大

```
第一轮："定义类型"
第二轮："实现所有功能"
→ 第二轮又变成一次性 Prompt
```

**修复**：每轮只添加 1-2 个新功能点。

### ❌ 错误 2：没有评估就继续

```
第一轮生成后直接说"继续"
→ 如果第一轮有错误，后续全部在错误基础上构建
```

**修复**：每轮生成后，检查是否符合预期，必要时修正再继续。

### ❌ 错误 3：丢失上下文

```
第五轮迭代时，AI 忘记了第一轮的类型定义
→ 生成了不兼容的代码
```

**修复**：关键的前序代码在每轮 Prompt 中简要提及，或粘贴核心部分。

### ❌ 错误 4：缺乏明确的验收标准

```
"继续完善"
→ AI 不知道什么程度算"完善"
```

**修复**：每轮明确说明期望的输出——"这轮完成后，应该能验证嵌套对象并报告完整路径"。

### ❌ 错误 5：不做方向检查

```
连续 5 轮迭代，每轮都基于上一轮
到最后一轮发现第一轮的基础设计有问题
→ 前面的工作全部浪费
```

**修复**：在迭代 2 完成后做一次整体方向检查，确认架构合理再继续。

---

## 6. 工程建议

1. **每轮迭代记录评估检查点**：在每轮 Prompt 生成后，花 2 分钟检查输出是否符合预期，记录偏差点。这比事后回溯修改成本低得多，也能帮助你优化下一轮的 Prompt。

2. **迭代粒度以"可测试"为标准**：每轮迭代完成后，代码应该能独立运行或通过类型检查。如果一轮迭代后代码无法编译，说明步幅太大，需要拆分。

3. **保留关键前序代码在 Prompt 中**：多轮迭代时，AI 可能"遗忘"早期的类型定义。在每轮 Prompt 开头粘贴核心类型或接口定义（10-20 行），确保后续生成与前序代码兼容。

4. **迭代 2 完成后做整体方向检查**：不要等到第 5 轮才发现第 1 轮的架构设计有问题。在第 2 轮完成后暂停，整体审视架构是否合理，确认后再继续后续迭代。

---

## 7. 总结

```
五步迭代法回顾：

  种子 ──▶ 核心类型/接口/骨架
  扩展 ──▶ 基础实现
  约束 ──▶ 边界条件/验证规则
  优化 ──▶ 组合/推导/重构
  完善 ──▶ 测试/文档/细节

每轮迭代的检查点：
  ✓ 输出是否符合预期？
  ✓ 架构是否仍然合理？
  ✓ 是否需要修正方向？
  ✓ 下一轮的重点是什么？
```

| 迭代步骤 | 核心目标 | 代码量 | 验收标准 |
|---------|---------|--------|---------|
| 种子 | 类型定义 | 50-100 行 | 类型完备，接口清晰 |
| 扩展 | 基础实现 | 100-200 行 | 核心功能可用 |
| 约束 | 规则验证 | 100-200 行 | 约束检查正确 |
| 优化 | 组合重构 | 150-300 行 | 嵌套验证通过 |
| 完善 | 测试文档 | 200+ 行测试 | 测试全部通过 |

---

## 8. 动手练习

### 练习 1：5 轮迭代实践

选择以下任一项目，用五步迭代法通过 AI 构建：

- A. 一个 Markdown 解析器（将 Markdown 转为 HTML）
- B. 一个简单的 HTTP 客户端封装（类似 axios）
- C. 一个状态机库（支持状态定义和转换规则）

要求：记录每轮的 Prompt、AI 输出、你的评估、下一轮的方向。

### 练习 2：方向修正练习

故意在第二轮迭代中给出一个"有偏差"的 Prompt，观察 AI 的输出，然后在第三轮修正方向。记录：

- 偏差 Prompt 导致了什么问题？
- 修正 Prompt 是如何表述的？
- 修正后 AI 的输出是否回到正轨？

### 练习 3：迭代粒度优化

同一个功能（比如一个日期格式化函数），分别用以下两种方式实现：

- 方式 A：一次性 Prompt，让 AI 完整实现
- 方式 B：3 轮迭代（基础格式化 → 添加时区支持 → 添加国际化）

对比两种方式的最终代码质量、所需时间、修改次数。

---

**下一课**：[Lesson 05: 系统级 Prompt](./05-系统级Prompt.md) —— 学习编写系统级 Prompt，定义项目编码规范和团队约定。

---

## 参考答案

### 练习 1：5 轮迭代实践

**思路**：以 Markdown 解析器为例，展示五步迭代法的完整过程。每轮聚焦一个目标，Prompt 明确，评估检查点清晰。关键是控制每轮的粒度——只添加 1-2 个新功能点。

**答案**：

以 Markdown 解析器为例的 5 轮迭代记录：

**第 1 轮（种子）—— 核心类型和最小解析**

```
设计一个 Markdown 转 HTML 的解析器核心类型。

要求：
1. 定义 Token 类型（heading, paragraph, bold, italic, code, link, list）
2. 定义 Parser 接口：parse(markdown: string) → string
3. 先只实现段落和标题（h1-h3）的解析
4. 保持极简，只处理单行文本
```

评估：Token 类型完备，parse 接口清晰，段落和标题解析正确。

**第 2 轮（扩展）—— 行内格式**

```
基于上一轮的 Parser，添加行内格式解析：
1. **粗体** → <strong>
2. *斜体* → <em>
3. `行内代码` → <code>
4. [链接](url) → <a>
5. 行内格式可以嵌套（如粗体中包含链接）
```

评估：行内格式解析正确，嵌套场景通过测试。

**第 3 轮（约束）—— 列表和代码块**

```
添加块级元素解析：
1. 无序列表（- 开头）→ <ul><li>
2. 有序列表（数字开头）→ <ol><li>
3. 代码块（``` 包围）→ <pre><code>
4. 引用块（> 开头）→ <blockquote>
```

评估：列表嵌套、代码块内不解析格式、引用块支持多行。

**第 4 轮（优化）—— 边界情况和性能**

```
处理边界情况：
1. 空行连续出现时只产生一个段落分隔
2. 列表项中包含行内格式
3. 代码块中不解析任何 Markdown 语法
4. 水平线（---）→ <hr>
5. 提取公共的行内解析逻辑，消除重复代码
```

评估：边界情况全部通过，代码结构清晰。

**第 5 轮（完善）—— 测试和错误处理**

```
完善解析器：
1. 添加完整的单元测试（至少 20 个用例）
2. 处理恶意输入（超长文本、未闭合标签）
3. 添加转义字符支持（\* 不解析为斜体）
4. 输出格式化的 HTML（带缩进）
```

评估：测试全部通过，覆盖率 90%+。

**要点**：
- 每轮只新增 1-2 个功能模块，避免信息过载
- 每轮结束后必须运行测试确认无回归
- 前序代码的核心类型定义在每轮 Prompt 中简要提及

---

### 练习 2：方向修正练习

**思路**：故意在第二轮引入偏差（如使用不合适的解析策略），观察 AI 输出偏离后在第三轮修正。关键是记录偏差信号和修正话术。

**答案**：

**偏差 Prompt（第 2 轮）：**

```
用正则表达式实现所有 Markdown 解析，包括标题、粗体、斜体、列表、代码块。
一行正则匹配一个语法。
```

**导致的问题：**
- AI 用多层嵌套正则实现解析，代码变成 200+ 行难以维护的正则地狱
- 无法处理嵌套格式（如粗体中包含链接）
- 代码块内的语法被错误解析
- 每次新增语法都要修改全局正则，违反开放封闭原则

**修正 Prompt（第 3 轮）：**

```
上一轮的正则方案不可维护。请重构为以下架构：
1. 使用状态机（state machine）解析块级元素
2. 使用递归下降解析行内格式
3. 每种语法类型独立处理，不使用全局正则
4. 保持上一轮已通过的测试用例不变
```

**修正后 AI 的输出：**
- 用 Lexer → Parser → Renderer 三阶段架构替代正则
- 每种语法有独立的处理函数
- 嵌套格式正确解析
- 测试全部通过

**要点**：
- 偏差信号：代码复杂度远超预期、新增功能需要大量修改现有代码
- 修正策略：明确指出"不可维护"并给出期望的架构方向
- 关键话术："重构为 X 架构，保持测试不变"

---

### 练习 3：迭代粒度优化

**思路**：对比一次性实现和迭代式实现的差异，从代码质量、修改次数、可维护性三个维度评估。核心结论是迭代式在复杂功能上优势明显。

**答案**：

以日期格式化函数为例的对比实验：

**方式 A：一次性 Prompt**

```
实现一个日期格式化函数，支持：
- 格式化模板（YYYY-MM-DD HH:mm:ss）
- 时区转换（UTC、本地时区、指定时区）
- 国际化（中英文月份/星期）
- 相对时间（"3分钟前"、"昨天"）
- 自定义区域设置
```

结果：AI 生成 300+ 行代码，时区处理有 bug（夏令时边界错误），国际化模块与格式化模块耦合，相对时间的精度计算有误。需要修改 15+ 处。

**方式 B：3 轮迭代**

第 1 轮：基础格式化（YYYY-MM-DD），50 行，0 处修改。
第 2 轮：添加时区支持，100 行，2 处修改（时区偏移计算）。
第 3 轮：添加国际化和相对时间，180 行，3 处修改（月份名称映射）。

**对比结论：**

| 维度 | 一次性 | 迭代式 |
|------|--------|--------|
| 最终代码量 | 300 行 | 180 行 |
| 修改次数 | 15+ 处 | 5 处 |
| Bug 数量 | 3 个 | 0 个 |
| 总耗时 | 40 分钟 | 45 分钟 |
| 代码可维护性 | 低（模块耦合） | 高（职责清晰） |

**要点**：
- 迭代式在总耗时上与一次性方式接近，但代码质量显著更高
- 每轮迭代的"可测试"验收标准是关键——第 1 轮完成后就能运行验证
- 复杂功能（多模块、多语言特性）适合迭代式，简单函数一次性即可

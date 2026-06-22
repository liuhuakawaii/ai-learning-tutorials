# 01 - Builder 模式类型安全版

## 场景引入

你在构建一个 HTTP 请求配置对象，有些字段必填（url、method），有些可选（headers、timeout）。传统做法是传一个大对象，但调用者经常漏掉必填字段，直到运行时才发现。有没有办法让 TypeScript 编译器在你写代码时就告诉你"还没设置 url"？

## 学习目标

- 理解传统 Builder 模式在类型安全上的缺陷
- 掌握用泛型参数追踪构建状态的技术
- 学会用交叉类型和条件类型强制必填字段
- 实现一个编译期完整的链式请求构建器

## 一、传统 Builder 的类型问题

传统 Builder 用可选字段和运行时检查，类型系统无法帮你兜底：

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  timeout?: number
}

class TraditionalBuilder {
  private config: Partial<RequestConfig> = {}

  setUrl(url: string): this { this.config.url = url; return this }
  setMethod(method: RequestConfig['method']): this { this.config.method = method; return this }
  setHeaders(headers: Record<string, string>): this { this.config.headers = headers; return this }
  setTimeout(timeout: number): this { this.config.timeout = timeout; return this }

  build(): RequestConfig {
    if (!this.config.url) throw new Error('url is required')
    if (!this.config.method) throw new Error('method is required')
    return this.config as RequestConfig
  }
}

// 编译期不会报错，运行时才崩
const req = new TraditionalBuilder()
  .setMethod('GET')
  .build() // 💥 Error: url is required
```

问题很明确：`build()` 在编译期接受任何状态的 builder，缺失字段的错误只能在运行时暴露。

## 二、用泛型追踪构建状态

核心思路是让 Builder 的类型参数记录"哪些字段已经设置"：

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: Record<string, string>
  timeout: number
}

// 泛型参数 Set 表示已设置的字段集合
class TypeSafeBuilder<Set extends string = never> {
  private config: Partial<RequestConfig> = {}

  setUrl(url: string): TypeSafeBuilder<Set | 'url'> {
    const builder = this as TypeSafeBuilder<Set | 'url'>
    builder.config.url = url
    return builder
  }

  setMethod(method: RequestConfig['method']): TypeSafeBuilder<Set | 'method'> {
    const builder = this as TypeSafeBuilder<Set | 'method'>
    builder.config.method = method
    return builder
  }

  setHeaders(headers: Record<string, string>): TypeSafeBuilder<Set | 'headers'> {
    const builder = this as TypeSafeBuilder<Set | 'headers'>
    builder.config.headers = headers
    return builder
  }

  setTimeout(timeout: number): TypeSafeBuilder<Set | 'timeout'> {
    const builder = this as TypeSafeBuilder<Set | 'timeout'>
    builder.config.timeout = timeout
    return builder
  }

  // 只有当 Set 包含所有必需字段时，build 才可用
  build(this: TypeSafeBuilder<'url' | 'method'>): RequestConfig {
    return {
      url: this.config.url!,
      method: this.config.method!,
      headers: this.config.headers ?? {},
      timeout: this.config.timeout ?? 3000,
    }
  }
}

// 编译失败：缺少 url
new TypeSafeBuilder().setMethod('GET').build() // ❌

// 正确：所有必需字段已设置
new TypeSafeBuilder()
  .setUrl('https://api.example.com')
  .setMethod('GET')
  .build() // ✅
```

## 三、区分必填与可选字段

用映射类型自动提取必填字段，实现通用 Builder：

```typescript
// 提取必填字段名
type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

type RequiredFields = RequiredKeys<RequestConfig> // "url" | "method"

class SmartBuilder<Set extends string = never> {
  private config: Record<string, unknown> = {}

  set<K extends keyof RequestConfig>(
    key: K, value: RequestConfig[K]
  ): SmartBuilder<Set | K> {
    const builder = this as SmartBuilder<Set | K>
    builder.config[key as string] = value
    return builder
  }

  build(this: SmartBuilder<Set & RequiredFields>): RequestConfig {
    return this.config as unknown as RequestConfig
  }
}

// 使用：通用 set 方法 + 编译期必填检查
const request = new SmartBuilder()
  .set('url', 'https://api.example.com/users')
  .set('method', 'GET')
  .set('timeout', 5000)
  .build() // ✅
```

## 常见误区

1. **把所有字段都设为可选**：用 `Partial<T>` 规避类型检查，等于放弃了 Builder 的安全保障
2. **泛型参数用联合类型而非字符串字面量**：无法追踪具体字段
3. **忘记 `this` 参数约束**：`build()` 必须用 `this` 参数声明约束，否则类型检查不生效
4. **过度设计**：简单配置对象直接用对象字面量即可，Builder 适合字段多、组合复杂的场景

## 工程建议

1. **Builder 适合字段超过 5 个且有必填约束的场景**：低于 5 个字段直接用函数参数
2. **用 `Readonly` 包装最终产物**：防止构建后被意外修改
3. **考虑支持 `reset()` 方法**：在需要复用 builder 实例的场景下提供重置能力
4. **配合验证库使用**：Builder 保证字段齐全，Zod 等库保证字段值合法

## 小结

类型安全 Builder 的核心是**用泛型参数记录构建进度**。每次调用 setter 都会扩展泛型参数的联合类型，`build()` 通过 `this` 参数约束要求所有必需字段在联合类型中出现。这个技术让 TypeScript 编译器成为你的构建守卫。

## 练习

### 练习一：数据库查询构建器

实现一个 `QueryBuilder<T>`，支持链式调用 `select`、`where`、`orderBy`、`limit`，要求 `select` 和 `from`（构造时传入）为必填，其余可选。

### 练习二：表单验证 Builder

实现一个 `FormValidator` Builder，支持链式调用 `required()`、`minLength(n)`、`maxLength(n)`、`pattern(regex)`，返回一个 `validate(value: string)` 方法。

### 练习三：通用 Builder 工厂

编写一个 `createBuilder<T>()` 工厂函数，接收一个接口 `T`，自动生成类型安全的 Builder 类。

---

## 参考答案

### 练习一

**思路**：用泛型参数 `Selected` 和 `HasFrom` 追踪 select 和 from 的设置状态。

**答案**：

```typescript
class QueryBuilder<Table extends string = never, Selected extends boolean = false> {
  private result: Partial<{ table: string; columns: string[]; conditions: string[]; orderBy: string; limit: number }> = { conditions: [] }

  static from<T extends string>(table: T): QueryBuilder<T, false> {
    const builder = new QueryBuilder<T, false>()
    builder.result.table = table
    return builder
  }

  select(...columns: string[]): QueryBuilder<Table, true> {
    const builder = this as QueryBuilder<Table, true>
    builder.result.columns = columns
    return builder
  }

  where(condition: string): this { this.result.conditions!.push(condition); return this }
  orderBy(field: string): this { this.result.orderBy = field; return this }
  limit(n: number): this { this.result.limit = n; return this }

  build(this: QueryBuilder<Table, true>) {
    return this.result as { table: Table; columns: string[]; conditions: string[]; orderBy?: string; limit?: number }
  }
}

QueryBuilder.from('users').select('id', 'name').where('age > 18').build() // ✅
QueryBuilder.from('users').where('age > 18').build() // ❌ 未 select
```

**要点**：`from` 返回 `Selected=false`，`select` 切换为 `true`，`build` 要求 `true`。

### 练习二

**思路**：收集验证规则到数组，`validate` 时统一执行。

**答案**：

```typescript
type ValidationRule =
  | { type: 'required' }
  | { type: 'minLength'; value: number }
  | { type: 'maxLength'; value: number }
  | { type: 'pattern'; regex: RegExp }

class FormValidator {
  private rules: ValidationRule[] = []
  required(): this { this.rules.push({ type: 'required' }); return this }
  minLength(v: number): this { this.rules.push({ type: 'minLength', value: v }); return this }
  maxLength(v: number): this { this.rules.push({ type: 'maxLength', value: v }); return this }
  pattern(r: RegExp): this { this.rules.push({ type: 'pattern', regex: r }); return this }

  validate(value: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    for (const rule of this.rules) {
      if (rule.type === 'required' && !value) errors.push('字段不能为空')
      if (rule.type === 'minLength' && value.length < rule.value) errors.push(`最少 ${rule.value} 个字符`)
      if (rule.type === 'maxLength' && value.length > rule.value) errors.push(`最多 ${rule.value} 个字符`)
      if (rule.type === 'pattern' && !rule.regex.test(value)) errors.push('格式不正确')
    }
    return { valid: errors.length === 0, errors }
  }
}

const v = new FormValidator().required().minLength(3).maxLength(20).pattern(/^[a-zA-Z0-9_]+$/)
console.log(v.validate('ab'))       // valid: false
console.log(v.validate('john_doe')) // valid: true
```

**要点**：规则收集在数组中，`validate` 时遍历执行，每条规则产生错误消息。

### 练习三

**思路**：用 `Proxy` 拦截属性设置，映射类型自动生成方法签名。

**答案**：

```typescript
type BuilderMethods<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => BuilderMethods<T>
} & { build(): T }

function createBuilder<T extends Record<string, unknown>>(): BuilderMethods<T> {
  const data: Record<string, unknown> = {}
  return new Proxy(data, {
    get(_target, prop: string) {
      if (prop === 'build') return () => ({ ...data })
      if (prop.startsWith('set')) {
        const key = prop[3].toLowerCase() + prop.slice(4)
        return (value: unknown) => { data[key] = value; return new Proxy(data, this) }
      }
    },
  }) as unknown as BuilderMethods<T>
}

interface UserProfile { name: string; age: number; email: string }
const user = createBuilder<UserProfile>()
  .setName('张三').setAge(25).setEmail('zhangsan@example.com').build()
```

**要点**：`Proxy` 动态生成 `setXxx` 方法，`Capitalize` 处理首字母大写，`build` 返回浅拷贝。

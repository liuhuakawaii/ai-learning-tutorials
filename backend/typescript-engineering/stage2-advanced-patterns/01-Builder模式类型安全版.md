# 01 - Builder 模式类型安全版

你在构建一个 HTTP 请求配置对象。有些字段必填（url、method），有些可选（headers、timeout）。传统做法是传一个大对象或者用 Builder 模式，但两种方式都有同一个问题：漏掉必填字段时，编译器不报错，直到运行时才崩。

这节课要解决的问题：能不能让 TypeScript 编译器在你写代码时就告诉你"还没设置 url"？

## 传统 Builder 的问题

```typescript
interface RequestConfig {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  timeout?: number
}

class TraditionalBuilder {
  private config: Partial<RequestConfig> = {}

  setUrl(url: string): this { this.config.url = url; return this }
  setMethod(method: RequestConfig["method"]): this { this.config.method = method; return this }
  setHeaders(headers: Record<string, string>): this { this.config.headers = headers; return this }
  setTimeout(timeout: number): this { this.config.timeout = timeout; return this }

  build(): RequestConfig {
    if (!this.config.url) throw new Error("url is required")
    if (!this.config.method) throw new Error("method is required")
    return this.config as RequestConfig
  }
}

// 编译期不报错，运行时崩
const req = new TraditionalBuilder()
  .setMethod("GET")
  .build() // 💥 url is required
```

问题出在 `Partial<RequestConfig>`：它把所有字段变成可选的，`build()` 接受任何状态的 builder。缺失字段的检查被推迟到了运行时。

## 用泛型参数追踪构建状态

核心思路：让 Builder 的类型参数记录"哪些字段已经被设置过"。

```typescript
class TypeSafeBuilder<Set extends string = never> {
  private config: Partial<RequestConfig> = {}

  setUrl(url: string): TypeSafeBuilder<Set | "url"> {
    const builder = this as TypeSafeBuilder<Set | "url">
    builder.config.url = url
    return builder
  }

  setMethod(method: RequestConfig["method"]): TypeSafeBuilder<Set | "method"> {
    const builder = this as TypeSafeBuilder<Set | "method">
    builder.config.method = method
    return builder
  }

  setHeaders(headers: Record<string, string>): TypeSafeBuilder<Set | "headers"> {
    const builder = this as TypeSafeBuilder<Set | "headers">
    builder.config.headers = headers
    return builder
  }

  setTimeout(timeout: number): TypeSafeBuilder<Set | "timeout"> {
    const builder = this as TypeSafeBuilder<Set | "timeout">
    builder.config.timeout = timeout
    return builder
  }

  build(this: TypeSafeBuilder<"url" | "method">): RequestConfig {
    return {
      url: this.config.url!,
      method: this.config.method!,
      headers: this.config.headers ?? {},
      timeout: this.config.timeout ?? 3000,
    }
  }
}
```

`Set` 参数是一个字符串联合类型，每调用一个 setter 就往联合类型里加一个成员。`build()` 的 `this` 参数约束为 `TypeSafeBuilder<"url" | "method">`，意思是只有当 `Set` 包含 `"url"` 和 `"method"` 时，`build` 才能调用。

```typescript
// 编译失败：Set 是 "method"，缺少 "url"
new TypeSafeBuilder().setMethod("GET").build() // ❌

// 编译成功：Set 是 "url" | "method"
new TypeSafeBuilder()
  .setUrl("https://api.example.com")
  .setMethod("GET")
  .build() // ✅
```

`this` 参数是关键。没有它，TypeScript 不会在 `build()` 调用时检查泛型参数是否满足约束。

## 区分必填与可选字段

手动写 `"url" | "method"` 太脆弱——如果接口变了，Builder 的约束不会自动更新。用映射类型自动提取必填字段：

```typescript
type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

type RequiredFields = RequiredKeys<RequestConfig> // "url" | "method"
```

`-?` 移除可选标记，然后用条件类型检查 `undefined extends T[K]`——如果是可选字段，`undefined extends T[K]` 成立，返回 `never`；否则返回字段名。最后 `[keyof T]` 索引取出所有非 `never` 的值。

有了这个，你可以写一个通用的 `set` 方法：

```typescript
class SmartBuilder<Set extends string = never> {
  private config: Record<string, unknown> = {}

  set<K extends keyof RequestConfig>(
    key: K,
    value: RequestConfig[K]
  ): SmartBuilder<Set | K> {
    const builder = this as SmartBuilder<Set | K>
    builder.config[key as string] = value
    return builder
  }

  build(this: SmartBuilder<Set & RequiredFields>): RequestConfig {
    return this.config as unknown as RequestConfig
  }
}

const request = new SmartBuilder()
  .set("url", "https://api.example.com/users")
  .set("method", "GET")
  .set("timeout", 5000)
  .build() // ✅
```

`Set & RequiredFields` 的约束确保 `Set` 必须包含所有必填字段。`&` 在这里是"同时满足"的意思。

## 这个模式的适用边界

类型安全 Builder 不是万能的。以下场景适合用它：

- **字段超过 5 个且有必填约束**：字段少的时候直接用函数参数更简单
- **配置对象需要分步构建**：比如从环境变量、配置文件、命令行参数分别读取不同字段
- **想在 IDE 里有自动补全和错误提示**：泛型参数驱动的类型推断能提供精确的补全

以下场景不适合：

- **字段之间有复杂的依赖关系**：比如"设置了 A 就必须设置 B"，这种约束用泛型参数追踪会非常复杂
- **需要运行时验证**：Builder 只保证字段齐全，不保证值合法。值的验证还是需要 Zod 这样的库
- **配置对象是动态的**：如果字段名在运行时才确定，编译期类型安全没有意义

## 工程建议

1. **用 `Readonly` 包装最终产物**：防止构建后被意外修改
2. **Builder 和验证库配合**：Builder 保证字段齐全，Zod 保证字段值合法
3. **考虑支持 `reset()` 方法**：在需要复用 builder 实例的场景下提供重置能力

## 练习

### 练习一：数据库查询构建器

实现一个 `QueryBuilder<T>`，支持链式调用 `select`、`where`、`orderBy`、`limit`。要求 `from`（构造时传入）和 `select` 为必填，其余可选。用泛型参数追踪 `from` 和 `select` 的设置状态。

### 练习二：表单验证 Builder

实现一个 `FormValidator` Builder，支持链式调用 `required()`、`minLength(n)`、`maxLength(n)`、`pattern(regex)`，最终返回一个 `validate(value: string)` 方法。规则收集在数组中，`validate` 时遍历执行。

### 练习三：通用 Builder 工厂

编写一个 `createBuilder<T>()` 工厂函数，接收一个接口 `T`，自动生成 `setXxx` 方法和 `build` 方法。提示：可以用 `Proxy` 动态拦截属性访问。

---

## 参考答案

### 练习一

```typescript
class QueryBuilder<Table extends string = never, Selected extends boolean = false> {
  private result: {
    table?: string; columns?: string[]; conditions: string[]; orderBy?: string; limit?: number
  } = { conditions: [] }

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

  where(condition: string): this { this.result.conditions.push(condition); return this }
  orderBy(field: string): this { this.result.orderBy = field; return this }
  limit(n: number): this { this.result.limit = n; return this }

  build(this: QueryBuilder<Table, true>) {
    return this.result as { table: Table; columns: string[]; conditions: string[] }
  }
}

QueryBuilder.from("users").select("id", "name").where("age > 18").build() // ✅
QueryBuilder.from("users").where("age > 18").build() // ❌ 未调用 select
```

`from` 返回 `Selected=false`，`select` 切换为 `true`，`build` 要求 `true`。

### 练习二

```typescript
type ValidationRule =
  | { type: "required" }
  | { type: "minLength"; value: number }
  | { type: "maxLength"; value: number }
  | { type: "pattern"; regex: RegExp }

class FormValidator {
  private rules: ValidationRule[] = []
  required(): this { this.rules.push({ type: "required" }); return this }
  minLength(v: number): this { this.rules.push({ type: "minLength", value: v }); return this }
  maxLength(v: number): this { this.rules.push({ type: "maxLength", value: v }); return this }
  pattern(r: RegExp): this { this.rules.push({ type: "pattern", regex: r }); return this }

  validate(value: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    for (const rule of this.rules) {
      if (rule.type === "required" && !value) errors.push("字段不能为空")
      if (rule.type === "minLength" && value.length < rule.value) errors.push(`最少 ${rule.value} 个字符`)
      if (rule.type === "maxLength" && value.length > rule.value) errors.push(`最多 ${rule.value} 个字符`)
      if (rule.type === "pattern" && !rule.regex.test(value)) errors.push("格式不正确")
    }
    return { valid: errors.length === 0, errors }
  }
}

const usernameValidator = new FormValidator()
  .required().minLength(3).maxLength(20).pattern(/^[a-zA-Z0-9_]+$/)

console.log(usernameValidator.validate("ab"))       // valid: false
console.log(usernameValidator.validate("john_doe")) // valid: true
```

### 练习三

```typescript
type BuilderMethods<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => BuilderMethods<T>
} & { build(): T }

function createBuilder<T extends Record<string, unknown>>(): BuilderMethods<T> {
  const data: Record<string, unknown> = {}
  return new Proxy(data, {
    get(_target, prop: string) {
      if (prop === "build") return () => ({ ...data })
      if (prop.startsWith("set")) {
        const key = prop[3].toLowerCase() + prop.slice(4)
        return (value: unknown) => {
          data[key] = value
          return new Proxy(data, this)
        }
      }
    },
  }) as unknown as BuilderMethods<T>
}

interface UserProfile { name: string; age: number; email: string }
const user = createBuilder<UserProfile>()
  .setName("张三").setAge(25).setEmail("zhangsan@example.com").build()
```

`Proxy` 动态生成 `setXxx` 方法，`Capitalize` 处理首字母大写，`build` 返回浅拷贝。

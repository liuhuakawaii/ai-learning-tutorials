# 02 - Strategy 与 Factory 模式

## 场景引入

你的电商平台需要支持多种支付方式：支付宝、微信支付、银行卡。每种支付方式的接口不同，但业务流程相同——创建订单、扣款、回调确认。如果用 `if-else` 硬编码每种支付逻辑，新增支付方式时就要改动核心代码。如何用策略模式和工厂模式让支付方式可插拔、类型安全？

## 学习目标

- 用接口约束实现类型安全的策略模式
- 用可辨识联合实现工厂模式，消除类型断言
- 掌握抽象工厂的类型推导技巧
- 在支付处理场景中综合运用两种模式

## 一、策略模式的接口约束

策略模式的核心是定义统一接口，让不同实现可以互换：

```typescript
interface PaymentStrategy {
  readonly name: string
  createOrder(amount: number): Promise<PaymentOrder>
  execute(orderId: string): Promise<PaymentResult>
  handleCallback(payload: unknown): CallbackResult
}

interface PaymentOrder { orderId: string; amount: number; provider: string; createdAt: Date }
interface PaymentResult { success: boolean; transactionId: string; paidAt: Date }
interface CallbackResult { verified: boolean; orderId: string }

class AlipayStrategy implements PaymentStrategy {
  readonly name = 'alipay'

  async createOrder(amount: number): Promise<PaymentOrder> {
    return { orderId: `alipay_${Date.now()}`, amount, provider: 'alipay', createdAt: new Date() }
  }

  async execute(orderId: string): Promise<PaymentResult> {
    return { success: true, transactionId: `txn_${orderId}`, paidAt: new Date() }
  }

  handleCallback(payload: unknown): CallbackResult {
    const data = payload as { out_trade_no: string }
    return { verified: true, orderId: data.out_trade_no }
  }
}

class WechatPayStrategy implements PaymentStrategy {
  readonly name = 'wechat'

  async createOrder(amount: number): Promise<PaymentOrder> {
    return { orderId: `wx_${Date.now()}`, amount, provider: 'wechat', createdAt: new Date() }
  }

  async execute(orderId: string): Promise<PaymentResult> {
    return { success: true, transactionId: `txn_${orderId}`, paidAt: new Date() }
  }

  handleCallback(payload: unknown): CallbackResult {
    const data = payload as { xml: { out_trade_no: string } }
    return { verified: true, orderId: data.xml.out_trade_no }
  }
}
```

## 二、工厂模式与可辨识联合

用可辨识联合替代字符串参数，让编译器帮你检查所有分支：

```typescript
type PaymentConfig =
  | { provider: 'alipay'; appId: string; privateKey: string }
  | { provider: 'wechat'; mchId: string; apiKey: string }
  | { provider: 'card'; bankCode: string; merchantId: string }

class CardStrategy implements PaymentStrategy {
  readonly name = 'card'
  constructor(private bankCode: string) {}

  async createOrder(amount: number): Promise<PaymentOrder> {
    return { orderId: `card_${Date.now()}`, amount, provider: 'card', createdAt: new Date() }
  }

  async execute(orderId: string): Promise<PaymentResult> {
    return { success: true, transactionId: `txn_${orderId}`, paidAt: new Date() }
  }

  handleCallback(payload: unknown): CallbackResult {
    return { verified: true, orderId: (payload as { orderId: string }).orderId }
  }
}

// 工厂函数：编译器确保处理了所有分支
function createPaymentStrategy(config: PaymentConfig): PaymentStrategy {
  switch (config.provider) {
    case 'alipay': return new AlipayStrategy()
    case 'wechat': return new WechatPayStrategy()
    case 'card': return new CardStrategy(config.bankCode)
  }
}

const strategy = createPaymentStrategy({ provider: 'alipay', appId: 'app_123', privateKey: 'key_abc' })
const order = await strategy.createOrder(99.9)
```

如果新增支付方式但忘记在工厂中处理，TypeScript 会报错——可辨识联合让编译器做穷举检查。

## 三、抽象工厂与类型推导

当创建的不是单一对象而是一组相关对象时，需要抽象工厂：

```typescript
interface PaymentComponentFactory<P extends string> {
  createGateway(): PaymentGateway<P>
  createNotifier(): PaymentNotifier<P>
}

interface PaymentGateway<P extends string> { provider: P; charge(amount: number): Promise<string> }
interface PaymentNotifier<P extends string> { provider: P; notify(orderId: string, status: string): void }

class AlipayComponentFactory implements PaymentComponentFactory<'alipay'> {
  createGateway(): PaymentGateway<'alipay'> {
    return { provider: 'alipay', async charge(amount) { return `alipay_txn_${amount}` } }
  }
  createNotifier(): PaymentNotifier<'alipay'> {
    return { provider: 'alipay', notify(orderId, status) { console.log(`[支付宝] ${orderId}: ${status}`) } }
  }
}

function initializePaymentSystem<P extends string>(factory: PaymentComponentFactory<P>) {
  const gateway = factory.createGateway()
  const notifier = factory.createNotifier()
  console.log(`初始化 ${gateway.provider} 支付系统`)
  return { gateway, notifier }
}

const alipaySystem = initializePaymentSystem(new AlipayComponentFactory())
// gateway.provider 类型是 'alipay'，不会与 notifier 的 provider 混淆
```

抽象工厂保证了同一族的对象类型一致——你不会把支付宝网关和微信通知混在一起。

## 常见误区

1. **策略接口方法全部返回 `any`**：丧失了类型检查的意义
2. **工厂函数返回 `PaymentStrategy | undefined`**：应该确保所有分支都返回实例
3. **在策略实现中硬编码配置**：配置应通过构造函数注入
4. **忽略策略的生命周期**：有状态策略要注意实例复用，无状态策略可做成单例

## 工程建议

1. **策略接口方法不超过 5 个**：接口过于庞大说明职责过重，应拆分
2. **工厂函数配合配置文件使用**：从配置读取 `provider` 字段，自动创建对应策略
3. **用 `satisfies` 操作符校验策略注册表**：确保注册表类型完整且正确
4. **策略模式与 DI 容器结合**：将策略注册到容器中，由容器负责创建和注入

## 小结

策略模式通过接口约束实现算法互换，工厂模式通过可辨识联合实现安全的实例创建。两者结合后，新增支付方式只需：实现策略接口、在联合类型中添加分支、在工厂函数中添加创建逻辑。TypeScript 编译器会确保你没有遗漏。

## 练习

### 练习一：序列化策略

实现一个序列化系统，支持 JSON、XML、CSV 三种格式，用工厂函数根据文件扩展名创建对应策略。

### 练习二：日志策略工厂

实现一个日志系统抽象工厂，创建 Logger、Formatter、Transport 三个组件，确保同一日志级别的组件类型一致。

### 练习三：策略注册表

实现一个 `StrategyRegistry<T>` 类型，支持 `register(name, strategy)` 和 `get(name)` 方法，确保注册的策略类型与声明一致。

---

## 参考答案

### 练习一

**思路**：定义 `Serializer` 接口，每种格式实现该接口，工厂函数根据扩展名返回实例。

**答案**：

```typescript
interface Serializer {
  readonly format: string
  serialize(data: unknown): string
  deserialize<T>(raw: string): T
}

class JsonSerializer implements Serializer {
  readonly format = 'json'
  serialize(data: unknown) { return JSON.stringify(data, null, 2) }
  deserialize<T>(raw: string): T { return JSON.parse(raw) }
}

class CsvSerializer implements Serializer {
  readonly format = 'csv'
  serialize(data: unknown) {
    const rows = data as Record<string, unknown>[]
    return [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n')
  }
  deserialize<T>(raw: string): T {
    const [headerLine, ...lines] = raw.split('\n')
    const headers = headerLine.split(',')
    return lines.map(line => Object.fromEntries(headers.map((h, i) => [h, line.split(',')[i]]))) as unknown as T
  }
}

function createSerializer(filename: string): Serializer {
  const ext = filename.split('.').pop()
  switch (ext) {
    case 'json': return new JsonSerializer()
    case 'csv': return new CsvSerializer()
    default: throw new Error(`不支持的格式: ${ext}`)
  }
}
```

**要点**：工厂函数根据扩展名选择策略，每个序列化器独立实现。

### 练习二

**思路**：用泛型参数约束日志级别，抽象工厂确保组件级别一致。

**答案**：

```typescript
type LogLevel = 'debug' | 'info' | 'error'
interface Logger<L extends LogLevel> { level: L; log(msg: string): void }
interface Formatter<L extends LogLevel> { level: L; format(msg: string): string }
interface Transport<L extends LogLevel> { level: L; send(formatted: string): void }

interface LoggerFactory<L extends LogLevel> {
  createLogger(): Logger<L>
  createFormatter(): Formatter<L>
  createTransport(): Transport<L>
}

class DebugLoggerFactory implements LoggerFactory<'debug'> {
  createLogger() { return { level: 'debug' as const, log: (msg: string) => console.log(`[DEBUG] ${msg}`) } }
  createFormatter() { return { level: 'debug' as const, format: (msg: string) => `[DEBUG ${new Date().toISOString()}] ${msg}` } }
  createTransport() { return { level: 'debug' as const, send: (msg: string) => console.log(msg) } }
}

function initLogger<L extends LogLevel>(factory: LoggerFactory<L>) {
  return { logger: factory.createLogger(), formatter: factory.createFormatter(), transport: factory.createTransport() }
}
```

**要点**：泛型参数 `L` 约束三个组件的级别必须一致。

### 练习三

**思路**：用映射类型约束注册表的键值类型。

**答案**：

```typescript
interface StrategyMap { [key: string]: { execute(input: unknown): unknown } }

class StrategyRegistry<T extends StrategyMap> {
  private strategies = new Map<string, T[keyof T]>()
  register<K extends keyof T & string>(name: K, strategy: T[K]) { this.strategies.set(name, strategy) }
  get<K extends keyof T & string>(name: K): T[K] | undefined { return this.strategies.get(name) as T[K] }
}

interface MyStrategies {
  compress: { execute(input: Buffer): Buffer }
  encrypt: { execute(input: string): string }
}

const registry = new StrategyRegistry<MyStrategies>()
registry.register('compress', { execute(input: Buffer) { return input } })
registry.register('encrypt', { execute(input: string) { return Buffer.from(input).toString('base64') } })
// registry.register('unknown', { ... }) // ❌ 编译报错
```

**要点**：`K extends keyof T` 确保名称和类型对应，`get` 返回类型自动推导。

# 06 - 阶段实战：DDD 领域模型

## 场景引入

前几课分别学习了 Entity、Value Object、Aggregate Root、领域事件、策略模式和依赖注入。现在要把这些知识整合起来，构建一个完整的电商领域模型，包含商品、购物车、订单三大聚合，通过领域事件松耦合通信。

## 学习目标

- 整合 DDD 战术模式构建完整的业务领域模型
- 用 Repository 模式隔离领域模型与持久化
- 用领域服务处理跨聚合的业务逻辑
- 实现聚合间的事件驱动通信

## 一、基础类型

搭建整个领域模型共用的基础类型：

```typescript
abstract class ValueObject<T> {
  protected readonly props: T
  constructor(props: T) { this.props = Object.freeze(props) }
  equals(other: ValueObject<T>): boolean { return !!other && JSON.stringify(this.props) === JSON.stringify(other.props) }
}

abstract class Entity<T, ID> {
  protected readonly _id: ID; protected props: T
  constructor(id: ID, props: T) { this._id = id; this.props = props }
  get id(): ID { return this._id }
  equals(other: Entity<T, ID>): boolean { return !!other && this._id === other._id }
}

abstract class AggregateRoot<T, ID> extends Entity<T, ID> {
  private domainEvents: DomainEvent[] = []
  protected addDomainEvent(event: DomainEvent) { this.domainEvents.push(event) }
  pullDomainEvents(): DomainEvent[] { const e = [...this.domainEvents]; this.domainEvents = []; return e }
}

interface DomainEvent { readonly eventType: string; readonly occurredAt: Date; readonly aggregateId: string }

class OrderPlacedEvent implements DomainEvent {
  readonly eventType = 'order.placed'; readonly occurredAt = new Date()
  constructor(readonly aggregateId: string, readonly userId: string, readonly totalAmount: number) {}
}

class OrderPaidEvent implements DomainEvent {
  readonly eventType = 'order.paid'; readonly occurredAt = new Date()
  constructor(readonly aggregateId: string, readonly paidAmount: number) {}
}
```

## 二、商品与购物车聚合

```typescript
class Money extends ValueObject<{ amount: number; currency: string }> {
  static create(amount: number, currency: string): Money { if (amount < 0) throw new Error('金额不能为负'); return new Money({ amount, currency }) }
  get amount() { return this.props.amount }; get currency() { return this.props.currency }
  add(other: Money): Money { if (this.currency !== other.currency) throw new Error('币种不同'); return Money.create(this.amount + other.amount, this.currency) }
  multiply(factor: number): Money { return Money.create(this.amount * factor, this.currency) }
  subtract(other: Money): Money { if (this.currency !== other.currency) throw new Error('币种不同'); if (this.amount < other.amount) throw new Error('余额不足'); return Money.create(this.amount - other.amount, this.currency) }
  toString() { return `${this.currency} ${this.amount.toFixed(2)}` }
}

interface ProductProps { name: string; price: Money; category: string; status: 'draft' | 'active' | 'discontinued'; stock: number }

class Product extends AggregateRoot<ProductProps, string> {
  static create(id: string, name: string, price: Money, category: string): Product {
    if (!name.trim()) throw new Error('商品名不能为空')
    return new Product(id, { name, price, category, status: 'draft', stock: 0 })
  }
  get name() { return this.props.name }; get price() { return this.props.price }; get status() { return this.props.status }
  activate(): void { if (this.status !== 'draft') throw new Error('只有草稿状态可激活'); this.props.status = 'active' }
  adjustPrice(newPrice: Money): void { if (newPrice.amount < this.props.price.amount * 0.9) throw new Error('降价不能超过 10%'); this.props.price = newPrice }
  replenish(quantity: number): void { if (quantity <= 0) throw new Error('补货数量必须大于 0'); this.props.stock += quantity }
  isAvailable(quantity: number): boolean { return this.status === 'active' && this.props.stock >= quantity }
}

interface CartItemData { productId: string; productName: string; price: Money; quantity: number }

class Cart extends AggregateRoot<{ userId: string; items: CartItemData[] }, string> {
  static create(id: string, userId: string): Cart { return new Cart(id, { userId, items: [] }) }
  get items(): readonly CartItemData[] { return [...this.props.items] }
  get total(): Money { return this.props.items.reduce((sum, i) => sum.add(i.price.multiply(i.quantity)), Money.create(0, 'CNY')) }
  addItem(productId: string, name: string, price: Money, qty: number): void {
    if (this.props.items.find(i => i.productId === productId)) throw new Error(`商品 ${productId} 已在购物车中`)
    this.props.items.push({ productId, productName: name, price, quantity: qty })
  }
  removeItem(productId: string): void { const idx = this.props.items.findIndex(i => i.productId === productId); if (idx < 0) throw new Error('购物车中无此商品'); this.props.items.splice(idx, 1) }
  clear(): void { this.props.items = [] }
}
```

## 三、订单聚合

```typescript
class Address extends ValueObject<{ province: string; city: string; district: string; detail: string; phone: string }> {
  static create(p: { province: string; city: string; district: string; detail: string; phone: string }): Address {
    if (!p.phone.match(/^1\d{10}$/)) throw new Error('手机号格式不正确'); return new Address(p)
  }
}

type OrderStatusValue = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
interface OrderItemData { productId: string; productName: string; price: Money; quantity: number }

class Order extends AggregateRoot<{ userId: string; items: OrderItemData[]; shippingAddress: Address; status: OrderStatusValue; createdAt: Date }, string> {
  static create(id: string, userId: string, address: Address): Order {
    return new Order(id, { userId, items: [], shippingAddress: address, status: 'pending', createdAt: new Date() })
  }
  get status() { return this.props.status }; get userId() { return this.props.userId }
  get items(): readonly OrderItemData[] { return [...this.props.items] }
  get total(): Money { return this.props.items.reduce((sum, i) => sum.add(i.price.multiply(i.quantity)), Money.create(0, 'CNY')) }

  addItem(item: OrderItemData): void {
    if (this.status !== 'pending') throw new Error('只有待支付订单可添加商品'); this.props.items.push(item)
  }
  place(): void {
    if (this.props.items.length === 0) throw new Error('订单不能为空')
    this.addDomainEvent(new OrderPlacedEvent(this.id, this.props.userId, this.total.amount))
  }
  pay(amount: Money): void {
    if (this.status !== 'pending') throw new Error(`无法从 ${this.status} 转换到 paid`)
    if (amount.amount < this.total.amount) throw new Error('支付金额不足')
    this.props.status = 'paid'; this.addDomainEvent(new OrderPaidEvent(this.id, amount.amount))
  }
  ship(): void { if (this.status !== 'paid') throw new Error('无法发货'); this.props.status = 'shipped' }
  cancel(): void { if (this.status !== 'pending' && this.status !== 'paid') throw new Error('无法取消'); this.props.status = 'cancelled' }
}
```

## 四、Repository 与领域服务

```typescript
interface Repository<T, ID> { findById(id: ID): Promise<T | null>; save(entity: T): Promise<void> }
interface ProductRepository extends Repository<Product, string> {}
interface OrderRepository extends Repository<Order, string> {}
interface CartRepository extends Repository<Cart, string> { findByUserId(userId: string): Promise<Cart | null> }

function createInMemoryRepo<T extends { id: string }>(): Repository<T, string> & { findAll(): T[] } {
  const store = new Map<string, T>()
  return {
    async findById(id: string) { return store.get(id) ?? null },
    async save(entity: T) { store.set(entity.id, entity) },
    findAll() { return Array.from(store.values()) },
  }
}

class PlaceOrderService {
  constructor(
    private productRepo: ProductRepository,
    private orderRepo: OrderRepository,
    private cartRepo: CartRepository
  ) {}

  async execute(userId: string, address: Address): Promise<Order> {
    const cart = await this.cartRepo.findByUserId(userId)
    if (!cart || cart.items.length === 0) throw new Error('购物车为空')

    for (const item of cart.items) {
      const product = await this.productRepo.findById(item.productId)
      if (!product || !product.isAvailable(item.quantity)) throw new Error(`商品 ${item.productId} 库存不足`)
    }

    const order = Order.create(`order_${Date.now()}`, userId, address)
    for (const item of cart.items) order.addItem({ productId: item.productId, productName: item.productName, price: item.price, quantity: item.quantity })
    order.place()
    await this.orderRepo.save(order)
    cart.clear()
    await this.cartRepo.save(cart)
    return order
  }
}
```

## 五、组装与运行

```typescript
async function runEcommerceDemo() {
  const productRepo = createInMemoryRepo<Product>() as ProductRepository
  const orderRepo = createInMemoryRepo<Order>() as OrderRepository
  const cartStore = createInMemoryRepo<Cart>()
  const cartRepo: CartRepository = { ...cartStore, async findByUserId(userId: string) { return cartStore.findAll().find(c => c.props.userId === userId) ?? null } }

  const product1 = Product.create('p1', 'TypeScript 实战指南', Money.create(99, 'CNY'), '书籍')
  product1.replenish(100); product1.activate()
  await productRepo.save(product1)

  const cart = Cart.create('cart_1', 'user_001')
  cart.addItem('p1', 'TypeScript 实战指南', Money.create(99, 'CNY'), 2)
  await cartRepo.save(cart)

  const address = Address.create({ province: '北京市', city: '北京市', district: '朝阳区', detail: 'xxx路100号', phone: '13800138000' })
  const service = new PlaceOrderService(productRepo, orderRepo, cartRepo)
  const order = await service.execute('user_001', address)

  order.pay(Money.create(198, 'CNY'))
  await orderRepo.save(order)

  console.log(`状态: ${order.status}, 总额: ${order.total.toString()}`)
  for (const event of order.pullDomainEvents()) console.log(`[${event.eventType}] ${event.occurredAt.toISOString()}`)
}

runEcommerceDemo().catch(console.error)
```

## 常见误区

1. **Repository 直接返回数据库模型**：应返回领域对象，数据库模型与领域模型解耦
2. **聚合根之间直接引用**：聚合间只通过 ID 引用，不持有对方实例
3. **领域事件同步处理**：事件应异步处理，保证最终一致性
4. **忽略不变量检查**：每个状态修改都必须检查业务规则

## 工程建议

1. **一个聚合一个 Repository**：不要在一个 Repository 中操作多个聚合
2. **事件存储用于审计**：把领域事件持久化，用于调试和审计追踪
3. **用 ID 引用其他聚合**：Order 只存 userId，不存整个 User 对象
4. **测试领域模型不需要数据库**：纯领域逻辑可以用内存 Repository 测试

## 小结

本课通过电商领域模型的完整实现，展示了 DDD 战术模式的实际应用。核心要点：值对象保证不可变和值相等，实体保证身份标识，聚合根保护业务不变量，领域事件解耦聚合通信，Repository 隔离持久化。这套模式让业务规则内聚在领域模型中。

## 练习

### 练习一：退款服务

实现 `RefundService`，支持订单退款：验证订单状态、发布退款事件。

### 练习二：库存预留机制

修改 `PlaceOrderService`，在下单时预留库存，支付失败时释放预留。

### 练习三：事件溯源

实现一个 `EventStore`，把领域事件持久化，支持通过重放事件重建聚合状态。

---

## 参考答案

### 练习一

**思路**：退款服务检查订单状态（必须是已支付），发布退款事件。

**答案**：

```typescript
class RefundRequestedEvent implements DomainEvent {
  readonly eventType = 'order.refundRequested'; readonly occurredAt = new Date()
  constructor(readonly aggregateId: string, readonly refundAmount: number, readonly reason: string) {}
}

class RefundService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(orderId: string, reason: string): Promise<{ orderId: string; amount: Money }> {
    const order = await this.orderRepo.findById(orderId)
    if (!order) throw new Error('订单不存在')
    if (order.status !== 'paid') throw new Error(`订单状态 ${order.status} 不可退款`)
    if (!reason.trim()) throw new Error('退款原因不能为空')
    order.cancel()
    order.addDomainEvent(new RefundRequestedEvent(orderId, order.total.amount, reason))
    await this.orderRepo.save(order)
    return { orderId, amount: order.total }
  }
}
```

**要点**：只有已支付订单才能退款，退款时订单状态变为 cancelled。

### 练习二

**思路**：下单时预留库存，失败时释放所有已预留库存。

**答案**：

```typescript
class PlaceOrderWithReservationService {
  constructor(private productRepo: ProductRepository, private orderRepo: OrderRepository, private cartRepo: CartRepository) {}

  async execute(userId: string, address: Address): Promise<Order> {
    const cart = await this.cartRepo.findByUserId(userId)
    if (!cart || cart.items.length === 0) throw new Error('购物车为空')
    const reserved: Array<{ product: Product; qty: number }> = []
    try {
      for (const item of cart.items) {
        const product = await this.productRepo.findById(item.productId)
        if (!product || !product.isAvailable(item.quantity)) throw new Error(`商品 ${item.productId} 库存不足`)
        product.reserve(item.quantity)
        await this.productRepo.save(product)
        reserved.push({ product, qty: item.quantity })
      }
      const order = Order.create(`order_${Date.now()}`, userId, address)
      for (const item of cart.items) order.addItem({ productId: item.productId, productName: item.productName, price: item.price, quantity: item.quantity })
      order.place()
      await this.orderRepo.save(order)
      cart.clear(); await this.cartRepo.save(cart)
      return order
    } catch (error) {
      for (const { product, qty } of reserved) { product.release(qty); await this.productRepo.save(product) }
      throw error
    }
  }
}
```

**要点**：try-catch 确保事务补偿性，失败时释放所有已预留库存。

### 练习三

**思路**：EventStore 存储事件，通过重放事件序列重建聚合状态。

**答案**：

```typescript
interface StoredEvent { aggregateId: string; eventType: string; payload: unknown; occurredAt: Date; version: number }

class EventStore {
  private events = new Map<string, StoredEvent[]>()
  private versions = new Map<string, number>()

  append(event: DomainEvent): void {
    const ver = (this.versions.get(event.aggregateId) ?? 0) + 1
    if (!this.events.has(event.aggregateId)) this.events.set(event.aggregateId, [])
    this.events.get(event.aggregateId)!.push({ aggregateId: event.aggregateId, eventType: event.eventType, payload: event, occurredAt: event.occurredAt, version: ver })
    this.versions.set(event.aggregateId, ver)
  }

  getEvents(aggregateId: string): StoredEvent[] { return this.events.get(aggregateId) ?? [] }
}

function rebuildOrder(orderId: string, store: EventStore): Order {
  const events = store.getEvents(orderId)
  if (events.length === 0) throw new Error('事件不存在')
  const first = events[0].payload as OrderPlacedEvent
  const addr = Address.create({ province: '北京市', city: '北京市', district: '朝阳区', detail: 'xxx路', phone: '13800138000' })
  const order = Order.create(orderId, first.userId, addr)
  for (const stored of events.slice(1)) {
    if (stored.eventType === 'order.paid') order.pay(Money.create((stored.payload as OrderPaidEvent).paidAmount, 'CNY'))
  }
  return order
}
```

**要点**：每个事件带版本号保证顺序，重建时按事件序列重放恢复聚合状态。

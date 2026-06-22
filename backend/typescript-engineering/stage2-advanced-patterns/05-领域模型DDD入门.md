# 05 - 领域模型 DDD 入门

## 场景引入

你在开发一个电商系统，订单状态有"待支付"、"已支付"、"已发货"、"已完成"、"已取消"。直接用字符串表示状态，结果某天有人写了 `order.status = 'shipped'`（拼错了），或者在"已取消"的订单上调用了 `order.ship()`。这些业务规则散落在各个 service 文件里。DDD 的 Entity 和 Value Object 就是要把业务规则封装到领域模型里。

## 学习目标

- 理解 Entity 的身份标识与 Value Object 的值相等
- 掌握 Aggregate Root 的不变量保护机制
- 学会用领域事件解耦聚合间的通信
- 用 DDD 战术模式构建订单领域模型

## 一、Entity：身份标识决定相等性

Entity 有唯一标识，两个 Entity 即使所有属性相同，只要 ID 不同就是不同的实体：

```typescript
abstract class ValueObject<T> {
  protected readonly props: T
  constructor(props: T) { this.props = Object.freeze(props) }
  equals(other: ValueObject<T>): boolean {
    if (!other) return false
    return JSON.stringify(this.props) === JSON.stringify(other.props)
  }
}

abstract class Entity<T, ID> {
  protected readonly _id: ID
  protected props: T
  constructor(id: ID, props: T) { this._id = id; this.props = props }
  get id(): ID { return this._id }
  equals(other: Entity<T, ID>): boolean {
    if (!other) return false
    return this._id === other._id
  }
}

class UserId extends ValueObject<{ value: string }> {
  static create(value: string): UserId {
    if (!value) throw new Error('UserId 不能为空')
    return new UserId({ value })
  }
  get value(): string { return this.props.value }
}

interface UserProps { name: string; email: string; createdAt: Date }

class User extends Entity<UserProps, UserId> {
  static create(id: UserId, name: string, email: string): User {
    if (!email.includes('@')) throw new Error('邮箱格式不正确')
    return new User(id, { name, email, createdAt: new Date() })
  }
  get name() { return this.props.name }
  get email() { return this.props.email }
  changeName(newName: string): void {
    if (!newName.trim()) throw new Error('用户名不能为空')
    this.props.name = newName
  }
}

const user1 = User.create(UserId.create('u1'), '张三', 'zhangsan@example.com')
const user2 = User.create(UserId.create('u1'), '李四', 'lisi@example.com')
const user3 = User.create(UserId.create('u2'), '张三', 'zhangsan@example.com')
console.log(user1.equals(user2)) // true（同一用户，ID 相同）
console.log(user1.equals(user3)) // false（不同用户，ID 不同）
```

## 二、Value Object：值决定相等性

Value Object 没有标识，只要所有属性相同就相等，且不可变：

```typescript
class Money extends ValueObject<{ amount: number; currency: string }> {
  static create(amount: number, currency: string): Money {
    if (amount < 0) throw new Error('金额不能为负')
    return new Money({ amount, currency })
  }
  get amount() { return this.props.amount }
  get currency() { return this.props.currency }
  add(other: Money): Money { if (this.currency !== other.currency) throw new Error('不能相加不同币种'); return Money.create(this.amount + other.amount, this.currency) }
  multiply(factor: number): Money { return Money.create(this.amount * factor, this.currency) }
  subtract(other: Money): Money { if (this.currency !== other.currency) throw new Error('不能相减不同币种'); if (this.amount < other.amount) throw new Error('余额不足'); return Money.create(this.amount - other.amount, this.currency) }
  toString() { return `${this.currency} ${this.amount.toFixed(2)}` }
}

class Address extends ValueObject<{ province: string; city: string; district: string; detail: string; phone: string }> {
  static create(p: { province: string; city: string; district: string; detail: string; phone: string }): Address {
    if (!p.phone.match(/^1\d{10}$/)) throw new Error('手机号格式不正确'); return new Address(p)
  }
  get fullAddress() { return `${this.props.province}${this.props.city}${this.props.district}${this.props.detail}` }
}

const price1 = Money.create(100, 'CNY')
const price2 = Money.create(100, 'CNY')
console.log(price1.equals(price2)) // true（值相等）
console.log(price1.add(price2).toString()) // 'CNY 200.00'
```

## 三、Aggregate Root 与领域事件

Aggregate Root 是一组相关对象的入口点，负责保护业务不变量：

```typescript
interface DomainEvent {
  readonly eventType: string
  readonly occurredAt: Date
  readonly aggregateId: string
}

class OrderPaidEvent implements DomainEvent {
  readonly eventType = 'order.paid'
  readonly occurredAt = new Date()
  constructor(readonly aggregateId: string, readonly paidAmount: number) {}
}

type OrderStatusValue = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'

class OrderStatus extends ValueObject<{ value: OrderStatusValue }> {
  static create(value: OrderStatusValue) { return new OrderStatus({ value }) }
  get value() { return this.props.value }
  canTransitionTo(next: OrderStatusValue): boolean {
    const map: Record<OrderStatusValue, OrderStatusValue[]> = {
      pending: ['paid', 'cancelled'],
      paid: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
    }
    return map[this.value].includes(next)
  }
}

interface OrderItemProps {
  productId: string; productName: string; price: Money; quantity: number
}

class OrderItem extends Entity<OrderItemProps, string> {
  static create(id: string, productId: string, name: string, price: Money, qty: number): OrderItem {
    if (qty <= 0) throw new Error('数量必须大于 0')
    return new OrderItem(id, { productId, productName: name, price, quantity: qty })
  }
  get subtotal() { return this.props.price.multiply(this.props.quantity) }
  get productId() { return this.props.productId }
  get quantity() { return this.props.quantity }
}

interface OrderProps {
  userId: string; items: OrderItem[]; shippingAddress: Address; status: OrderStatus; createdAt: Date
}

class Order extends Entity<OrderProps, string> {
  private domainEvents: DomainEvent[] = []

  static create(id: string, userId: string, address: Address): Order {
    return new Order(id, {
      userId, items: [], shippingAddress: address,
      status: OrderStatus.create('pending'), createdAt: new Date(),
    })
  }

  get status() { return this.props.status.value }
  get total(): Money {
    return this.props.items.reduce((sum, item) => sum.add(item.subtotal), Money.create(0, 'CNY'))
  }
  get items(): readonly OrderItem[] { return [...this.props.items] }

  addItem(item: OrderItem): void {
    if (this.status !== 'pending') throw new Error('只有待支付订单才能添加商品')
    const existing = this.props.items.find(i => i.productId === item.productId)
    if (existing) throw new Error('商品已存在，请修改数量')
    this.props.items.push(item)
  }

  pay(amount: Money): void {
    if (!this.props.status.canTransitionTo('paid')) throw new Error(`无法从 ${this.status} 转换到 paid`)
    if (amount.amount < this.total.amount) throw new Error(`支付金额不足，需要 ${this.total}`)
    this.props.status = OrderStatus.create('paid')
    this.domainEvents.push(new OrderPaidEvent(this.id, amount.amount))
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents]
    this.domainEvents = []
    return events
  }
}

const order = Order.create('order_001', 'user_001', Address.create({
  province: '北京市', city: '北京市', district: '朝阳区', detail: 'xxx路100号', phone: '13800138000',
}))

order.addItem(OrderItem.create('item_1', 'prod_001', 'TypeScript 实战', Money.create(99, 'CNY'), 2))
console.log(order.total.toString()) // 'CNY 198.00'
order.pay(Money.create(198, 'CNY'))
console.log(order.status) // 'paid'
console.log(order.pullDomainEvents()[0].eventType) // 'order.paid'
```

## 常见误区

1. **把 Entity 当数据库表映射**：Entity 封装的是业务规则，不一定对应数据库列
2. **Value Object 用 class 而非 readonly 结构**：值对象必须不可变，修改返回新实例
3. **绕过 Aggregate Root 直接操作内部实体**：外部只能通过聚合根修改内部状态
4. **在聚合根里做持久化**：聚合根只关心业务逻辑，持久化交给 Repository

## 工程建议

1. **聚合根的事务边界**：一个聚合根对应一个事务，不要在一个事务中修改多个聚合
2. **领域事件用于最终一致性**：聚合间通过事件通信，不要直接引用其他聚合
3. **值对象优先**：能用值对象表示的就不用实体，值对象更简单、更安全
4. **聚合根 ID 用 UUID**：避免数据库自增 ID 泄露业务信息

## 小结

DDD 的核心是把业务规则封装到领域模型中。Entity 用身份标识区分，Value Object 用值区分且不可变，Aggregate Root 保护一组相关对象的业务不变量。领域事件让聚合间松耦合通信。这套模式让"订单状态转换规则"内聚在 Order 聚合根里。

## 练习

### 练习一：商品领域模型

设计 Product Entity 和 Price Value Object，支持价格调整（只允许涨价，不允许降价超过 10%）。

### 练习二：购物车聚合根

实现 Cart 聚合根，支持添加商品、移除商品、修改数量，保护"同一商品不能重复添加"的不变量。

### 练习三：库存聚合根

实现 Inventory 聚合根，支持预留库存、释放库存、扣减库存，确保库存不会出现负数。

---

## 参考答案

### 练习一

**思路**：Product 是 Entity，Price 是 Value Object。价格调整规则封装在 Product 中。

**答案**：

```typescript
class Price extends ValueObject<{ amount: number; currency: string }> {
  static create(amount: number, currency: string): Price {
    if (amount < 0) throw new Error('价格不能为负')
    return new Price({ amount, currency })
  }
  get amount() { return this.props.amount }
  get currency() { return this.props.currency }
}

interface ProductProps { name: string; price: Price; category: string }

class Product extends Entity<ProductProps, string> {
  static create(id: string, name: string, price: Price, category: string): Product {
    if (!name.trim()) throw new Error('商品名不能为空')
    return new Product(id, { name, price, category })
  }
  get price() { return this.props.price }

  adjustPrice(newPrice: Price): void {
    const minAllowed = this.props.price.amount * 0.9
    if (newPrice.amount < minAllowed) throw new Error(`降价不能超过 10%，最低价: ${minAllowed}`)
    this.props.price = newPrice
  }
}

const product = Product.create('p1', '商品A', Price.create(100, 'CNY'), '电子')
product.adjustPrice(Price.create(90, 'CNY'))  // ✅ 降价 10%
// product.adjustPrice(Price.create(80, 'CNY')) // ❌ 降价超过 10%
```

**要点**：价格调整规则（10%限制）封装在 Product 实体内，不在 service 中。

### 练习二

**思路**：Cart 是聚合根，确保商品不重复。

**答案**：

```typescript
interface CartItemData { productId: string; productName: string; price: Money; quantity: number }

class Cart extends Entity<{ userId: string; items: CartItemData[] }, string> {
  static create(id: string, userId: string): Cart { return new Cart(id, { userId, items: [] }) }
  get items(): readonly CartItemData[] { return [...this.props.items] }
  get total(): Money { return this.props.items.reduce((sum, i) => sum.add(i.price.multiply(i.quantity)), Money.create(0, 'CNY')) }

  addItem(productId: string, name: string, price: Money, qty: number): void {
    if (this.props.items.find(i => i.productId === productId)) throw new Error(`商品 ${productId} 已在购物车中`)
    this.props.items.push({ productId, productName: name, price, quantity: qty })
  }
  removeItem(productId: string): void {
    const idx = this.props.items.findIndex(i => i.productId === productId)
    if (idx < 0) throw new Error('购物车中无此商品'); this.props.items.splice(idx, 1)
  }
  changeQuantity(productId: string, quantity: number): void {
    const item = this.props.items.find(i => i.productId === productId)
    if (!item) throw new Error('购物车中无此商品')
    if (quantity <= 0) throw new Error('数量必须大于 0'); item.quantity = quantity
  }
}
```

**要点**：`addItem` 检查不重复，保护聚合不变量。所有修改通过聚合根操作。

### 练习三

**思路**：Inventory 是聚合根，预留/释放/扣减三种操作保护库存不为负。

**答案**：

```typescript
class Inventory extends Entity<{ productId: string; totalQuantity: number; reservedQuantity: number }, string> {
  static create(id: string, productId: string, quantity: number): Inventory {
    if (quantity < 0) throw new Error('库存不能为负')
    return new Inventory(id, { productId, totalQuantity: quantity, reservedQuantity: 0 })
  }
  get available() { return this.props.totalQuantity - this.props.reservedQuantity }

  reserve(quantity: number): void {
    if (quantity > this.available) throw new Error(`可用库存 ${this.available}，不足预留 ${quantity}`)
    this.props.reservedQuantity += quantity
  }
  release(quantity: number): void {
    if (quantity > this.props.reservedQuantity) throw new Error(`预留库存不足，无法释放 ${quantity}`)
    this.props.reservedQuantity -= quantity
  }
  deduct(quantity: number): void {
    if (quantity > this.props.reservedQuantity) throw new Error(`预留库存不足，无法扣减 ${quantity}`)
    this.props.totalQuantity -= quantity; this.props.reservedQuantity -= quantity
  }
}

const inv = Inventory.create('inv_1', 'p1', 100)
inv.reserve(30); console.log(inv.available) // 70
inv.release(10); console.log(inv.available) // 80
inv.deduct(20); console.log(inv.available)  // 60
```

**要点**：所有操作都检查不变量，确保库存不为负。`deduct` 同时减少总库存和预留库存。

# API 设计原则

## 场景引入

你正在开发一个电商系统的后端服务。前端团队需要获取商品详情，后端返回了一个嵌套了十几层的 JSON 对象，字段名有的用驼峰、有的用下划线，有些接口用 GET、有些用 POST 做查询。前端团队抱怨接口难用，后端团队说"能用就行"。

三个月后，系统要接入移动端 App 和第三方合作伙伴，接口要改。但因为没有版本管理，改一个字段就导致所有客户端崩溃。

API 是系统与外界交互的契约。设计得好，前后端协作顺畅、第三方接入成本低；设计得差，每次改动都是一场灾难。本节课对比 RESTful、GraphQL、gRPC 三种主流 API 设计方案，帮你选择合适的方案并设计出高质量的接口。

## 学习目标

- 掌握 RESTful API 的设计规范，包括资源命名、HTTP 方法和状态码的正确使用
- 理解 GraphQL 的 schema 设计与 N+1 查询问题
- 了解 gRPC 的 protobuf 定义与流式通信模式
- 能根据业务场景选择合适的 API 方案
- 掌握 API 版本管理策略与 OpenAPI 文档规范

## REST vs GraphQL vs gRPC 架构对比

```
┌──────────────────────────────────────────────────────────────┐
│                    三种 API 方案架构对比                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  RESTful API                                                 │
│  ┌────────┐    HTTP/JSON     ┌────────┐                     │
│  │ Client │ ──────────────→  │ Server │                     │
│  └────────┘   GET /users/1   └────────┘                     │
│               POST /orders    多个端点                       │
│               PUT /users/1    固定响应结构                    │
│               DELETE /users/1                                │
│                                                              │
│  GraphQL                                                    │
│  ┌────────┐    HTTP/POST     ┌────────┐    ┌────────┐      │
│  │ Client │ ──────────────→  │GraphQL │──→ │ 多个   │      │
│  └────────┘   query {        │Server  │    │数据源  │      │
│               user(id:1)     └────────┘    └────────┘      │
│                {name email}   单一端点                        │
│               }              按需返回字段                     │
│                                                              │
│  gRPC                                                       │
│  ┌────────┐   HTTP/2 + PB    ┌────────┐                     │
│  │ Client │ ═══════════════→ │ Server │                     │
│  └────────┘   binary proto   └────────┘                     │
│               .proto 文件     强类型契约                      │
│               双向流           高性能                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## RESTful 设计规范

REST（Representational State Transfer）是最常见的 API 设计风格。核心思想是：**万物皆资源，用 HTTP 方法操作资源**。

### 资源命名

```
✅ 正确：
GET    /api/v1/users              获取用户列表
GET    /api/v1/users/123          获取用户 123
POST   /api/v1/users              创建用户
PUT    /api/v1/users/123          更新用户 123
DELETE /api/v1/users/123          删除用户 123
GET    /api/v1/users/123/orders   获取用户 123 的订单

❌ 错误：
GET    /api/v1/getUser            不要用动词
GET    /api/v1/user               不要用单数
POST   /api/v1/deleteUser         不要用 POST 做删除
GET    /api/v1/users/123/delete   不要在 URL 中放动词
```

命名规则：
- 使用名词复数，不用动词
- 使用小写字母和连字符（kebab-case）
- 层级关系用嵌套路径表示，但不超过 3 层
- 用查询参数做过滤、排序、分页：`/users?role=admin&sort=-created_at&page=2`

### HTTP 方法语义

| 方法 | 语义 | 幂等性 | 安全性 |
|------|------|--------|--------|
| GET | 获取资源 | 是 | 是 |
| POST | 创建资源 | 否 | 否 |
| PUT | 全量替换资源 | 是 | 否 |
| PATCH | 部分更新资源 | 否 | 否 |
| DELETE | 删除资源 | 是 | 否 |

幂等性意味着同一个请求执行多次，结果和执行一次相同。这个特性在分布式系统中非常重要——网络超时重试时，幂等操作不会导致数据不一致。

### 状态码使用

```
2xx 成功：
  200 OK                  请求成功
  201 Created             资源创建成功（配合 POST）
  204 No Content          删除成功，无返回体

3xx 重定向：
  301 Moved Permanently   资源永久迁移
  304 Not Modified        缓存未过期

4xx 客户端错误：
  400 Bad Request         请求参数错误
  401 Unauthorized        未认证
  403 Forbidden           无权限
  404 Not Found           资源不存在
  409 Conflict            资源冲突（如重复创建）
  429 Too Many Requests   触发限流

5xx 服务端错误：
  500 Internal Error      服务器内部错误
  502 Bad Gateway         网关错误
  503 Service Unavailable 服务不可用
```

## GraphQL Schema 设计

GraphQL 由 Facebook 推出，核心特点是**客户端按需查询，一个端点获取所有数据**。

### Schema 定义

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  orders: [Order!]!
}

type Order {
  id: ID!
  total: Float!
  items: [OrderItem!]!
  createdAt: DateTime!
}

type Query {
  user(id: ID!): User
  users(filter: UserFilter, page: Int): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  placeOrder(input: PlaceOrderInput!): Order!
}
```

### N+1 问题

GraphQL 最大的性能陷阱是 N+1 查询。当查询用户列表及其订单时：

```
查询：{ users { id name orders { id total } } }

执行过程：
  1. SELECT * FROM users              （1 次查询）
  2. SELECT * FROM orders WHERE user_id = 1  （N 次查询）
     SELECT * FROM orders WHERE user_id = 2
     SELECT * FROM orders WHERE user_id = 3
     ...

解决：DataLoader 批量加载
  1. SELECT * FROM users
  2. SELECT * FROM orders WHERE user_id IN (1, 2, 3, ...)
```

DataLoader 将同一个 tick 内的所有单次查询合并为一次批量查询，是解决 N+1 的标准方案。

## gRPC 与 Protobuf

gRPC 是 Google 推出的高性能 RPC 框架，使用 Protocol Buffers 作为序列化格式。

### Proto 定义

```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);
  rpc Chat (stream Message) returns (stream Message);
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
}
```

### 四种通信模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| Unary | 一问一答 | 普通 RPC 调用 |
| Server Streaming | 客户端发一次，服务端返回流 | 实时推送、日志流 |
| Client Streaming | 客户端发流，服务端返回一次 | 文件上传、批量数据 |
| Bidirectional Streaming | 双向流 | 即时通讯、实时协作 |

gRPC 的优势在于：二进制序列化（比 JSON 小 3~10 倍）、HTTP/2 多路复用、强类型契约。但它不适合浏览器直接调用（需要 gRPC-Web 代理），调试也不如 JSON 直观。

## 三种方案对比

| 维度 | REST | GraphQL | gRPC |
|------|------|---------|------|
| 协议 | HTTP/1.1 | HTTP/1.1 或 2 | HTTP/2 |
| 数据格式 | JSON | JSON | Protobuf（二进制） |
| 类型系统 | 无（靠文档） | 强类型 Schema | 强类型 Proto |
| 过度获取 | 常见 | 按需查询 | 由 proto 决定 |
| 学习成本 | 低 | 中 | 高 |
| 浏览器支持 | 原生支持 | 原生支持 | 需要 gRPC-Web |
| 性能 | 一般 | 一般（N+1） | 高 |
| 适用场景 | 公开 API、简单 CRUD | 移动端、复杂查询 | 微服务内部通信 |

选型建议：
- **对外公开 API** → REST（生态成熟、文档友好）
- **移动端 BFF** → GraphQL（减少网络请求、按需获取）
- **微服务间通信** → gRPC（高性能、强类型）

## API 版本管理

当 API 需要不兼容的变更时，必须通过版本管理保证旧客户端不受影响。

### URL 路径版本（推荐）

```
GET /api/v1/users/123
GET /api/v2/users/123
```

优点：直观、容易路由。缺点：URL 变长。

### Header 版本

```
GET /api/users/123
Accept: application/vnd.myapp.v2+json
```

优点：URL 干净。缺点：不直观，调试不便。

### 版本管理原则

- 优先考虑向后兼容（新增字段不破坏旧客户端）
- 必须做不兼容变更时才升版本
- 旧版本至少维护 6 个月，提前通知下线时间

## OpenAPI/Swagger 文档

OpenAPI 是 API 描述的行业标准。用 YAML 或 JSON 定义接口，可以自动生成文档、客户端 SDK 和测试用例。定义包括路径、参数、请求体、响应结构和错误码，是前后端协作的核心契约。

## 常见误区

1. **REST 就是用 HTTP + JSON**：REST 的核心是资源导向和统一接口，不是简单地用 HTTP 调用返回 JSON。把所有操作都塞进一个 POST 端点不是 REST。
2. **GraphQL 能替代 REST**：GraphQL 适合查询复杂的场景，但不适合文件上传、实时流等场景。两者不是替代关系，而是互补。
3. **gRPC 一定比 REST 快**：gRPC 在内部通信中确实更快，但对于浏览器客户端、简单 API，REST 的开发效率更高。
4. **版本号越大越好**：频繁升版本说明 API 设计不够稳定。优先通过向后兼容避免版本升级。
5. **返回所有字段**：REST API 返回大量客户端不需要的字段，浪费带宽。可以参考 GraphQL 的思路，支持字段过滤。
6. **忽略错误码设计**：只返回 HTTP 状态码不给业务错误码，客户端无法区分具体错误原因。应统一返回 `{ code, message, details }` 结构。
7. **文档与代码脱节**：接口改了但文档没更新，第三方开发者踩坑不断。用 OpenAPI 规范 + CI 自动生成文档，保证文档与代码同步。

## 工程建议

1. **API 先行**：在开发之前先定义 API 契约（OpenAPI 或 Proto 文件），前后端可以并行开发。
2. **统一错误格式**：所有 API 返回一致的错误结构：`{ "code": "INVALID_PARAM", "message": "用户名不能为空", "details": {...} }`。
3. **分页标准化**：列表接口必须支持分页，推荐游标分页（cursor-based）而非偏移分页（offset-based），尤其在数据频繁变动的场景。
4. **限流与幂等**：所有写操作考虑幂等性设计（幂等键），所有接口做限流保护。
5. **API 网关**：微服务架构中使用 API 网关统一管理认证、限流、日志、版本路由。
6. **超时与重试**：为所有 API 调用设置合理的超时时间（通常 3~5 秒），配合指数退避重试策略。幂等接口可以安全重试，非幂等接口要谨慎。
7. **向后兼容优先**：新增字段不要求客户端必须处理（optional），删除字段先标记 deprecated 给缓冲期。能不升版本就不升版本。

## 小结

本课对比了 REST、GraphQL、gRPC 三种 API 设计方案：

- REST 适合公开 API，资源导向、生态成熟
- GraphQL 适合复杂查询场景，按需获取、避免过度传输
- gRPC 适合微服务内部通信，高性能、强类型
- API 版本管理优先选择 URL 路径方式
- 用 OpenAPI 规范管理 API 文档，实现自动化

## 练习

### 练习一：RESTful API 设计

为一个在线书店系统设计 RESTful API，需要支持以下功能：浏览书籍列表、搜索书籍、查看书籍详情、下单购买、查看订单历史。请写出完整的 API 端点设计（包括 HTTP 方法、路径、查询参数）。

### 练习二：GraphQL Schema 设计

为一个博客平台设计 GraphQL Schema，需要支持：文章列表（含作者信息和评论数）、文章详情（含评论列表）、用户信息（含发表的文章列表）。注意避免 N+1 问题。

### 练习三：方案选型

一个公司的技术栈如下：
- 内部有 20 个微服务需要互相通信
- 需要对外提供公开 API 给第三方开发者
- 有一个 React Native 移动端 App

请为这三种场景分别推荐合适的 API 方案，并说明理由。

---

## 参考答案

### 练习一

**思路**：按资源（书籍、订单）划分，用正确的 HTTP 方法和嵌套路径。

**答案**：

```
书籍：GET /api/v1/books（列表）、GET /api/v1/books?q=xxx（搜索）、GET /api/v1/books/123（详情）
订单：POST /api/v1/orders（下单）、GET /api/v1/orders（订单历史）、GET /api/v1/orders/456（详情）
分页：GET /api/v1/books?page=2&limit=20，返回 { data, pagination: { page, limit, total, hasNext } }
```

**要点**：搜索用查询参数而非 `/searchBooks`；订单直接 `/orders`（通过认证确定用户）；列表必须返回分页信息。

### 练习二

**思路**：定义核心类型，使用 DataLoader 模式避免 N+1。

**答案**：

```graphql
type Post { id: ID! title: String! content: String! author: User! comments: [Comment!]! commentCount: Int! }
type User { id: ID! name: String! posts(page: Int): PostConnection! postCount: Int! }
type Comment { id: ID! content: String! author: User! createdAt: DateTime! }
```

**要点**：`author` 和 `comments` 通过 DataLoader 批量加载；`commentCount` 用独立字段存储避免 COUNT 查询；使用 Connection 模式实现游标分页。

### 练习三

**思路**：根据场景特点匹配方案。

**答案**：

1. **内部微服务 → gRPC**：高性能、强类型契约、不需要浏览器兼容
2. **对外公开 API → REST**：生态成熟、学习成本低、API 网关可做协议转换
3. **移动端 App → GraphQL**：减少请求次数、按需获取节省流量、BFF 模式实现

**要点**：一个系统中可以同时使用多种 API 方案，关键是在正确的场景使用正确的方案。

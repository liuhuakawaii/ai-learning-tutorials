# API 兼容层设计与实现

## 场景引入

你的团队正在将用户服务从旧的 REST API 迁移到新的 GraphQL 接口。旧 API 有 47 个下游消费者——移动端 App、管理后台、第三方合作伙伴。移动端需要走应用商店审核（至少两周），第三方需要走他们的发版流程。你不可能让所有消费者一夜之间全部切换。

如果直接切断旧 API，47 个消费者全部崩溃。你需要一个 **API 兼容层**：对外暴露旧接口，内部转发到新系统，再把响应回转成旧格式。旧消费者完全无感知，新系统独立演进。

## 学习目标

完成本课学习后，你将能够：

1. 理解 API 兼容层的本质和三种设计模式
2. 用 Node.js/Express 实现一个完整的 API 网关
3. 设计请求/响应的格式转换映射
4. 实现版本化 API 策略和灰度发布
5. 用 GraphQL 作为 API 兼容层

---

## 核心概念

### 兼容层的本质：翻译官

API 兼容层是一个**翻译官**——调用方说"旧方言"，服务端说"新方言"，兼容层做双向翻译。

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   旧消费者    │  旧格式  │   API 兼容层  │  新格式  │   新服务     │
│  (移动端App)  │ ──────> │  (翻译官)    │ ──────> │  (GraphQL)   │
│  (管理后台)   │ <────── │              │ <────── │              │
│  (第三方)     │  旧格式  │              │  新格式  │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

### 三种设计模式

**1. 代理模式（Proxy）**：只做请求转发，不做格式转换。适用于新旧 API 格式基本一致。

```
旧消费者 ──GET /api/v1/users──> 兼容层 ──GET /api/v2/users──> 新服务
         <──{users}────────────       <──{users}────────────
```

**2. 适配器模式（Adapter）**：做请求和响应的格式转换。适用于新旧 API 格式差异较大。

```
旧消费者 ──GET /api/v1/users──> 兼容层 ──query { users { id name } }──> 新服务(GraphQL)
         <──[{uid,uname}]─────       <──{data:{users:[{id,name}]}}─────
```

**3. 门面模式（Facade）**：聚合多个新服务的调用，对外暴露统一接口。适用于旧 API 是大接口，新系统拆成了微服务。

```
旧消费者 ──GET /api/v1/user-detail──> 兼容层 ──> 用户服务(基本信息)
                                       ├──> 订单服务(最近订单)
                                       └──> 积分服务(积分余额)
         <──{user,orders,points}────
```

选择策略：格式差异大→适配器模式；微服务拆分→门面模式；格式一致→代理模式。

---

## 实战：构建 API 兼容层

### 项目初始化

```bash
mkdir api-compat-layer && cd api-compat-layer
npm init -y
npm install express axios pino pino-pretty
```

### 网关核心实现

```javascript
// src/index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const SERVICES = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
};

// v1 路由：通过适配器转发到新服务
app.get('/api/v1/users', async (req, res) => {
  try {
    // 转换请求格式
    const newParams = {
      offset: ((req.query.page || 1) - 1) * (req.query.pageSize || 20),
      limit: parseInt(req.query.pageSize) || 20,
      search: req.query.keyword || undefined,
    };

    // 调用新服务
    const response = await axios.get(`${SERVICES.user}/api/v2/users`, { params: newParams });

    // 转换响应格式
    res.json({
      code: 0,
      data: {
        list: response.data.users.map(u => ({
          uid: u.id,
          uname: u.name,
          mobile: u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : '',
          reg_time: new Date(u.createdAt).toLocaleDateString('zh-CN'),
        })),
        total: response.data.totalCount,
      },
    });
  } catch (error) {
    console.error('兼容层转发失败:', error.message);
    res.status(502).json({ error: '服务暂时不可用' });
  }
});

app.get('/api/v1/users/:id', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.user}/api/v2/users/${req.params.id}`);
    const u = response.data;
    res.json({
      code: 0,
      data: {
        uid: u.id,
        uname: u.name,
        email: u.email,
        mobile: u.phone,
        address: u.address ? `${u.address.city} ${u.address.street}` : '',
      },
    });
  } catch (error) {
    res.status(error.response?.status || 502).json({ error: '服务暂时不可用' });
  }
});

// v2 路由：直连新服务
app.get('/api/v2/users', async (req, res) => {
  const response = await axios.get(`${SERVICES.user}/api/v2/users`, { params: req.query });
  res.json(response.data);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('API 兼容层运行在端口 3000'));
```

### 适配器模块化

将格式转换逻辑抽成独立模块，便于测试和维护：

```javascript
// src/adapters/user-adapter.js
function adaptUserListRequest(oldQuery) {
  return {
    offset: ((oldQuery.page || 1) - 1) * (oldQuery.pageSize || 20),
    limit: parseInt(oldQuery.pageSize) || 20,
    search: oldQuery.keyword || undefined,
  };
}

function adaptUserListResponse(newResponse) {
  return {
    code: 0,
    data: {
      list: newResponse.users.map(u => ({
        uid: u.id,
        uname: u.name,
        mobile: maskPhone(u.phone),
        reg_time: formatDate(u.createdAt),
      })),
      total: newResponse.totalCount,
    },
  };
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('zh-CN') : '';
}

module.exports = { adaptUserListRequest, adaptUserListResponse };
```

---

## 版本化 API 策略

**URL 版本**（推荐新手）：`GET /api/v1/users` vs `GET /api/v2/users`。直观、易调试、缓存友好。

**Header 版本**（适合成熟团队）：`Accept: application/vnd.myapp.v2+json`。URL 干净，但调试不直观。

推荐策略：迁移初期用 URL 版本降低沟通成本，稳定后过渡到 Header 版本。

---

## 灰度发布与流量切分

按用户 ID 哈希切分，保证同一用户始终走同一版本：

```javascript
function createTrafficSplitter(percentage) {
  return function split(req, res, next) {
    const userId = req.headers['x-user-id'] || req.ip;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    req.goNew = (Math.abs(hash) % 100) < percentage;
    req.grayMeta = { userId, hash: Math.abs(hash) % 100, threshold: percentage };
    next();
  };
}
```

灰度发布流程：0%（只监控）→ 1%（观察错误率）→ 10% → 50% → 100%（全量切换）→ 下线旧服务。

---

## GraphQL 作为 API 兼容层

GraphQL 天然适合作为兼容层，可以在一个查询里聚合多个数据源：

```javascript
const { ApolloServer, gql } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const axios = require('axios');

const typeDefs = gql`
  type User {
    uid: ID!
    uname: String!
    mobile: String
    email: String
  }
  type Query {
    users(page: Int, pageSize: Int, keyword: String): [User!]!
    userDetail(uid: ID!): User
  }
`;

const resolvers = {
  Query: {
    users: async (_, { page = 1, pageSize = 20, keyword }) => {
      const res = await axios.post('http://user-service/graphql', {
        query: `query { users(offset: ${(page-1)*pageSize}, limit: ${pageSize}, search: "${keyword}") { id name phone email } }`,
      });
      return res.data.data.users.map(u => ({
        uid: u.id, uname: u.name, mobile: u.phone, email: u.email,
      }));
    },
    userDetail: async (_, { uid }) => {
      const res = await axios.get(`http://user-service/api/v2/users/${uid}`);
      const u = res.data;
      return { uid: u.id, uname: u.name, mobile: u.phone, email: u.email };
    },
  },
};

async function main() {
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
  console.log(`GraphQL 兼容层运行在 ${url}`);
}
main();
```

---

## 监控与回滚

兼容层是所有流量的必经之路，必须有完善的可观测性：

```javascript
const metrics = { v1: 0, v2: 0, errors: 0, latencies: [] };

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const version = req.path.includes('/v1/') ? 'v1' : 'v2';
  metrics[version]++;

  res.on('finish', () => {
    metrics.latencies.push({ version, duration: Date.now() - start });
    if (res.statusCode >= 500) metrics.errors++;
  });
  next();
}

app.get('/metrics', (req, res) => {
  const avgV1 = avg(metrics.latencies.filter(l => l.version === 'v1').map(l => l.duration));
  const avgV2 = avg(metrics.latencies.filter(l => l.version === 'v2').map(l => l.duration));
  res.json({ requests: { v1: metrics.v1, v2: metrics.v2 }, errors: metrics.errors, avgLatency: { v1: avgV1, v2: avgV2 } });
});

function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }
```

回滚策略：当新服务出问题时，通过环境变量动态切换到旧服务，无需重启。

---

## 常见误区

**误区一：兼容层长期存在，变成新债。** 兼容层是临时设施，必须设过期日期，到期强制下线。

**误区二：不做监控。** 兼容层是所有流量的必经之路，必须监控延迟、错误率、流量比例。

**误区三：兼容层承担业务逻辑。** 兼容层只做格式转换和路由分发，不应该包含业务规则。

**误区四：忽略超时。** 调用新服务必须设超时（建议 3 秒），否则新服务挂了会拖垮兼容层。

---

## 小结

- API 兼容层是新旧系统之间的翻译官，让迁移可以渐进进行
- 三种模式：代理（格式一致）、适配器（格式不同）、门面（聚合多个服务）
- 版本化 API 推荐先用 URL 版本，灰度发布按用户 ID 哈希切分
- GraphQL 天然适合作为兼容层，一个查询聚合多个数据源
- 兼容层必须有监控、日志、回滚能力，且应该设过期日期

## 练习

### 练习一：设计 API 兼容层

你的团队要把订单 API 从 REST 迁移到 GraphQL。旧 API 有以下接口：

```
GET /api/v1/orders?status=pending&page=1&size=20
POST /api/v1/orders
GET /api/v1/orders/:id
```

请设计一个 API 兼容层：选择合适的模式，画出请求流转图，写出 `GET /api/v1/orders` 的适配器代码。

### 练习二：实现灰度发布

为上述兼容层实现灰度发布策略：按用户 ID 哈希切分流量，支持通过配置文件调整切分比例，记录每个请求的路由决策。

---

## 参考答案

### 练习一

**思路**：旧 REST API 和 GraphQL 格式差异大，选择适配器模式。兼容层接收 REST 请求，转换为 GraphQL 查询，再把响应回转。

**答案**：

```javascript
function adaptOrderListRequest(query) {
  const statusMap = { pending: 'PENDING', paid: 'PAID', shipped: 'SHIPPED' };
  return {
    query: `query Orders($filter: OrderFilter, $page: Int, $size: Int) {
      orders(filter: $filter, page: $page, size: $size) {
        id status totalAmount createdAt
      }
    }`,
    variables: {
      filter: { status: statusMap[query.status] },
      page: parseInt(query.page) || 1,
      size: parseInt(query.size) || 20,
    },
  };
}

function adaptOrderListResponse(gqlResponse) {
  return {
    code: 0,
    data: {
      list: gqlResponse.data.orders.map(o => ({
        order_id: o.id,
        status: o.status.toLowerCase(),
        total: o.totalAmount,
        created_at: o.createdAt,
      })),
      total: gqlResponse.data.orders.length,
    },
  };
}
```

**要点**：适配器负责双向转换；状态枚举需要映射（小写→大写）；保留旧 API 的 code+data 结构。

### 练习二

**思路**：用用户 ID 哈希取模实现确定性路由，用 `fs.watch` 监听配置文件变化支持热更新。

**答案**：

```javascript
const fs = require('fs');

function createGrayRelease(configPath) {
  let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  fs.watch(configPath, () => {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('灰度配置已更新:', config);
  });

  return function grayRelease(req, res, next) {
    const userId = req.headers['x-user-id'] || req.ip;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    req.grayMeta = {
      userId,
      hash: Math.abs(hash) % 100,
      threshold: config.percentage,
      target: (Math.abs(hash) % 100) < config.percentage ? 'new' : 'old',
    };
    console.log(JSON.stringify({ type: 'routing_decision', ...req.grayMeta }));
    next();
  };
}
```

**要点**：`fs.watch` 支持热更新无需重启；路由决策写入日志便于排查；同一用户始终走同一版本。

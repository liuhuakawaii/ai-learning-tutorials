# 第五课：支付与 CRM 集成

> **课程定位**：在 n8n 中集成 Stripe 支付和 HubSpot/Salesforce CRM，实现业务自动化
> **前置知识**：了解支付和 CRM 概念
> **预计时长**：35 分钟

---

## 场景引入

你的 SaaS 产品用 Stripe 处理支付，用 HubSpot 管理客户关系。你需要自动化：新订阅 → 创建 CRM 记录、支付失败 → 通知客户、订阅取消 → 更新 CRM 状态、客户升级 → 同步到 CRM。

---

## 学习目标

完成本课学习后，你将能够：

1. 配置 Stripe 凭证和 Webhook
2. 处理支付事件（订阅、退款、失败）
3. 集成 HubSpot/Salesforce CRM
4. 实现支付和 CRM 的双向同步

---

## 一、Stripe 集成

### 1.1 配置凭证

```json
{
  "name": "Stripe API",
  "secretKey": "sk_live_xxxxx"
}
```

### 1.2 Webhook 事件

Stripe 通过 Webhook 推送事件：

| 事件 | 说明 |
|------|------|
| `customer.subscription.created` | 新订阅 |
| `customer.subscription.updated` | 订阅变更 |
| `customer.subscription.deleted` | 订阅取消 |
| `invoice.payment_succeeded` | 支付成功 |
| `invoice.payment_failed` | 支付失败 |
| `charge.refunded` | 退款 |

### 1.3 处理订阅事件

```
Webhook（Stripe 事件）
    ↓
Code（验证签名）
    ↓
Switch（事件类型）
    ├─ subscription.created → 创建 CRM 记录
    ├─ subscription.updated → 更新 CRM
    ├─ subscription.deleted → 标记流失
    ├─ payment_succeeded → 发送收据
    └─ payment_failed → 通知客户
```

### 1.4 签名验证

```javascript
// Code 节点：验证 Stripe Webhook 签名
const crypto = require('crypto');

const payload = JSON.stringify($input.first().json.body);
const sig = $input.first().json.headers['stripe-signature'];
const secret = 'whsec_xxxxx';

const elements = sig.split(',').reduce((acc, el) => {
  const [key, value] = el.split('=');
  acc[key] = value;
  return acc;
}, {});

const expectedSig = crypto
  .createHmac('sha256', secret)
  .update(elements.t + '.' + payload)
  .digest('hex');

if (expectedSig !== elements.v1) {
  throw new Error('Webhook 签名验证失败');
}

return [{ json: $input.first().json.body }];
```

### 1.5 查询客户和订阅

```json
{
  "resource": "customer",
  "operation": "get",
  "customerId": "={{ $json.customer_id }}"
}
```

```json
{
  "resource": "subscription",
  "operation": "getAll",
  "customerId": "={{ $json.customer_id }}"
}
```

---

## 二、HubSpot 集成

### 2.1 配置凭证

使用 HubSpot API Key 或 OAuth2：

```json
{
  "name": "HubSpot API",
  "apiKey": "pat-na1-xxxxx"
}
```

### 2.2 创建联系人

```json
{
  "resource": "contact",
  "operation": "create",
  "properties": {
    "email": "={{ $json.customer_email }}",
    "firstname": "={{ $json.first_name }}",
    "lastname": "={{ $json.last_name }}",
    "phone": "={{ $json.phone }}",
    "company": "={{ $json.company }}",
    "lifecyclestage": "customer"
  }
}
```

### 2.3 更新联系人

```json
{
  "resource": "contact",
  "operation": "update",
  "contactId": "={{ $json.hubspot_id }}",
  "properties": {
    "subscription_plan": "={{ $json.plan }}",
    "subscription_status": "={{ $json.status }}",
    "last_payment_date": "={{ $now.toFormat('yyyy-MM-dd') }}"
  }
}
```

### 2.4 创建交易

```json
{
  "resource": "deal",
  "operation": "create",
  "properties": {
    "dealname": "={{ $json.customer_name }} - {{ $json.plan }}",
    "amount": "={{ $json.amount }}",
    "pipeline": "default",
    "dealstage": "closedwon"
  },
  "associations": {
    "contacts": ["={{ $json.hubspot_contact_id }}"]
  }
}
```

---

## 三、Salesforce 集成

### 3.1 配置

使用 OAuth2 认证：

```json
{
  "name": "Salesforce OAuth2",
  "clientId": "xxxxx",
  "clientSecret": "xxxxx",
  "environment": "production"
}
```

### 3.2 SOQL 查询

```json
{
  "resource": "sobject",
  "operation": "query",
  "query": "SELECT Id, Name, Email, Phone FROM Contact WHERE Email = '{{ $json.email }}'"
}
```

### 3.3 创建记录

```json
{
  "resource": "sobject",
  "operation": "create",
  "sobject": "Contact",
  "fields": {
    "FirstName": "={{ $json.first_name }}",
    "LastName": "={{ $json.last_name }}",
    "Email": "={{ $json.email }}",
    "Phone": "={{ $json.phone }}"
  }
}
```

---

## 四、支付-CRM 同步

### 4.1 新订阅流程

```
Stripe Webhook（subscription.created）
    ↓
Code（提取客户信息）
    ↓
HubSpot（查找联系人）
    ↓
IF（联系人存在？）
    ├─ 是 → 更新联系人
    └─ 否 → 创建联系人
    ↓
HubSpot（创建交易）
    ↓
Slack（通知销售团队）
```

### 4.2 支付失败处理

```
Stripe Webhook（payment_failed）
    ↓
Code（提取信息）
    ↓
HubSpot（更新联系人状态）
    ↓
发送邮件（通知客户更新支付方式）
    ↓
Slack（通知客服）
```

### 4.3 订阅取消处理

```
Stripe Webhook（subscription.deleted）
    ↓
Code（提取信息）
    ↓
HubSpot（更新生命周期阶段为 churned）
    ↓
Code（生成流失分析）
    ↓
Slack（通知客户成功团队）
```

---

## 五、实战：SaaS 订阅管理

### 5.1 完整流程

```
新订阅：
Stripe → 创建 HubSpot 联系人 → 创建交易 → 欢迎邮件 → Slack 通知

续费成功：
Stripe → 更新 HubSpot → 发送收据 → 更新统计

支付失败：
Stripe → 更新 HubSpot → 通知客户 → 3天后重试 → 仍失败则暂停

取消订阅：
Stripe → 更新 HubSpot → 流失分析 → 保留挽回邮件
```

### 5.2 统计报表

```javascript
// Code 节点：计算订阅统计
const subscriptions = $input.all();

const stats = {
  total: subscriptions.length,
  by_plan: {},
  mrr: 0, // Monthly Recurring Revenue
  churn_rate: 0
};

for (const sub of subscriptions) {
  const plan = sub.json.plan;
  stats.by_plan[plan] = (stats.by_plan[plan] || 0) + 1;
  stats.mrr += sub.json.amount || 0;
}

return [{ json: stats }];
```

---

## 常见误区

### 误区一："Webhook 不需要验证签名"

必须验证。攻击者可以伪造 Webhook 请求，执行恶意操作。

### 误区二："支付事件不会重复"

Stripe 可能重复发送同一事件。需要记录已处理的事件 ID，实现幂等处理。

### 误区三："CRM 数据不需要清洗"

来自支付系统的数据格式可能和 CRM 不一致。需要标准化后再写入。

---

## 工程建议

1. **验证 Webhook 签名**：防止伪造请求。
2. **幂等处理**：记录事件 ID，避免重复处理。
3. **错误重试**：支付事件不能丢失，失败要重试。
4. **数据同步**：保持支付系统和 CRM 数据一致。
5. **监控告警**：支付失败、同步失败要立即告警。

---

## 小结

- Stripe 通过 Webhook 推送支付事件，需要验证签名
- HubSpot/Salesforce 通过 API 管理客户和交易
- 支付-CRM 同步确保数据一致性
- 幂等处理和错误重试是关键
- 监控支付和同步状态是生产环境的必要措施

---

## 练习

### 练习一：Stripe Webhook

创建一个工作流：接收 Stripe 订阅事件，记录到数据库。

### 练习二：CRM 同步

扩展练习一，新订阅时创建 HubSpot 联系人和交易。

### 练习三：支付失败处理

创建一个工作流：处理支付失败事件，发送通知邮件，更新 CRM 状态。

---

## 参考答案

### 练习一

**思路**：Webhook → 验证签名 → 解析事件 → 数据库插入。

**答案**：

```
Webhook → Code(验证签名) → Code(解析事件) → PostgreSQL(INSERT)
```

### 练习二

**思路**：Stripe 事件 → HubSpot 查找/创建联系人 → 创建交易。

**答案**：

```
Stripe → Code(提取信息) → HubSpot(Search) → IF(exists?) → Create/Update → Create Deal
```

### 练习三

**思路**：Stripe payment_failed → HubSpot 更新 → 邮件通知 → Slack 告警。

**答案**：

```
Stripe(payment_failed) → HubSpot(Update) → Email(通知客户) → Slack(通知客服)
```

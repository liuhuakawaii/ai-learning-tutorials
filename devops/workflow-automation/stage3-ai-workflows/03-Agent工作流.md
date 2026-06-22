# 第三课：Agent 工作流

> **课程定位**：在 n8n 中实现 AI Agent——工具调用、多步推理和人工确认
> **前置知识**：了解 Function Calling 概念，有 AI 节点使用经验
> **预计时长**：40 分钟

---

## 场景引入

你的 AI 客服不仅能回答问题，还需要能执行操作：查询订单状态、修改收货地址、申请退款。这些操作需要调用不同的 API，而且有些操作（如退款）需要人工确认后才能执行。这就是 Agent 工作流要解决的问题。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 AI Agent 的工作原理
2. 在 n8n 中实现工具调用
3. 设计多步推理流程
4. 实现人工确认（Human-in-the-loop）

---

## 一、Agent 概念

### 1.1 什么是 Agent

Agent 是能使用工具、做出决策、执行操作的 AI 系统：

```
用户请求 → AI 分析 → 选择工具 → 执行 → 观察结果 → 继续推理 → 最终回答
```

### 1.2 Agent vs 普通 AI 调用

| 维度 | 普通 AI 调用 | Agent |
|------|-------------|-------|
| 能力 | 只能生成文本 | 可以执行操作 |
| 决策 | 单次推理 | 多步推理 |
| 工具 | 无 | 可调用外部工具 |
| 自主性 | 低 | 高 |

### 1.3 n8n AI Agent 节点

n8n 内置了 AI Agent 节点，支持：

- 工具调用（Function Calling）
- 多步推理
- 记忆管理
- 人工确认

---

## 二、工具定义

### 2.1 工具是什么

工具是 Agent 可以调用的函数：

```json
{
  "name": "get_order_status",
  "description": "查询订单状态",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "订单编号"
      }
    },
    "required": ["order_id"]
  }
}
```

### 2.2 在 n8n 中定义工具

n8n 的 AI Agent 节点支持多种工具类型：

| 工具类型 | 说明 | 实现方式 |
|---------|------|---------|
| HTTP Request | 调用 API | HTTP Tool 节点 |
| Code | 自定义逻辑 | Code Tool 节点 |
| Workflow | 调用子工作流 | Workflow Tool 节点 |
| Vector Store | 语义检索 | Vector Store Tool |

### 2.3 HTTP Tool 示例

```json
{
  "name": "get_order",
  "description": "根据订单号查询订单详情",
  "url": "https://api.example.com/orders/{{ $json.order_id }}",
  "method": "GET",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "myServiceApi"
}
```

### 2.4 Code Tool 示例

```javascript
// Code Tool：查询库存
const input = $input.first().json;

// 模拟数据库查询
const inventory = {
  'PROD-001': { name: '笔记本电脑', stock: 50 },
  'PROD-002': { name: '鼠标', stock: 200 },
  'PROD-003': { name: '键盘', stock: 0 }
};

const product = inventory[input.product_id];

if (!product) {
  return [{ json: { error: '商品不存在' } }];
}

return [{
  json: {
    product_id: input.product_id,
    name: product.name,
    stock: product.stock,
    available: product.stock > 0
  }
}];
```

---

## 三、AI Agent 配置

### 3.1 Agent 节点设置

```json
{
  "agent": "conversationalAgent",
  "text": "={{ $json.question }}",
  "systemMessage": "你是一个客服 Agent，可以查询订单和库存。执行敏感操作（如退款）前必须确认。",
  "tools": {
    "values": [
      { "name": "get_order", "tool": "HTTP Tool" },
      { "name": "check_stock", "tool": "Code Tool" },
      { "name": "request_refund", "tool": "Workflow Tool" }
    ]
  },
  "options": {
    "maxIterations": 5,
    "returnIntermediateSteps": true
  }
}
```

### 3.2 System Prompt 设计

```
你是一个客服 Agent。你可以使用以下工具：

1. get_order: 查询订单状态，参数：order_id
2. check_stock: 检查库存，参数：product_id
3. request_refund: 申请退款，参数：order_id, reason

规则：
- 查询信息可以直接执行
- 退款等敏感操作需要先向用户确认
- 如果工具返回错误，告诉用户并建议其他方案
- 不确定时询问用户，不要猜测
```

### 3.3 最大迭代次数

Agent 可能需要多次工具调用才能完成任务：

```
用户："我订单 ORD-001 的商品有库存吗？"
Agent 思考：需要先查询订单获取商品 ID，再检查库存
  → 调用 get_order(ORD-001)
  → 获取商品 ID: PROD-001
  → 调用 check_stock(PROD-001)
  → 获取库存信息
  → 生成回答
```

设置 `maxIterations` 防止无限循环。

---

## 四、人工确认

### 4.1 为什么需要人工确认

某些操作不可逆或有风险：
- 退款
- 删除数据
- 修改重要配置
- 发送群发消息

### 4.2 实现方式

**方式一：Agent 内置确认**

在 System Prompt 中要求 Agent 在执行前确认：

```
执行退款前，必须先询问用户：
"确认要为订单 {order_id} 申请退款吗？原因：{reason}"
用户确认后才能调用 request_refund 工具。
```

**方式二：Webhook 确认**

```
Agent 决定退款
    ↓
Wait 节点（等待确认 Webhook）
    ↓
发送确认链接给管理员
    ↓
管理员点击确认
    ↓
Webhook 触发 → 继续执行退款
```

### 4.3 Wait 节点配置

```json
{
  "resume": "webhook",
  "webhookPath": "confirm/{{ $json.action_id }}",
  "responseMode": "responseNode",
  "options": {
    "timeout": 3600
  }
}
```

---

## 五、实战：客服 Agent

### 5.1 完整流程

```
Webhook（客户消息）
    ↓
AI Agent
    ├─ 工具：get_order（查询订单）
    ├─ 工具：check_stock（检查库存）
    ├─ 工具：request_refund（申请退款）
    └─ 工具：search_docs（搜索文档）
    ↓
IF（需要人工确认？）
    ├─ 是 → 发送确认 → Wait → 执行
    └─ 否 → 直接返回结果
    ↓
发送回复
```

### 5.2 Agent 对话示例

```
用户：我的订单 ORD-001 什么时候发货？

Agent 思考：用户询问订单状态，需要调用 get_order 工具
Agent 调用：get_order({ order_id: "ORD-001" })
工具返回：{ status: "shipped", tracking: "SF1234567" }
Agent 回答：您的订单 ORD-001 已发货，物流单号 SF1234567。

---

用户：这个鼠标还有货吗？

Agent 思考：用户询问库存，需要先确定商品 ID
Agent 回答：请问您想查询哪个商品的库存？
用户：PROD-002
Agent 调用：check_stock({ product_id: "PROD-002" })
工具返回：{ stock: 200, available: true }
Agent 回答：PROD-002（鼠标）目前有货，库存 200 件。

---

用户：我要退款，订单 ORD-001

Agent 思考：退款是敏感操作，需要确认
Agent 回答：确认要为订单 ORD-001 申请退款吗？请提供退款原因。
用户：商品质量问题
Agent 调用：request_refund({ order_id: "ORD-001", reason: "商品质量问题" })
工具返回：{ success: true, refund_id: "REF-001" }
Agent 回答：退款已提交，退款单号 REF-001，预计 3-5 个工作日到账。
```

---

## 六、高级模式

### 6.1 多 Agent 协作

```
用户请求
    ↓
路由 Agent（判断任务类型）
    ├─ 订单问题 → 订单 Agent
    ├─ 技术问题 → 技术 Agent
    └─ 投诉问题 → 投诉 Agent
    ↓
汇总结果
```

### 6.2 Agent 记忆

```json
{
  "memory": {
    "type": "bufferMemory",
    "sessionId": "={{ $json.session_id }}",
    "maxTokenLimit": 2000
  }
}
```

### 6.3 错误恢复

```javascript
// Agent 工具调用失败时的降级
try {
  const result = await callTool(name, params);
  return result;
} catch (error) {
  return {
    error: true,
    message: `工具 ${name} 调用失败: ${error.message}`,
    suggestion: '建议联系人工客服'
  };
}
```

---

## 常见误区

### 误区一："Agent 可以完全自主"

Agent 的自主性需要限制。高风险操作必须有人工确认，防止误操作。

### 误区二："工具越多越好"

过多的工具会让 Agent 困惑。只提供必要的工具，并给每个工具清晰的描述。

### 误区三："Agent 总是正确的"

Agent 可能误判用户意图或选错工具。需要监控和人工兜底。

---

## 工程建议

1. **工具描述要准确**：Agent 根据描述选择工具，描述不清会导致选错。
2. **限制迭代次数**：防止 Agent 陷入循环，一般 5-10 次足够。
3. **敏感操作要确认**：退款、删除等操作必须有人工确认环节。
4. **记录 Agent 推理过程**：方便调试和优化。
5. **设置超时**：Agent 的多步推理可能很慢，设置合理的超时。

---

## 小结

- Agent 是能使用工具、做出决策、执行操作的 AI 系统
- n8n 通过 AI Agent 节点实现工具调用和多步推理
- 工具包括 HTTP Tool、Code Tool、Workflow Tool 等
- 敏感操作需要人工确认（Human-in-the-loop）
- Agent 需要限制迭代次数和设置超时

---

## 练习

### 练习一：基础 Agent

创建一个 Agent 工作流，配备一个"查询天气"工具（调用天气 API），测试 Agent 的工具调用能力。

### 练习二：多工具 Agent

扩展练习一，添加"查询订单"和"查询库存"两个工具，测试 Agent 的多工具选择能力。

### 练习三：人工确认

为 Agent 添加退款工具，实现人工确认流程：Agent 提议退款 → 发送确认链接 → 管理员确认 → 执行退款。

---

## 参考答案

### 练习一

**思路**：AI Agent 节点 + HTTP Tool 查询天气。

**答案**：

1. AI Agent 节点
2. HTTP Tool：
   - name: get_weather
   - description: 查询指定城市的天气
   - url: https://wttr.in/{{ $json.city }}?format=j1
3. 测试："北京今天天气怎么样？"

### 练习二

**思路**：添加多个 Code Tool。

**答案**：

添加 Code Tools：
- get_order: 查询订单状态
- check_stock: 查询库存

System Prompt 说明每个工具的用途和参数。

### 练习三

**思路**：Agent + Wait 节点实现确认。

**答案**：

```
Agent → IF(需要确认?) → Wait(webhook) → 执行退款
                      → 发送确认链接
```

Wait 节点 Webhook Path: `confirm/{{ $json.refund_id }}`

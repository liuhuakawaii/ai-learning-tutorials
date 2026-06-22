# 第一课：Slack / 飞书集成

> **课程定位**：在 n8n 中集成 Slack 和飞书，实现消息推送、审批流和机器人
> **前置知识**：了解 OAuth2 和 Webhook 概念
> **预计时长**：35 分钟

---

## 场景引入

你的团队用 Slack 协作，需要在工作流的关键节点发送通知：新订单到达、部署完成、异常告警。你还想做一个审批机器人，在 Slack 中直接审批而不用切换到其他系统。

---

## 学习目标

完成本课学习后，你将能够：

1. 配置 Slack 和飞书的 n8n 凭证
2. 发送消息、创建频道、管理用户
3. 实现 Slack 交互式消息和审批流
4. 构建飞书机器人

---

## 一、Slack 集成

### 1.1 配置凭证

**方式一：Bot Token（推荐）**

1. 创建 Slack App：https://api.slack.com/apps
2. 添加 Bot Token Scopes：`chat:write`、`channels:read`、`users:read`
3. 安装到工作区
4. 复制 Bot User OAuth Token
5. 在 n8n 创建 Slack API 凭证

**方式二：OAuth2**

更安全，支持细粒度权限控制。

### 1.2 发送消息

```json
{
  "resource": "message",
  "operation": "send",
  "channel": "#alerts",
  "text": "🔴 新订单到达！\n\n订单号：ORD-001\n金额：¥299\n客户：张三"
}
```

### 1.3 消息格式化

使用 Slack Block Kit 创建富文本消息：

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🆕 新订单通知"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*订单号：*\nORD-001" },
        { "type": "mrkdwn", "text": "*金额：*\n¥299" },
        { "type": "mrkdwn", "text": "*客户：*\n张三" },
        { "type": "mrkdwn", "text": "*时间：*\n2024-03-15 10:30" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "查看详情" },
          "url": "https://admin.example.com/orders/ORD-001"
        }
      ]
    }
  ]
}
```

### 1.4 Slack 交互式消息

Slack 支持按钮点击、下拉选择等交互：

```
Slack 消息（带按钮）
    ↓
用户点击按钮
    ↓
Slack 发送交互请求到 n8n Webhook
    ↓
n8n 处理交互
    ↓
更新 Slack 消息
```

配置交互 URL：
1. Slack App → Interactivity & Shortcuts
2. 设置 Request URL：`https://n8n.example.com/webhook/slack-interactive`

---

## 二、飞书集成

### 2.1 配置凭证

1. 创建飞书应用：https://open.feishu.cn/
2. 获取 App ID 和 App Secret
3. 添加权限：`im:message:send_as_bot`
4. 在 n8n 使用 HTTP Request 节点调用飞书 API

### 2.2 获取 Access Token

```json
{
  "method": "POST",
  "url": "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
  "body": {
    "app_id": "cli_xxxxx",
    "app_secret": "xxxxx"
  }
}
```

### 2.3 发送消息

```json
{
  "method": "POST",
  "url": "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
  "headers": {
    "Authorization": "Bearer {{ $json.tenant_access_token }}",
    "Content-Type": "application/json"
  },
  "body": {
    "receive_id": "oc_xxxxx",
    "msg_type": "interactive",
    "content": "{\"elements\":[{\"tag\":\"div\",\"text\":{\"content\":\"🆕 新订单 ORD-001\\n金额：¥299\",\"tag\":\"lark_md\"}}]}"
  }
}
```

### 2.4 飞书机器人

飞书支持交互式卡片：

```json
{
  "msg_type": "interactive",
  "content": {
    "config": { "wide_screen_mode": true },
    "header": {
      "title": { "tag": "plain_text", "content": "审批请求" },
      "template": "orange"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**订单号：** ORD-001\n**金额：** ¥5,999\n**申请人：** 张三"
        }
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": { "tag": "plain_text", "content": "同意" },
            "type": "primary",
            "value": { "action": "approve", "order_id": "ORD-001" }
          },
          {
            "tag": "button",
            "text": { "tag": "plain_text", "content": "拒绝" },
            "type": "danger",
            "value": { "action": "reject", "order_id": "ORD-001" }
          }
        ]
      }
    ]
  }
}
```

---

## 三、审批工作流

### 3.1 Slack 审批

```
触发事件
    ↓
Slack 发送审批消息（带 Approve/Reject 按钮）
    ↓
Webhook 接收交互回调
    ↓
IF（用户操作）
    ├─ Approve → 执行操作 → 更新消息
    └─ Reject → 拒绝 → 更新消息
```

### 3.2 飞书审批

```
触发事件
    ↓
飞书发送审批卡片
    ↓
Webhook 接收回调
    ↓
处理审批结果
```

---

## 四、实战：部署通知机器人

### 4.1 场景

当 CI/CD 部署完成时，发送通知到 Slack，并提供一键回滚按钮。

### 4.2 实现

```
Webhook（部署完成事件）
    ↓
Code（格式化消息）
    ↓
Slack（发送通知 + 回滚按钮）
    ↓
Webhook（接收回滚操作）
    ↓
IF（回滚？）
    ├─ 是 → 执行回滚脚本 → 更新消息
    └─ 否 → 无操作
```

---

## 常见误区

### 误区一："Bot Token 不需要安装"

Bot Token 必须先安装到 Slack 工作区才能使用。安装后 Bot 才能发送消息。

### 误区二："飞书消息不需要签名验证"

飞书的 Webhook 回调应该验证签名，防止伪造请求。

### 误区三："消息发送失败就放弃"

消息发送可能因为网络问题失败。应该配置重试，并有降级方案（如发邮件）。

---

## 工程建议

1. **使用 Block Kit/卡片**：富文本消息比纯文本更专业。
2. **验证 Webhook 签名**：防止伪造请求。
3. **消息去重**：Webhook 可能重复推送，需要幂等处理。
4. **限流**：Slack API 有频率限制（1 次/秒）。
5. **错误通知**：工作流失败时通知到 Slack。

---

## 小结

- Slack 通过 Bot Token 或 OAuth2 认证，支持消息、交互和审批
- 飞书通过 App ID/Secret 认证，支持卡片消息和交互
- 审批工作流：发送审批消息 → 接收回调 → 处理结果
- Block Kit 和飞书卡片提供丰富的消息格式
- Webhook 签名验证和限流是生产环境的必要措施

---

## 练习

### 练习一：发送 Slack 消息

创建一个工作流：接收 Webhook，发送格式化的 Slack 消息到指定频道。

### 练习二：Slack 交互

扩展练习一，添加一个"确认"按钮。点击后更新消息状态。

### 练习三：飞书机器人

创建一个飞书机器人：接收消息，调用 AI 生成回答，回复用户。

---

## 参考答案

### 练习一

**思路**：Webhook → Slack 节点发送消息。

**答案**：

1. Webhook（POST /notify）
2. Slack：
   - channel: #notifications
   - text: "新消息：{{ $json.body.message }}"

### 练习二

**思路**：Slack 发送带按钮消息 → Webhook 接收交互 → 更新消息。

**答案**：

Block Kit 消息包含 button 元素，设置 action_id 和 value。
交互 Webhook 处理回调，用 Slack API 更新原消息。

### 练习三

**思路**：飞书 Webhook → OpenAI → 飞书回复。

**答案**：

```
飞书 Webhook → 解析消息 → OpenAI 生成回答 → 飞书 API 回复
```

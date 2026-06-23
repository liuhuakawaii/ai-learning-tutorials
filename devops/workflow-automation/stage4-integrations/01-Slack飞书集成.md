# Slack / 飞书集成

## 场景

团队用 Slack 协作，需要在工作流关键节点发送通知：新订单到达、部署完成、异常告警。还想做审批机器人，在 Slack 中直接审批。

## Slack 集成

### 配置凭证

1. 创建 Slack App：https://api.slack.com/apps
2. 添加 Bot Token Scopes：`chat:write`、`channels:read`、`users:read`
3. 安装到工作区
4. 复制 Bot User OAuth Token
5. 在 n8n 创建 Slack API 凭证

### 发送消息

```json
{
  "resource": "message",
  "operation": "send",
  "channel": "#alerts",
  "text": "🔴 新订单到达！\n\n订单号：ORD-001\n金额：¥299\n客户：张三"
}
```

### Block Kit 富文本消息

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🆕 新订单通知" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*订单号：*\nORD-001" },
        { "type": "mrkdwn", "text": "*金额：*\n¥299" }
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

### Slack 交互式消息

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

配置：Slack App → Interactivity & Shortcuts → Request URL：`https://n8n.example.com/webhook/slack-interactive`

## 飞书集成

### 配置凭证

1. 创建飞书应用：https://open.feishu.cn/
2. 获取 App ID 和 App Secret
3. 添加权限：`im:message:send_as_bot`
4. 使用 HTTP Request 节点调用飞书 API

### 获取 Access Token

```json
{
  "method": "POST",
  "url": "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
  "body": { "app_id": "cli_xxxxx", "app_secret": "xxxxx" }
}
```

### 发送消息

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
    "content": "{\"elements\":[{\"tag\":\"div\",\"text\":{\"content\":\"🆕 新订单 ORD-001\",\"tag\":\"lark_md\"}}]}"
  }
}
```

### 飞书审批卡片

```json
{
  "msg_type": "interactive",
  "content": {
    "header": {
      "title": { "tag": "plain_text", "content": "审批请求" },
      "template": "orange"
    },
    "elements": [
      {
        "tag": "div",
        "text": { "tag": "lark_md", "content": "**订单号：** ORD-001\n**金额：** ¥5,999" }
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

## 审批工作流

```
触发事件
    ↓
Slack/飞书发送审批消息（带 Approve/Reject 按钮）
    ↓
Webhook 接收交互回调
    ↓
IF（用户操作）
    ├─ Approve → 执行操作 → 更新消息
    └─ Reject → 拒绝 → 更新消息
```

## 实战：部署通知机器人

CI/CD 部署完成时发送通知到 Slack，提供一键回滚按钮：

```
Webhook（部署完成事件）
    ↓
Code（格式化消息）
    ↓
Slack（发送通知 + 回滚按钮）
    ↓
Webhook（接收回滚操作）
    ↓
IF（回滚？）→ 是 → 执行回滚脚本 → 更新消息
```

## 练习

### 练习一：发送 Slack 消息

接收 Webhook，发送格式化 Slack 消息到指定频道。

### 练习二：Slack 交互

添加"确认"按钮，点击后更新消息状态。

### 练习三：飞书机器人

飞书机器人：接收消息，调用 AI 生成回答，回复用户。

---

## 参考答案

### 练习一

Webhook（POST /notify）→ Slack（channel: #notifications, text: "新消息：{{ $json.body.message }}"）

### 练习二

Block Kit 消息包含 button 元素，设置 action_id 和 value。交互 Webhook 处理回调，用 Slack API 更新原消息。

### 练习三

飞书 Webhook → 解析消息 → OpenAI 生成回答 → 飞书 API 回复

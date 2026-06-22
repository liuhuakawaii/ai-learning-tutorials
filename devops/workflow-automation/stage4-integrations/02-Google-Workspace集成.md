# 第二课：Google Workspace 集成

> **课程定位**：在 n8n 中集成 Google Sheets、Docs 和 Calendar，实现办公自动化
> **前置知识**：了解 OAuth2 和 Google API
> **预计时长**：35 分钟

---

## 场景引入

你的团队用 Google Sheets 管理项目进度，每周需要从 Sheets 中提取数据生成报告，更新到 Google Docs 中，并在 Google Calendar 上创建会议。手动操作繁琐，你想用 n8n 实现全自动化。

---

## 学习目标

完成本课学习后，你将能够：

1. 配置 Google OAuth2 凭证
2. 操作 Google Sheets（读写、筛选、格式化）
3. 操作 Google Docs（创建、更新、模板）
4. 操作 Google Calendar（创建事件、查询空闲）

---

## 一、Google OAuth2 配置

### 1.1 创建 OAuth 应用

1. 访问 Google Cloud Console
2. 创建项目 → 启用 API（Sheets、Docs、Calendar）
3. 创建 OAuth 2.0 Client ID
4. 设置 Redirect URI：`https://n8n.example.com/rest/oauth2-credential/callback`
5. 复制 Client ID 和 Client Secret

### 1.2 n8n 凭证配置

1. Credentials → Add Credential → Google OAuth2
2. 填入 Client ID 和 Client Secret
3. 设置 Scope：
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/calendar`
4. 点击 Connect → 授权

---

## 二、Google Sheets 操作

### 2.1 读取数据

```json
{
  "resource": "spreadsheet",
  "operation": "read",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "range": "Sheet1!A:E",
  "options": {
    "valueRenderMode": "FORMATTED_VALUE"
  }
}
```

### 2.2 写入数据

```json
{
  "resource": "spreadsheet",
  "operation": "append",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "range": "Sheet1!A:E",
  "columns": {
    "values": [
      {
        "日期": "={{ $now.toFormat('yyyy-MM-dd') }}",
        "订单数": "={{ $json.order_count }}",
        "总金额": "={{ $json.total_amount }}",
        "状态": "已完成"
      }
    ]
  }
}
```

### 2.3 更新数据

```json
{
  "resource": "spreadsheet",
  "operation": "update",
  "spreadsheetId": "xxx",
  "range": "Sheet1!C2",
  "columns": {
    "values": [{ "状态": "已处理" }]
  }
}
```

### 2.4 Google Sheets 作为数据库

Google Sheets 可以作为轻量级数据存储：

| 场景 | 说明 |
|------|------|
| 内容计划 | 存储待发布的内容 |
| 审批流程 | 记录审批状态 |
| 数据收集 | 汇总表单提交 |
| 报表数据 | 存储统计结果 |

---

## 三、Google Docs 操作

### 3.1 创建文档

```json
{
  "resource": "document",
  "operation": "create",
  "title": "周报 - {{ $now.toFormat('yyyy-MM-dd') }}",
  "body": {
    "content": [
      {
        "paragraph": {
          "text": "本周工作总结\n\n",
          "style": "HEADING_1"
        }
      },
      {
        "paragraph": {
          "text": "1. 完成订单处理系统优化\n2. 修复客服系统 bug\n3. 更新产品文档"
        }
      }
    ]
  }
}
```

### 3.2 模板化文档

使用模板生成文档：

```javascript
// Code 节点：构建文档内容
const data = $input.first().json;

const content = `
# 周报 - ${data.week}

## 本周完成
${data.completed.map(item => `- ${item}`).join('\n')}

## 数据统计
- 订单数：${data.order_count}
- 总金额：¥${data.total_amount}
- 客户满意度：${data.satisfaction}%

## 下周计划
${data.plans.map(item => `- ${item}`).join('\n')}
`;

return [{
  json: {
    title: `周报 - ${data.week}`,
    content: content
  }
}];
```

---

## 四、Google Calendar 操作

### 4.1 创建事件

```json
{
  "resource": "event",
  "operation": "create",
  "calendarId": "primary",
  "start": "={{ $json.meeting_time }}",
  "end": "={{ DateTime.fromISO($json.meeting_time).plus({ hours: 1 }).toISO() }}",
  "summary": "={{ $json.meeting_title }}",
  "description": "会议议程：\n{{ $json.agenda }}",
  "attendees": [
    { "email": "alice@example.com" },
    { "email": "bob@example.com" }
  ],
  "options": {
    "sendUpdates": "all"
  }
}
```

### 4.2 查询日程

```json
{
  "resource": "event",
  "operation": "getAll",
  "calendarId": "primary",
  "timeMin": "={{ $now.toISO() }}",
  "timeMax": "={{ $now.plus({ days: 7 }).toISO() }}",
  "options": {
    "singleEvents": true,
    "orderBy": "startTime"
  }
}
```

### 4.3 查找空闲时间

```javascript
// Code 节点：查找空闲时间段
const events = $input.all();
const workStart = 9; // 9:00
const workEnd = 18;  // 18:00
const duration = 1;  // 1 小时

const today = $now.set({ hour: workStart, minute: 0 });
const busySlots = events.map(e => ({
  start: DateTime.fromISO(e.json.start.dateTime),
  end: DateTime.fromISO(e.json.end.dateTime)
}));

const freeSlots = [];
let current = today;

for (const slot of busySlots) {
  if (current < slot.start) {
    freeSlots.push({
      start: current.toISO(),
      end: slot.start.toISO()
    });
  }
  current = slot.end;
}

if (current.hour < workEnd) {
  freeSlots.push({
    start: current.toISO(),
    end: current.set({ hour: workEnd }).toISO()
  });
}

return freeSlots.filter(s => {
  const hours = DateTime.fromISO(s.end).diff(DateTime.fromISO(s.start), 'hours').hours;
  return hours >= duration;
}).map(s => ({ json: s }));
```

---

## 五、实战：自动周报生成

### 5.1 流程

```
Schedule（每周五 17:00）
    ↓
Google Sheets（读取本周数据）
    ↓
Code（计算统计）
    ↓
Code（生成报告内容）
    ↓
Google Docs（创建周报文档）
    ↓
Slack（发送周报链接）
```

### 5.2 实现

统计计算：

```javascript
const rows = $input.all();
const thisWeek = rows.filter(r => {
  const date = DateTime.fromISO(r.json.date);
  return date >= $now.startOf('week') && date <= $now.endOf('week');
});

const stats = {
  total_orders: thisWeek.length,
  total_amount: thisWeek.reduce((sum, r) => sum + r.json.amount, 0),
  by_status: {}
};

for (const row of thisWeek) {
  stats.by_status[row.json.status] = (stats.by_status[row.json.status] || 0) + 1;
}

return [{ json: stats }];
```

---

## 常见误区

### 误区一："OAuth2 授权后永久有效"

Google OAuth2 的 Access Token 有效期 1 小时。n8n 会自动用 Refresh Token 刷新，但 Refresh Token 也可能过期（如用户修改密码）。

### 误区二："Sheets 操作没有频率限制"

Google Sheets API 有配额限制（每分钟 300 次读取）。批量操作要注意频率。

### 误区三："Calendar 事件创建后不能修改"

可以修改，但需要存储事件 ID。建议把事件 ID 写回 Sheets 方便后续管理。

---

## 工程建议

1. **使用 Service Account**：生产环境推荐 Service Account 代替个人 OAuth。
2. **批量操作**：读写多行数据时用 `append` 而不是逐行操作。
3. **错误处理**：Google API 可能返回 429（限流），需要重试。
4. **权限最小化**：只申请需要的 Scope。
5. **文档版本控制**：重要文档的修改要有审计日志。

---

## 小结

- Google Workspace 通过 OAuth2 认证，n8n 内置了 Sheets、Docs、Calendar 节点
- Google Sheets 适合轻量级数据存储和协作
- Google Docs 支持模板化文档生成
- Google Calendar 支持事件创建、查询和空闲时间查找
- OAuth2 Token 需要定期刷新，生产环境推荐 Service Account

---

## 练习

### 练习一：Sheets 读写

创建一个工作流：从 Google Sheets 读取数据，添加一列计算结果，写回 Sheets。

### 练习二：自动报告

创建一个工作流：从 Sheets 读取销售数据，生成统计报告，创建 Google Docs 文档。

### 练习三：会议安排

创建一个工作流：查询团队成员的日程，找到共同空闲时间，创建 Google Calendar 事件。

---

## 参考答案

### 练习一

**思路**：Google Sheets Read → Code 计算 → Google Sheets Write。

**答案**：

```
Google Sheets(Read) → Code(添加计算列) → Google Sheets(Append/Update)
```

### 练习二

**思路**：Sheets 读取 → Code 统计 → Docs 创建。

**答案**：

```
Google Sheets(Read) → Code(统计) → Code(生成报告) → Google Docs(Create)
```

### 练习三

**思路**：Calendar 查询多用户日程 → Code 找空闲 → Calendar 创建事件。

**答案**：

```
Loop(用户) → Calendar(查询) → Code(找共同空闲) → Calendar(创建事件)
```

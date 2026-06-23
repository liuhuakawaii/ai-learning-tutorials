# 阶段实战：用低代码搭建完整 CRM 系统

> 前置知识：低代码思维、平台选型、数据模型设计、表单与工作流、权限与角色（第 1-5 课）

## 你要做什么

用低代码平台搭建一套完整的 CRM（客户关系管理）系统。核心需求：客户信息集中管理、销售机会跟踪、销售漏斗可视化、活动记录、数据报表。

这不是一个 demo——这是一个两周内要上线的业务系统。

## 需求分析

```
CRM 功能清单：
├── 客户管理：客户信息录入、分级、标签、分配与转移
├── 联系人管理：联系人维护、与客户关联、沟通记录
├── 销售机会：商机创建与跟进、销售阶段管理
├── 活动记录：电话/拜访/邮件记录、活动提醒
├── 数据报表：销售漏斗图、业绩排行榜、转化率
└── 权限管理：销售人员管自己的、主管看团队的、管理员看全部
```

## 第一步：数据模型设计

```
Customer (客户) ──1:N── Contact (联系人)
    ├──1:N── Opportunity (销售机会) ──1:N── Activity (活动记录)
    └──M:N── Tag (标签)

User (销售人员) ──1:N── Customer (owner_id)
              ──1:N── Opportunity (owner_id)
```

### 客户表（customers）

```json
{
  "name": "customers",
  "fields": [
    { "name": "name", "type": "string", "required": true, "label": "客户名称" },
    { "name": "company", "type": "string", "label": "公司" },
    { "name": "industry", "type": "select", "options": ["互联网", "金融", "制造", "零售", "其他"], "label": "行业" },
    { "name": "level", "type": "select", "options": ["A-战略客户", "B-重点客户", "C-一般客户", "D-潜在客户"], "label": "客户等级" },
    { "name": "source", "type": "select", "options": ["官网", "转介绍", "展会", "电话营销", "其他"], "label": "来源" },
    { "name": "owner_id", "type": "relation", "target": "users", "label": "负责人" },
    { "name": "status", "type": "select", "options": ["活跃", "沉默", "流失"], "label": "状态" },
    { "name": "notes", "type": "text", "label": "备注" }
  ]
}
```

### 销售机会表（opportunities）

```json
{
  "name": "opportunities",
  "fields": [
    { "name": "title", "type": "string", "required": true, "label": "商机名称" },
    { "name": "customer_id", "type": "relation", "target": "customers", "required": true, "label": "关联客户" },
    { "name": "amount", "type": "number", "label": "预计金额" },
    { "name": "stage", "type": "select", "options": ["初步接触", "需求确认", "方案报价", "商务谈判", "赢单", "输单"], "label": "销售阶段" },
    { "name": "probability", "type": "number", "label": "赢单概率%" },
    { "name": "expected_close_date", "type": "date", "label": "预计成交日期" },
    { "name": "owner_id", "type": "relation", "target": "users", "label": "负责人" }
  ]
}
```

## 第二步：页面搭建

### 客户列表页

组件配置：

```json
{
  "type": "table",
  "dataSource": {
    "type": "api",
    "endpoint": "/api/customers",
    "method": "GET"
  },
  "columns": [
    { "field": "name", "label": "客户名称", "link": "/customers/{{id}}" },
    { "field": "company", "label": "公司" },
    { "field": "level", "label": "等级", "tag": true },
    { "field": "owner_id.name", "label": "负责人" },
    { "field": "status", "label": "状态", "tag": true }
  ],
  "filters": [
    { "field": "level", "type": "select" },
    { "field": "status", "type": "select" },
    { "field": "owner_id", "type": "select" }
  ],
  "pagination": { "pageSize": 20 }
}
```

### 销售漏斗图

```json
{
  "type": "funnel",
  "dataSource": {
    "type": "api",
    "endpoint": "/api/opportunities/funnel"
  },
  "stages": ["初步接触", "需求确认", "方案报价", "商务谈判", "赢单"],
  "valueField": "count",
  "labelField": "stage"
}
```

## 第三步：工作流配置

### 商机阶段变更自动通知

```json
{
  "trigger": {
    "type": "record_updated",
    "table": "opportunities",
    "field": "stage"
  },
  "actions": [
    {
      "type": "send_notification",
      "to": "{{record.owner_id}}",
      "template": "商机「{{record.title}}」已进入「{{record.stage}}」阶段"
    },
    {
      "type": "send_notification",
      "condition": "{{record.stage}} === '赢单'",
      "to": "{{record.customer_id.owner_id}}",
      "template": "恭喜！商机「{{record.title}}」已赢单，金额 ¥{{record.amount}}"
    }
  ]
}
```

### 超期商机提醒

```json
{
  "trigger": {
    "type": "scheduled",
    "cron": "0 9 * * 1-5"
  },
  "actions": [
    {
      "type": "send_notification",
      "query": {
        "table": "opportunities",
        "filter": "expected_close_date < NOW() AND stage NOT IN ('赢单', '输单')"
      },
      "to": "{{query.results[].owner_id}}",
      "template": "您有 {{query.count}} 个商机已超过预计成交日期，请及时跟进"
    }
  ]
}
```

## 第四步：权限配置

```
角色权限矩阵：

销售员：
  ├── 客户：查看/编辑自己负责的
  ├── 联系人：查看/编辑关联客户的
  ├── 商机：查看/编辑自己负责的
  └── 报表：只看自己的数据

销售主管：
  ├── 客户：查看/编辑团队的
  ├── 商机：查看/编辑团队的
  ├── 报表：看团队数据
  └── 团队管理：查看团队成员的客户分配

管理员：
  └── 全部权限 + 系统配置
```

## 验收清单

```
✓ 客户 CRUD 正常工作
✓ 联系人和客户关联正常
✓ 商机创建和阶段变更正常
✓ 销售漏斗图数据正确
✓ 通知工作流正常触发
✓ 权限隔离生效（销售员看不到别人的数据）
✓ 移动端可以正常访问
```

## 练习

### 练习一：添加报表

创建一个"业绩排行榜"报表：按销售人员分组，统计本月赢单金额，从高到低排序。

### 练习二：添加自动化

创建一个工作流：当客户 30 天没有活动记录时，自动将客户状态改为"沉默"，并通知负责人。

### 练习三：数据导入

假设你有一个 Excel 文件包含 500 条客户数据。设计导入方案：数据格式、字段映射、去重策略。

---

## 参考答案

### 练习一

报表配置：

```json
{
  "type": "bar_chart",
  "dataSource": {
    "type": "api",
    "endpoint": "/api/opportunities/aggregate",
    "params": {
      "group_by": "owner_id",
      "filter": "stage = '赢单' AND MONTH(won_date) = MONTH(NOW())",
      "aggregate": "SUM(amount)"
    }
  },
  "xAxis": "owner_id.name",
  "yAxis": "sum_amount",
  "sort": "desc"
}
```

### 练习二

```json
{
  "trigger": {
    "type": "scheduled",
    "cron": "0 10 * * 1"
  },
  "actions": [
    {
      "type": "update_records",
      "query": {
        "table": "customers",
        "filter": "last_activity_date < DATE_SUB(NOW(), INTERVAL 30 DAY) AND status = '活跃'"
      },
      "update": { "status": "沉默" }
    },
    {
      "type": "send_notification",
      "to": "{{updated_records[].owner_id}}",
      "template": "您有 {{updated_count}} 个客户因 30 天无活动被标记为沉默"
    }
  ]
}
```

### 练习三

导入方案：

1. 数据格式：CSV 或 Excel，第一行为表头
2. 字段映射：Excel 列名 → 系统字段名（如"客户名" → "name"）
3. 去重策略：按"客户名称 + 公司"组合去重，重复时更新而非新建
4. 预处理：检查必填字段、清洗空值、标准化行业字段
5. 分批导入：每批 100 条，避免超时

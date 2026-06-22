# 阶段实战：用低代码搭建完整 CRM 系统

## 场景引入

陈薇是一家 B2B 销售公司的运营总监，公司有 40 名销售人员，每年处理超过 2000 个商机。目前客户信息散落在 Excel、微信聊天记录和销售人员的个人笔记本中。每到月底统计销售数据时，她需要花三天时间手动汇总各人的报表，数据经常对不上。

她决定用低代码平台搭建一套 CRM（客户关系管理）系统。核心需求包括：客户信息集中管理、销售机会跟踪、销售漏斗可视化、活动记录和数据报表。预算有限，希望两周内上线。

本节课将带你从零开始，用前面五节课学到的知识，完整搭建这套 CRM 系统。这是一个综合性实战，涵盖数据模型设计、表单与工作流、权限控制等所有核心技能。

## 学习目标

- 能够根据业务需求设计完整的数据模型
- 掌握 CRM 系统的核心功能模块和业务逻辑
- 综合运用表单设计器、工作流引擎和权限配置
- 理解从需求分析到系统上线的完整交付流程

## 需求分析

在动手之前，先梳理 CRM 系统的核心功能：

```
CRM 系统功能清单：
├── 客户管理：客户信息录入、分级、标签、分配与转移
├── 联系人管理：联系人维护、与客户关联、沟通记录
├── 销售机会：商机创建与跟进、销售阶段管理、赢/输分析
├── 活动记录：电话/拜访/邮件记录、活动提醒
├── 数据报表：销售漏斗图、业绩排行榜、商机转化率
└── 权限管理：销售人员管自己的、主管看团队的、管理员看全部
```

## 数据模型设计

### 实体关系图

```
Customer (客户) ──1:N── Contact (联系人)
    ├──1:N── Opportunity (销售机会) ──1:N── Activity (活动记录)
    └──M:N── Tag (标签) [通过 CustomerTag 中间表]

User (销售人员) ──1:N── Customer (通过 owner_id)
              ──1:N── Opportunity (通过 owner_id)
              ──1:N── Activity (通过 created_by)
```

### 客户表（customers）

```json
{
  "entity": "customers",
  "fields": [
    { "name": "id", "type": "UUID", "primary": true, "auto": true },
    { "name": "name", "type": "Text", "required": true, "maxLength": 200 },
    { "name": "industry", "type": "Enum", "options": ["互联网", "金融", "制造", "教育", "医疗", "零售", "其他"] },
    { "name": "level", "type": "Enum", "options": ["普通", "重要", "VIP"], "default": "普通" },
    { "name": "source", "type": "Enum", "options": ["官网", "展会", "转介绍", "电话营销", "社交媒体"] },
    { "name": "phone", "type": "Text" },
    { "name": "address", "type": "Text" },
    { "name": "owner", "type": "Relation", "target": "users" },
    { "name": "remark", "type": "LongText" },
    { "name": "created_at", "type": "DateTime", "auto": true }
  ]
}
```

### 销售机会表（opportunities）

```json
{
  "entity": "opportunities",
  "fields": [
    { "name": "id", "type": "UUID", "primary": true, "auto": true },
    { "name": "title", "type": "Text", "required": true },
    { "name": "customer", "type": "Relation", "target": "customers", "required": true },
    { "name": "contact", "type": "Relation", "target": "contacts" },
    { "name": "stage", "type": "Enum", "options": ["初步接触", "需求确认", "方案报价", "商务谈判", "赢单", "输单"], "default": "初步接触" },
    { "name": "amount", "type": "Decimal", "precision": 12, "scale": 2 },
    { "name": "probability", "type": "Number", "min": 0, "max": 100 },
    { "name": "expected_close_date", "type": "Date" },
    { "name": "lose_reason", "type": "Text" },
    { "name": "owner", "type": "Relation", "target": "users" },
    { "name": "created_at", "type": "DateTime", "auto": true }
  ],
  "computed_fields": {
    "weighted_amount": { "expression": "amount * probability / 100" }
  }
}
```

### 联系人表与活动记录表

```json
{
  "entity": "contacts",
  "fields": [
    { "name": "id", "type": "UUID", "primary": true },
    { "name": "name", "type": "Text", "required": true },
    { "name": "title", "type": "Text" },
    { "name": "phone", "type": "Text" },
    { "name": "email", "type": "Text", "format": "email" },
    { "name": "customer", "type": "Relation", "target": "customers", "required": true }
  ]
}
{
  "entity": "activities",
  "fields": [
    { "name": "id", "type": "UUID", "primary": true },
    { "name": "type", "type": "Enum", "options": ["电话", "拜访", "邮件", "微信", "会议"] },
    { "name": "title", "type": "Text", "required": true },
    { "name": "content", "type": "LongText" },
    { "name": "customer", "type": "Relation", "target": "customers" },
    { "name": "opportunity", "type": "Relation", "target": "opportunities" },
    { "name": "activity_time", "type": "DateTime", "required": true },
    { "name": "next_follow_date", "type": "Date" },
    { "name": "created_by", "type": "Relation", "target": "users" }
  ]
}
```

## 表单配置

### 客户创建表单

客户创建表单核心字段：客户名称（必填）、行业（必填下拉）、来源渠道、客户等级、负责人（关联用户表，必填）。通过分组布局将基本信息和业务信息分开展示。

商机阶段变更表单通过条件显示实现：新阶段（必填）→ 预计金额（方案报价/商务谈判时显示）→ 预计成交日期（非赢单/输单时显示）→ 输单原因（输单时必填）。

## 工作流配置

### 商机阶段自动更新概率

```yaml
workflow:
  name: 商机阶段变更自动化
  trigger:
    type: data_change
    entity: opportunities
    field: stage
    event: updated

  steps:
    - name: 更新赢单概率
      type: action
      operations:
        - condition: "stage === '初步接触'"
          update: { probability: 10 }
        - condition: "stage === '需求确认'"
          update: { probability: 30 }
        - condition: "stage === '方案报价'"
          update: { probability: 50 }
        - condition: "stage === '商务谈判'"
          update: { probability: 70 }
        - condition: "stage === '赢单'"
          update: { probability: 100 }
        - condition: "stage === '输单'"
          update: { probability: 0 }
```

### 跟进提醒工作流

```yaml
workflow:
  name: 客户跟进提醒
  trigger:
    type: schedule
    cron: "0 9 * * 1-5"

  steps:
    - name: 查询待跟进活动
      type: action
      operation:
        query: { entity: activities, filter: { next_follow_date: "today()" } }

    - name: 发送提醒
      type: notification
      loop: "{{activities}}"
      channels:
        - type: email
          to: "{{item.created_by.email}}"
          subject: "今日跟进提醒：{{item.title}}"
```

## 权限配置

权限按三种角色配置：销售人员（CRUD 自己的客户/商机/活动，行级过滤 owner_id）、销售主管（管理本部门数据，可查看报表导出）、管理员（全部权限）。所有角色的行级权限通过 `currentUser()` 函数动态注入过滤条件。

上线前需逐项检查：数据模型（表、关系、索引、初始数据）、表单页面（校验、条件显示、移动端）、工作流（审批、通知、超时）、权限（角色、行级权限、按钮权限）、测试（完整流程、边界条件、越权访问）。

## 常见误区

1. **跳过需求分析直接搭建**：没有清晰的需求分析，搭出来的系统大概率需要反复返工。花一天时间梳理需求和数据模型，能节省三天的返工时间。

2. **一次性搭建所有功能**：试图一次性搭建所有功能会导致项目周期失控。正确的做法是分阶段交付：第一阶段上线客户管理 + 商机管理，第二阶段上线报表和自动化。

3. **忽视数据迁移**：如果公司已有客户数据散落在 Excel 和其他系统中，数据迁移是上线的关键环节。提前规划数据清洗和导入方案。

## 工程建议

1. **先搭建核心流程，再优化细节**：第一版只需要跑通"创建客户 → 创建商机 → 更新阶段 → 赢单/输单"的完整流程。UI 可以粗糙，但流程必须跑通。

2. **让销售团队参与测试**：最终用户是销售人员，他们的反馈比你的设计稿更有价值。在上线前安排至少两轮用户测试。

3. **建立数据质量规范**：在系统设计阶段就定义好数据录入规范，通过表单校验强制执行。脏数据一旦积累，清理成本远高于预防成本。

## 小结

- CRM 系统的核心是"客户-联系人-商机-活动"四层数据模型，关系设计是关键
- 销售漏斗通过商机阶段管理实现，每个阶段对应不同的赢单概率
- 权限设计需要同时考虑功能权限和数据权限
- 分阶段交付比一次性搭建更可控，先跑通核心流程再优化细节
- 数据质量规范应在系统设计阶段就建立，而不是上线后补救

## 练习

### 练习一：扩展 CRM 数据模型

在现有 CRM 数据模型基础上，增加"合同管理"功能。要求：
- 合同与客户和商机关联
- 合同有审批流程
- 合同到期前 30 天自动提醒

请设计合同表的字段定义和相关工作流。

### 练习二：CRM 报表查询

基于本课设计的 CRM 数据模型，编写以下报表的查询逻辑：
1. 本月各销售人员的商机数量和金额
2. 最近 3 个月的销售漏斗趋势（按月对比）
3. 客户来源渠道的商机转化率

---

## 参考答案

### 练习一

**思路**：合同表需要关联客户和商机，审批流参考报销审批的设计模式

**答案**：

```json
{
  "entity": "contracts",
  "fields": [
    { "name": "id", "type": "UUID", "primary": true },
    { "name": "contract_number", "type": "Text", "required": true, "unique": true },
    { "name": "title", "type": "Text", "required": true },
    { "name": "customer", "type": "Relation", "target": "customers", "required": true },
    { "name": "opportunity", "type": "Relation", "target": "opportunities" },
    { "name": "amount", "type": "Decimal", "precision": 12, "scale": 2, "required": true },
    { "name": "start_date", "type": "Date", "required": true },
    { "name": "end_date", "type": "Date", "required": true },
    { "name": "status", "type": "Enum", "options": ["草稿", "审批中", "已签署", "执行中", "已到期"], "default": "草稿" },
    { "name": "owner", "type": "Relation", "target": "users" },
    { "name": "created_at", "type": "DateTime", "auto": true }
  ]
}
```

合同审批工作流：法务审核 → （金额>5万时）销售总监审批 → 更新状态为已签署。大额合同需要总监加签，合同编号设置唯一约束。到期提醒通过定时任务每天检查 30 天内到期的合同并邮件通知负责人。

### 练习二

**思路**：使用聚合查询（GROUP BY + 聚合函数）实现统计报表

**答案**：

```javascript
// 1. 本月各销售人员的商机数量和金额
const monthlyPerformance = {
  entity: "opportunities",
  groupBy: "owner",
  aggregations: [
    { field: "id", function: "count", alias: "opportunity_count" },
    { field: "amount", function: "sum", alias: "total_amount" }
  ],
  filter: { created_at: { gte: "firstDayOfMonth(today())", lte: "lastDayOfMonth(today())" } },
  orderBy: [{ total_amount: "desc" }]
};

// 2. 最近 3 个月的销售漏斗趋势
const funnelTrend = {
  entity: "opportunities",
  groupBy: ["month(created_at)", "stage"],
  aggregations: [
    { field: "id", function: "count", alias: "count" },
    { field: "amount", function: "sum", alias: "total_amount" }
  ],
  filter: { created_at: { gte: "3 months ago" }, stage: { notIn: ["赢单", "输单"] } }
};

// 3. 客户来源渠道的商机转化率
const conversionBySource = {
  entity: "opportunities",
  groupBy: "customer.source",
  aggregations: [
    { field: "id", function: "count", alias: "total_opportunities" },
    { field: "id", function: "count", alias: "won_opportunities", filter: { stage: "赢单" } }
  ],
  computed: { conversion_rate: "won_opportunities / total_opportunities * 100" },
  orderBy: [{ conversion_rate: "desc" }]
};
```

**要点**：
- 聚合查询需要数据库支持 GROUP BY 和聚合函数
- 转化率需要在聚合结果基础上进行二次计算
- 时间范围过滤使用相对日期表达式便于复用

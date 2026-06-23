# Dashboard 搭建：图表组件、数据源绑定与实时刷新

> 前置知识：低代码基础、数据模型设计（阶段一）

## 一个数据看板的需求

你是一家电商公司的运营负责人，每天需要关注销售额、订单量、转化率等核心指标。过去依赖数据团队每周出 Excel 报表，等报表到手时数据已经过时两三天。

现在你需要用低代码平台搭建一个实时运营 Dashboard——打开浏览器就能看到最新数据。

Dashboard 不是把几个图表堆在一起。它需要解决三个核心问题：数据从哪来、如何展示、如何保持实时更新。

## 图表选型

```
数据类型 → 图表类型：

趋势变化 → 折线图（销售额趋势、用户增长）
对比大小 → 柭状图（各渠道对比、各品类销售额）
占比构成 → 饼图/环形图（订单来源分布）
单一指标 → 仪表盘/数字卡片（今日 GMV、转化率）
排名列表 → 排行榜（热销商品 TOP10）
地理分布 → 地图（各地区销售分布）
```

选图表的原则：**一个图表只回答一个问题。** 不要把多个问题塞进一个图表里。

## 数据源绑定

### 三种绑定模式

```
模式一：API 请求
  └── 图表组件发起 HTTP 请求，获取数据
  └── 适合：实时数据、后端聚合好的数据

模式二：SQL 直连
  └── 图表组件直接查询数据库
  └── 适合：简单查询、数据量不大

模式三：WebSocket 推送
  └── 服务端主动推送数据更新
  └── 适合：实时性要求极高的场景
```

### API 请求示例

```json
{
  "type": "line_chart",
  "dataSource": {
    "type": "api",
    "endpoint": "/api/dashboard/sales-trend",
    "method": "GET",
    "params": {
      "range": "7d",
      "granularity": "day"
    },
    "refreshInterval": 30000
  },
  "xAxis": "date",
  "yAxis": "amount",
  "series": [
    { "field": "this_year", "label": "今年", "color": "#1890ff" },
    { "field": "last_year", "label": "去年", "color": "#d9d9d9" }
  ]
}
```

`refreshInterval: 30000` 表示每 30 秒自动刷新数据。

## KPI 卡片

Dashboard 最显眼的位置应该放核心指标的数字卡片：

```json
{
  "type": "stat_card",
  "title": "今日 GMV",
  "dataSource": {
    "type": "api",
    "endpoint": "/api/dashboard/today-gmv"
  },
  "field": "amount",
  "format": "currency",
  "compare": {
    "field": "yesterday",
    "type": "percentage",
    "positive": "up",
    "negative": "down"
  }
}
```

展示效果：

```
今日 GMV
¥ 1,234,567
↑ 12.3% vs 昨日
```

## 布局策略

```
推荐布局（从上到下）：

第一行：核心 KPI 卡片（4 个）
  [今日 GMV] [今日订单] [转化率] [客单价]

第二行：主要图表（占满宽度）
  [销售趋势折线图]

第三行：次要图表（并排）
  [订单来源饼图] [品类销售柱状图]

第四行：明细数据
  [热销商品排行榜]
```

设计原则：
- 核心指标放在最显眼的位置
- 一个屏幕能看到所有关键信息
- 不需要滚动就能看到最重要的数据

## 实时刷新 vs 手动刷新

```
实时刷新（WebSocket 或定时轮询）：
  ✓ 数据始终是最新的
  ✗ 增加服务器负担
  适合：运营监控大屏、实时交易看板

手动刷新（点击按钮刷新）：
  ✓ 不增加服务器负担
  ✗ 数据可能过时
  适合：日报型看板、历史数据分析
```

折中方案：页面可见时每 30 秒刷新，页面不可见时停止刷新。

## 练习

### 练习一：搭建销售 Dashboard

用低代码平台搭建一个销售 Dashboard，包含：今日 GMV 卡片、7 天销售趋势折线图、订单来源饼图、热销商品 TOP10 排行榜。

### 练习二：实时数据

配置一个 WebSocket 数据源，让 Dashboard 的 GMV 卡片实时更新。当有新订单时，数字应该立即变化。

### 练习三：移动端适配

将你搭建的 Dashboard 适配移动端：KPI 卡片从 4 列变为 2 列，图表从并排变为上下排列。

---

## 参考答案

### 练习一

页面结构：

```json
{
  "layout": "grid",
  "rows": [
    {
      "height": "auto",
      "columns": [
        { "width": "25%", "component": { "type": "stat_card", "title": "今日 GMV", "endpoint": "/api/today-gmv" }},
        { "width": "25%", "component": { "type": "stat_card", "title": "今日订单", "endpoint": "/api/today-orders" }},
        { "width": "25%", "component": { "type": "stat_card", "title": "转化率", "endpoint": "/api/conversion-rate" }},
        { "width": "25%", "component": { "type": "stat_card", "title": "客单价", "endpoint": "/api/avg-order-value" }}
      ]
    },
    { "height": "300px", "component": { "type": "line_chart", "endpoint": "/api/sales-trend" }},
    {
      "height": "300px",
      "columns": [
        { "width": "50%", "component": { "type": "pie_chart", "endpoint": "/api/order-source" }},
        { "width": "50%", "component": { "type": "bar_chart", "endpoint": "/api/category-sales" }}
      ]
    },
    { "height": "400px", "component": { "type": "table", "endpoint": "/api/top-products", "pageSize": 10 }}
  ]
}
```

### 练习二

WebSocket 配置：

```json
{
  "type": "stat_card",
  "dataSource": {
    "type": "websocket",
    "url": "wss://api.example.com/ws/dashboard",
    "subscribe": { "channel": "today-gmv" }
  },
  "field": "amount",
  "format": "currency"
}
```

服务端在有新订单时推送：

```javascript
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ channel: 'today-gmv', data: { amount: 1234567 } }));
});
```

### 练习三

用响应式断点：

```json
{
  "responsive": {
    "mobile": {
      "breakpoint": 768,
      "layout": {
        "kpi_columns": 2,
        "charts_stacked": true
      }
    },
    "desktop": {
      "breakpoint": 1200,
      "layout": {
        "kpi_columns": 4,
        "charts_stacked": false
      }
    }
  }
}
```

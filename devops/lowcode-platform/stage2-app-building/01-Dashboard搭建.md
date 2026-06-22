# Dashboard 搭建：图表组件、数据源绑定与实时刷新

## 场景引入

你是一家电商公司的运营负责人，每天需要关注销售额、订单量、转化率等核心指标。过去依赖数据团队每周出 Excel 报表，等报表到手时数据已经过时两三天。现在公司决定用低代码平台搭建实时运营 Dashboard，打开浏览器就能看到最新业务数据。

Dashboard 不是简单地把几个图表堆在一起，它需要解决几个核心问题：数据从哪里来、如何展示、如何保持实时更新、如何在有限屏幕空间里呈现最有价值的信息。

本节课将从零搭建一个功能完整的 Dashboard，覆盖图表组件选型、数据源绑定、实时刷新机制和布局策略。

## 学习目标

- 掌握常见图表组件（折线图、柱状图、饼图、仪表盘）的选型与配置
- 理解数据源绑定的三种模式：API 请求、SQL 直连、WebSocket 推送
- 实现基于轮询和 WebSocket 的实时数据刷新方案
- 学会 Dashboard 布局设计与 KPI 卡片的使用技巧

## 图表组件体系

### 图表类型与适用场景

选择图表类型的核心原则：**数据关系决定图表形式**。

| 数据关系 | 推荐图表 | 典型场景 |
|---------|---------|---------|
| 趋势变化 | 折线图 | 销售额月度趋势 |
| 大小对比 | 柱状图 | 各区域业绩对比 |
| 占比构成 | 饼图/环形图 | 渠道来源占比 |
| 单一指标 | 仪表盘/进度条 | 目标完成率 |

### KPI 卡片组件

KPI 卡片是 Dashboard 中最重要的信息单元，用于展示单一核心指标：

```typescript
interface KpiCardConfig {
  type: 'kpi-card'
  title: string
  metric: {
    field: string
    format: 'number' | 'currency' | 'percent'
    prefix?: string
    suffix?: string
    precision?: number
  }
  comparison: {
    enabled: boolean
    field: string
    direction: 'up-good' | 'down-good'
  }
  sparkline: { enabled: boolean; field: string; color?: string }
  threshold?: { warning: number; danger: number }
}

const orderKpi: KpiCardConfig = {
  type: 'kpi-card',
  title: '今日订单数',
  metric: { field: 'orderCount', format: 'number', precision: 0 },
  comparison: { enabled: true, field: 'orderCountChange', direction: 'up-good' },
  sparkline: { enabled: true, field: 'orderTrend', color: '#52c41a' },
  threshold: { warning: 500, danger: 200 }
}
```

### 折线图配置示例

```typescript
const salesTrendConfig = {
  type: 'line',
  title: '近30天销售趋势',
  xAxis: { field: 'date', label: '日期', type: 'time' },
  yAxis: { field: 'amount', label: '销售额(万元)', format: 'currency' },
  series: [
    { field: 'current', name: '本期', color: '#1890ff', smooth: true, areaStyle: true },
    { field: 'previous', name: '上期', color: '#999', smooth: true }
  ],
  tooltip: { trigger: 'axis' }
}
```

## 数据源绑定

### API 请求绑定

最常见的数据源方式，通过 HTTP 请求获取后端接口数据：

```typescript
interface ApiDataSource {
  type: 'api'
  url: string
  method: 'GET' | 'POST'
  params?: Record<string, any>
  transform?: { path: string; mapping: Record<string, string> }
  cache?: { enabled: boolean; ttl: number }
}

const salesApiSource: ApiDataSource = {
  type: 'api',
  url: '/api/dashboard/sales-trend',
  method: 'GET',
  params: { range: '30d' },
  transform: { path: 'data.items', mapping: { date: 'reportDate', current: 'currentAmount' } },
  cache: { enabled: true, ttl: 60 }
}
```

### SQL 直连与 WebSocket 推送

```typescript
// SQL 直连：适合内部管理系统
const dailyOrderSource = {
  type: 'sql',
  connection: 'mysql-prod-readonly',
  query: `SELECT DATE(created_at) AS date, COUNT(*) AS cnt FROM orders
           WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY date`,
  refreshInterval: 300
}

// WebSocket 推送：适合实时交易监控
const realtimeSource = {
  type: 'websocket',
  url: 'wss://api.example.com/ws/dashboard',
  topic: 'realtime-transactions',
  reconnect: { enabled: true, maxRetries: 10, interval: 3000 }
}
```

## 实时刷新机制

### 轮询策略

```typescript
class PollingManager {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private interval: number, private onHidden: 'pause' | 'continue') {}

  start(fetchFn: () => Promise<void>) {
    if (this.onHidden === 'pause') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.pause()
        else this.resume(fetchFn)
      })
    }
    this.timer = setInterval(fetchFn, this.interval * 1000)
    fetchFn()
  }

  pause() { if (this.timer) clearInterval(this.timer) }

  resume(fetchFn: () => Promise<void>) {
    this.timer = setInterval(fetchFn, this.interval * 1000)
    fetchFn()
  }

  stop() { if (this.timer) clearInterval(this.timer) }
}
```

### WebSocket 实时更新

```typescript
function useRealtimeData(topic: string) {
  const [data, setData] = useState<any>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/ws/${topic}`)
    ws.onopen = () => setStatus('connected')
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      setData((prev: any) => mergeData(prev, payload))
    }
    ws.onclose = () => setStatus('disconnected')
    return () => ws.close()
  }, [topic])

  return { data, status }
}
```

## Dashboard 布局策略

采用 24 列栅格系统，核心原则是**重要信息优先、视觉层次清晰**：

```typescript
const salesDashboard = {
  type: 'grid', columns: 24, gap: 16,
  rows: [
    {
      height: 120,
      cells: [
        { span: 6, component: 'kpi-card', config: { title: '今日销售额' } },
        { span: 6, component: 'kpi-card', config: { title: '今日订单数' } },
        { span: 6, component: 'kpi-card', config: { title: '转化率' } },
        { span: 6, component: 'kpi-card', config: { title: '客单价' } }
      ]
    },
    {
      height: 400,
      cells: [
        { span: 16, component: 'line-chart', config: { title: '销售趋势' } },
        { span: 8, component: 'pie-chart', config: { title: '渠道占比' } }
      ]
    }
  ]
}
```

## 常见误区

1. **图表越多越好**：Dashboard 信息过载会让人抓不住重点。单个 Dashboard 的核心指标不应超过 6-8 个
2. **实时等于秒级更新**：大多数业务场景 1-5 分钟的刷新频率已足够，过于频繁会增加服务器压力
3. **忽略加载状态**：图表数据加载需要时间，必须有 loading 状态和空数据占位

## 工程建议

1. **数据源与图表解耦**：数据源配置和图表配置应分开管理，同一数据源可被多个图表引用
2. **优先使用缓存**：不频繁变化的数据开启缓存，TTL 设置为数据更新周期的 1.5 倍
3. **移动端优先考虑 KPI 卡片**：复杂图表在手机上看不清，优先展示 KPI 卡片和简化趋势图

## 小结

- 图表选型应基于数据关系：趋势用折线、对比用柱状、占比用饼图
- 数据源绑定有 API、SQL、WebSocket 三种模式，根据实时性要求选择
- 实时刷新推荐页面可见性感知的轮询方案，高频场景使用 WebSocket
- 布局设计遵循 Z 型阅读动线，核心 KPI 放顶部，趋势图和明细表在下方

## 练习

### 练习一：设计销售 Dashboard

为 B2B 电商平台设计运营 Dashboard，需展示：月度 GMV 趋势、Top10 客户贡献、产品类目占比、退货率异常告警。写出组件选型和数据源配置方案。

### 练习二：实现实时订单监控

使用 WebSocket 实现实时订单监控面板：新订单实时推送、显示最近 50 条滚动列表、每 10 秒更新汇总统计。

---

## 参考答案

### 练习一

**思路**：GMV 趋势用折线图，Top10 用横向柱状图，类目用环形图，退货率用仪表盘配合阈值告警。数据源统一走 API，5 分钟缓存。

**答案**：

```typescript
const b2bDashboard = {
  rows: [
    { height: 120, cells: [
      { span: 6, component: 'kpi-card', config: { title: '月度GMV', metric: 'monthlyGmv', format: 'currency' } },
      { span: 6, component: 'kpi-card', config: { title: '活跃客户数', metric: 'activeClients' } },
      { span: 6, component: 'kpi-card', config: { title: '平均客单价', metric: 'avgOrderValue', format: 'currency' } },
      { span: 6, component: 'kpi-card', config: { title: '退货率', metric: 'returnRate', format: 'percent',
        threshold: { warning: 5, danger: 10 } } }
    ]},
    { height: 350, cells: [
      { span: 14, component: 'line-chart', config: { title: '月度GMV趋势',
        dataSource: { type: 'api', url: '/api/gmv/trend', cache: { ttl: 300 } } } },
      { span: 10, component: 'pie-chart', config: { title: '产品类目占比' } }
    ]},
    { height: 350, cells: [
      { span: 24, component: 'bar-chart', config: { title: 'Top10客户贡献', orientation: 'horizontal' } }
    ]}
  ]
}
```

**要点**：
- KPI 卡片放顶部第一行，快速传达核心指标
- 退货率使用阈值配置，超过 5% 黄色告警，超过 10% 红色告警
- 数据源缓存 TTL 300 秒，匹配数据更新频率

### 练习二

**思路**：WebSocket 接收新订单，维护 50 条滚动数组。汇总统计用独立轮询，避免每次推送都重算。

**答案**：

```typescript
function useOrderMonitor() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ todayCount: 0, todayAmount: 0 })

  useEffect(() => {
    const ws = new WebSocket('wss://api.example.com/ws/orders')
    ws.onmessage = (event) => {
      const newOrder = JSON.parse(event.data)
      setOrders(prev => [newOrder, ...prev].slice(0, 50))
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/orders/today-stats')
      setStats(await res.json())
    }
    fetchStats()
    const timer = setInterval(fetchStats, 10000)
    return () => clearInterval(timer)
  }, [])

  return { orders, stats }
}
```

**要点**：
- 新订单通过 WebSocket 实时推送，slice(0, 50) 保持固定长度
- 汇总统计 10 秒轮询，避免每次推送都重算聚合数据
- 组件卸载时清理 WebSocket 和 setInterval，防止内存泄漏

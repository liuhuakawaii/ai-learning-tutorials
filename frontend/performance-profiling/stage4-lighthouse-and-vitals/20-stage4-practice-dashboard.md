# 阶段实战：搭建一个性能监控 Dashboard

> 把前几课学到的指标采集、Field Data、性能预算组合起来，搭建一个可以看到实时性能数据的 Dashboard。

## 目标

搭建一个简单的性能监控 Dashboard，展示：
- 各页面的 LCP、INP、CLS 趋势
- 性能预算是否达标
- 最慢的页面列表
- 设备和网络维度的分布

## 架构设计

```
用户浏览器 → 采集 web-vitals → 发送到 API → 存储到数据库
                                                    ↓
                                            Dashboard 读取并展示
```

简化版用 localStorage 或 JSON 文件存储，不需要真正的后端。

## 第一步：采集端

```tsx
// vitals-reporter.ts
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals'

interface VitalsPayload {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  page: string
  timestamp: number
  deviceMemory?: number
  connectionType?: string
}

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
  }
  const [good, poor] = thresholds[name] ?? [0, 0]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function report(metric: Metric) {
  const payload: VitalsPayload = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    page: location.pathname,
    timestamp: Date.now(),
    deviceMemory: (navigator as any).deviceMemory,
    connectionType: (navigator as any).connection?.effectiveType,
  }

  // 用 localStorage 模拟存储（实际项目用 API）
  const stored = JSON.parse(localStorage.getItem('vitals') || '[]')
  stored.push(payload)
  localStorage.setItem('vitals', JSON.stringify(stored))

  // 同时用 sendBeacon 发送（如果有后端）
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', JSON.stringify(payload))
  }
}

export function initVitalsReporting() {
  onLCP(report)
  onINP(report)
  onCLS(report)
}
```

## 第二步：Dashboard 组件

```tsx
import { useEffect, useState } from 'react'

interface VitalsPayload {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  page: string
  timestamp: number
}

function useVitalsData() {
  const [data, setData] = useState<VitalsPayload[]>([])

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('vitals') || '[]')
    setData(stored)
  }, [])

  return data
}

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function VitalsDashboard() {
  const data = useVitalsData()

  const lcpValues = data.filter((d) => d.name === 'LCP').map((d) => d.value)
  const inpValues = data.filter((d) => d.name === 'INP').map((d) => d.value)
  const clsValues = data.filter((d) => d.name === 'CLS').map((d) => d.value)

  const lcpMedian = lcpValues.length ? getMedian(lcpValues) : 0
  const inpMedian = inpValues.length ? getMedian(inpValues) : 0
  const clsMedian = clsValues.length ? getMedian(clsValues) : 0

  return (
    <div style={{ fontFamily: 'monospace', padding: 20 }}>
      <h1>Performance Dashboard</h1>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <MetricCard
          name="LCP"
          value={lcpMedian}
          unit="ms"
          threshold={2500}
          format={(v) => `${(v / 1000).toFixed(2)}s`}
        />
        <MetricCard
          name="INP"
          value={inpMedian}
          unit="ms"
          threshold={200}
          format={(v) => `${v.toFixed(0)}ms`}
        />
        <MetricCard
          name="CLS"
          value={clsMedian}
          unit=""
          threshold={0.1}
          format={(v) => v.toFixed(3)}
        />
      </div>

      <h2>最近采集记录</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>时间</th>
            <th style={thStyle}>指标</th>
            <th style={thStyle}>数值</th>
            <th style={thStyle}>评级</th>
            <th style={thStyle}>页面</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(-20).reverse().map((item, i) => (
            <tr key={i}>
              <td style={tdStyle}>{new Date(item.timestamp).toLocaleTimeString()}</td>
              <td style={tdStyle}>{item.name}</td>
              <td style={tdStyle}>{item.name === 'CLS' ? item.value.toFixed(3) : `${item.value.toFixed(0)}ms`}</td>
              <td style={{ ...tdStyle, color: ratingColor[item.rating] }}>{item.rating}</td>
              <td style={tdStyle}>{item.page}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ratingColor = {
  good: '#0cce6b',
  'needs-improvement': '#ffa400',
  poor: '#ff4e42',
}

const thStyle = { textAlign: 'left' as const, padding: '8px', borderBottom: '2px solid #333' }
const tdStyle = { padding: '8px', borderBottom: '1px solid #eee' }

function MetricCard({ name, value, threshold, format }: {
  name: string
  value: number
  unit: string
  threshold: number
  format: (v: number) => string
}) {
  const isGood = value <= threshold
  return (
    <div style={{
      padding: 16,
      border: `2px solid ${isGood ? '#0cce6b' : '#ff4e42'}`,
      borderRadius: 8,
      minWidth: 150,
    }}>
      <div style={{ fontSize: 14, color: '#666' }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 'bold' }}>{format(value)}</div>
      <div style={{ fontSize: 12, color: '#999' }}>目标: {format(threshold)}</div>
    </div>
  )
}
```

## 第三步：按页面分组

Dashboard 应该能按页面分组查看性能数据：

```tsx
function PageBreakdown({ data }: { data: VitalsPayload[] }) {
  const byPage = new Map<string, VitalsPayload[]>()
  data.forEach((item) => {
    if (!byPage.has(item.page)) byPage.set(item.page, [])
    byPage.get(item.page)!.push(item)
  })

  return (
    <div>
      <h2>按页面分组</h2>
      {Array.from(byPage.entries()).map(([page, items]) => {
        const lcpMedian = getMedian(items.filter((i) => i.name === 'LCP').map((i) => i.value))
        return (
          <div key={page} style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace' }}>{page}</span>
            <span style={{ marginLeft: 16, color: lcpMedian > 2500 ? '#ff4e42' : '#0cce6b' }}>
              LCP: {(lcpMedian / 1000).toFixed(2)}s
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

## 第四步：集成到项目

```tsx
// main.tsx
import { initVitalsReporting } from './vitals-reporter'

// 在生产环境启用采集
if (import.meta.env.PROD) {
  initVitalsReporting()
}
```

## 练习

### 练习一：搭建并运行

在你的 React 项目里实现上面的采集和 Dashboard：

1. 集成 `web-vitals` 采集
2. 实现 Dashboard 组件
3. 多访问几个页面，收集数据
4. 在 Dashboard 里查看各页面的指标

### 练习二：添加性能预算检查

在 Dashboard 里添加预算检查功能：

1. 定义预算常量（LCP < 2.5s, INP < 200ms, CLS < 0.1）
2. 在 MetricCard 里显示是否超标
3. 添加一个"预算检查"列表，显示哪些页面的哪些指标超标

---

## 参考答案

### 练习一

实现后，你应该能看到：
- Dashboard 展示了所有采集到的 LCP、INP、CLS 数据
- 每个指标有中位数值和评级（good/needs-improvement/poor）
- 最近采集记录按时间倒序排列

注意：开发模式的性能数据不代表生产环境。建议用 `npm run build && npm run preview` 运行生产版本来采集。

### 练习二

预算检查的实现：

```tsx
const budgets = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
}

function BudgetCheck({ data }: { data: VitalsPayload[] }) {
  const byPage = new Map<string, VitalsPayload[]>()
  data.forEach((item) => {
    if (!byPage.has(item.page)) byPage.set(item.page, [])
    byPage.get(item.page)!.push(item)
  })

  const violations: Array<{ page: string; metric: string; value: number; budget: number }> = []

  byPage.forEach((items, page) => {
    for (const [metric, budget] of Object.entries(budgets)) {
      const values = items.filter((i) => i.name === metric).map((i) => i.value)
      const p75 = getPercentile(values, 75)
      if (p75 > budget) {
        violations.push({ page, metric, value: p75, budget })
      }
    }
  })

  return (
    <div>
      <h2>预算超标项</h2>
      {violations.length === 0 ? (
        <p style={{ color: '#0cce6b' }}>所有页面达标 ✓</p>
      ) : (
        violations.map((v, i) => (
          <div key={i} style={{ color: '#ff4e42' }}>
            {v.page}: {v.metric} = {v.value.toFixed(0)}ms (预算 {v.budget}ms)
          </div>
        ))
      )}
    </div>
  )
}
```

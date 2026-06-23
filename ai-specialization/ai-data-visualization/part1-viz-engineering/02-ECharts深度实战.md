# 02 - ECharts 深度实战：从配置项到自定义系列、主题系统

> ECharts 的配置项只是冰山一角，真正的深度在于理解它的坐标系、渲染管线和扩展机制。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 1: 数据可视化工程基础 |
| 前置课程 | 01-数据可视化工程观 |
| 预计时长 | 2.5 小时 |
| 难度等级 | ⭐⭐⭐ |

---

## 场景引入

上一课我们用 ECharts 搭建了一个基础的销售看板。折线图、饼图这些标准图表用默认配置就能搞定。但产品经理很快提出了新需求：

1. "我想要一个**自定义的漏斗图**，每个阶段的宽度不是固定的，要根据实际转化率动态计算。"
2. "图表要支持**深色模式切换**，用户可以在页面右上角切换主题。"
3. "数据量大的时候（5 万条以上）折线图**明显卡顿**，要优化。"

这三个需求分别对应 ECharts 的三个进阶能力：**自定义系列**、**主题系统**、**大数据量优化**。掌握这三个能力，你才算真正"会用"ECharts。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 ECharts 的核心架构：Option 驱动 vs API 驱动
2. 掌握直角坐标系、极坐标系、地理坐标系的原理与应用
3. 使用自定义系列（custom series）实现非标准图表
4. 设计和实现一套可复用的主题系统
5. 掌握大数据量场景下的渲染优化策略
6. 构建一个支持主题切换的销售数据分析仪表盘

---

## 核心概念

### 一、ECharts 核心架构：Option 驱动 vs API 驱动

ECharts 有两种使用方式，理解它们的区别是深入使用的基础。

**Option 驱动**是声明式的：你描述"图表应该是什么样的"，ECharts 负责渲染。

```typescript
chart.setOption({
  xAxis: { type: 'category', data: ['一月', '二月', '三月'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [120, 200, 150] }]
})
```

**API 驱动**是命令式的：你告诉 ECharts "做什么操作"。

```typescript
chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: 1 })
chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: 0 })
```

实际项目中两者结合使用。Option 用于定义图表结构和数据，API 用于触发交互行为。

```
┌─────────────────────────────────────────────────────┐
│                   ECharts 架构                       │
│                                                     │
│  Option (声明式)          API (命令式)               │
│  ┌─────────────┐         ┌─────────────┐           │
│  │ setOption() │         │dispatchAction│           │
│  └──────┬──────┘         └──────┬──────┘           │
│         │                       │                   │
│         ▼                       ▼                   │
│  ┌─────────────────────────────────────┐           │
│  │          内部状态管理                 │           │
│  │  (模型层：数据、坐标系、组件)         │           │
│  └──────────────────┬──────────────────┘           │
│                     │                               │
│                     ▼                               │
│  ┌─────────────────────────────────────┐           │
│  │          渲染管线                     │           │
│  │  Canvas / SVG / SSR                  │           │
│  └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

**关键理解**：`setOption` 不是"重新渲染"，而是"增量更新"。ECharts 内部会 diff 新旧 option，只更新变化的部分。这是性能优化的基础。

### 二、坐标系系统

ECharts 支持多种坐标系，理解坐标系是正确使用图表的前提。

#### 直角坐标系（cartesian2d）

最常用的坐标系，用于折线图、柱状图、散点图。

```
  Y轴
   │
   │    ┌───┐
   │    │   │      ┌───┐
   │ ┌──┤   │      │   │
   │ │  │   │  ┌───┤   │
   │ │  │   │  │   │   │
   └─┴──┴───┴──┴───┴───┴── X轴
     A    B     C    D
```

直角坐标系的核心配置：

```typescript
{
  xAxis: {
    type: 'category',     // 类目轴：data 数组定义刻度
    data: ['Q1', 'Q2', 'Q3', 'Q4'],
    axisLabel: { rotate: 30 },  // 标签旋转防重叠
  },
  yAxis: {
    type: 'value',         // 数值轴：自动根据数据计算范围
    name: '销售额（万元）',
    axisLabel: {
      formatter: '{value}'  // 自定义标签格式
    }
  },
  grid: {
    left: 80,              // 留出空间给 Y 轴标签
    right: 40,
    top: 40,
    bottom: 60,            // 留出空间给旋转的 X 轴标签
  }
}
```

一个直角坐标系上可以叠加多个系列，这是实现"折线+柱状"混合图的基础：

```typescript
series: [
  { type: 'bar', data: [120, 200, 150, 180] },
  { type: 'line', data: [120, 200, 150, 180], smooth: true }
]
```

#### 极坐标系（polar）

用于雷达图、玫瑰图、极坐标柱状图。

```
        90°
         │
         │
  180° ──┼── 0°
         │
         │
        270°
```

极坐标系的关键配置：

```typescript
{
  polar: {},
  angleAxis: {        // 角度轴
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  radiusAxis: {},     // 半径轴
  series: [{
    type: 'bar',
    coordinateSystem: 'polar',
    data: [1, 2, 3, 4, 3, 5, 1],
  }]
}
```

#### 地理坐标系（geo）

用于地图、热力地图、地理散点图。

```typescript
{
  geo: {
    map: 'china',
    roam: true,           // 支持缩放和拖拽
    label: { show: true },
    itemStyle: {
      areaColor: '#eee',
      borderColor: '#333',
    },
  },
  series: [{
    type: 'scatter',
    coordinateSystem: 'geo',
    data: [
      { name: '北京', value: [116.46, 39.92, 1200] },
      { name: '上海', value: [121.48, 31.22, 980] },
    ],
  }]
}
```

### 三、自定义系列（Custom Series）

自定义系列是 ECharts 最强大的能力之一。当内置图表类型无法满足需求时，你可以用 `custom` 系列完全控制每个数据点的渲染方式。

#### 核心原理

自定义系列提供一个 `renderItem` 函数，ECharts 在渲染每个数据点时会调用这个函数，你返回一个图形描述（graphic element）。

```
数据点 → renderItem(params, api) → 图形描述 → ECharts 渲染
```

`params` 包含当前数据点的索引、系列信息等。`api` 提供了两个关键能力：
- `api.value(dim)`：获取当前数据点在某个维度上的值
- `api.coord([x, y])`：把数据坐标转换为像素坐标

#### 实战：自定义进度条柱状图

假设我们要展示各销售员的目标完成率，用渐变进度条替代普通柱状图：

```typescript
const progressOption = {
  xAxis: { type: 'value', max: 100 },
  yAxis: {
    type: 'category',
    data: ['张三', '李四', '王五', '赵六', '钱七'],
    inverse: true,       // 从上到下排列
  },
  series: [{
    type: 'custom',
    data: [85, 72, 95, 60, 88],  // 完成率百分比
    renderItem: (params: any, api: any) => {
      const categoryIndex = api.value(0)  // 这里 dataIndex 通过 params
      const value = api.value(1)          // 当前值（完成率）
      const start = api.coord([0, categoryIndex])
      const end = api.coord([value, categoryIndex])
      const barHeight = 20

      return {
        type: 'group',
        children: [
          // 背景条（灰色）
          {
            type: 'rect',
            shape: {
              x: start[0],
              y: start[1] - barHeight / 2,
              width: api.coord([100, 0])[0] - start[0],
              height: barHeight,
            },
            style: {
              fill: '#e8e8e8',
              radius: [0, barHeight / 2, barHeight / 2, 0],
            },
          },
          // 进度条（渐变色）
          {
            type: 'rect',
            shape: {
              x: start[0],
              y: start[1] - barHeight / 2,
              width: end[0] - start[0],
              height: barHeight,
            },
            style: {
              fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#5470C6' },
                { offset: 1, color: '#91CC75' },
              ]),
              radius: [0, barHeight / 2, barHeight / 2, 0],
            },
          },
          // 百分比文字
          {
            type: 'text',
            style: {
              text: `${value}%`,
              x: end[0] + 8,
              y: start[1],
              fill: '#333',
              fontSize: 13,
              verticalAlign: 'middle',
            },
          },
        ],
      }
    },
  }],
}
```

#### 实战：自定义甘特图

甘特图是项目管理中的常用图表，ECharts 没有内置，但可以用自定义系列实现：

```typescript
interface TaskData {
  taskName: string
  assignee: string
  startDate: number  // 时间戳
  endDate: number
  progress: number   // 0-100
}

function buildGanttOption(tasks: TaskData[]) {
  const categories = tasks.map(t => t.taskName)
  const minTime = Math.min(...tasks.map(t => t.startDate))
  const maxTime = Math.max(...tasks.map(t => t.endDate))

  return {
    xAxis: {
      type: 'time',
      min: minTime,
      max: maxTime,
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
    },
    series: [{
      type: 'custom',
      renderItem: (params: any, api: any) => {
        const taskIndex = params.dataIndex
        const task = tasks[taskIndex]

        const startCoord = api.coord([task.startDate, taskIndex])
        const endCoord = api.coord([task.endDate, taskIndex])
        const barHeight = 24

        const progressWidth = (endCoord[0] - startCoord[0]) * (task.progress / 100)

        return {
          type: 'group',
          children: [
            // 任务背景
            {
              type: 'rect',
              shape: {
                x: startCoord[0],
                y: startCoord[1] - barHeight / 2,
                width: endCoord[0] - startCoord[0],
                height: barHeight,
              },
              style: {
                fill: '#e8e8e8',
                radius: 4,
              },
            },
            // 进度
            {
              type: 'rect',
              shape: {
                x: startCoord[0],
                y: startCoord[1] - barHeight / 2,
                width: progressWidth,
                height: barHeight,
              },
              style: {
                fill: '#5470C6',
                radius: [4, 0, 0, 4],
              },
            },
          ],
        }
      },
      encode: { x: [0, 1], y: 0 },
      data: tasks.map(t => [t.startDate, t.endDate, t.progress]),
    }],
  }
}
```

### 四、主题系统

ECharts 的主题系统让你可以全局控制图表的视觉风格，而不需要在每个 option 里重复配置。

#### 内置主题

ECharts 内置了 `light` 和 `dark` 两个主题：

```typescript
// 使用内置暗色主题
const chart = echarts.init(container, 'dark')
```

#### 自定义主题

自定义主题有两种方式：

**方式一：注册主题对象**

```typescript
const salesDarkTheme = {
  color: ['#58D9F9', '#05C091', '#FFD700', '#FF6B6B', '#7B68EE'],
  backgroundColor: '#1a1a2e',
  textStyle: {
    color: '#e0e0e0',
    fontSize: 13,
  },
  title: {
    textStyle: { color: '#ffffff' },
    subtextStyle: { color: '#b0b0b0' },
  },
  legend: {
    textStyle: { color: '#b0b0b0' },
  },
  tooltip: {
    backgroundColor: 'rgba(30, 30, 60, 0.9)',
    borderColor: '#3a3a5c',
    textStyle: { color: '#e0e0e0' },
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#3a3a5c' } },
    axisTick: { lineStyle: { color: '#3a3a5c' } },
    axisLabel: { color: '#b0b0b0' },
    splitLine: { lineStyle: { color: '#2a2a4a' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#3a3a5c' } },
    axisTick: { lineStyle: { color: '#3a3a5c' } },
    axisLabel: { color: '#b0b0b0' },
    splitLine: { lineStyle: { color: '#2a2a4a' } },
  },
}

echarts.registerTheme('salesDark', salesDarkTheme)
```

**方式二：主题文件（JSON）**

```json
{
  "color": ["#58D9F9", "#05C091", "#FFD700"],
  "backgroundColor": "#1a1a2e",
  "textStyle": { "color": "#e0e0e0" }
}
```

#### 动态主题切换

动态主题切换的核心问题是：ECharts 不支持直接切换主题，需要销毁重建实例。

```typescript
function useThemeSwitch(initialTheme: string) {
  const [currentTheme, setCurrentTheme] = useState(initialTheme)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const optionRef = useRef<echarts.EChartsOption>({})

  useEffect(() => {
    if (!containerRef.current) return

    // 销毁旧实例
    if (chartRef.current) {
      optionRef.current = chartRef.current.getOption()
      chartRef.current.dispose()
    }

    // 用新主题创建实例
    const chart = echarts.init(containerRef.current, currentTheme)
    chartRef.current = chart

    // 恢复之前的配置
    if (Object.keys(optionRef.current).length > 0) {
      chart.setOption(optionRef.current)
    }

    return () => chart.dispose()
  }, [currentTheme])

  const switchTheme = (theme: string) => {
    setCurrentTheme(theme)
  }

  return { containerRef, chartRef, switchTheme, currentTheme }
}
```

### 五、大数据量优化

当数据量超过 1 万条时，默认配置的 ECharts 会明显卡顿。以下是几种优化策略。

#### 策略一：sampling（采样）

对于折线图，当数据点远多于像素点时，可以通过采样减少渲染的数据点数：

```typescript
{
  series: [{
    type: 'line',
    data: largeDataset,  // 10 万条数据
    sampling: 'lttb',    // Largest Triangle Three Buckets 算法
    // 可选值: 'average' | 'min' | 'max' | 'sum' | 'lttb'
    // lttb 保留了数据的视觉特征，效果最好
  }]
}
```

`lttb`（Largest Triangle Three Buckets）算法会在保持数据视觉特征的前提下，把 10 万个点采样到几千个点。这是 ECharts 5.x 推荐的采样策略。

#### 策略二：dataZoom 按需加载

配合 dataZoom 组件，只渲染可视区域的数据：

```typescript
{
  dataZoom: [
    {
      type: 'inside',  // 鼠标滚轮缩放
      start: 0,
      end: 10,         // 初始只显示 10% 的数据
    },
    {
      type: 'slider',  // 底部滑块
      start: 0,
      end: 10,
    },
  ],
  series: [{
    type: 'line',
    data: largeDataset,
    large: true,        // 开启大数据量优化
    largeThreshold: 5000,
  }]
}
```

#### 策略三：增量渲染（progressive rendering）

对于超大数据集（百万级），可以启用增量渲染，分批绘制数据点：

```typescript
{
  series: [{
    type: 'scatter',
    data: millionPoints,
    large: true,
    progressive: 1000,       // 每次渲染 1000 个点
    progressiveThreshold: 5000,  // 数据量超过 5000 时启用
  }]
}
```

#### 策略四：Canvas vs SVG 选择

ECharts 5.x 支持 Canvas 和 SVG 两种渲染器：

```typescript
// Canvas（默认）：适合大数据量、频繁更新
const chart = echarts.init(container, undefined, { renderer: 'canvas' })

// SVG：适合少量数据、需要高保真导出、无障碍访问
const chart = echarts.init(container, undefined, { renderer: 'svg' })
```

选择原则：
- 数据量 < 1000 且需要 SEO/无障碍 → SVG
- 数据量 > 1000 或需要频繁更新 → Canvas

---

## 完整代码示例：支持主题切换的销售数据分析仪表盘

下面实现一个完整的仪表盘，包含主题切换、自定义系列和大数据量优化。

### 主题定义

```typescript
// src/themes/lightTheme.ts
export const lightTheme = {
  color: ['#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE', '#3BA272', '#FC8452'],
  backgroundColor: '#ffffff',
  title: { textStyle: { color: '#1a1a1a' } },
  legend: { textStyle: { color: '#666' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#e8e8e8',
    textStyle: { color: '#333' },
    extraCssText: 'box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 8px;',
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#d9d9d9' } },
    axisLabel: { color: '#666' },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#d9d9d9' } },
    axisLabel: { color: '#666' },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
  },
}

// src/themes/darkTheme.ts
export const darkTheme = {
  color: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#fc8452'],
  backgroundColor: '#0d1117',
  title: { textStyle: { color: '#e6edf3' } },
  legend: { textStyle: { color: '#8b949e' } },
  tooltip: {
    backgroundColor: 'rgba(22,27,34,0.95)',
    borderColor: '#30363d',
    textStyle: { color: '#e6edf3' },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.3); border-radius: 8px;',
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' },
    splitLine: { lineStyle: { color: '#21262d' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' },
    splitLine: { lineStyle: { color: '#21262d' } },
  },
}
```

### 主题上下文

```typescript
// src/context/ThemeContext.tsx
import { createContext, useContext, useState, useCallback } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <div data-theme={mode} className={`theme-${mode}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

### 通用图表 Hook（支持主题切换）

```typescript
// src/hooks/useEChart.ts
import { useRef, useEffect, useState } from 'react'
import * as echarts from 'echarts'
import { useTheme } from '../context/ThemeContext'
import { lightTheme } from '../themes/lightTheme'
import { darkTheme } from '../themes/darkTheme'

echarts.registerTheme('customLight', lightTheme)
echarts.registerTheme('customDark', darkTheme)

export function useEChart() {
  const { mode } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const savedOptionRef = useRef<echarts.EChartsOption>({})
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    // 保存当前配置
    if (chartRef.current) {
      savedOptionRef.current = chartRef.current.getOption()
      chartRef.current.dispose()
    }

    const themeName = mode === 'dark' ? 'customDark' : 'customLight'
    const chart = echarts.init(containerRef.current, themeName)
    chartRef.current = chart

    // 恢复配置
    if (Object.keys(savedOptionRef.current).length > 0) {
      chart.setOption(savedOptionRef.current)
    }

    setIsReady(true)

    // 响应式
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [mode])

  const setOption = (option: echarts.EChartsOption, notMerge = false) => {
    savedOptionRef.current = option
    chartRef.current?.setOption(option, notMerge)
  }

  return { containerRef, chartRef, setOption, isReady }
}
```

### 自定义漏斗图组件

```tsx
// src/components/ConversionFunnel.tsx
import { useEffect } from 'react'
import { Card } from 'antd'
import * as echarts from 'echarts'
import { useEChart } from '../hooks/useEChart'

interface FunnelData {
  stage: string
  count: number
  color: string
}

const conversionData: FunnelData[] = [
  { stage: '访问', count: 10000, color: '#5470C6' },
  { stage: '注册', count: 6000, color: '#91CC75' },
  { stage: '加购', count: 3500, color: '#FAC858' },
  { stage: '下单', count: 2000, color: '#EE6666' },
  { stage: '支付', count: 1600, color: '#73C0DE' },
]

export function ConversionFunnel() {
  const { containerRef, setOption, isReady } = useEChart()

  useEffect(() => {
    if (!isReady) return

    const maxCount = conversionData[0].count
    const stageCount = conversionData.length

    setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = conversionData[params.dataIndex]
          const rate = ((data.count / maxCount) * 100).toFixed(1)
          const prevRate = params.dataIndex > 0
            ? ((data.count / conversionData[params.dataIndex - 1].count) * 100).toFixed(1)
            : '100.0'
          return `
            <div style="font-weight:600">${data.stage}</div>
            <div>数量: ${data.count.toLocaleString()}</div>
            <div>总转化率: ${rate}%</div>
            ${params.dataIndex > 0 ? `<div>阶段转化率: ${prevRate}%</div>` : ''}
          `
        },
      },
      series: [{
        type: 'funnel',
        left: '10%',
        top: 20,
        bottom: 20,
        width: '80%',
        min: 0,
        max: maxCount,
        minSize: '10%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => {
            const data = conversionData[params.dataIndex]
            const rate = ((data.count / maxCount) * 100).toFixed(1)
            return `${data.stage}\n${data.count.toLocaleString()} (${rate}%)`
          },
          fontSize: 14,
          fontWeight: 'bold',
        },
        itemStyle: {
          borderColor: 'transparent',
          borderWidth: 0,
        },
        emphasis: {
          label: { fontSize: 16 },
        },
        data: conversionData.map(item => ({
          value: item.count,
          name: item.stage,
          itemStyle: { color: item.color },
        })),
      }],
    })
  }, [isReady])

  return (
    <Card title="转化漏斗">
      <div ref={containerRef} style={{ width: '100%', height: 400 }} />
    </Card>
  )
}
```

### 大数据量折线图组件

```tsx
// src/components/LargeDataChart.tsx
import { useEffect, useMemo } from 'react'
import { Card, Tag } from 'antd'
import { useEChart } from '../hooks/useEChart'

function generateLargeDataset(count: number) {
  const data: [number, number][] = []
  let value = 100
  const startTime = new Date('2025-01-01').getTime()

  for (let i = 0; i < count; i++) {
    value += (Math.random() - 0.48) * 5
    value = Math.max(50, Math.min(150, value))
    data.push([startTime + i * 3600 * 1000, Math.round(value * 100) / 100])
  }
  return data
}

export function LargeDataChart() {
  const { containerRef, setOption, isReady } = useEChart()
  const dataset = useMemo(() => generateLargeDataset(50000), [])

  useEffect(() => {
    if (!isReady) return

    setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {},
        },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 5 },
        { type: 'slider', start: 0, end: 5 },
      ],
      xAxis: {
        type: 'time',
      },
      yAxis: {
        type: 'value',
        name: '指数',
        scale: true,
      },
      series: [{
        name: '市场指数',
        type: 'line',
        data: dataset,
        sampling: 'lttb',
        large: true,
        largeThreshold: 5000,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(84,112,198,0.3)' },
              { offset: 1, color: 'rgba(84,112,198,0.02)' },
            ],
          },
        },
      }],
    })
  }, [isReady, dataset])

  return (
    <Card
      title="大数据量趋势分析"
      extra={<Tag color="blue">{dataset.length.toLocaleString()} 条数据</Tag>}
    >
      <div ref={containerRef} style={{ width: '100%', height: 350 }} />
    </Card>
  )
}
```

### 主仪表盘页面

```tsx
// src/App.tsx
import { Row, Col, Space, Button, Typography } from 'antd'
import { BulbOutlined, BulbFilled } from '@ant-design/icons'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { ConversionFunnel } from './components/ConversionFunnel'
import { LargeDataChart } from './components/LargeDataChart'

const { Title } = Typography

function DashboardContent() {
  const { mode, toggleTheme } = useTheme()

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: mode === 'dark' ? '#0d1117' : '#f5f5f5' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: mode === 'dark' ? '#e6edf3' : '#1a1a1a' }}>
          销售数据分析仪表盘
        </Title>
        <Button
          icon={mode === 'dark' ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggleTheme}
        >
          {mode === 'dark' ? '切换亮色' : '切换暗色'}
        </Button>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ConversionFunnel />
        </Col>
        <Col xs={24} lg={12}>
          <LargeDataChart />
        </Col>
      </Row>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <DashboardContent />
    </ThemeProvider>
  )
}
```

---

## 常见误区

### 误区一：频繁调用 setOption 导致性能问题

每次调用 `setOption` 都会触发 diff 和重绘。如果在循环中多次调用，会导致严重的性能问题。应该把所有配置合并成一个对象，一次性调用：

```typescript
// 错误：多次调用
data.forEach(item => {
  chart.setOption({ series: [{ data: item }] })
})

// 正确：合并后一次调用
const mergedData = data.map(item => item)
chart.setOption({ series: [{ data: mergedData }] })
```

### 误区二：自定义系列中创建对象导致 GC 压力

在 `renderItem` 中创建新对象（尤其是 `new echarts.graphic.LinearGradient`）会被调用数千次，产生大量临时对象。应该缓存渐变对象或在外部创建：

```typescript
// 错误：每次渲染都创建
renderItem: (params, api) => {
  return {
    type: 'rect',
    style: {
      fill: new echarts.graphic.LinearGradient(...)  // 每个数据点都创建一次
    }
  }
}

// 正确：在外部缓存
const gradient = new echarts.graphic.LinearGradient(0, 0, 1, 0, [...])
// renderItem 中直接使用 gradient
```

### 误区三：主题切换时没有保存状态

直接销毁重建实例会丢失 dataZoom 位置、tooltip 显示状态等。应该在销毁前保存关键状态，重建后恢复。

### 误区四：大数据量场景下没有开启 sampling

直接渲染 5 万条数据到折线图，每条数据都是一个像素点，视觉上和采样后无区别，但性能差距巨大。在数据量超过 5000 条时就应该开启 `sampling: 'lttb'`。

### 误区五：混淆 coordinateSystem 配置

自定义系列中 `api.coord()` 的行为取决于 `coordinateSystem` 配置。如果设为 `'cartesian2d'` 但实际用了极坐标系，坐标转换会出错。确保 `coordinateSystem` 和实际使用的坐标系一致。

---

## 小结与练习

### 小结

本课深入 ECharts 的核心能力：

1. **Option 驱动 vs API 驱动**：声明式定义结构，命令式触发交互，两者结合使用
2. **坐标系系统**：直角坐标系用于常规图表，极坐标系用于雷达/玫瑰图，地理坐标系用于地图
3. **自定义系列**：通过 `renderItem` 函数完全控制每个数据点的渲染，适合漏斗图、甘特图等非标准图表
4. **主题系统**：通过 `registerTheme` 注册主题，动态切换需要销毁重建实例
5. **大数据量优化**：sampling 采样、dataZoom 按需加载、增量渲染、选择合适的渲染器

### 练习

#### 练习一：自定义系列

用 ECharts 的自定义系列实现一个**子弹图（Bullet Chart）**。子弹图用于展示实际值与目标值的对比，结构如下：

```
背景条（浅灰）: [=========================]
目标线（深色）:           |
实际条（彩色）: [===========]
```

要求：
- 每行展示一个指标（如：销售额、利润、客户数）
- 背景条分为三段（差、良、优），用不同灰色表示
- 目标线用黑色竖线表示
- 实际值用彩色条表示

#### 练习二：主题系统

设计一套包含 3 个主题的 ECharts 主题系统：
- `classic`：经典商务风（蓝灰色调）
- `vibrant`：活力风（高饱和度暖色）
- `minimal`：极简风（黑白灰 + 一个强调色）

要求：
- 每个主题定义完整的配色、背景、文字、坐标轴样式
- 编写一个 `ThemeManager` 类，支持注册、切换、导出主题
- 切换主题时保留图表的 dataZoom 状态

---

## 参考答案

### 练习一

**思路**：子弹图的核心是把多个指标并排展示，每个指标包含背景分段、目标线和实际值条。用自定义系列的 `renderItem` 可以精确控制每个元素的位置和样式。

**答案**：

```typescript
interface BulletData {
  label: string
  actual: number
  target: number
  ranges: [number, number, number]  // [差, 良, 优] 的分界值
}

const bulletData: BulletData[] = [
  { label: '销售额', actual: 85, target: 90, ranges: [60, 80, 100] },
  { label: '利润', actual: 72, target: 70, ranges: [50, 70, 100] },
  { label: '客户满意度', actual: 92, target: 85, ranges: [60, 80, 100] },
]

const bulletOption = {
  xAxis: {
    type: 'value',
    max: 100,
    axisLabel: { formatter: '{value}%' },
  },
  yAxis: {
    type: 'category',
    data: bulletData.map(d => d.label),
    inverse: true,
  },
  series: [{
    type: 'custom',
    renderItem: (params: any, api: any) => {
      const index = params.dataIndex
      const item = bulletData[index]
      const categoryY = api.coord([0, index])[1]
      const barHeight = 18
      const barTop = categoryY - barHeight / 2

      const children: any[] = []

      // 背景分段
      const rangeColors = ['#f0f0f0', '#d9d9d9', '#bfbfbf']
      let prevX = api.coord([0, index])[0]
      for (let i = 0; i < item.ranges.length; i++) {
        const endX = api.coord([item.ranges[i], index])[0]
        children.push({
          type: 'rect',
          shape: { x: prevX, y: barTop, width: endX - prevX, height: barHeight },
          style: { fill: rangeColors[i] },
        })
        prevX = endX
      }

      // 实际值条
      const actualWidth = api.coord([item.actual, index])[0] - api.coord([0, index])[0]
      children.push({
        type: 'rect',
        shape: { x: api.coord([0, index])[0], y: barTop + 3, width: actualWidth, height: barHeight - 6 },
        style: { fill: '#1890ff', radius: [0, 3, 3, 0] },
      })

      // 目标线
      const targetX = api.coord([item.target, index])[0]
      children.push({
        type: 'line',
        shape: { x1: targetX, y1: barTop - 2, x2: targetX, y2: barTop + barHeight + 2 },
        style: { stroke: '#333', lineWidth: 2 },
      })

      return { type: 'group', children }
    },
    encode: { x: -1, y: 0 },
    data: bulletData.map(() => 0),
  }],
}
```

**要点**：
- `api.coord` 将数据坐标转为像素坐标，是自定系列的核心 API
- 背景分段用循环渲染多个 rect，颜色由浅到深
- 目标线用 line 元素，比背景条高出一点形成视觉突出
- 实际值条的宽度通过比例计算得出

### 练习二

**思路**：主题系统的本质是一组视觉变量的集合。设计 3 个风格差异明显的主题，通过统一的接口管理。

**答案**：

```typescript
interface ChartTheme {
  name: string
  color: string[]
  backgroundColor: string
  title: { textStyle: { color: string } }
  legend: { textStyle: { color: string } }
  tooltip: {
    backgroundColor: string
    borderColor: string
    textStyle: { color: string }
  }
  xAxis: {
    axisLine: { lineStyle: { color: string } }
    axisLabel: { color: string }
    splitLine: { lineStyle: { color: string } }
  }
  yAxis: {
    axisLine: { lineStyle: { color: string } }
    axisLabel: { color: string }
    splitLine: { lineStyle: { color: string } }
  }
}

const classicTheme: ChartTheme = {
  name: 'classic',
  color: ['#2E5B88', '#4A90A4', '#7BB5C4', '#A8D5E2', '#D4E8F0'],
  backgroundColor: '#fafbfc',
  title: { textStyle: { color: '#1a1a1a' } },
  legend: { textStyle: { color: '#555' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#d0d5dd',
    textStyle: { color: '#333' },
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#d0d5dd' } },
    axisLabel: { color: '#555' },
    splitLine: { lineStyle: { color: '#e8ecf0' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#d0d5dd' } },
    axisLabel: { color: '#555' },
    splitLine: { lineStyle: { color: '#e8ecf0' } },
  },
}

const vibrantTheme: ChartTheme = {
  name: 'vibrant',
  color: ['#FF6B6B', '#FFA07A', '#FFD700', '#32CD32', '#1E90FF'],
  backgroundColor: '#FFFAF0',
  title: { textStyle: { color: '#2D2D2D' } },
  legend: { textStyle: { color: '#555' } },
  tooltip: {
    backgroundColor: 'rgba(255,250,240,0.95)',
    borderColor: '#FFD700',
    textStyle: { color: '#333' } },
  xAxis: {
    axisLine: { lineStyle: { color: '#E0E0E0' } },
    axisLabel: { color: '#555' },
    splitLine: { lineStyle: { color: '#F5F0E8' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#E0E0E0' } },
    axisLabel: { color: '#555' },
    splitLine: { lineStyle: { color: '#F5F0E8' } },
  },
}

const minimalTheme: ChartTheme = {
  name: 'minimal',
  color: ['#333333', '#666666', '#999999', '#CCCCCC', '#1890FF'],
  backgroundColor: '#ffffff',
  title: { textStyle: { color: '#000000' } },
  legend: { textStyle: { color: '#666' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: '#e0e0e0',
    textStyle: { color: '#333' },
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#e0e0e0' } },
    axisLabel: { color: '#999' },
    splitLine: { lineStyle: { color: '#f5f5f5' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#e0e0e0' } },
    axisLabel: { color: '#999' },
    splitLine: { lineStyle: { color: '#f5f5f5' } },
  },
}

class ThemeManager {
  private themes = new Map<string, ChartTheme>()
  private currentTheme: string

  constructor(initialTheme: string) {
    this.register(classicTheme)
    this.register(vibrantTheme)
    this.register(minimalTheme)
    this.currentTheme = initialTheme
  }

  register(theme: ChartTheme) {
    this.themes.set(theme.name, theme)
    echarts.registerTheme(theme.name, theme)
  }

  switch(name: string) {
    if (!this.themes.has(name)) throw new Error(`主题 ${name} 不存在`)
    this.currentTheme = name
    return this.themes.get(name)!
  }

  getCurrent() {
    return this.themes.get(this.currentTheme)!
  }

  exportTheme(name: string): string {
    const theme = this.themes.get(name)
    if (!theme) throw new Error(`主题 ${name} 不存在`)
    return JSON.stringify(theme, null, 2)
  }
}
```

**要点**：
- 每个主题是一个完整的视觉配置对象，包含配色、背景、文字、坐标轴等所有视觉变量
- `ThemeManager` 通过 `Map` 管理多个主题，支持注册、切换、导出
- 使用前先 `registerTheme` 注册到 ECharts，切换时销毁重建实例
- 三个主题风格差异明显：classic 偏蓝灰商务、vibrant 高饱和暖色、minimal 黑白灰极简

---

> **下一课预告**：[03-D3.js数据驱动](./03-D3js数据驱动.md) — 从 Selection 机制到力导向图，掌握 D3.js 数据驱动 DOM 的核心思想。

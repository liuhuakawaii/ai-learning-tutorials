# 阶段实战：优化一个页面的加载瀑布图

> 把 Network 面板、瀑布图分析、Code Splitting、预加载策略组合起来，对一个真实页面做完整的加载优化。

## 目标

找一个加载较慢的页面（或构造一个），分析它的瀑布图，实施优化，对比优化前后的加载表现。

## 构造一个加载慢的页面

如果你手头没有合适的项目，用以下代码构造一个加载特征明显的问题页面：

```tsx
// App.tsx — 问题版本
import moment from 'moment' // 全量引入，约 300KB
import { Chart } from 'chart.js' // 全量引入，约 200KB
import { useCallback, useEffect, useState } from 'react'

// 同步引入所有页面
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { Reports } from './pages/Reports'
import { Analytics } from './pages/Analytics'

// 没有 font-display: swap 的字体
// <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto&display=block" />

function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    // 3 个 API 串行调用
    fetch('/api/user').then((r) => r.json()).then((user) => {
      fetch(`/api/dashboard/${user.id}`).then((r) => r.json()).then((dashboard) => {
        fetch(`/api/notifications/${user.id}`).then((r) => r.json()).then((notifications) => {
          setData({ user, dashboard, notifications })
        })
      })
    })
  }, [])

  if (!data) return <div>加载中...</div>

  return <Dashboard data={data} />
}
```

## 分析步骤

### 1. 录制加载 trace

1. 用无痕模式打开页面
2. 打开 Network 面板，勾选 "Disable cache"
3. 刷新页面，等完全加载

### 2. 分析瀑布图

记录以下信息：

**请求总数**：
**首屏 JS 总大小**：
**最慢请求**：
**串行请求数量**：
**是否有资源排队**：

### 3. 识别优化点

从瀑布图和请求列表里找问题：

| 问题 | 现象 | 优化方向 |
|------|------|---------|
| JS bundle 太大 | 单个 JS > 200KB | Code Splitting |
| 字体阻塞渲染 | 字体加载完才显示文字 | font-display: swap / preload |
| API 串行调用 | 3 个请求一个等一个 | Promise.all 并行 |
| 第三方库全量引入 | moment.js 300KB | 替换为 day.js |
| 没有预连接 | CDN 域名首次连接慢 | preconnect |

### 4. 实施优化

逐一修复：

**优化 API 调用**：

```tsx
useEffect(() => {
  fetch('/api/user')
    .then((r) => r.json())
    .then((user) => {
      // 两个 API 并行请求
      return Promise.all([
        fetch(`/api/dashboard/${user.id}`).then((r) => r.json()),
        fetch(`/api/notifications/${user.id}`).then((r) => r.json()),
      ]).then(([dashboard, notifications]) => {
        setData({ user, dashboard, notifications })
      })
    })
}, [])
```

**Code Splitting**：

```tsx
import { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
```

**替换 moment.js**：

```tsx
// Before
import moment from 'moment'
const formatted = moment(date).format('YYYY-MM-DD')

// After
import dayjs from 'dayjs'
const formatted = dayjs(date).format('YYYY-MM-DD')
```

**添加预连接**：

```html
<link rel="preconnect" href="https://api.example.com" />
<link rel="preconnect" href="https://cdn.example.com" />
```

**字体优化**：

```html
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin />
<style>
  @font-face {
    font-family: 'MainFont';
    src: url('/fonts/main.woff2') format('woff2');
    font-display: swap;
  }
</style>
```

### 5. 对比验证

优化后重新录制，对比：

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 首屏 JS 大小 | | |
| 请求总数 | | |
| 最大内容绘制时间 | | |
| API 总等待时间 | | |
| 串行请求层数 | | |

## 输出报告

```markdown
# 加载优化报告

## 页面 URL

## 优化前分析
- 瀑布图描述（附关键数据）
- 识别出的问题

## 实施的优化
1. 
2. 
3. 

## 优化后对比
| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| | | | |

## 结论

```

## 练习

### 练习一：完成优化流程

用上面的问题页面（或你自己选择的页面），完成完整的分析和优化流程。输出优化报告。

### 练习二：测量优化对用户体验的影响

在优化前后分别用 Lighthouse 跑一次评分（下一阶段会详细学），对比 Performance 分数的变化。

记录：
- Performance 分数变化
- FCP（First Contentful Paint）变化
- LCP（Largest Contentful Paint）变化
- TBT（Total Blocking Time）变化

---

## 参考答案

### 练习一

典型优化结果：

- **API 串行改并行**：3 个串行请求（总等待 ~900ms）变成 1 + 2 并行（总等待 ~500ms），节省约 40%
- **Code Splitting**：首屏 JS 从 ~800KB 降到 ~300KB
- **moment.js 替换为 day.js**：JS 大小减少约 280KB
- **字体 preload + font-display: swap**：文字显示时间提前，用户不再看到空白文字

### 练习二

Lighthouse 分数的典型变化：
- Performance 分数提升 15-30 分（取决于原始问题有多严重）
- FCP 改善主要来自字体优化和 CSS 加载优化
- LCP 改善主要来自 API 并行和图片优化
- TBT 改善主要来自 JS 体积减小（解析和编译时间减少）

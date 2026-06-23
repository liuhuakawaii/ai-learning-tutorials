# 阶段实战：Dashboard 交互优化——把 INP 从 500ms 降到 100ms

## 现象

你的 Dashboard 页面有大量数据表格和图表。用户点击"排序"按钮后，页面卡顿 500ms 才有反应。CPU 4x 节流下更严重。

## 排查过程

### 第一步：定位长任务

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.log(`Long Task: ${entry.duration.toFixed(0)}ms`, entry.attribution)
    }
  }
})
observer.observe({ type: 'longtask', buffered: true })
```

### 第二步：分析主线程

Performance 面板录制后，找到长任务的调用栈：
```
SortButton.onClick
  → sortProducts() 280ms（排序 10000 条数据）
  → renderList() 200ms（渲染 10000 个 DOM 节点）
```

### 第三步：优化

```typescript
// 优化 1：用 Web Worker 排序
const sortWorker = new Worker(new URL('./sort.worker.ts', import.meta.url))

function handleSort(key: string) {
  sortWorker.postMessage({ data: products, key })
  sortWorker.onmessage = (e) => {
    setSortedProducts(e.data)
  }
}

// 优化 2：虚拟滚动，只渲染可见区域
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(row => (
          <div key={row.key} style={{
            position: 'absolute',
            top: row.start,
            height: row.size,
            width: '100%'
          }}>
            {items[row.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}

// 优化 3：用 startTransition 标记低优先级更新
import { startTransition } from 'react'

function handleSearch(query: string) {
  // 高优先级：输入框立即响应
  setSearchInput(query)

  // 低优先级：搜索结果可以延迟
  startTransition(() => {
    setSearchResults(filterItems(query))
  })
}
```

## 优化前后对比

```
                优化前      优化后      改善
INP             500ms       80ms        -84%
排序操作        280ms       20ms        -93%（Worker）
渲染列表        200ms       10ms        -95%（虚拟滚动）
搜索输入        150ms       30ms        -80%（startTransition）
```

## 关键优化技术

### 1. Web Worker

```typescript
// sort.worker.ts
self.onmessage = (e) => {
  const { data, key } = e.data
  const sorted = [...data].sort((a, b) => {
    if (typeof a[key] === 'number') return a[key] - b[key]
    return String(a[key]).localeCompare(String(b[key]))
  })
  self.postMessage(sorted)
}
```

### 2. 虚拟滚动

只渲染可见区域的 DOM 节点。10000 条数据只渲染 20 个 DOM 节点。

### 3. startTransition

React 18 的并发特性：将更新标记为"非紧急"，浏览器可以中断渲染来处理用户输入。

## 你可能踩的坑

**坑一：Worker 序列化成本**

传给 Worker 的数据需要序列化。如果数据很大，序列化本身就很慢。用 Transferable Objects。

**坑二：虚拟滚动的动态高度**

如果每行高度不同，需要预估高度。估算不准会导致滚动跳动。

**坑三：startTransition 的使用场景**

startTransition 只适用于非紧急更新。如果更新是用户直接感知的（如输入框文字），不要用。

## 练习

### 练习一：Web Worker 排序

实现一个 Web Worker 排序功能：主线程发送数据和排序键，Worker 排序后返回结果。

### 练习二：虚拟列表

用 @tanstack/react-virtual 实现一个虚拟列表，渲染 10000 条数据，滚动流畅。

---

## 参考答案

### 练习一

```typescript
// main.ts
const worker = new Worker(new URL('./sort.worker.ts', import.meta.type))

function sortAsync(data: any[], key: string): Promise<any[]> {
  return new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data)
    worker.postMessage({ data, key })
  })
}

// 使用
const sorted = await sortAsync(products, 'price')
```

### 练习二

```typescript
const virtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 40,
  overscan: 5 // 多渲染 5 个缓冲项
})
```

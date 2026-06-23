# 长列表性能

> 10000 条数据的列表，渲染要 3 秒，滚动卡顿。虚拟滚动不是唯一的解法，但它是解决 DOM 节点过多最直接的方案。

## 问题的本质

一个包含 10000 行的列表，如果每行是一个 `<div>`，就是 10000 个 DOM 节点。每个 DOM 节点占用的内存和布局计算时间都不可忽略。

在 Performance 面板里，渲染这样的列表你会看到：
- Main 轨道上有一个很长的黄色/紫色色块（JavaScript 渲染 + 布局）
- 大量的 Recalculate Style 和 Layout 色块
- FPS 掉到个位数

解决方案的核心思路：**只渲染用户能看到的那部分 DOM 节点**。

## react-window 虚拟滚动

`react-window` 是最常用的虚拟滚动库。它的原理是：只渲染可见区域的列表项，滚动时动态替换。

```tsx
import { FixedSizeList } from 'react-window'

interface Item {
  id: number
  name: string
  description: string
}

function VirtualList({ items }: { items: Item[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} className="list-row">
      <strong>{items[index].name}</strong>
      <p>{items[index].description}</p>
    </div>
  )

  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={80}
    >
      {Row}
    </FixedSizeList>
  )
}
```

**关键参数**：
- `height`：列表可视区域的高度
- `itemSize`：每个列表项的高度（固定值）
- `itemCount`：总条目数

`react-window` 也支持可变高度的列表（`VariableSizeList`）和网格（`FixedSizeGrid`）。

## Intersection Observer 分页加载

如果不是一次性拿到所有数据，而是在用户滚动到底部时加载更多，用 Intersection Observer 更合适：

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'

function InfiniteList() {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading) return
    setLoading(true)

    const newItems = await fetchPage(page)
    setItems((prev) => [...prev, ...newItems])
    setPage((p) => p + 1)
    setLoading(false)
  }, [page, loading])

  useEffect(() => {
    loadMore()
  }, []) // 首次加载

  useEffect(() => {
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="list-item">{item}</div>
      ))}
      <div ref={sentinelRef} />
      {loading && <div>加载中...</div>}
    </div>
  )
}
```

Intersection Observer 的问题是：随着列表越来越长，DOM 节点越来越多。如果列表很长（几千条以上），需要结合虚拟滚动。

## 虚拟滚动 + 无限加载

把两者结合：用虚拟滚动控制 DOM 节点数量，用 Intersection Observer 触发数据加载。

```tsx
import { FixedSizeList } from 'react-window'
import { useEffect, useRef, useState } from 'react'

function VirtualInfiniteList() {
  const [items, setItems] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchPage(page).then((newItems) => {
      setItems((prev) => [...prev, ...newItems])
      if (newItems.length < 50) setHasMore(false)
    })
  }, [page])

  const handleItemsRendered = ({
    visibleStopIndex,
  }: {
    visibleStopIndex: number
  }) => {
    // 当渲染到最后 10 个元素时，加载下一页
    if (visibleStopIndex >= items.length - 10 && hasMore) {
      setPage((p) => p + 1)
    }
  }

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={60}
      width="100%"
      onItemsRendered={handleItemsRendered}
    >
      {({ index, style }) => (
        <div style={style}>{items[index]}</div>
      )}
    </FixedSizeList>
  )
}
```

## 分页加载

分页加载是最简单的方案——每次只显示一页数据：

```tsx
function PaginatedList() {
  const [items, setItems] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    fetch(`/api/items?page=${page}&size=${pageSize}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
  }, [page])

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="list-item">{item}</div>
      ))}
      <div className="pagination">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
        <span>{page} / {Math.ceil(total / pageSize)}</span>
        <button onClick={() => setPage((p) => p + 1)}>下一页</button>
      </div>
    </div>
  )
}
```

分页加载的 DOM 节点始终只有一页（20 个），但用户体验不如无限滚动。

## 在 Performance 面板里对比

录制三种方案的渲染过程：

| 方案 | DOM 节点数 | 渲染时间 | 用户体验 |
|------|-----------|---------|---------|
| 全量渲染 | 10000 | 3-5s | 卡顿 |
| 无限滚动 | 持续增长 | 初始快，后面慢 | 好（但后期卡） |
| 虚拟滚动 | 固定 ~20 | <50ms | 流畅 |
| 虚拟滚动 + 无限加载 | 固定 ~20 | <50ms | 流畅 |

## 练习

### 练习一：全量渲染 vs 虚拟滚动

创建一个包含 5000 条数据的列表。分别用普通 `<div>` 渲染和 `react-window` 渲染。

用 Performance 面板录制两者的渲染过程，对比：
- 渲染耗时
- DOM 节点数量
- 帧率

### 练习二：实现无限滚动列表

用 Intersection Observer 实现一个无限滚动列表：

1. 首次加载 20 条数据
2. 滚动到底部时加载更多
3. 加载过程中显示 loading 指示器
4. 用 Performance 面板验证：滚动时没有掉帧

---

## 参考答案

### 练习一

典型结果：

- **全量渲染**：渲染耗时 2-5s（取决于设备），DOM 节点 5000+，FPS 个位数
- **虚拟滚动**：渲染耗时 <50ms，DOM 节点约 20，FPS 60

差异来自 DOM 操作的数量级不同。5000 个 DOM 节点的创建、样式计算、布局和绘制的时间远大于 20 个。

### 练习二

关键实现要点：

- `rootMargin: '200px'` 让加载提前触发，用户不会看到 loading
- 用 `loading` 状态防止重复加载
- 用 `hasMore` 状态在没有更多数据时停止触发
- 如果列表很长（>1000 条），应该结合虚拟滚动避免 DOM 节点过多

# 内存优化实践

> 定位到泄漏之后，下一步是知道怎么修。有些优化是 API 层面的（WeakRef），有些是架构层面的（虚拟滚动）。

## WeakMap 和 WeakRef

上节课讲了 `WeakMap` 作为缓存 key 的弱引用。ES2021 引入了更灵活的 `WeakRef`，可以对任意对象创建弱引用。

```tsx
class LRUCache<K, V> {
  private cache = new Map<K, WeakRef<V>>()
  private registry = new FinalizationRegistry<K>((key) => {
    this.cache.delete(key)
  })

  set(key: K, value: V) {
    const ref = new WeakRef(value)
    this.cache.set(key, ref)
    this.registry.register(value, key)
  }

  get(key: K): V | undefined {
    const ref = this.cache.get(key)
    if (!ref) return undefined
    const value = ref.deref()
    if (!value) {
      this.cache.delete(key)
      return undefined
    }
    return value
  }
}
```

`WeakRef.deref()` 返回被引用的对象，如果对象已经被 GC 回收则返回 `undefined`。`FinalizationRegistry` 在对象被 GC 回收后执行回调，用于清理 Map 里的过期 entry。

适用场景：缓存 DOM 节点、缓存大型计算结果。不适用场景：你需要确保数据不丢失的场景（弱引用随时可能失效）。

## 虚拟滚动

一个包含 10000 条数据的列表，如果把所有 DOM 节点都渲染出来，会占用大量内存（每个 DOM 节点本身几十到几百字节，加上样式计算、布局信息等）。

虚拟滚动的核心思想：只渲染用户可见区域的 DOM 节点，滚动时动态替换。

```tsx
import { FixedSizeList } from 'react-window'

function VirtualList({ items }: { items: string[] }) {
  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={40}
    >
      {({ index, style }) => (
        <div style={style} className="list-item">
          {items[index]}
        </div>
      )}
    </FixedSizeList>
  )
}
```

用 `react-window` 后，无论列表有多少条数据，DOM 节点数量始终等于可见区域能显示的条数（通常 15-20 个）。

内存影响：10000 条数据的列表从 10000 个 DOM 节点降到约 20 个。数据数组本身仍然在内存里，但 DOM 节点和关联的布局信息大幅减少。

## Intersection Observer 延迟加载

图片和组件的延迟加载不仅减少网络请求，也减少内存占用——只有进入可视区域的元素才会被创建和渲染。

```tsx
import { useEffect, useRef, useState } from 'react'

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} style={{ minHeight: 200 }}>
      {isVisible && <img src={src} alt={alt} loading="lazy" />}
    </div>
  )
}
```

`rootMargin: '200px'` 让图片在进入可视区域前 200px 就开始加载，避免用户看到加载过程。

## 大列表的内存管理

当列表数据量非常大（几万到几十万条），即使虚拟滚动解决了 DOM 问题，数据本身的内存占用也需要管理。

**分页加载**：只在内存里保留当前页和相邻页的数据。

```tsx
function usePagedData<T>(fetchPage: (page: number) => Promise<T[]>, pageSize: number) {
  const [pages, setPages] = useState<Map<number, T[]>>(new Map())
  const [currentPage, setCurrentPage] = useState(0)

  const loadPage = async (page: number) => {
    if (pages.has(page)) return

    const data = await fetchPage(page)
    setPages((prev) => {
      const next = new Map(prev)
      next.set(page, data)

      // 只保留当前页前后各 1 页
      for (const [key] of next) {
        if (Math.abs(key - page) > 1) {
          next.delete(key)
        }
      }
      return next
    })
  }

  useEffect(() => {
    loadPage(currentPage)
  }, [currentPage])

  const items = pages.get(currentPage) ?? []

  return { items, currentPage, setCurrentPage, totalPages: 100 }
}
```

**数据裁剪**：对于列表项里不需要展示的字段，不在内存里保留。

```tsx
// 不要这样
const items = await fetch('/api/items') // 包含所有字段，每项 5KB

// 只保留需要的字段
const items = (await fetch('/api/items')).map((item: any) => ({
  id: item.id,
  name: item.name,
  thumbnail: item.thumbnail,
})) // 每项 200B
```

## 清理引用的时机

有些引用需要在特定时机清理：

**路由切换时**：单页应用切换路由时，前一个页面的组件虽然卸载了，但如果有全局事件监听器或缓存，数据可能还在。

**弹窗关闭时**：弹窗里的表单数据、上传的文件预览、临时创建的对象都应该在关闭时清理。

**长时间空闲时**：如果用户 5 分钟没有操作，可以主动释放一些缓存：

```tsx
function useIdleCleanup(callback: () => void, timeout: number) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(callback, timeout)
    }

    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('keydown', resetTimer)
    resetTimer()

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('keydown', resetTimer)
    }
  }, [callback, timeout])
}

// 使用
useIdleCleanup(() => {
  // 清理非关键缓存
  imageCache.clear()
}, 5 * 60 * 1000)
```

## 练习

### 练习一：虚拟滚动对比

创建一个包含 5000 条数据的列表。分别用普通渲染和 `react-window` 虚拟滚动渲染，用 Memory 面板对比两种方式的内存占用。

记录：
- 普通渲染的 DOM 节点数量和堆快照大小
- 虚拟滚动的 DOM 节点数量和堆快照大小

### 练习二：实现一个简单的 LRU 缓存

实现一个 LRU（Least Recently Used）缓存，限制最大条目数，超出时淘汰最久未使用的条目。用 `WeakMap` 存储缓存值，确保缓存值在没有其他引用时可以被 GC 回收。

```tsx
class SimpleLRUCache<K, V> {
  // 你的实现
}
```

---

## 参考答案

### 练习一

典型结果：
- 普通渲染：5000 个 DOM 节点，堆快照约 8-15MB
- 虚拟滚动：约 20 个 DOM 节点，堆快照约 2-4MB

差异主要来自 DOM 节点本身（每个约 1-2KB）以及关联的 React fiber 节点和事件处理器。

### 练习二

```tsx
class SimpleLRUCache<K, V> {
  private map = new Map<K, V>()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)!
    // 移到最新位置
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      // Map.keys().next() 返回最早插入的 key
      const oldest = this.map.keys().next().value
      this.map.delete(oldest)
    }
  }
}
```

注意：这里用的是 `Map` 的插入顺序特性，不是 `WeakMap`。`WeakMap` 的 key 必须是对象，不适合所有场景。如果 key 是对象，可以用 `WeakMap`；如果 key 是字符串或数字，用 `Map` + 手动淘汰。

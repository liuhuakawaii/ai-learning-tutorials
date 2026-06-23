# 阶段实战：定位并修复一个真实应用的内存泄漏

> 前面四课学了工具和模式。现在把它们组合起来，对一个真实应用做内存分析。

## 目标

准备一个有内存泄漏的 React 应用（或找到一个开源项目的早期版本），用 Memory 面板定位泄漏，修复它，用堆快照验证修复效果。

## 准备一个有泄漏的应用

如果你手头没有合适的项目，可以用以下代码构造一个有多种泄漏的简单应用：

```tsx
import { useEffect, useRef, useState } from 'react'

// 泄漏源 1：全局缓存没有淘汰策略
const searchCache = new Map<string, any[]>()

// 泄漏源 2：全局事件日志
const eventLog: Array<{ type: string; time: number; data: any }> = []

function App() {
  const [route, setRoute] = useState<'home' | 'search' | 'detail'>('home')

  return (
    <div>
      <nav>
        <button onClick={() => setRoute('home')}>首页</button>
        <button onClick={() => setRoute('search')}>搜索</button>
        <button onClick={() => setRoute('detail')}>详情</button>
      </nav>
      {route === 'home' && <HomePage />}
      {route === 'search' && <SearchPage />}
      {route === 'detail' && <DetailPage />}
    </div>
  )
}

function HomePage() {
  useEffect(() => {
    const handler = () => {
      eventLog.push({ type: 'scroll', time: Date.now(), data: window.scrollY })
    }
    window.addEventListener('scroll', handler)
    // 泄漏：没有 removeEventListener
  }, [])

  return <div style={{ height: 2000 }}>首页内容（请滚动）</div>
}

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const historyRef = useRef<string[]>([])

  useEffect(() => {
    if (!query) return

    const timer = setTimeout(() => {
      if (searchCache.has(query)) {
        setResults(searchCache.get(query)!)
        return
      }

      // 模拟搜索
      const data = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        title: `结果 ${i} for "${query}"`,
        description: 'A'.repeat(500), // 故意制造大对象
      }))

      searchCache.set(query, data) // 只进不出
      historyRef.current.push(query) // 闭包引用
      setResults(data)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {results.map((r) => (
        <div key={r.id}>
          <h3>{r.title}</h3>
          <p>{r.description}</p>
        </div>
      ))}
    </div>
  )
}

function DetailPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    // 泄漏：setInterval 没有清理
    const timer = setInterval(() => {
      setItems((prev) => [
        ...prev,
        {
          id: prev.length,
          content: `动态内容 ${prev.length}`,
          timestamp: Date.now(),
        },
      ])
    }, 2000)

    // return () => clearInterval(timer) // 被注释掉了
  }, [])

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          {item.content} - {new Date(item.timestamp).toLocaleTimeString()}
        </div>
      ))}
    </div>
  )
}
```

## 分析步骤

### 第一步：建立基准

1. 打开应用，拍堆快照 1
2. 记录当前内存大小（Memory 面板底部显示）

### 第二步：模拟用户行为

1. 切换到首页，滚动几次，切回搜索页
2. 搜索 "react"，再搜索 "vue"，再搜索 "angular"
3. 切换到详情页，等 20 秒
4. 切换回首页
5. 拍堆快照 2

### 第三步：重复操作

1. 重复第二步的操作
2. 拍堆快照 3

### 第四步：对比分析

1. 在快照 3 上选择 Comparison 视图，对比快照 1
2. 用 "Detached" 过滤分离的 DOM 元素
3. 检查 `(closure)` 的数量变化
4. 检查 `string` 的数量变化
5. 检查 `Map` 相关的对象

### 第五步：定位引用链

对找到的泄漏对象，点击它查看引用链，确认是哪段代码导致的。

## 修复清单

根据分析结果，修复应该包括：

| 泄漏 | 修复方式 |
|------|---------|
| HomePage 的 scroll 监听器 | useEffect 返回清理函数 |
| searchCache 全局 Map | 添加大小限制或使用 WeakMap |
| DetailPage 的 setInterval | useEffect 返回清理函数 |
| eventLog 全局数组 | 限制大小或改为 WeakRef |

## 验证修复

修复后重复第二步和第三步的操作，做堆快照对比：

- Detached DOM 元象数量应该大幅减少
- `(closure)` 数量应该稳定而不是持续增长
- `string` 的增长应该在搜索词不同时才增长，而不是每次搜索都增长

## 练习

### 练习一：完成分析和修复

用上面的应用代码，完成完整的分析和修复流程。输出一份分析报告，包含：

1. 发现的所有泄漏点
2. 每个泄漏点的引用链截图描述
3. 修复方案
4. 修复前后的堆快照对比数据

### 练习二：分析一个开源项目

找一个 GitHub 上的 React 项目（小型的，比如一个 TodoMVC 或示例应用），克隆到本地运行，用 Memory 面板分析它有没有内存泄漏。

如果没找到泄漏，试着自己引入一个泄漏（比如在某个 useEffect 里去掉清理函数），然后用工具定位它。

---

## 参考答案

### 练习一

典型发现：

1. **HomePage scroll 监听器**：每次挂载都新增一个监听器。堆快照对比能看到 `(closure)` 数量随路由切换次数线性增长。引用链：`EventListener → handler → eventLog（全局数组）`

2. **searchCache**：每次搜索新关键词都会新增缓存条目。堆快照里 `string` 和 `array` 持续增长。引用链：`Map → Array → Object → string`

3. **DetailPage setInterval**：每 2 秒新增一个对象。堆快照 2 和快照 3 之间对象数量差异明显。

修复后验证：所有泄漏点修复后，快照对比的 #Delta 应该接近零或只有正常的渲染开销。

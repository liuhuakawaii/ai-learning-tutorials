# 内存泄漏定位

> 内存泄漏最隐蔽的地方在于：页面不会立刻崩溃，只是慢慢变慢，直到某天突然卡死。

## 什么是内存泄漏

程序不再需要的对象，因为仍然被引用而无法被垃圾回收，就是内存泄漏。

在 JavaScript 里，内存泄漏通常不是"忘记释放内存"（JS 没有手动释放的机制），而是"无意中保留了引用"。一个事件监听器、一个闭包、一个全局变量，都可能让一大片对象永远无法被回收。

## 堆快照对比法

定位内存泄漏最有效的方法是 **堆快照对比**：拍两个快照，对比中间新增了哪些对象、它们被谁引用。

操作流程：

1. 打开页面，执行一些初始化操作
2. 拍快照 1（基准）
3. 执行可能导致泄漏的操作（比如反复打开关闭弹窗、反复切换路由）
4. 拍快照 2
5. 执行相同操作几次
6. 拍快照 3
7. 在快照 3 上选择 Comparison 视图，对比快照 1

对比结果里关注 **#Delta**（对象数量变化）和 **Size Delta**（内存变化）。如果某类对象的数量随操作次数线性增长，基本可以确认有泄漏。

## Detached DOM Tree

前端最常见的内存泄漏之一是 **分离的 DOM 元素**。

一个 DOM 元素从页面上移除后（比如 `element.remove()` 或 React 卸载组件），如果 JavaScript 仍然持有对它的引用，这个元素就不会被 GC 回收。它占用的内存、它的子元素、它的事件监听器——全部保留。

在堆快照的 Summary 视图里，用 "Detached" 关键字过滤，能看到所有分离的 DOM 元素。

```
在 Class filter 搜索框输入: Detached
```

如果看到大量的 `Detached HTMLDivElement`、`Detached HTMLUListElement`，说明有 DOM 元素被移除后没有被正确释放。

点击某个 Detached 元素，在 **Object** 面板里能看到它的引用链——谁持有它的引用导致它无法被回收。

## 一个泄漏示例

```tsx
import { useEffect, useRef, useState } from 'react'

// 全局缓存——泄漏的常见源头
const elementCache = new Map<string, HTMLElement>()

function LeakyComponent() {
  const [count, setCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 创建一个子元素并缓存
    const child = document.createElement('div')
    child.textContent = `动态元素 ${count}`
    containerRef.current.appendChild(child)

    // 问题：把元素放进全局缓存，组件卸载后引用还在
    elementCache.set(`item-${count}`, child)

    return () => {
      // 从 DOM 移除了，但没有从缓存移除
      child.remove()
    }
  }, [count])

  return (
    <div>
      <div ref={containerRef} />
      <button onClick={() => setCount((c) => c + 1)}>添加</button>
    </div>
  )
}
```

这个组件每次渲染都会创建一个新的 DOM 元素。组件卸载时，`child.remove()` 把它从 DOM 树移除了，但 `elementCache` 仍然持有引用。这些元素变成了 Detached DOM，永远不会被 GC 回收。

在堆快照里对比：每切换一次路由（挂载/卸载这个组件），Detached 元素的数量就增加一个。

## 用堆快照定位引用链

发现 Detached 元素后，点击它，在 Object 面板里展开引用链：

```
Detached HTMLDivElement
  ← elementCache (Map)
    ← Window (全局作用域)
```

引用链告诉你：这个元素被 `elementCache` 引用，`elementCache` 是全局的，所以元素永远不会被 GC 回收。

修复方法：在组件卸载时清理缓存。

```tsx
useEffect(() => {
  if (!containerRef.current) return

  const child = document.createElement('div')
  child.textContent = `动态元素 ${count}`
  containerRef.current.appendChild(child)
  elementCache.set(`item-${count}`, child)

  return () => {
    child.remove()
    elementCache.delete(`item-${count}`) // 清理缓存引用
  }
}, [count])
```

## 多次对比确认

单次对比可能有误差——第一次操作可能触发了正常的初始化分配（比如创建缓存、注册服务）。关键是要看多次操作后对象数量是否持续增长。

理想情况：
- 快照 1 vs 快照 2：新增一些对象（可能是正常的初始化）
- 快照 2 vs 快照 3：新增的对象数量应该和第一次差不多（如果每次操作泄漏 N 个对象）
- 快照 3 vs 快照 1：对象数量应该回到接近快照 1 的水平（如果没有泄漏）

泄漏情况：
- 每次对比都看到对象数量持续增长
- 增长的对象类型一致（比如总是 Detached DOM 或某种自定义对象）
- 手动触发 GC 后数量不下降

## Performance 面板辅助判断

除了 Memory 面板，Performance 面板的 Main 轨道也能间接反映内存问题：

1. 录制一段时间的操作
2. 观察 JS Heap 轨道（如果显示的话）
3. 如果内存曲线持续上升、GC 无法回收到之前的水平，说明有泄漏

## 练习

### 练习一：制造并定位泄漏

以下代码有内存泄漏。用堆快照对比法定位它：

```tsx
function LeakyTimer() {
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setMessages((prev) => [
        ...prev,
        `消息 ${new Date().toLocaleTimeString()}`,
      ])
    }, 1000)

    // 问题：没有清理 timer
    // return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {messages.map((msg, i) => (
        <p key={i}>{msg}</p>
      ))}
    </div>
  )
}
```

操作步骤：
1. 渲染组件，等 10 秒，拍快照 1
2. 再等 10 秒，拍快照 2
3. 对比快照 1 和快照 2，找出持续增长的对象

### 练习二：修复并验证

修复 `LeakyTimer` 的泄漏，重新做堆快照对比，确认对象数量不再持续增长。

---

## 参考答案

### 练习一

对比快照 1 和快照 2，你会看到：
- `string` 对象数量持续增长（每秒新增一条消息文本）
- `array` 对象数量增长（`messages` 数组每次更新都创建新数组）
- `(closure)` 可能也有增长（`setInterval` 的回调闭包）

这些对象不会被回收，因为 `setInterval` 的回调闭包持有对 `messages` 的引用，而 `setInterval` 本身永远不会停止。

### 练习二

修复：添加清理函数。

```tsx
useEffect(() => {
  const timer = setInterval(() => {
    setMessages((prev) => [
      ...prev,
      `消息 ${new Date().toLocaleTimeString()}`,
    ])
  }, 1000)

  return () => clearInterval(timer)
}, [])
```

验证：重新做堆快照对比，10 秒间隔内的新增对象应该大幅减少。`messages` 数组仍然会增长（因为组件还在运行），但组件卸载后这些对象应该能被 GC 回收。

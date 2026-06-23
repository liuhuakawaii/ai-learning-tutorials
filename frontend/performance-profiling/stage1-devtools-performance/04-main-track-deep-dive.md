# Main 轨道深度解读

> Main 轨道上的色块不全是平等的。Task、Microtask、渲染回调各有各的调度规则，搞混了就会误判性能瓶颈。

## Task 的调度优先级

浏览器主线程上执行的所有工作都被组织成 Task。但不同来源的 Task 有不同的优先级：

- **用户输入事件**（click、keydown）：最高优先级
- **网络回调**（fetch、XHR 的回调）：中等优先级
- **setTimeout/setInterval**：较低优先级
- **requestAnimationFrame**：在每帧渲染前执行
- **渲染更新**（Style、Layout、Paint）：在 rAF 之后

这意味着如果你用 `setTimeout(fn, 0)` 安排了一个任务，它可能被更高优先级的输入事件插队。Performance 面板里的 Main 轨道会如实地展示这种调度顺序。

## Task 与 Microtask

在 Main 轨道上，你会看到一个 Task 色块内部可能嵌套了更小的色块。这些小色块不全是子 Task——有些是 **Microtask**。

Microtask 的执行时机和 Task 不同：
- 每个 Task 执行完后，浏览器会清空 Microtask 队列
- `Promise.then`、`queueMicrotask`、`MutationObserver` 回调都是 Microtask
- Microtask 会连续执行直到队列清空，中间不会插入渲染

在 Performance 面板里区分 Task 和 Microtask：Task 之间有明显的间隙（浏览器在间隙里做调度决策），而 Microtask 之间紧密相连，看起来像是一个 Task 内部的连续调用。

一个容易踩的坑：如果你在 Microtask 里做了大量工作（比如在一个 resolved Promise 的 `.then` 里处理大量数据），它会阻塞当前 Task 之后的所有 Microtask，直到全部执行完才轮到下一个 Task 或渲染。

```tsx
// 这段代码会阻塞渲染
function processInMicrotask() {
  Promise.resolve().then(() => {
    // 这 50000 次迭代都在同一个 Microtask 里
    for (let i = 0; i < 50000; i++) {
      heavyComputation(i)
    }
  })
}
```

在 Performance 面板里，你会看到一个很长的 Task 色块，内部是一个 Microtask 的调用栈。

## 渲染回调的执行顺序

浏览器在一帧内的执行顺序是固定的：

1. 执行 Task 队列里的一个 Task
2. 清空 Microtask 队列
3. 执行 `requestAnimationFrame` 回调
4. 执行渲染更新（Style → Layout → Paint → Composite）
5. 执行 `requestIdleCallback` 回调（如果还有时间）

在 Performance 面板里，你会看到 rAF 回调总是出现在渲染阶段之前。如果你在 rAF 里修改了 DOM，浏览器会在同一帧内完成渲染。

## Long Animation Frames (LoAF) API

Performance 面板的 Main 轨道上，超过 50ms 的 Task 会被标记为"长任务"。但 50ms 这个阈值是 Task 级别的——它不区分这个 Task 是 JavaScript 执行还是渲染工作。

Chrome 引入了 **Long Animation Frames** API，它从动画帧的角度来分析性能瓶颈：

```tsx
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('长动画帧:', entry.duration, 'ms')
    console.log('scriptDuration:', entry.scriptDuration)
    console.log('renderDuration:', entry.renderDuration)
    console.log('idleDuration:', entry.idleDuration)
  }
})

observer.observe({ type: 'long-animation-frame', buffered: true })
```

`scriptDuration` 是 JavaScript 执行时间，`renderDuration` 是渲染时间。如果一个长动画帧主要是 `scriptDuration` 高，优化方向是减少 JS 计算；如果 `renderDuration` 高，问题在渲染流水线。

## 看懂 Task 的嵌套关系

在 Main 轨道上，一个外层色块可能包含多个内层色块。这代表的是调用关系：

```
[Task: Event Handler]
  [Function: handleClick]
    [Function: processData]
    [Function: updateDOM]
      [Recalculate Style]
      [Layout]
  [Paint]
```

这种嵌套结构告诉你：`handleClick` 调用了 `processData` 和 `updateDOM`，`updateDOM` 触发了样式计算和布局。

判断瓶颈时，从外层向内层看：
1. 最外层的 Task 总耗时是多少？
2. 里面的哪一步占了大头？
3. 那一步的 Self Time 是多少？

如果一个 Task 里大部分时间花在 `processData` 上，问题在计算逻辑。如果大部分时间花在 `Recalculate Style` 和 `Layout` 上，问题在 DOM 操作。

## 用 User Timing 标记自定义区间

Performance 面板的 Main 轨道默认只显示浏览器内部的 Task。如果你想知道自己的某个函数在 Main 轨道上的表现，可以用 Performance API 手动标记：

```tsx
function handleSearch(query: string) {
  performance.mark('search-start')

  const results = searchIndex(query)
  renderResults(results)

  performance.mark('search-end')
  performance.measure('search-operation', 'search-start', 'search-end')
}
```

录制 Performance trace 后，在 **Timings 轨道** 上会出现你标记的区间，同时在 Main 轨道上也会对应显示。这样你就能精确看到自己的代码在主线程时间线上的位置和耗时。

## 一个真实的分析场景

假设你有一个搜索框，用户输入时会实时搜索并渲染结果。用户反馈输入时有明显延迟。

录制一次快速输入的过程，观察 Main 轨道：

1. 你会看到一系列密集的 Task——每次 `keydown` 事件触发一个 Task
2. 如果搜索逻辑在每次输入时都执行，每个 Task 里都会有一个很长的搜索函数色块
3. 渲染被推迟到搜索完成后，导致输入框的文字更新也变慢了

解决方案的思路是拆分：
- 输入框的响应（受控组件的 `setState`）应该立刻执行
- 搜索逻辑应该 debounce 或移到 `requestIdleCallback`
- 搜索结果的渲染可以用虚拟列表减少 DOM 操作

在 Performance 面板里验证效果：优化后，`keydown` 的 Task 应该变得很短（只有 `setState`），搜索逻辑出现在空闲时段或单独的 Task 里。

## 练习

### 练习一：观察 Microtask 执行

写一段代码，用 `Promise.resolve().then()` 创建 10 个 Microtask，每个 Microtask 里做 5ms 的计算。用 Performance 面板录制，观察：

1. 这 10 个 Microtask 在 Main 轨道上是怎么呈现的
2. 它们之间有没有渲染的机会

```tsx
function runMicrotasks() {
  for (let i = 0; i < 10; i++) {
    Promise.resolve().then(() => {
      const start = performance.now()
      while (performance.now() - start < 5) {
        // busy wait 5ms
      }
      console.log(`Microtask ${i} done`)
    })
  }
}
```

### 练习二：用 User Timing 标记函数

给你的某个业务函数加上 `performance.mark` 和 `performance.measure`，录制后在 Timings 轨道上找到它。记录它的实际耗时，并与你在代码里用 `console.time` 测量的结果对比。

---

## 参考答案

### 练习一

在 Performance 面板里，你会看到：
- 10 个 Microtask 合并在一个 Task 内部，紧密排列
- 它们之间没有渲染机会——整个 Microtask 队列清空后才会执行渲染
- 总耗时约 50ms，如果这期间用户有输入事件，会被阻塞

这验证了一个关键认知：Microtask 不是"免费"的。它们的优先级比渲染高，大量 Microtask 会阻塞画面更新。

### 练习二

`performance.mark/measure` 和 `console.time` 的结果通常非常接近（差异在微秒级别）。但 User Timing 的优势是它出现在 Performance 面板的时间线上，能让你看到函数在整体帧时间中的位置。

如果发现你的函数耗时 8ms，但同一帧里还有 5ms 的 Layout 和 3ms 的 Paint，总时间就超过了 16ms——即使函数本身"不算慢"，它和其他工作叠加后仍然导致掉帧。

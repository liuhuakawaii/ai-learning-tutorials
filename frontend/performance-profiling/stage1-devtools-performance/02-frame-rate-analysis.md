# 帧率分析

> 用户抱怨"页面卡"，但你看代码觉得没问题。帧率分析能告诉你用户说的"卡"到底卡在哪里。

## 60fps 意味着什么

浏览器每秒刷新屏幕 60 次（大多数显示器），每次刷新间隔约 16.6ms。这意味着浏览器在每一帧内要完成所有工作——JavaScript 执行、样式计算、布局、绘制、合成——总时间不能超过 16.6ms。

如果某一帧的工作量超过了 16.6ms，这一帧就来不及提交给显示器，用户就会看到"卡顿"。丢一帧用户可能感觉不到，但连续丢帧就会产生肉眼可见的不流畅。

这个 16.6ms 不是留给你的全部时间。浏览器自身有一些开销（比如合成、提交到 GPU），实际留给你的代码的时间大约在 10-12ms。

## Frames 轨道

Performance 面板录制完成后，最上方的 **Frames 轨道** 是帧率的直接体现。

每一条竖线代表一帧。竖线的高度代表该帧的持续时间。绿色竖线表示帧率正常（接近 60fps），红色竖线表示掉帧。

点击任意一帧，底部面板会显示该帧的详细信息：
- **Duration**：该帧的总耗时
- **FPS**：该帧对应的实际帧率
- **Frame screenshot**：该帧结束时的页面截图

一个实用的查看方式：在 Frames 轨道上从左到右扫一眼，找出所有红色竖线。这些就是用户感知到卡顿的位置。

## 长任务与掉帧的关系

浏览器的主线程一次只能做一件事。当一个 Task 执行时间超过 50ms，它就被称为**长任务（Long Task）**。长任务会阻塞主线程，导致后续的渲染帧被推迟。

但长任务不等于掉帧。一个 80ms 的长任务如果恰好跨了 5 帧，可能只导致最后两帧掉帧。而一个 40ms 的任务虽然不是长任务，如果它正好在帧的渲染路径上，也可能导致当帧掉帧。

Performance 面板里判断掉帧最直接的方式不是找长任务，而是直接看 Frames 轨道的红色竖线。

## 找到导致掉帧的代码

在 Frames 轨道上找到红色竖线后，向上对应到 Main 轨道同一时间段，找到正在执行的色块。这些色块就是导致掉帧的 Task。

点击色块看 Bottom-Up 标签，Self Time 最高的函数就是最值得优化的目标。

一个典型的场景：你看到一个 45ms 的黄色色块（JavaScript 执行），它内部有一个函数 `processLargeArray` 占了 38ms 的 Self Time。这就是一个明确的优化点——也许可以分批处理数组，或者用 Web Worker 把计算移出主线程。

## 实际操作：录制一个掉帧场景

用以下代码创建一个简单的掉帧场景：

```tsx
import { useState } from 'react'

function HeavyList() {
  const [items, setItems] = useState<number[]>([])

  const handleClick = () => {
    const start = performance.now()
    const result: number[] = []
    // 同步处理 50000 个元素，故意制造长任务
    for (let i = 0; i < 50000; i++) {
      result.push(Math.sqrt(i) * Math.random())
    }
    setItems(result)
    console.log(`处理耗时: ${(performance.now() - start).toFixed(1)}ms`)
  }

  return (
    <div>
      <button onClick={handleClick}>生成列表</button>
      <p>共 {items.length} 个元素</p>
      <ul>
        {items.slice(0, 100).map((v, i) => (
          <li key={i}>{v.toFixed(4)}</li>
        ))}
      </ul>
    </div>
  )
}
```

操作步骤：
1. 把这段代码放到 React 项目里运行
2. 打开 Performance 面板，点击圆点按钮开始录制
3. 点击"生成列表"按钮
4. 停止录制

在 Frames 轨道上，你应该能看到点击按钮后出现红色竖线。对应到 Main 轨道，会看到一个很宽的黄色色块——那就是那个 50000 次循环。

## requestAnimationFrame 分帧

解决长任务最直接的思路是把大任务拆成小块，分到多帧里执行。`requestAnimationFrame`（rAF）是最基本的分帧手段：

```tsx
function processInChunks(
  total: number,
  chunkSize: number,
  process: (start: number, end: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    let current = 0

    function step() {
      const end = Math.min(current + chunkSize, total)
      process(current, end)
      current = end

      if (current < total) {
        requestAnimationFrame(step)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(step)
  })
}
```

但 rAF 有个问题：你无法精确控制每帧能分配多少时间。如果一帧里除了你的代码还有其他工作（样式计算、布局、绘制），你的 chunk 可能把整帧的时间都吃掉了。

更精确的方案是 `scheduler.yield()`（或 polyfill）：

```tsx
async function processWithYield(
  items: number[],
  chunkSize: number,
  process: (item: number) => void
) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    chunk.forEach(process)

    // 让出主线程，允许浏览器处理渲染和其他任务
    if ('scheduler' in globalThis && 'yield' in (globalThis as any).scheduler) {
      await (globalThis as any).scheduler.yield()
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}
```

## 帧率分析的常见陷阱

**陷阱一：只看平均帧率。** 平均 55fps 听起来不错，但如果其中有连续 10 帧掉到 20fps，用户的感知是"卡了一下"。要看帧率的分布，而不是平均值。

**陷阱二：忽略掉帧的时机。** 页面加载时掉帧用户通常可以接受（还没开始操作），但滚动或点击时掉帧体验很差。同一个掉帧率，在不同时机对用户的影响完全不同。

**陷阱三：DevTools 录制本身会影响性能。** 录制 trace 会消耗额外的 CPU 和内存，导致你在 DevTools 里看到的帧率比用户实际体验的更低。这在分析低端设备时尤其明显。

## 练习

### 练习一：制造掉帧并分析

把上面的 `HeavyList` 组件运行起来，用 Performance 面板录制点击按钮的过程：

1. 记录掉帧持续了多长时间（从 Frames 轨道的红色区域读取）
2. 找到 Main 轨道上对应的长任务，记录它的总耗时
3. 在 Bottom-Up 里找到 Self Time 最高的函数

### 练习二：用分帧优化

用 `processInChunks` 函数重写 `HeavyList`，把 50000 个元素分成每批 1000 个处理。再次录制，对比优化前后的帧率表现。

记录：优化后 Frames 轨道上是否还有红色竖线？长任务的最长耗时是多少？

---

## 参考答案

### 练习一

典型结果：
- 掉帧持续时间约 40-60ms（取决于机器性能）
- Main 轨道上对应一个 40-60ms 的黄色长色块
- Bottom-Up 里 Self Time 最高的是循环内的 `Math.sqrt` 和 `Math.random`，或者 React 的 `setState` 触发的重新渲染

### 练习二

分帧优化后：
- Frames 轨道上的红色竖线应该消失或大幅减少
- 不再有单个超过 50ms 的长任务
- 代价是列表的渲染从"瞬间完成"变成了"分批出现"——用户能看到列表项逐步增加
- 每批处理约 1-3ms，远低于 16.6ms 的帧预算

关键认知：分帧不是让处理变快了，而是把一个大阻塞变成了多个小阻塞。总时间可能略有增加（因为每帧之间有调度开销），但用户感知更流畅。

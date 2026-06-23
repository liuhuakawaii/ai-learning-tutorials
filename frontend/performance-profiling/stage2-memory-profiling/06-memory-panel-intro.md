# Memory 面板入门

> 页面用久了越来越卡，刷新就好——大概率是内存泄漏。Memory 面板是定位这类问题的核心工具。

## 三种内存分析工具

Chrome DevTools 的 Memory 面板提供三种分析方式，各有适用场景：

**Heap Snapshot（堆快照）**：拍一张当前内存的"照片"，展示所有存活的对象。适合回答"现在内存里有什么"。

**Allocation Instrumentation on Timeline（分配时间线）**：实时记录内存分配，展示哪些代码在不断创建新对象。适合回答"内存是在哪里增长的"。

**Allocation Sampling（分配采样）**：以采样的方式记录内存分配，开销比时间线低，适合长时间录制。适合回答"哪些代码路径分配了最多内存"。

先从堆快照开始。

## 拍一个堆快照

1. 打开 DevTools → Memory 面板
2. 选择 "Heap snapshot"，点击 "Take snapshot"
3. 等几秒钟，快照生成

快照生成后，你会看到一个对象列表。默认按 **Shallow Size** 降序排列。

两个关键指标：
- **Shallow Size**：对象自身占用的内存（不包含它引用的其他对象）
- **Retained Size**：对象自身加上它独占引用的对象的总内存（如果这个对象被 GC 回收，能释放多少内存）

Retained Size 才是判断对象"有多重"的正确指标。一个 Shallow Size 很小的对象可能持有一棵很大的引用树，Retained Size 会非常大。

## 三种视图

快照有三种查看方式：

**Summary 视图**：按对象类型分组。能看到有多少个 `Array`、有多少个 `HTMLDivElement`、有多少个闭包。这是最常用的视图。

**Comparison 视图**：对比两个快照之间的差异。能看到哪些对象是新创建的、哪些被回收了。这是定位内存泄漏的核心工具（下节课详细讲）。

**Containment 视图**：展示对象的引用关系树。从 GC Roots 开始展开，能看到谁引用了谁。适合追踪一个对象为什么没被回收。

## 理解 Summary 视图

Summary 视图里每一行代表一类对象：

- **Constructor**：对象的构造函数（`Array`、`Object`、`HTMLDivElement`、自定义类名）
- **Distance**：到 GC Root 的引用链长度
- **Shallow Size**：这类对象自身的总内存
- **Retained Size**：这类对象及其独占引用的总内存

几个常见的对象类型：
- **(system)** 或 **(compiled code)**：浏览器内部对象
- **(closure)**：闭包。大量闭包可能意味着事件监听器或回调没有清理
- **(string)**：字符串。大量的短字符串可能来自重复的模板拼接
- **(array)**：数组。注意数组的 `length` 和实际元素数
- **Detached** 开头的 DOM 元素：已经从 DOM 树移除但仍然被 JavaScript 引用的元素——这是内存泄漏的典型信号

## 内存分配时间线

切换到 "Allocation instrumentation on timeline" 模式，点击开始。它会在时间线上实时显示内存分配：

- 蓝色竖条表示新的内存分配
- 竖条的高度表示分配的内存量
- 灰色区域表示被 GC 回收的内存

如果蓝色竖条持续出现但灰色很少，说明内存一直在增长但没有被回收——这就是内存泄漏的信号。

点击某个蓝色竖条，可以看到那个时刻分配了哪些对象、分配的调用栈是什么。这能帮你定位是哪段代码在不断分配内存。

## 一个简单的内存观察实验

```tsx
import { useState } from 'react'

function MemoryDemo() {
  const [data, setData] = useState<number[][]>([])

  const allocate = () => {
    // 每次分配 1MB 的数据
    const chunk = Array.from({ length: 1024 * 1024 }, () => Math.random())
    setData((prev) => [...prev, chunk])
  }

  const clear = () => {
    setData([])
  }

  return (
    <div>
      <button onClick={allocate}>分配 1MB</button>
      <button onClick={clear}>清空</button>
      <p>已分配 {data.length} MB</p>
    </div>
  )
}
```

操作步骤：
1. 打开 Memory 面板，拍一个初始堆快照
2. 点击 5 次"分配 1MB"
3. 拍第二个堆快照
4. 在第二个快照的 Summary 视图里，按 Retained Size 排序

你应该能看到大量的 `number` 对象或 `Array` 对象，Retained Size 总计约 5MB。

然后点击"清空"，等几秒（让 GC 运行），再拍第三个快照。对比第二个和第三个快照，看内存是否真的释放了。

## GC 不是即时的

一个常见的误解是"把引用设为 null，内存就立刻释放了"。实际上 GC 有自己 的调度策略，通常在内存压力较大或空闲时才会运行。

在实验中，你点击"清空"后立刻拍快照，可能发现内存没有减少。等 5-10 秒再拍，内存才会降下来。

在 Performance 面板里也可以观察 GC 事件：录制时如果有 GC 发生，Main 轨道上会出现一个标有 "GC" 的小色块。

## 分配采样

对于长时间运行的场景（比如用户浏览一个单页应用 10 分钟），用堆快照不太实际（快照生成本身就几秒）。这时候用 **Allocation Sampling**：

1. 选择 "Allocation sampling"
2. 点击开始
3. 执行你想要分析的操作
4. 停止

采样结果按调用栈聚合，展示每个代码路径分配了多少内存。这比堆快照更适合找"哪些函数分配了最多内存"。

## 练习

### 练习一：堆快照对比

用上面的 `MemoryDemo` 组件：

1. 拍初始快照
2. 点击 10 次"分配 1MB"
3. 拍快照 2
4. 点击"清空"，等 10 秒
5. 拍快照 3

在 Comparison 视图里对比快照 1 和快照 2，记录新增了多少对象。再对比快照 2 和快照 3，记录释放了多少。

### 练习二：分配时间线录制

用 Allocation Instrumentation on Timeline 模式录制，期间点击 5 次"分配 1MB"。观察：

1. 蓝色竖条出现的时机和高度
2. 是否有灰色区域（GC 回收）
3. 点击某个蓝色竖条，查看分配的调用栈

---

## 参考答案

### 练习一

- 快照 1 vs 快照 2：应该看到约 10MB 的新增对象（10 × 1MB），主要是 `number` 和 `Array` 类型
- 快照 2 vs 快照 3：理论上应该释放 10MB，但实际可能只释放了部分——因为 React 的 state 更新和 GC 调度的时机

如果快照 3 的内存没有明显减少，检查快照 2 里是否还有对这些数组的引用。

### 练习二

- 每次点击按钮应该出现一个蓝色高竖条（分配约 1MB）
- 前几次点击可能没有灰色区域（没有触发 GC）
- 连续分配后，浏览器可能在某次分配后触发一次 GC，回收一些临时对象
- 点击竖条看到的调用栈应该指向 `allocate` 函数和 `Array.from`

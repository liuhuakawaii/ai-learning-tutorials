# 第1课：React 渲染机制

> **课程定位**：理解 React 如何决定何时渲染、渲染什么，为后续优化打基础
> **前置知识**：熟悉 React 组件和 hooks
> **预计时长**：30 分钟

## 场景引入

你的 React 应用有一个 Sidebar 组件，渲染了 50 个导航项。你发现每次在页面其他地方点击按钮更新一个计数器时，Sidebar 的 50 个导航项都会重新渲染，尽管它们的 props 根本没变。用 React DevTools Profiler 一看，每次渲染 Sidebar 耗时 15ms，而计数器按钮每秒可能点击多次。问题不在 Sidebar 本身，而在于你不理解 React 的渲染机制——父组件渲染时，所有子组件默认都会渲染，即使它们的 props 没有变化。

---

## 学习目标

1. 理解 React 的渲染流程（render → commit）
2. 区分触发渲染的三种原因
3. 理解虚拟 DOM Diff 的工作方式
4. 识别不必要的渲染

---

## 一、React 渲染流程

```
┌──────────────────────────────────────────────────────────────┐
│                    React 渲染流程                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  触发更新                                                     │
│    ↓                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │  Render  │ →  │   Diff   │ →  │  Commit  │               │
│  │  阶段    │    │  阶段    │    │  阶段    │               │
│  └──────────┘    └──────────┘    └──────────┘               │
│    ↓                  ↓               ↓                      │
│  调用组件函数      比较新旧 VDOM    更新真实 DOM              │
│  生成新的 VDOM     找出差异         应用变更                  │
│                                                              │
│  ⚠️ Render 阶段可以被中断（React 18 Concurrent）              │
│  ✅ Commit 阶段一定同步执行，用户看到的是 Commit 后的状态       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、什么触发渲染

```
┌──────────────────────────────────────────────────────────────┐
│                    触发渲染的三种原因                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 状态更新（setState / useState setter）                    │
│     const [count, setCount] = useState(0);                   │
│     setCount(1); // → 触发该组件及其子组件渲染                │
│                                                              │
│  2. 父组件渲染                                                │
│     父组件渲染 → 所有子组件默认也会渲染                        │
│     即使子组件的 props 没有变化                                │
│                                                              │
│  3. context 值变化                                            │
│     Context Provider 的 value 变化 → 所有消费者渲染           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、渲染 ≠ DOM 更新

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  console.log('组件渲染了'); // 每次 setCount 都会执行

  return <div>{count}</div>;
}

// setCount(0) → 即使值没变，React 也会渲染组件
// 但 Commit 阶段发现 DOM 没变化，不会更新真实 DOM
```

```
重要理解：

  setCount(0) 时（值相同）：
  ✅ Render 阶段：组件函数会执行（"渲染了"）
  ❌ Commit 阶段：DOM 不更新（因为 Virtual DOM 没变化）

  但组件函数执行本身就有成本：
  - 函数调用开销
  - 虚拟 DOM 创建开销
  - Diff 计算开销
  - 子组件也会被渲染
```

---

## 四、Virtual DOM Diff

```
┌──────────────────────────────────────────────────────────────┐
│                    Diff 算法规则                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  规则 1：不同类型的元素 → 销毁重建                            │
│  <div> → <span>  → 销毁旧树，创建新树                        │
│                                                              │
│  规则 2：同类型元素 → 保留 DOM，只更新变化的属性               │
│  <div className="a"> → <div className="b">                   │
│  → 只更新 className                                          │
│                                                              │
│  规则 3：同类型组件 → 保留实例，更新 props 后重新渲染          │
│  <Counter count={1}> → <Counter count={2}>                   │
│  → 调用 Counter 函数，传入新 props                            │
│                                                              │
│  规则 4：列表用 key 标识元素                                  │
│  key 帮助 React 识别哪些元素是新增、删除或移动的               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 五、识别不必要的渲染

### 5.1 React DevTools Profiler

```
操作步骤：
1. 安装 React DevTools 浏览器扩展
2. 打开 Profiler 面板
3. 点击录制 → 操作页面 → 停止录制
4. 查看 Flamegraph 视图：
   - 灰色 = 没有渲染
   - 绿色/黄色/红色 = 渲染了（颜色越深耗时越长）
5. 查看为什么渲染：点击组件 → "Why did this render?"
```

### 5.2 用代码追踪渲染

```javascript
// 开发环境下的渲染追踪
function ComponentTracker({ name, children }) {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${name}] 渲染次数: ${renderCount.current}`);
    }
  });

  return children;
}

// 使用
<ComponentTracker name="UserCard">
  <UserCard user={user} />
</ComponentTracker>
```

---

## 六、渲染成本分析

```
┌──────────────────────────────────────────────────────────────┐
│                渲染成本由低到高                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  低成本                                                       │
│  ├─ 原生 HTML 元素（div, span）                               │
│  ├─ 简单组件（无子组件、无复杂逻辑）                           │
│  ├─ 列表项（10-50 项）                                        │
│  │                                                           │
│  中等成本                                                     │
│  ├─ 有多个子组件的容器                                        │
│  ├─ 中等列表（50-200 项）                                     │
│  ├─ 表单组件                                                  │
│  │                                                           │
│  高成本                                                       │
│  ├─ 大列表（500+ 项）                                         │
│  ├─ 复杂图表组件                                              │
│  ├─ 嵌套很深的组件树                                          │
│  └─ 包含大量 DOM 节点的组件                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 常见误区

1. **认为"渲染"就是"DOM 更新"**：React 的"渲染"（Render 阶段）是调用组件函数生成虚拟 DOM，不等于真实 DOM 更新。即使 DOM 没变，渲染本身也有函数调用和 Diff 计算的成本。
2. **认为 setCount(0) 不会触发渲染**：即使新值和旧值相同，React 默认也会执行渲染。只有在渲染阶段发现虚拟 DOM 没变化时，才会跳过 Commit 阶段的 DOM 更新。
3. **只关注渲染次数不关注渲染成本**：一个简单组件渲染 100 次可能比一个复杂组件渲染 1 次更快。关键看每次渲染的耗时，而不是次数。
4. **在生产环境关闭 StrictMode**：React 18 的 StrictMode 会在开发环境故意渲染两次，帮你发现副作用问题。不要因为"多渲染了一次"就关闭它。

## 工程建议

1. **用 React DevTools Profiler 定期审查渲染**：养成习惯，在每次大功能开发后用 Profiler 录制操作，检查是否有不必要的渲染。
2. **区分渲染触发的三种原因**：状态更新、父组件渲染、context 变化——知道"为什么渲染"才能找到正确的优化方向。
3. **关注渲染成本最高的组件**：Profiler 中颜色越深的组件渲染耗时越长，优先优化这些"热点"组件。
4. **不要过早优化**：先确认性能问题存在（用 Profiler 测量），再决定是否需要优化。大多数 React 应用的渲染性能是足够的。

## 动手练习

### 练习一：追踪渲染

1. 创建一个父组件和三个子组件
2. 父组件状态更新时，观察哪些子组件渲染了
3. 用 React DevTools Profiler 确认

### 练习二：分析渲染原因

1. 给一个组件添加 console.log
2. 改变不同状态，观察渲染触发
3. 区分"状态更新触发"和"父组件渲染触发"

### 练习三：测量渲染成本

1. 创建一个有 1000 个列表项的页面
2. 用 Profiler 测量每次渲染的耗时
3. 找出最耗时的组件

---

## 参考答案

### 练习一：追踪渲染

**思路**：创建一个父组件和三个子组件，父组件状态更新时观察哪些子组件渲染，用 Profiler 确认。

**答案**：

```jsx
import { useState, Profiler } from 'react';

function ChildA({ count }) {
  console.log('ChildA rendered');
  return <div>ChildA: {count}</div>;
}

function ChildB() {
  console.log('ChildB rendered');
  return <div>ChildB: 不依赖 count</div>;
}

function ChildC() {
  console.log('ChildC rendered');
  return <div>ChildC: 不依赖 count</div>;
}

function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Profiler id="ChildA" onRender={(id, phase, duration) =>
        console.log(`${id} ${phase}: ${duration}ms`)
      }>
        <ChildA count={count} />
      </Profiler>
      <ChildB />
      <ChildC />
    </div>
  );
}
```

```markdown
点击按钮后的控制台输出：

ChildA rendered    ← 渲染了（依赖 count）
ChildB rendered    ← 也渲染了（不依赖 count，但父组件渲染带动）
ChildC rendered    ← 也渲染了（同上）
ChildA render: 0.8ms

分析：
- React 默认行为：父组件渲染 → 所有子组件都渲染
- 即使 ChildB 和 ChildC 不依赖 count，它们也被带动渲染
- 这就是"不必要的渲染"

解决方案：
- 用 React.memo 包裹 ChildB 和 ChildC
- 或者把不依赖父组件状态的内容作为 children 传入
```

**要点**：
- React 的"渲染"不等于"DOM 更新"，即使 DOM 不变也会执行渲染
- 父组件状态变化会带动所有子组件渲染，无论子组件是否依赖该状态
- Profiler 可以精确测量每个组件的渲染耗时

### 练习二：分析渲染原因

**思路**：给组件添加 console.log，改变不同状态，区分"状态更新触发"和"父组件渲染触发"。

**答案**：

```jsx
function Profile({ userId }) {
  console.log(`Profile rendered, userId: ${userId}`);

  return <div>Profile: {userId}</div>;
}

function Dashboard() {
  const [theme, setTheme] = useState('light');
  const [userId, setUserId] = useState(1);

  console.log('Dashboard rendered');

  return (
    <div>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      <button onClick={() => setUserId(id => id + 1)}>
        Switch User
      </button>
      <Profile userId={userId} />
    </div>
  );
}
```

```markdown
操作和输出分析：

1. 点击 "Toggle Theme":
   Dashboard rendered
   Profile rendered, userId: 1
   → Profile 被父组件渲染带动，但 userId 没变
   → 这是"父组件渲染触发"的不必要渲染

2. 点击 "Switch User":
   Dashboard rendered
   Profile rendered, userId: 2
   → Profile 因为 userId 变化而渲染
   → 这是"状态更新触发"的必要渲染

区分方法：
- console.log 输出 → 确认组件确实渲染了
- 检查 props 是否变化 → 判断是否必要
- Profiler 的 "Why did this render?" → 直接告诉你原因
```

**要点**：
- 用 console.log 是最简单的渲染追踪方法
- Profiler 的 "Why did this render?" 功能需要在 DevTools 设置中开启
- 区分"状态更新触发"和"父组件渲染触发"是优化的前提

### 练习三：测量渲染成本

**思路**：创建一个有 1000 个列表项的页面，用 Profiler 测量每次渲染的耗时，找出最耗时的组件。

**答案**：

```jsx
import { useState, memo, Profiler } from 'react';

const ListItem = memo(function ListItem({ item, onSelect }) {
  return (
    <div onClick={() => onSelect(item.id)} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
      <strong>{item.name}</strong>
      <span>{item.description}</span>
    </div>
  );
});

function ExpensiveList() {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('');

  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`,
  }));

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." />
      <Profiler id="List" onRender={(id, phase, actualDuration) => {
        console.log(`${id}: ${phase} took ${actualDuration.toFixed(2)}ms`);
      }}>
        <div style={{ height: 400, overflow: 'auto' }}>
          {filtered.map(item => (
            <ListItem key={item.id} item={item} onSelect={setSelectedId} />
          ))}
        </div>
      </Profiler>
    </div>
  );
}
```

```markdown
Profiler 测量结果：

操作 1: 输入搜索关键词 "test"
→ List: update took 45.2ms
→ 原因: 1000 项过滤 + 重新渲染匹配的项

操作 2: 点击一个列表项
→ List: update took 2.8ms
→ 原因: setSelectedId 触发渲染，但 ListItem 用了 memo，props 没变所以跳过

最耗时的组件: ListItem（当 filter 变化时每个都重新渲染）
优化方案:
- 虚拟滚动（只渲染可见区域的 20 项）
- 搜索输入加 debounce
- 把过滤逻辑移到 Web Worker
```

**要点**：
- Profiler 的 actualDuration 是组件渲染的实际耗时
- 1000 个列表项每次渲染约 40-50ms，已经是长任务了
- memo 可以让列表项在 props 不变时跳过渲染

---

## 小结

1. **Render → Diff → Commit**：React 渲染三阶段
2. **三种触发**：状态更新、父组件渲染、context 变化
3. **渲染 ≠ DOM 更新**：即使 DOM 不变，渲染本身也有成本
4. **Diff 规则**：类型不同重建，类型相同更新属性
5. **用 Profiler** 识别不必要的渲染

---

## 下一课预告

下一课将学习状态设计和重渲染控制——你将了解如何通过合理的状态结构减少不必要的渲染。

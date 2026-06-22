# 第3课：memo、useMemo、useCallback 的正确使用边界

> **课程定位**：掌握 React 性能优化 API 的使用时机，避免滥用和误用
> **前置知识**：理解 React 渲染机制和状态设计
> **预计时长**：35 分钟

## 场景引入

你的同事在代码审查时要求你给所有组件都加上 memo，给所有函数都加上 useCallback，给所有计算都加上 useMemo。你照做了，但 Profiler 显示渲染性能几乎没有改善——甚至某些组件变得更慢了。原因很简单：你的组件本身很轻量（只有几个 DOM 元素），memo 的比较成本反而比直接渲染更高；传给子组件的 props 是内联对象，每次都是新引用，memo 根本没有生效。memo、useMemo、useCallback 不是万能药，用错地方反而有害。

---

## 学习目标

1. 理解 memo、useMemo、useCallback 各自的作用
2. 识别什么时候该用、什么时候不该用
3. 避免常见的滥用模式
4. 掌握正确的使用边界

---

## 一、三者分别做什么

```
┌──────────────────────────────────────────────────────────────┐
│                memo / useMemo / useCallback                   │
├──────────────┬───────────────────────────────────────────────┤
│ API          │ 作用                                          │
├──────────────┼───────────────────────────────────────────────┤
│ memo()       │ 包裹组件：props 没变时跳过渲染                 │
│ useMemo()    │ 缓存计算结果：依赖不变就不重新计算             │
│ useCallback  │ 缓存函数引用：依赖不变就不创建新函数           │
└──────────────┴───────────────────────────────────────────────┘
```

---

## 二、React.memo

### 2.1 基本用法

```javascript
// 没有 memo：父组件渲染 → 子组件一定渲染
function ExpensiveChild({ data }) {
  console.log('ExpensiveChild 渲染');
  // 假设这里有复杂的计算和大量 DOM
  return <div>{/* 复杂渲染 */}</div>;
}

// 有 memo：props 不变 → 跳过渲染
const ExpensiveChild = memo(function ExpensiveChild({ data }) {
  console.log('ExpensiveChild 渲染');
  return <div>{/* 复杂渲染 */}</div>;
});
```

### 2.2 什么时候该用 memo

```
┌──────────────────────────────────────────────────────────────┐
│              memo 适用场景                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ 组件渲染成本高（大量 DOM、复杂计算）                       │
│  ✅ 组件经常因为父组件渲染而被无辜带动                         │
│  ✅ props 通常不变                                            │
│  ✅ 列表中的每一项（尤其是长列表）                             │
│                                                              │
│  ❌ 组件本身很简单（几个 DOM 元素）                            │
│  ❌ props 每次都变化                                          │
│  ❌ 组件很少被重渲染                                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 memo 的陷阱

```javascript
// ❌ 陷阱 1：内联对象每次创建新引用
function Parent() {
  const [count, setCount] = useState(0);

  // 每次渲染都创建新对象 → memo 失效
  return <MemoizedChild style={{ color: 'red' }} />;
}

// ✅ 提取到外部或用 useMemo
const style = { color: 'red' };
function Parent() {
  const [count, setCount] = useState(0);
  return <MemoizedChild style={style} />;
}

// ❌ 陷阱 2：内联函数每次创建新引用
function Parent() {
  // 每次渲染都创建新函数 → memo 失效
  return <MemoizedChild onClick={() => console.log('click')} />;
}

// ✅ 用 useCallback
function Parent() {
  const handleClick = useCallback(() => console.log('click'), []);
  return <MemoizedChild onClick={handleClick} />;
}
```

---

## 三、useMemo

### 3.1 基本用法

```javascript
function FilteredList({ items, query }) {
  // ❌ 每次渲染都重新过滤
  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  // ✅ 只在 items 或 query 变化时才重新过滤
  const filtered = useMemo(
    () => items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    ),
    [items, query]
  );

  return <List items={filtered} />;
}
```

### 3.2 什么时候该用 useMemo

```
┌──────────────────────────────────────────────────────────────┐
│              useMemo 适用场景                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ 计算成本高（大数组过滤/排序/聚合）                         │
│  ✅ 计算结果作为子组件的 props（避免子组件重渲染）              │
│  ✅ 计算结果作为其他 hook 的依赖                               │
│                                                              │
│  ❌ 计算很简单（简单加法、字符串拼接）                         │
│  ❌ 结果只在当前渲染中使用                                     │
│  ❌ 依赖数组每次都变化                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 useMemo 的成本

```javascript
// useMemo 本身有成本：
// 1. 存储依赖数组的内存
// 2. 每次渲染比较依赖数组
// 3. 代码复杂度增加

// ❌ 滥用：计算本身很轻
const fullName = useMemo(
  () => `${firstName} ${lastName}`,
  [firstName, lastName]
);
// 直接写更好：
const fullName = `${firstName} ${lastName}`;
```

---

## 四、useCallback

### 4.1 基本用法

```javascript
function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 每次渲染创建新函数
  const handleClick = () => {
    console.log('clicked');
  };

  // ✅ 依赖不变，函数引用不变
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);

  return <MemoizedChild onClick={handleClick} />;
}
```

### 4.2 什么时候该用 useCallback

```
┌──────────────────────────────────────────────────────────────┐
│              useCallback 适用场景                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ 函数作为 memo 组件的 props                                │
│  ✅ 函数作为其他 hook 的依赖（useEffect, useMemo）             │
│  ✅ 函数传递给子组件且子组件用 memo                            │
│                                                              │
│  ❌ 函数只在当前组件内使用                                     │
│  ❌ 子组件没有用 memo                                         │
│  ❌ 函数作为依赖时每次都变化（需要检查依赖）                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 useCallback 的正确组合

```javascript
// memo + useCallback 配合使用
const MemoizedList = memo(function List({ items, onSelect }) {
  return items.map(item => (
    <button key={item.id} onClick={() => onSelect(item.id)}>
      {item.name}
    </button>
  ));
});

function Parent() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // useCallback 稳定了函数引用 → memo 生效
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []);

  return <MemoizedList items={items} onSelect={handleSelect} />;
}
```

---

## 五、决策流程图

```
┌──────────────────────────────────────────────────────────────┐
│              是否需要优化？决策流程                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  组件是否因为父组件渲染而不必要地重渲染？                      │
│  ├─ 否 → 不需要 memo                                         │
│  └─ 是 → 组件渲染成本高吗？                                   │
│          ├─ 否（很简单）→ 不需要 memo                         │
│          └─ 是 → 用 memo                                     │
│               └─ props 中有对象/函数？                        │
│                  ├─ 否 → memo 就够了                          │
│                  └─ 是 → useMemo/useCallback 稳定引用         │
│                                                              │
│  计算是否很昂贵？                                             │
│  ├─ 否 → 不需要 useMemo                                      │
│  └─ 是 → 计算结果会作为 props 或依赖传递吗？                  │
│          ├─ 否 → 可能不需要                                   │
│          └─ 是 → 用 useMemo                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、常见误区

```javascript
// ❌ 错误 1：依赖数组遗漏
const value = useMemo(() => {
  return compute(a, b);
}, [a]); // b 没有加入依赖 → 计算结果可能过时

// ✅ 正确
const value = useMemo(() => {
  return compute(a, b);
}, [a, b]);

// ❌ 错误 2：useCallback 依赖了不稳定值
function Parent({ fetchData }) {
  const handler = useCallback(() => {
    fetchData(); // fetchData 每次都是新引用 → handler 也变
  }, [fetchData]); // useCallback 形同虚设
}

// ✅ 正确：在调用链上游稳定引用
function Parent({ fetchData }) {
  const stableFetch = useCallback(fetchData, []); // 或在定义处稳定
  const handler = useCallback(() => {
    stableFetch();
  }, [stableFetch]);
}

// ❌ 错误 3：用 memo 但没有稳定 props
const MemoizedChild = memo(Child);
function Parent() {
  return <MemoizedChild config={{ theme: 'dark' }} />; // 每次新对象
}
// memo 完全无效
```

---

## 七、React Compiler（未来）

```
┌──────────────────────────────────────────────────────────────┐
│              React Compiler（React 19+）                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  React 团队正在开发编译器，自动优化：                          │
│  - 自动 memo 组件                                            │
│  - 自动缓存计算和函数                                        │
│  - 开发者不需要手动写 memo/useMemo/useCallback               │
│                                                              │
│  现阶段建议：                                                 │
│  - 先理解原理，知道为什么需要优化                             │
│  - 在需要的地方手动优化                                       │
│  - 关注 React Compiler 的进展                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 工程建议

1. **先测量再优化**：用 React DevTools Profiler 确认组件确实有不必要的重渲染，再决定是否加 memo。不要预防性地到处加优化。
2. **内联对象/函数是 memo 的天敌**：如果传给 memo 组件的 props 是内联对象或函数，memo 每次都会失效。用 useMemo/useCallback 稳定引用，或者把对象提取到组件外部。
3. **依赖数组必须完整**：useMemo/useCallback 遗漏依赖会导致计算结果过时。ESLint 的 exhaustive-deps 规则能帮你检查。
4. **关注 React Compiler 的进展**：未来 React Compiler 会自动处理 memo/useMemo/useCallback，届时手动优化将不再必要。但现阶段仍需手动优化。

## 动手练习

### 练习一：测量 memo 效果

1. 创建一个有昂贵子组件的页面
2. 不用 memo，用 Profiler 测量渲染耗时
3. 加上 memo，对比渲染次数和耗时

### 练习二：修复 memo 失效

1. 创建一个 memo 组件，但传入内联对象/函数
2. 用 Profiler 观察 memo 是否生效
3. 用 useMemo/useCallback 修复

### 练习三：决策实践

1. 给出 5 个不同的组件场景
2. 用决策流程图判断是否需要 memo/useMemo/useCallback
3. 实施优化并验证效果

---

## 参考答案

### 练习一：测量 memo 效果

**思路**：创建一个有昂贵子组件的页面，用 Profiler 测量不用 memo 和用 memo 的渲染耗时差异。

**答案**：

```jsx
import { useState, memo, Profiler } from 'react';

// 昂贵的子组件：渲染 1000 个 DOM 节点
function ExpensiveChild({ data, onSelect }) {
  console.log('ExpensiveChild rendered');
  return (
    <div>
      {data.map((item, i) => (
        <div key={i} onClick={() => onSelect(i)} style={{ padding: 4 }}>
          {item.name} - {item.value}
        </div>
      ))}
    </div>
  );
}

// 用 memo 包裹
const MemoizedChild = memo(ExpensiveChild);

function Parent() {
  const [count, setCount] = useState(0);
  const data = Array.from({ length: 1000 }, (_, i) => ({
    name: `Item ${i}`,
    value: Math.random(),
  }));

  return (
    <div>
      <Profiler id="Child" onRender={(id, phase, duration) => {
        console.log(`${id} ${phase}: ${duration.toFixed(2)}ms`);
      }}>
        {/* 不用 memo: <ExpensiveChild data={data} onSelect={console.log} /> */}
        {/* 用 memo: */}
        <MemoizedChild data={data} onSelect={console.log} />
      </Profiler>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}
```

```markdown
测量结果：

不用 memo：
- 点击按钮 → ExpensiveChild rendered → 45ms
- 每次父组件渲染都带动子组件渲染

用 memo + 内联函数（memo 失效）：
- 点击按钮 → ExpensiveChild rendered → 45ms
- onSelect={console.log} 每次都是新引用 → memo 失效

用 memo + useCallback：
- 点击按钮 → ExpensiveChild 没有渲染 → 0ms
- onSelect 引用稳定 → memo 生效 → 跳过渲染

结论：
- memo 可以让昂贵组件在 props 不变时跳过渲染
- 但传入内联函数/对象会让 memo 失效
- 必须配合 useCallback/useMemo 稳定引用
```

**要点**：
- memo 只在 props 变化时才重新渲染
- 内联函数和对象每次渲染都是新引用，会让 memo 失效
- 先用 Profiler 确认问题存在，再决定是否加 memo

### 练习二：修复 memo 失效

**思路**：创建一个 memo 组件但传入内联对象/函数，用 Profiler 观察 memo 是否生效，然后用 useMemo/useCallback 修复。

**答案**：

```jsx
import { useState, memo, useCallback, useMemo } from 'react';

const UserCard = memo(function UserCard({ user, style, onClick }) {
  console.log('UserCard rendered:', user.name);
  return (
    <div style={style} onClick={onClick}>
      {user.name} - {user.email}
    </div>
  );
});

function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 问题 1：内联对象 → 每次都是新引用
  // const style = { padding: 16, border: '1px solid #ccc' };

  // ✅ 修复 1：用 useMemo 缓存对象
  const style = useMemo(() => ({ padding: 16, border: '1px solid #ccc' }), []);

  // ❌ 问题 2：内联函数 → 每次都是新引用
  // const handleClick = () => console.log('clicked');

  // ✅ 修复 2：用 useCallback 缓存函数
  const handleClick = useCallback(() => console.log('clicked'), []);

  const user = { name: 'Alice', email: 'alice@example.com' };

  return (
    <div>
      <UserCard user={user} style={style} onClick={handleClick} />
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}
```

```markdown
验证结果：

修复前（内联对象/函数）：
- 点击按钮 → UserCard rendered: Alice → memo 失效
- 原因: style 和 onClick 每次都是新引用

修复后（useMemo/useCallback）：
- 点击按钮 → UserCard 没有渲染 → memo 生效
- 原因: style 和 onClick 引用稳定

注意：
- user 对象也需要 useMemo 或定义在组件外部
- 如果 user 定义在 Parent 内部，每次渲染也是新引用
```

**要点**：
- memo 的天敌是内联对象和内联函数
- useMemo 缓存计算结果/对象，useCallback 缓存函数引用
- 依赖数组必须完整，遗漏依赖会导致值过时

### 练习三：决策实践

**思路**：给出 5 个不同的组件场景，用决策流程图判断是否需要 memo/useMemo/useCallback。

**答案**：

```markdown
场景 1: 一个简单的 <p> 标签显示文字
→ 不需要 memo
→ 原因: 渲染成本极低（< 0.1ms），优化的收益可以忽略

场景 2: 一个输入框组件，值通过 props 传入
→ 不需要 memo
→ 原因: 输入框的值必须随父组件变化，memo 会导致输入不响应

场景 3: 一个渲染 500 行的表格组件
→ 需要 memo + useCallback
→ 原因: 渲染成本高（30-50ms），经常因父组件渲染而被带动
→ 实现: const Table = memo(TableRow); 配合稳定的 onRowClick

场景 4: 一个复杂的计算函数，结果作为 props 传给子组件
→ 需要 useMemo
→ 原因: 计算昂贵（100ms+）且结果作为依赖传递
→ 实现: const result = useMemo(() => expensiveCompute(data), [data]);

场景 5: 一个列表项组件，包含头像、名称、操作按钮
→ 需要 memo + useCallback
→ 原因: 列表项多（100+），每个都有 onClick 回调
→ 实现: const ListItem = memo(...); 配合 useCallback 稳定 onSelect
```

```markdown
决策流程图总结：

1. 渲染成本高吗？
   → 低（简单组件）→ 不需要优化
   → 高（复杂组件、大量 DOM）→ 继续判断

2. 经常因父组件渲染而被带动吗？
   → 很少 → 不需要 memo
   → 经常 → 用 memo

3. 传给 memo 组件的 props 稳定吗？
   → 稳定（常量、定义在外部的函数）→ memo 足够
   → 不稳定（内联对象/函数）→ 配合 useMemo/useCallback

4. 计算昂贵吗？
   → 不昂贵 → 不需要 useMemo
   → 昂贵 → 用 useMemo 缓存结果
```

**要点**：
- 不要过早优化，先用 Profiler 确认问题存在
- 简单组件（< 1ms）不需要 memo，优化的收益可以忽略
- memo 必须配合稳定的 props 才能生效

---

## 小结

1. **memo**：包裹组件，props 不变时跳过渲染
2. **useMemo**：缓存昂贵的计算结果
3. **useCallback**：缓存函数引用，配合 memo 使用
4. **不要滥用**：简单的计算和组件不需要优化
5. **必须稳定依赖**：内联对象/函数会让优化失效
6. **先测量再优化**：用 Profiler 确认问题存在

---

## 下一课预告

下一课将学习大列表和虚拟滚动——当列表项数以千计时，如何保持渲染性能。

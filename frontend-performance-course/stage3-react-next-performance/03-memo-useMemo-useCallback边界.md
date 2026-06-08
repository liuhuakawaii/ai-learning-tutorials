# 第3课：memo、useMemo、useCallback 的正确使用边界

> **课程定位**：掌握 React 性能优化 API 的使用时机，避免滥用和误用
> **前置知识**：理解 React 渲染机制和状态设计
> **预计时长**：35 分钟

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

## 六、常见错误

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

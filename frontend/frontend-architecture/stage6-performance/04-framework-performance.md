# 04. React/Vue 性能优化模式 —— memo、虚拟列表、时间切片、computed/watch

> 框架帮你管理了 DOM 更新，但框架本身也可能成为性能瓶颈

## 本课目标

- 理解 React 和 Vue 的渲染机制，知道什么情况下会产生不必要的渲染
- 掌握 React 的 memo/useMemo/useCallback 优化模式
- 掌握 Vue 的 computed/watch/nextTick 优化模式
- 理解虚拟列表的原理和实现思路
- 理解时间切片的原理和应用场景

## 框架为什么会导致性能问题

React 和 Vue 的核心价值是"状态变化时自动更新 DOM"。但这个自动化有代价：

```
状态变化
  ↓
框架重新执行组件函数（React）或重新计算模板（Vue）
  ↓
生成新的 Virtual DOM / 模板 AST
  ↓
Diff：对比新旧虚拟 DOM，找出变化
  ↓
Patch：只更新真正变化的真实 DOM

代价在第二步：组件函数可能执行了大量计算，
或者生成了大量虚拟 DOM 节点，即使最终没有变化。
```

## React 性能优化

### React.memo

```jsx
// 问题：父组件渲染时，即使子组件的 props 没变，子组件也会重新渲染

function Parent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveChild /> {/* 每次 count 变化，这个组件都会重新渲染 */}
    </div>
  );
}

function ExpensiveChild() {
  // 假设这里有复杂的渲染逻辑
  console.log('ExpensiveChild rendered');
  return <div>复杂的子组件</div>;
}

// 解决方案：用 React.memo 包裹子组件
const ExpensiveChild = React.memo(function ExpensiveChild() {
  console.log('ExpensiveChild rendered');
  return <div>复杂的子组件</div>;
});

// memo 的原理：
// 在渲染前对比新旧 props，如果 props 没变，跳过渲染，使用上次的结果
```

**memo 的适用场景**：

```
适合用 memo 的情况：
1. 子组件渲染成本高（大量 DOM 节点、复杂计算）
2. 子组件经常因为父组件状态变化而"无辜"重新渲染
3. props 变化的频率远低于父组件渲染的频率

不适合用 memo 的情况：
1. 子组件本身很简单（几个 DOM 节点）
2. props 每次都不同（memo 的对比也会浪费时间）
3. 父组件很少重新渲染

记住：memo 不是免费的，它需要对比 props。
如果对比的成本大于重新渲染的成本，memo 反而更慢。
```

### useMemo 和 useCallback

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const [items] = useState([1, 2, 3, 4, 5]);
  
  // 问题 1：每次渲染都创建新的函数引用
  const handleClick = (id) => {
    console.log(id);
  };
  
  // 问题 2：每次渲染都重新计算
  const sortedItems = items.sort((a, b) => a - b);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <List items={sortedItems} onClick={handleClick} />
    </div>
  );
}

const List = React.memo(function List({ items, onClick }) {
  console.log('List rendered');
  return (
    <ul>
      {items.map(item => (
        <li key={item} onClick={() => onClick(item)}>{item}</li>
      ))}
    </ul>
  );
});
// List 每次都会渲染，因为：
// 1. handleClick 每次都是新引用 → memo 的 props 对比失败
// 2. sortedItems 每次都是新数组 → memo 的 props 对比失败
```

```jsx
// 解决方案
function Parent() {
  const [count, setCount] = useState(0);
  const [items] = useState([1, 2, 3, 4, 5]);
  
  // useCallback：缓存函数引用
  const handleClick = useCallback((id) => {
    console.log(id);
  }, []);  // 依赖数组为空，函数引用永远不会变
  
  // useMemo：缓存计算结果
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a - b);
  }, [items]);  // 只在 items 变化时重新计算
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <List items={sortedItems} onClick={handleClick} />
    </div>
  );
}
// 现在 List 只在 items 或 handleClick 变化时才渲染
// count 的变化不会导致 List 重新渲染
```

**useMemo/useCallback 的使用原则**：

```
不要无脑给所有东西加 useMemo/useCallback。

需要的情况：
1. 计算成本高的操作（大数组排序、过滤、聚合）
2. 作为 memo 组件的 prop（保持引用稳定）
3. 作为其他 Hook 的依赖项（避免 effect 重复执行）

不需要的情况：
1. 简单的计算（a + b、字符串拼接）
2. 不作为 prop 传递的回调
3. 不作为 Hook 依赖的值

过度使用的代价：
- 代码可读性下降
- 每个 useMemo/useCallback 都需要维护依赖数组
- 内存占用增加（缓存了更多值）
- React 本身也有对比依赖数组的成本
```

### 虚拟列表（Virtual List / Windowing）

```jsx
// 问题：渲染 10000 个列表项，DOM 节点太多，页面卡顿
// 解决方案：只渲染可见区域的 DOM 节点

// 原理：
// ┌─────────────────────────┐
// │      容器（固定高度）      │
// │  ┌───────────────────┐  │
// │  │  可见区域          │  │
// │  │  渲染 10-15 个项    │  │
// │  └───────────────────┘  │
// │                         │
// │  上方占位（不可见）       │ ← padding 或 transform
// │  下方占位（不可见）       │ ← padding 或 transform
// └─────────────────────────┘

// 使用 react-window 库
import { FixedSizeList } from 'react-window';

function VirtualList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index]}
    </div>
  );
  
  return (
    <FixedSizeList
      height={400}       // 容器高度
      width="100%"        // 容器宽度
      itemCount={items.length}
      itemSize={35}       // 每项高度
    >
      {Row}
    </FixedSizeList>
  );
}
// 只渲染 400/35 ≈ 12 个 DOM 节点，而不是 10000 个
```

```jsx
// 不等高列表的虚拟化
import { VariableSizeList } from 'react-window';

function VariableList({ items }) {
  const listRef = useRef();
  
  // 根据内容估算每项高度
  const getItemSize = (index) => {
    // 可以根据内容长度估算
    return items[index].content.length > 100 ? 80 : 40;
  };
  
  const Row = ({ index, style }) => (
    <div style={style}>
      <h3>{items[index].title}</h3>
      <p>{items[index].content}</p>
    </div>
  );
  
  return (
    <VariableSizeList
      ref={listRef}
      height={400}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  );
}
```

### 时间切片（Time Slicing）

```jsx
// 问题：一次性处理大量数据，主线程被阻塞，页面卡顿
// 解决方案：把任务拆成小块，用空闲时间分批处理

// 使用 requestIdleCallback 的时间切片
function useTimeSlice(items, batchSize = 100) {
  const [renderedItems, setRenderedItems] = useState([]);
  const indexRef = useRef(0);
  
  useEffect(() => {
    let cancelled = false;
    
    function processBatch(deadline) {
      const batch = [];
      
      while (
        deadline.timeRemaining() > 0 &&
        indexRef.current < items.length &&
        !cancelled
      ) {
        batch.push(items[indexRef.current]);
        indexRef.current++;
      }
      
      if (batch.length > 0) {
        setRenderedItems(prev => [...prev, ...batch]);
      }
      
      if (indexRef.current < items.length && !cancelled) {
        requestIdleCallback(processBatch);
      }
    }
    
    requestIdleCallback(processBatch);
    
    return () => { cancelled = true; };
  }, [items]);
  
  return renderedItems;
}

// 使用
function LargeList({ items }) {
  const renderedItems = useTimeSlice(items);
  
  return (
    <ul>
      {renderedItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

### React 的并发特性（Concurrent Features）

```jsx
// React 18+ 的并发渲染
import { useDeferredValue, useTransition } from 'react';

function SearchList({ query }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState([]);
  
  const handleSearch = (e) => {
    const value = e.target.value;
    
    // startTransition 标记为非紧急更新
    // 如果有更紧急的更新（如输入框响应），会打断这个更新
    startTransition(() => {
      setResults(filterItems(value));
    });
  };
  
  return (
    <div>
      <input onChange={handleSearch} />
      {isPending && <span>搜索中...</span>}
      <List items={results} />
    </div>
  );
}

// useDeferredValue：延迟更新非关键 UI
function App({ searchText }) {
  const deferredSearch = useDeferredValue(searchText);
  
  return (
    <div>
      <SearchResults query={deferredSearch} />
    </div>
  );
}
// searchText 变化时，SearchResults 不会立即更新
// 等主线程空闲后才更新，避免输入卡顿
```

## Vue 性能优化

### computed 的缓存特性

```vue
<script setup>
import { ref, computed } from 'vue';

const items = ref([3, 1, 4, 1, 5, 9, 2, 6]);

// computed 有缓存：只有依赖变化时才重新计算
const sortedItems = computed(() => {
  console.log('sortedItems computed'); // 只在 items 变化时打印
  return [...items.value].sort((a, b) => a - b);
});

// 对比：普通函数每次访问都会执行
function getSortedItems() {
  console.log('getSortedItems called'); // 每次模板渲染都会打印
  return [...items.value].sort((a, b) => a - b);
}
</script>

<template>
  <!-- 使用 computed：多次访问只计算一次 -->
  <div>{{ sortedItems.join(', ') }}</div>
  <div>{{ sortedItems.length }}</div>
  
  <!-- 使用函数：每次访问都计算 -->
  <div>{{ getSortedItems().join(', ') }}</div>
</template>
```

### watch vs watchEffect

```vue
<script setup>
import { ref, watch, watchEffect } from 'vue';

const userId = ref(1);
const userData = ref(null);

// watch：明确指定依赖，可选懒执行
watch(userId, async (newId, oldId) => {
  console.log(`User changed from ${oldId} to ${newId}`);
  userData.value = await fetchUser(newId);
}, { immediate: false });  // 默认不立即执行

// watchEffect：自动追踪依赖，立即执行
watchEffect(async () => {
  console.log(`Fetching user ${userId.value}`);
  userData.value = await fetchUser(userId.value);
});
// 区别：
// 1. watch 需要明确指定监听的值
// 2. watchEffect 自动追踪回调中用到的所有响应式值
// 3. watch 可以获取旧值，watchEffect 不行
// 4. watch 默认懒执行，watchEffect 立即执行

// 选择建议：
// - 需要旧值 → watch
// - 需要懒执行 → watch
// - 依赖多个响应式值 → watchEffect（更简洁）
</script>
```

### 大型列表优化

```vue
<script setup>
import { ref, computed } from 'vue';

const allItems = ref(generateItems(10000));
const filterText = ref('');

// 优化 1：用 computed 缓存过滤结果
const filteredItems = computed(() => {
  if (!filterText.value) return allItems.value;
  const keyword = filterText.value.toLowerCase();
  return allItems.value.filter(item =>
    item.name.toLowerCase().includes(keyword)
  );
});

// 优化 2：分页或虚拟滚动
const page = ref(1);
const pageSize = 50;

const paginatedItems = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredItems.value.slice(start, start + pageSize);
});

// 优化 3：v-memo 避免不必要的 vnode 创建（Vue 3.2+）
// 只有当 item.id 或 item.selected 变化时才重新渲染这个列表项
</script>

<template>
  <input v-model="filterText" placeholder="搜索..." />
  
  <ul>
    <li v-for="item in paginatedItems" :key="item.id" v-memo="[item.selected]">
      <span>{{ item.name }}</span>
      <input type="checkbox" v-model="item.selected" />
    </li>
  </ul>
  
  <div>
    <button @click="page--" :disabled="page <= 1">上一页</button>
    <span>{{ page }} / {{ Math.ceil(filteredItems.length / pageSize) }}</span>
    <button @click="page++">下一页</button>
  </div>
</template>
```

### Vue 中的 v-once 和 v-memo

```vue
<template>
  <!-- v-once：只渲染一次，后续更新跳过 -->
  <header v-once>
    <h1>{{ appTitle }}</h1>
    <p>{{ appDescription }}</p>
  </header>
  
  <!-- v-memo：有条件地跳过更新 -->
  <div v-for="item in list" :key="item.id" v-memo="[item.selected, item.title]">
    <!-- 只有 selected 或 title 变化时才重新渲染这个 div -->
    <h3>{{ item.title }}</h3>
    <p>{{ item.description }}</p>
    <input type="checkbox" v-model="item.selected" />
  </div>
</template>
```

## 本课小结

```
React 性能优化工具箱：
  React.memo     → 避免子组件不必要的渲染
  useMemo        → 缓存计算结果
  useCallback    → 缓存函数引用
  虚拟列表       → 大量列表项只渲染可见区域
  useTransition  → 标记非紧急更新
  useDeferredValue → 延迟非关键 UI 更新

Vue 性能优化工具箱：
  computed       → 缓存派生值
  watch          → 明确的依赖追踪
  v-once         → 静态内容只渲染一次
  v-memo         → 有条件地跳过更新
  虚拟滚动       → 大量列表项（vue-virtual-scroller）
  shallowRef     → 减少深层响应式追踪

通用原则：
  1. 先测量再优化（React DevTools Profiler / Vue DevTools）
  2. 不要过早优化（大多数组件不需要 memo）
  3. 优化瓶颈组件（找到渲染最慢的组件，而不是所有组件）
  4. 减少不必要的状态（状态越少，触发更新的机会越少）
```

## 练习

### 练习一：优化 React 组件

以下组件有性能问题，请找出并优化：

```jsx
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };

  const handleAdd = () => {
    setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
    setInput('');
  };

  const handleToggle = (id) => {
    setTodos(todos.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleAdd}>Add</button>
      
      <div>
        <button onClick={() => setFilter('all')}>All ({stats.total})</button>
        <button onClick={() => setFilter('active')}>Active ({stats.active})</button>
        <button onClick={() => setFilter('completed')}>Completed ({stats.completed})</button>
      </div>
      
      <TodoList todos={filteredTodos} onToggle={handleToggle} />
    </div>
  );
}

function TodoList({ todos, onToggle }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

### 练习二：Vue computed 与方法的区别

解释以下代码中 `computedResult` 和 `methodResult` 的行为差异：

```vue
<script setup>
import { ref, computed } from 'vue';

const count = ref(1);

const computedResult = computed(() => {
  console.log('computed 执行');
  return count.value * 2;
});

function methodResult() {
  console.log('method 执行');
  return count.value * 2;
}
</script>

<template>
  <p>Count: {{ count }}</p>
  <p>Computed: {{ computedResult }}</p>
  <p>Computed: {{ computedResult }}</p>
  <p>Method: {{ methodResult() }}</p>
  <p>Method: {{ methodResult() }}</p>
  <button @click="count++">+1</button>
</template>
```

问题：
1. 初始渲染时，控制台会打印哪些日志？各几次？
2. 点击按钮后，控制台会打印哪些日志？各几次？
3. 为什么 Vue 推荐用 computed 而不是方法？

---

## 参考答案

### 练习一

```jsx
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all');

  // 优化 1：用 useMemo 缓存过滤结果
  const filteredTodos = useMemo(() => {
    return todos.filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
  }, [todos, filter]);

  // 优化 2：用 useMemo 缓存统计信息
  const stats = useMemo(() => ({
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  }), [todos]);

  // 优化 3：用 useCallback 缓存回调（作为 TodoList 的 prop）
  const handleToggle = useCallback((id) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  }, []);

  const handleAdd = useCallback(() => {
    setTodos(prev => [...prev, { id: Date.now(), text: input, completed: false }]);
    setInput('');
  }, [input]);

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleAdd}>Add</button>
      
      <div>
        <button onClick={() => setFilter('all')}>All ({stats.total})</button>
        <button onClick={() => setFilter('active')}>Active ({stats.active})</button>
        <button onClick={() => setFilter('completed')}>Completed ({stats.completed})</button>
      </div>
      
      <TodoList todos={filteredTodos} onToggle={handleToggle} />
    </div>
  );
}

// 优化 4：用 memo 包裹 TodoList
const TodoList = React.memo(function TodoList({ todos, onToggle }) {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} />
      ))}
    </ul>
  );
});

// 优化 5：单独的 TodoItem 组件，用 memo 包裹
const TodoItem = React.memo(function TodoItem({ todo, onToggle }) {
  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      {todo.text}
    </li>
  );
});
```

```
优化点说明：
1. filteredTodos：每次渲染都会过滤，用 useMemo 缓存
2. stats：每次渲染都重新计算，用 useMemo 缓存
3. handleToggle：作为 TodoList 的 prop，用 useCallback 保持引用稳定
4. TodoList：用 memo 避免父组件输入时不必要的渲染
5. TodoItem：用 memo 避免其他 todo 变化时不必要的渲染

注意：handleAdd 依赖 input，每次 input 变化都会创建新引用。
但这没问题，因为 handleAdd 不是 TodoList 的 prop。
```

### 练习二

```
1. 初始渲染时的控制台输出：
   computed 执行     ← 1 次（computed 首次访问时计算，结果被缓存）
   method 执行       ← 2 次（模板中调用了两次 methodResult()）

2. 点击按钮后的控制台输出：
   computed 执行     ← 1 次（count 变了，重新计算）
   method 执行       ← 2 次（每次模板渲染都重新执行）

3. 为什么 Vue 推荐用 computed：
   - computed 有缓存：依赖不变时直接返回缓存值，不重新计算
   - 方法没有缓存：每次渲染都执行
   - computed 是响应式的：依赖变化时自动更新
   - 方法需要在模板中调用：每次渲染都调用

   在这个例子中，methodResult 在模板中被调用了两次，
   所以每次渲染都会执行两次函数。
   computedResult 被访问了两次，但只计算了一次（缓存生效）。
```

## 下一步

完成本课后，继续学习 [05. 代码分割与懒加载最佳实践](./05-code-splitting-lazy-loading.md)。

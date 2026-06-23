# React 渲染机制：为什么你的组件总是重渲染

## 现象

你的 React 应用在开发环境很流畅，但列表数据多了之后，每次输入搜索框都会卡顿。React DevTools 的 Profiler 显示：每次按键，整个列表组件都在重渲染。

问题不在 React 本身，在你的状态设计。

## React 的渲染触发条件

```
组件重渲染的触发条件：
  1. 自身 state 变化
  2. 父组件重渲染（即使 props 没变）
  3. context 值变化
```

```typescript
// 问题示例：搜索输入导致整个列表重渲染
function ProductPage() {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <ProductList products={products} />  {/* 每次输入都重渲染 */}
    </div>
  )
}
```

## 状态下沉

最有效的优化：把状态移到真正需要它的组件中。

```typescript
// 优化：搜索状态下沉到 SearchBar
function ProductPage() {
  return (
    <div>
      <SearchBar />
      <ProductList />
    </div>
  )
}

function SearchBar() {
  const [search, setSearch] = useState('')
  return <input value={search} onChange={e => setSearch(e.target.value)} />
}
```

## memo：跳过不必要的渲染

```typescript
// memo：如果 props 没变，跳过渲染
const ProductList = memo(function ProductList({ products }) {
  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  )
})
```

memo 的代价：每次都要比较 props。如果组件本身很轻量，memo 反而更慢。

## useMemo 和 useCallback

```typescript
function ProductPage({ products }) {
  const [sortKey, setSortKey] = useState('name')

  // useMemo：缓存计算结果
  const sorted = useMemo(
    () => [...products].sort((a, b) => a[sortKey].localeCompare(b[sortKey])),
    [products, sortKey]
  )

  // useCallback：缓存函数引用
  const handleClick = useCallback((id) => {
    console.log('Clicked', id)
  }, [])

  return <ProductList products={sorted} onClick={handleClick} />
}
```

## 使用边界

```
memo 的适用场景：
  ✅ 组件渲染成本高（复杂列表、图表）
  ✅ 父组件频繁重渲染
  ✅ props 大部分时间不变

memo 不适用：
  ❌ 组件本身很轻量（一个 div + 一段文字）
  ❌ props 每次都变（对象字面量、箭头函数）
  ❌ 优化成本大于收益

useMemo 的适用场景：
  ✅ 昂贵的计算（排序、过滤大数组）
  ✅ 引用稳定性（传给 memo 组件的对象）

useMemo 不适用：
  ❌ 简单计算（加减乘除）
  ❌ 结果每次都不同
```

## 你可能踩的坑

**坑一：过度 memo**

每个组件都加 memo，反而增加了比较成本。只在 Profiler 证明有性能问题时才用。

**坑二：useMemo 的依赖不完整**

```typescript
// 错误：遗漏了 dependency
useMemo(() => products.filter(p => p.category === category), [])
// 正确：
useMemo(() => products.filter(p => p.category === category), [products, category])
```

**坑三：对象字面量破坏 memo**

```typescript
// 每次渲染都创建新对象，memo 无效
<ProductList style={{ color: 'red' }} />

// 解决：提取为常量
const style = { color: 'red' }
<ProductList style={style} />
```

## 练习

### 练习一：Profiler 分析

用 React DevTools 的 Profiler 工具分析你的项目，找出重渲染最频繁的组件。

### 练习二：优化搜索组件

有一个搜索组件，每次输入都导致整个列表重渲染。用状态下沉 + memo 优化，目标：输入时只有搜索框重渲染。

---

## 参考答案

### 练习一

```
Profiler 步骤：
1. 安装 React DevTools
2. 打开 Profiler 面板
3. 点击 Record
4. 进行操作（输入、点击、滚动）
5. 停止录制
6. 查看 Flamegraph 视图，找出重渲染最多的组件
7. 查看为什么重渲染（props changed / parent rendered）
```

### 练习二

```typescript
// 优化前
function SearchableList({ items }) {
  const [search, setSearch] = useState('')
  const filtered = items.filter(i => i.name.includes(search))
  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(i => <div key={i.id}>{i.name}</div>)}
    </div>
  )
}

// 优化后
function SearchableList({ items }) {
  return (
    <div>
      <SearchInput />
      <FilteredItems items={items} />
    </div>
  )
}

const SearchInput = memo(function SearchInput() {
  const [search, setSearch] = useState('')
  return <input value={search} onChange={e => setSearch(e.target.value)} />
})

// 搜索状态通过 URL 或 context 共享
```

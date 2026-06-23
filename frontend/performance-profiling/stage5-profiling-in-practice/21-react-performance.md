# React 性能分析

> React 应用的性能问题往往不是算法慢，而是渲染了不该渲染的组件。React DevTools Profiler 能直接告诉你哪些组件在做无用功。

## React DevTools Profiler

安装 React DevTools 浏览器扩展后，DevTools 里会多出一个 **Profiler** 面板（注意不是 Performance 面板）。

Profiler 的工作方式：
1. 点击录制按钮
2. 执行交互操作
3. 停止录制
4. 查看每次渲染的组件耗时

录制结果有两种视图：

**火焰图视图**：展示组件树和每个组件的渲染时间。每次 state 更新对应一帧，可以逐帧查看。

**排名图视图**：按渲染时间从高到低排列组件。直接找到最慢的组件。

## 识别不必要的重渲染

React 的重渲染规则：
- 组件的 state 或 context 变化时，该组件及其所有子组件都会重渲染
- 父组件重渲染时，即使子组件的 props 没变，子组件也会重渲染（除非用了 `React.memo`）

在 Profiler 的火焰图视图里，**灰色的组件**表示虽然被触发了重渲染，但渲染结果和上次一样（props 没变）。这些就是不必要的重渲染。

一个典型的场景：

```tsx
function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveComponent />
    </div>
  )
}

function ExpensiveComponent() {
  // 这个组件和 count 无关
  // 但每次 App 的 count 变化，它都会重渲染
  return <div>我很贵的渲染</div>
}
```

在 Profiler 里录制一次点击，你会看到 `ExpensiveComponent` 也被渲染了——它是灰色的，说明渲染结果和上次一样。

## 解决方案

### React.memo

```tsx
const ExpensiveComponent = React.memo(function ExpensiveComponent() {
  return <div>我很贵的渲染</div>
})
```

`React.memo` 会在渲染前浅比较 props，如果 props 没变就跳过渲染。

### 状态下沉

把需要频繁更新的状态移到真正需要它的组件里，而不是放在父组件：

```tsx
function App() {
  return (
    <div>
      <Counter />
      <ExpensiveComponent />
    </div>
  )
}

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}
```

`count` 的更新只影响 `Counter`，`ExpensiveComponent` 不会重渲染。

### useMemo 和 useCallback

如果子组件接收函数或对象作为 props，每次父组件渲染都会创建新的引用，导致 `React.memo` 失效：

```tsx
function Parent() {
  const [count, setCount] = useState(0)

  // 每次渲染都创建新的函数引用
  const handleClick = () => console.log('clicked')

  // 每次渲染都创建新的对象引用
  const config = { theme: 'dark' }

  return <MemoizedChild onClick={handleClick} config={config} />
}

const MemoizedChild = React.memo(function Child({ onClick, config }: any) {
  return <div onClick={onClick}>{config.theme}</div>
})
```

虽然 `handleClick` 和 `config` 的内容没变，但每次渲染都是新引用，`React.memo` 的浅比较会认为 props 变了。

修复：

```tsx
function Parent() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => console.log('clicked'), [])
  const config = useMemo(() => ({ theme: 'dark' }), [])

  return <MemoizedChild onClick={handleClick} config={config} />
}
```

## Profiler 里的 Commit 和 Render

在 Profiler 的火焰图视图里，每次 state 更新对应一次 **Commit**。每次 Commit 包含多个组件的 **Render**。

- **Render**：React 调用组件函数，计算新的 Virtual DOM
- **Commit**：React 把变化应用到真实 DOM

Render 的耗时是 JavaScript 计算时间（生成 Virtual DOM）。Commit 的耗时是 DOM 操作时间（插入、更新、删除 DOM 节点）。

如果 Render 很快但 Commit 很慢，说明 DOM 变化很大——也许你更新了一个包含大量子节点的组件。

## React 18 的并发特性

React 18 的并发模式下，Profiler 会显示两种优先级的渲染：

- **Immediate**：同步渲染（紧急更新，如用户输入）
- **Transition**：可中断的渲染（非紧急更新，如搜索结果）

```tsx
import { useTransition } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value) // 紧急：立即更新输入框
    startTransition(() => {
      setResults(search(e.target.value)) // 非紧急：可以被中断
    })
  }

  return (
    <div>
      <input value={query} onChange={handleInput} />
      {isPending ? <div>搜索中...</div> : <ResultList results={results} />}
    </div>
  )
}
```

在 Profiler 里，Transition 渲染被打断时会显示为"Incomplete"。

## 练习

### 练习一：找到不必要的重渲染

用以下代码，用 React DevTools Profiler 录制一次 count 更新，找出哪些组件做了不必要的重渲染：

```tsx
function App() {
  const [count, setCount] = useState(0)
  const [theme, setTheme] = useState('light')

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>Toggle Theme</button>
      <Header title="My App" />
      <CounterDisplay count={count} />
      <ThemeDisplay theme={theme} />
      <Footer />
    </div>
  )
}

function Header({ title }: { title: string }) {
  console.log('Header rendered')
  return <h1>{title}</h1>
}

function CounterDisplay({ count }: { count: number }) {
  console.log('CounterDisplay rendered')
  return <p>Count: {count}</p>
}

function ThemeDisplay({ theme }: { theme: string }) {
  console.log('ThemeDisplay rendered')
  return <p>Theme: {theme}</p>
}

function Footer() {
  console.log('Footer rendered')
  return <footer>Footer</footer>
}
```

### 练习二：优化重渲染

优化上面的代码，确保每次只更新相关组件。用 Profiler 验证优化效果。

---

## 参考答案

### 练习一

点击 count 按钮后，Console 会输出：
```
Header rendered
CounterDisplay rendered
ThemeDisplay rendered
Footer rendered
```

四个组件都重新渲染了，但只有 `CounterDisplay` 需要。其他三个的 props 没变。

### 练习二

```tsx
const Header = React.memo(function Header({ title }: { title: string }) {
  console.log('Header rendered')
  return <h1>{title}</h1>
})

const ThemeDisplay = React.memo(function ThemeDisplay({ theme }: { theme: string }) {
  console.log('ThemeDisplay rendered')
  return <p>Theme: {theme}</p>
})

const Footer = React.memo(function Footer() {
  console.log('Footer rendered')
  return <footer>Footer</footer>
})
```

优化后，点击 count 按钮只输出 `CounterDisplay rendered`。

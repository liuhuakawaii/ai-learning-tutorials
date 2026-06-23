# 常见内存泄漏模式

> 内存泄漏的代码模式就那么几种。认全了，看到泄漏的堆快照就能直接猜到原因。

## 模式一：闭包引用

闭包是 JavaScript 最常见的内存泄漏源头。闭包会捕获它所在作用域的变量，即使外部函数已经执行完毕，这些变量仍然被保留在内存里。

```tsx
function setupHandler(largeData: string[]) {
  // largeData 有 10MB

  document.getElementById('btn')?.addEventListener('click', () => {
    // 这个回调闭包捕获了 largeData
    // 只要事件监听器存在，largeData 就不会被 GC 回收
    console.log(largeData.length)
  })
}
```

问题不在于闭包本身，而在于闭包的生命周期超出了预期。如果事件监听器没有被移除，闭包（以及它捕获的 `largeData`）就永远留在内存里。

在堆快照里怎么识别：找到一个闭包对象，看它的 Retained Size 是否异常大。如果是，展开它的引用链，看它捕获了什么。

## 模式二：事件监听器未清理

这是最经典的前端内存泄漏。`addEventListener` 后如果没有对应的 `removeEventListener`，监听器回调（以及回调闭包引用的一切）都无法被回收。

```tsx
function LeakyComponent() {
  useEffect(() => {
    const handleScroll = () => {
      // 处理滚动
    }
    window.addEventListener('scroll', handleScroll)

    // 忘记清理
    // return () => window.removeEventListener('scroll', handleScroll)
  }, [])
}
```

每挂载一次组件，就多一个 scroll 监听器。如果在单页应用里反复导航到这个页面，监听器会不断累积。

在 DevTools 里检查：Console 面板输入 `getEventListeners(window)` 可以看到某个元素上注册的所有事件监听器。

## 模式三：定时器未清理

`setInterval` 如果没有 `clearInterval`，回调会一直执行。如果回调里有闭包引用大对象，这些对象永远不会被释放。

```tsx
function LeakyPolling() {
  useEffect(() => {
    setInterval(() => {
      fetch('/api/status').then(/* ... */)
    }, 5000)
    // 没有 clearInterval
  }, [])
}
```

即使组件卸载了，定时器还在跑，回调还在执行，闭包还在引用组件作用域里的变量。

## 模式四：全局变量和缓存

全局变量永远不会被 GC 回收，这是它们的本质特性。如果你把大量数据塞进全局变量或模块级变量，它们会一直占用内存。

```tsx
// 模块级缓存——没有过期策略
const cache = new Map<string, any>()

function fetchData(key: string) {
  if (cache.has(key)) return cache.get(key)

  const data = expensiveOperation(key)
  cache.set(key, data) // 只进不出
  return data
}
```

这不是传统意义上的"泄漏"（你确实需要这些数据），但如果没有淘汰策略，缓存会无限增长。

解决方案：用 `WeakMap`（如果 key 是对象）或手动实现 LRU 淘汰。

```tsx
const cache = new WeakMap<object, any>()

function fetchData(key: object) {
  if (cache.has(key)) return cache.get(key)
  const data = expensiveOperation(key)
  cache.set(key, data)
  return data
}
```

`WeakMap` 的 key 是弱引用——如果没有其他地方引用 key 对象，整个 entry 会被 GC 回收。

## 模式五：被遗忘的 Map/Set

`Map` 和 `Set` 持有对 key 和 value 的强引用。如果把 DOM 元素作为 key 放进 Map，即使 DOM 元素从页面移除了，Map 仍然持有引用。

```tsx
const elementData = new Map<HTMLElement, any>()

function trackElement(el: HTMLElement, data: any) {
  elementData.set(el, data)
}

// 后来 el 从 DOM 移除了
// 但 elementData 仍然引用它——泄漏！
```

解决方案：用 `WeakMap` 替代，或在元素移除时主动 `delete`。

## 模式六：React 特有的泄漏

**忘记清理 useEffect 的副作用**：上面的监听器和定时器都属于这类。React 的 useEffect 返回的清理函数是防止泄漏的核心机制。

**setState 在卸载后调用**：

```tsx
function AsyncComponent() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData().then((result) => {
      // 组件可能已经卸载了
      setData(result) // 泄漏：闭包引用了组件的 setState
    })
  }, [])
}
```

虽然 React 18 不再对此发出警告，但闭包本身仍然会保留在内存里直到 Promise resolved。

解决方案：用 AbortController 或一个 `isMounted` 标记。

```tsx
useEffect(() => {
  const controller = new AbortController()

  fetchData({ signal: controller.signal }).then((result) => {
    setData(result)
  }).catch(() => {})

  return () => controller.abort()
}, [])
```

## 在堆快照里识别这些模式

| 快照里的特征 | 可能的原因 |
|-------------|-----------|
| 大量 Detached DOM 元素 | 闭包引用、Map/Set 引用 |
| 闭包 Retained Size 很大 | 闭包捕获了大数组或大对象 |
| `(closure)` 数量持续增长 | 事件监听器或定时器未清理 |
| `(string)` 数量持续增长 | 全局缓存只进不出 |
| 自定义类实例数量持续增长 | 组件反复创建但没有销毁 |

## 练习

### 练习一：识别泄漏模式

以下代码有多个内存泄漏，找出所有泄漏点并说明属于哪种模式：

```tsx
const userDataCache = new Map()

function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null)
  const analyticsBuffer: any[] = []

  useEffect(() => {
    // 1. 获取用户数据
    fetch(`/api/user/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data)
        userDataCache.set(userId, data)
      })

    // 2. 追踪页面浏览
    const handler = () => {
      analyticsBuffer.push({
        page: 'profile',
        userId,
        time: Date.now(),
      })
    }
    window.addEventListener('scroll', handler)

    // 3. 定期刷新
    const timer = setInterval(() => {
      fetch(`/api/user/${userId}`)
        .then((r) => r.json())
        .then(setProfile)
    }, 30000)

    analyticsBuffer.push({ page: 'profile', userId, time: Date.now() })
  }, [userId])

  return <div>{profile?.name}</div>
}
```

### 练习二：修复并验证

修复上面代码中的所有泄漏，用堆快照对比法验证修复效果。

---

## 参考答案

### 练习一

泄漏点：

1. **fetch 回调闭包** — 组件卸载后 Promise 仍然持有 `setProfile` 的引用（闭包引用模式）
2. **userDataCache 全局 Map** — 只进不出，数据不断累积（全局缓存模式）
3. **scroll 监听器** — 没有 `removeEventListener`（事件监听器未清理模式）
4. **setInterval** — 没有 `clearInterval`（定时器未清理模式）
5. **analyticsBuffer** — 每次 effect 执行都创建新数组，且被闭包引用

### 练习二

```tsx
const userDataCache = new Map()

function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null)
  const analyticsBufferRef = useRef<any[]>([])

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/user/${userId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data)
        userDataCache.set(userId, data)
      })
      .catch(() => {})

    const handler = () => {
      analyticsBufferRef.current.push({
        page: 'profile',
        userId,
        time: Date.now(),
      })
    }
    window.addEventListener('scroll', handler)

    const timer = setInterval(() => {
      fetch(`/api/user/${userId}`, { signal: controller.signal })
        .then((r) => r.json())
        .then(setProfile)
        .catch(() => {})
    }, 30000)

    return () => {
      controller.abort()
      window.removeEventListener('scroll', handler)
      clearInterval(timer)
    }
  }, [userId])

  return <div>{profile?.name}</div>
}
```

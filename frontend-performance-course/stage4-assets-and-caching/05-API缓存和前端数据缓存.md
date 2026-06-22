# 第5课：API 缓存和前端数据缓存

> **课程定位**：减少重复的 API 请求，提升数据加载速度
> **前置知识**：了解 HTTP 缓存和 React 状态管理
> **预计时长**：30 分钟

## 场景引入

你的电商网站有个商品列表页，用户每次切换筛选条件都会发一次 `/api/products` 请求。但用户经常"选了 A 筛选 → 看了看 → 又切回 B 筛选 → 再切回 A"——同样的请求重复发了 3 次，每次都等 500ms。更糟的是，用户从商品列表点进详情页再返回列表，整个列表又重新加载了一遍。你需要在前端建立一套缓存机制，让重复请求秒返回，同时在数据变化时及时更新缓存。

---

## 学习目标

1. 理解 API 缓存的不同层级
2. 掌握前端数据缓存的实现方式
3. 学会设计缓存失效策略
4. 了解 React Query / SWR 等缓存库

---

## 一、API 缓存层级

```
┌──────────────────────────────────────────────────────────────┐
│              API 缓存层级                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 浏览器 HTTP 缓存                                          │
│     Cache-Control 控制 → 最快，无需代码                       │
│                                                              │
│  2. Service Worker 缓存                                       │
│     拦截请求 → 灵活控制，支持离线                             │
│                                                              │
│  3. 内存缓存（应用级）                                        │
│     变量/Map 存储 → 最快的代码级缓存                          │
│                                                              │
│  4. 状态管理缓存                                              │
│     React Query / SWR / Zustand → 自动管理                   │
│                                                              │
│  5. 持久化缓存                                                │
│     localStorage / IndexedDB → 跨会话                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、手动实现缓存

### 2.1 简单内存缓存

```javascript
const cache = new Map();

async function fetchWithCache(url, ttl = 60000) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }

  const response = await fetch(url);
  const data = await response.json();

  cache.set(url, { data, time: Date.now() });
  return data;
}
```

### 2.2 带缓存键的请求

```javascript
function createCacheKey(url, params) {
  const sorted = Object.entries(params).sort().map(([k, v]) => `${k}=${v}`);
  return `${url}?${sorted.join('&')}`;
}

async function fetchAPI(url, params = {}) {
  const key = createCacheKey(url, params);
  return fetchWithCache(key);
}

// 同样的参数会命中缓存
await fetchAPI('/api/products', { category: 'electronics', page: 1 });
await fetchAPI('/api/products', { category: 'electronics', page: 1 }); // 缓存命中
```

### 2.3 LRU 缓存

```javascript
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // 移到最新位置
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的（Map 的第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

---

## 三、React Query（TanStack Query）

### 3.1 基本用法

```jsx
import { useQuery } from '@tanstack/react-query';

function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(res => res.json()),
    staleTime: 5 * 60 * 1000,    // 5 分钟内数据是新鲜的
    gcTime: 10 * 60 * 1000,      // 10 分钟后清除缓存
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <List items={data} />;
}
```

### 3.2 带参数的查询

```jsx
function ProductDetail({ id }) {
  const { data } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetch(`/api/products/${id}`).then(res => res.json()),
    enabled: !!id, // 只在 id 存在时请求
  });

  return <ProductCard product={data} />;
}
```

### 3.3 缓存失效

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function AddToCart({ productId }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (productId) =>
      fetch('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      }),
    onSuccess: () => {
      // 使相关缓存失效，触发重新请求
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  return (
    <button onClick={() => mutation.mutate(productId)}>
      Add to Cart
    </button>
  );
}
```

### 3.4 乐观更新

```jsx
function TodoItem({ todo }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (updated) =>
      fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      }),
    onMutate: async (updated) => {
      // 取消正在进行的请求
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // 保存之前的值
      const previous = queryClient.getQueryData(['todos']);

      // 乐观更新
      queryClient.setQueryData(['todos'], (old) =>
        old.map(t => t.id === todo.id ? { ...t, ...updated } : t)
      );

      return { previous };
    },
    onError: (err, updated, context) => {
      // 回滚
      queryClient.setQueryData(['todos'], context.previous);
    },
    onSettled: () => {
      // 无论成功失败都重新请求
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  return (
    <input
      checked={todo.done}
      onChange={(e) => mutation.mutate({ done: e.target.checked })}
    />
  );
}
```

---

## 四、SWR

```jsx
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(res => res.json());

function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher, {
    revalidateOnFocus: true,    // 窗口聚焦时重新验证
    revalidateOnReconnect: true, // 网络恢复时重新验证
    dedupingInterval: 2000,      // 2 秒内相同请求去重
  });

  if (isLoading) return <Spinner />;
  return <div>{data.name}</div>;
}
```

---

## 五、缓存失效策略

```
┌──────────────────────────────────────────────────────────────┐
│              缓存失效策略                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 时间过期（TTL）                                           │
│     staleTime: 5min → 5 分钟后数据标记为 stale               │
│     gcTime: 10min → 10 分钟后清除缓存                        │
│     适合：变化不频繁的数据                                    │
│                                                              │
│  2. 窗口聚焦重新验证                                          │
│     revalidateOnFocus: true                                  │
│     用户切换回标签页时自动验证                                │
│     适合：需要最新数据的场景                                  │
│                                                              │
│  3. 操作后失效                                                │
│     mutation 后 invalidateQueries                            │
│     适合：用户操作后需要更新的数据                            │
│                                                              │
│  4. 依赖查询                                                  │
│     enabled: !!userId                                        │
│     依赖变化时自动请求                                        │
│                                                              │
│  5. 轮询                                                      │
│     refetchInterval: 30000                                   │
│     每 30 秒自动重新请求                                     │
│     适合：实时数据（聊天、股票）                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、Next.js 数据缓存

```jsx
// Server Component 中的 fetch 自动缓存
async function Products() {
  // 默认缓存：相同 URL 不重复请求
  const res = await fetch('https://api.example.com/products');
  const data = await res.json();

  return <ProductList items={data} />;
}

// 不缓存
const res = await fetch('https://api.example.com/products', {
  cache: 'no-store'
});

// 定时重新验证
const res = await fetch('https://api.example.com/products', {
  next: { revalidate: 3600 } // 1 小时
});

// 按需重新验证
import { revalidateTag } from 'next/cache';

const res = await fetch('https://api.example.com/products', {
  next: { tags: ['products'] }
});

// Server Action 中
async function addProduct() {
  'use server';
  await saveProduct();
  revalidateTag('products');
}
```

---

## 七、检查清单

```
┌──────────────────────────────────────────────────────────────┐
│              API 缓存检查清单                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  缓存策略                                                    │
│  □ 列表数据有合理的 staleTime                                │
│  □ 详情数据按 ID 缓存                                        │
│  □ 用户相关数据用 private 缓存                               │
│  □ 实时数据有轮询或 WebSocket                                │
│                                                              │
│  缓存失效                                                    │
│  □ 数据变更后相关缓存已失效                                  │
│  □ 窗口聚焦时重新验证重要数据                                │
│  □ 有乐观更新提升交互体验                                    │
│                                                              │
│  性能                                                        │
│  □ 相同请求不会重复发送                                      │
│  □ 缓存大小有上限                                            │
│  □ 内存中没有过多过期缓存                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：手动实现缓存

1. 实现一个带 TTL 的内存缓存
2. 添加 LRU 淘汰策略
3. 测试缓存命中率

### 练习二：使用 React Query

1. 用 React Query 替代手动 fetch
2. 配置合理的 staleTime
3. 实现 mutation 后缓存失效

### 练习三：乐观更新

1. 实现一个待办事项列表
2. 勾选时使用乐观更新
3. 处理失败回滚

---

## 常见误区

1. **所有 API 都缓存**：用户相关的数据（如购物车、通知）不应该长时间缓存，否则用户在 A 设备加了商品，B 设备上还显示旧数据。应该用 `private` 策略并设置较短的 staleTime。
2. **缓存不失效**：只设了 TTL 但没有在 mutation 后主动失效。用户修改了数据，页面还显示旧数据，直到 TTL 过期。正确的做法是 mutation 后立即 `invalidateQueries`。
3. **手动实现缓存逻辑过于复杂**：自己写 TTL、LRU、去重、重试等逻辑容易出 bug。React Query / SWR 已经帮你处理了这些，包括请求去重、窗口聚焦重新验证、后台刷新等。
4. **忽略乐观更新的回滚**：做乐观更新时如果只更新了 UI 但没有处理失败回滚，网络出错时用户看到的是错误数据。必须在 `onError` 中恢复之前的值。

## 工程建议

1. **根据数据特性选择缓存策略**：不常变的数据（如商品分类）用长 staleTime（5-10 分钟）；频繁变的数据（如库存）用短 staleTime 或轮询；用户操作后必须最新的数据用 mutation 后 invalidate。
2. **用 React Query DevTools 调试缓存**：开发时打开 DevTools 查看缓存状态、命中率、stale 状态，确认缓存策略是否符合预期。
3. **Next.js Server Component 的 fetch 自动缓存**：Server Component 中的 fetch 默认缓存，相同 URL 不重复请求。需要实时数据时用 `cache: 'no-store'`，需要定时更新时用 `next: { revalidate: 3600 }`。
4. **设置缓存大小上限**：内存缓存没有上限会导致内存泄漏。React Query 默认 gcTime 后清除未使用的缓存，但如果你自己实现 LRU 缓存，记得设置 maxSize。

## 小结

1. **缓存层级**：HTTP 缓存 → Service Worker → 内存 → 持久化
2. **React Query / SWR**：自动管理请求缓存、去重、重新验证
3. **缓存失效**：TTL、聚焦验证、操作后失效、依赖查询
4. **乐观更新**：先更新 UI，再同步服务器
5. **Next.js 缓存**：Server Component 的 fetch 自动缓存

---

## 下一课预告

下一课将学习第三方脚本治理——如何管理广告、分析、聊天等第三方脚本的加载。

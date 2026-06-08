# 第5课：API 缓存和前端数据缓存

> **课程定位**：减少重复的 API 请求，提升数据加载速度
> **前置知识**：了解 HTTP 缓存和 React 状态管理
> **预计时长**：30 分钟

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

## 小结

1. **缓存层级**：HTTP 缓存 → Service Worker → 内存 → 持久化
2. **React Query / SWR**：自动管理请求缓存、去重、重新验证
3. **缓存失效**：TTL、聚焦验证、操作后失效、依赖查询
4. **乐观更新**：先更新 UI，再同步服务器
5. **Next.js 缓存**：Server Component 的 fetch 自动缓存

---

## 下一课预告

下一课将学习第三方脚本治理——如何管理广告、分析、聊天等第三方脚本的加载。

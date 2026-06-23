# 03. 数据获取与缓存策略 —— SWR/React Query 原理、缓存失效、乐观更新

> 前端最复杂的状态不是表单输入，而是来自服务端的数据——它有自己的生命周期

## 本课目标

- 理解为什么手动管理 API 数据是反模式
- 掌握 SWR 和 React Query 的核心原理
- 设计缓存失效策略（staleTime、cacheTime、refetchOnWindowFocus）
- 实现乐观更新，理解回滚机制
- 处理竞态条件、分页、无限滚动等复杂场景

## 手动管理 API 数据的痛点

```typescript
// 典型的手动管理方式
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/users')
      .then(res => {
        if (!res.ok) throw new Error('请求失败');
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <List data={users} />;
}
```

这段代码看起来能工作，但有以下问题：

```
1. 没有缓存
   用户从列表页进入详情页再返回，会重新请求。
   如果数据没变，这次请求是浪费的。

2. 没有自动刷新
   用户一直在页面上，数据可能已经过期了。
   除非手动轮询，否则看不到最新数据。

3. 没有错误重试
   请求失败后，用户只能手动刷新页面。

4. 竞态条件
   如果组件快速 mount/unmount（比如路由切换），
   可能出现后发的请求先返回，导致显示错误数据。

5. 重复请求
   如果两个组件同时请求 /api/users，
   会发出两个相同的请求。

6. 没有焦点刷新
   用户切换到其他 tab 再回来，看到的可能是过期数据。

7. 代码重复
   每个需要请求数据的组件都要写这一套 loading/error 逻辑。
```

## SWR 原理

SWR（Stale-While-Revalidate）的名字来自 HTTP 缓存策略 RFC 5861。核心思想是：

**先返回缓存的数据（stale），同时在后台重新请求（revalidate），请求完成后更新数据**。

```
时间线：

请求发起 → 立即返回缓存数据 → 用户看到数据
                ↓
        后台发起 revalidate 请求
                ↓
        请求完成，数据更新
                ↓
        如果数据有变化，UI 自动更新
                ↓
        如果数据没变化，用户无感知

用户体验：
  - 首次访问：loading → 数据
  - 再次访问：缓存数据（立即） → 最新数据（静默更新）
  - 网络慢时：缓存数据一直显示，不会白屏等待
```

SWR 的基本使用：

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function UserList() {
  const { data: users, error, isLoading, mutate } = useSWR('/api/users', fetcher);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <List data={users} />;
}

// 同一个 URL 在多个组件中使用，只会发一次请求
function UserCount() {
  const { data: users } = useSWR('/api/users', fetcher);
  return <span>共 {users?.length} 个用户</span>;
}
```

### SWR 的缓存模型

```typescript
// SWR 内部维护一个缓存 Map
// key: API URL 或自定义 key
// value: { data, error, timestamp }

const cache = new Map();

// 请求流程：
function swrRequest(key, fetcher) {
  // 1. 检查缓存
  const cached = cache.get(key);

  if (cached && !isStale(cached)) {
    // 缓存有效，直接返回
    return cached.data;
  }

  if (cached) {
    // 缓存过期，先返回旧数据，后台 revalidate
    revalidate(key, fetcher);
    return cached.data;
  }

  // 没有缓存，loading 状态
  return loading(fetcher(key));
}
```

### SWR 的关键配置

```typescript
const { data } = useSWR('/api/users', fetcher, {
  // 数据多久内认为是新鲜的（不会触发 revalidate）
  // 默认：0（每次都 revalidate）
  dedupingInterval: 5000, // 5 秒内相同请求只发一次

  // 窗口获得焦点时是否自动 revalidate
  // 默认：true
  revalidateOnFocus: true,

  // 网络恢复时是否自动 revalidate
  // 默认：true
  revalidateOnReconnect: true,

  // 是否启用轮询
  refreshInterval: 0, // 0 表示不轮询

  // 重新验证时是否使用旧数据
  // true：返回旧数据 + 后台更新
  // false：返回 undefined（显示 loading）
  keepPreviousData: true,

  // 错误重试
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
});
```

## React Query 原理

React Query（TanStack Query）和 SWR 的核心思想类似，但功能更丰富：

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 定义 query
function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <List data={users} />;
}
```

React Query 的缓存模型：

```typescript
// React Query 用 queryKey 作为缓存 key
// queryKey 可以是数组，支持参数化查询

// 不同的 queryKey 是不同的缓存
useQuery({ queryKey: ['users'], queryFn: fetchUsers });
useQuery({ queryKey: ['users', { role: 'admin' }], queryFn: fetchAdmins });
useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });

// 相同的 queryKey 共享缓存
// 组件 A 和组件 B 都用 ['users']，只会请求一次
```

### React Query vs SWR

```
功能对比：

                    SWR              React Query
缓存策略            基础              精细控制
查询 key            字符串/对象       数组（支持嵌套）
分页支持            手动              useInfiniteQuery
乐观更新            mutate + 回滚     useMutation + onMutate
离线支持            基础              持久化 + 水合
DevTools            无官方            有官方 DevTools
Mutation            手动              useMutation
垃圾回收            1 分钟            5 分钟（可配置）
并行查询            自动              自动
依赖查询            refreshInterval   enabled 选项
取消请求            AbortController   自动取消
TypeScript          好                更好

选型建议：
- 简单场景、喜欢极简 → SWR
- 复杂场景、需要 Mutation、分页、离线 → React Query
```

## 缓存失效策略

缓存失效是数据获取中最难的问题。核心问题是：**什么时候数据是"过期"的？**

### staleTime vs cacheTime

```typescript
useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  // staleTime：数据多久内认为是新鲜的
  // 新鲜的数据不会触发后台 revalidate
  // 默认：0（立即过期）
  staleTime: 5 * 60 * 1000, // 5 分钟

  // cacheTime（gcTime）：数据在没有订阅者后多久被垃圾回收
  // 默认：5 分钟
  // 设为 Infinity 可以永久保留缓存（不推荐）
  gcTime: 10 * 60 * 1000, // 10 分钟
});

// 理解 staleTime 和 gcTime 的区别：
//
// 时间线：
// 0s    组件挂载，发起请求，数据进入缓存
// 0-5m  数据是新鲜的，不会 revalidate
// 5-10m 数据过期了，但还在缓存中
//        - 如果组件还在，会在后台 revalidate
//        - 如果组件卸载了，数据保留在缓存中
// 10m+  如果没有组件订阅这个数据，缓存被垃圾回收
```

### 常见的缓存策略

```typescript
// 策略 1：实时数据（聊天消息、股票价格）
useQuery({
  queryKey: ['messages'],
  queryFn: fetchMessages,
  staleTime: 0,              // 立即过期
  refetchInterval: 3000,     // 每 3 秒轮询
  refetchOnWindowFocus: true, // 切换窗口时刷新
});

// 策略 2：准实时数据（通知、订单状态）
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  staleTime: 30 * 1000,      // 30 秒
  refetchOnWindowFocus: true, // 切换窗口时刷新
  refetchOnReconnect: true,   // 网络恢复时刷新
});

// 策略 3：一般数据（用户列表、商品列表）
useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000,  // 5 分钟
  refetchOnWindowFocus: true,
});

// 策略 4：静态数据（配置、字典、国家列表）
useQuery({
  queryKey: ['countries'],
  queryFn: fetchCountries,
  staleTime: Infinity,        // 永不刷新
  gcTime: Infinity,           // 永不回收
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});
```

### 手动失效

```typescript
const queryClient = useQueryClient();

// 删除用户后，使用户列表缓存失效
const deleteUser = useMutation({
  mutationFn: (userId: string) => api.deleteUser(userId),
  onSuccess: () => {
    // 方式 1：使所有 ['users'] 相关的查询失效
    queryClient.invalidateQueries({ queryKey: ['users'] });

    // 方式 2：直接更新缓存（更精确）
    queryClient.setQueryData(['users'], (old) =>
      old.filter(user => user.id !== userId)
    );
  },
});
```

## 乐观更新

乐观更新的核心思想是：**先更新 UI，再发请求。如果请求失败，回滚 UI**。

```typescript
const queryClient = useQueryClient();

const addTodo = useMutation({
  mutationFn: (newTodo: Todo) => api.addTodo(newTodo),

  // onMutate 在请求发送前执行
  onMutate: async (newTodo) => {
    // 取消正在进行的查询，避免覆盖乐观更新
    await queryClient.cancelQueries({ queryKey: ['todos'] });

    // 保存当前数据（用于回滚）
    const previousTodos = queryClient.getQueryData(['todos']);

    // 乐观更新：立即更新 UI
    queryClient.setQueryData(['todos'], (old: Todo[]) => [
      ...old,
      { ...newTodo, id: 'temp-id', status: 'pending' },
    ]);

    // 返回 context，onError 中可以用来回滚
    return { previousTodos };
  },

  // 请求失败时回滚
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos'], context?.previousTodos);
    toast.error('添加失败，请重试');
  },

  // 无论成功失败，都重新获取最新数据
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

乐观更新的注意事项：

```
1. 只在更新操作成功率很高时使用乐观更新
   - 适合：修改名称、切换状态、调整排序
   - 不适合：支付、删除（回滚代价高）

2. 必须处理失败回滚
   - 保存更新前的数据
   - onError 中恢复数据
   - 给用户明确的失败提示

3. 注意临时 ID
   - 乐观更新时还没有真实 ID
   - 可以用 temp-id 或 uuid
   - onSettled 时用服务端数据替换

4. 并发更新的处理
   - 多个乐观更新同时发生时，需要正确合并
   - cancelQueries 避免旧数据覆盖新数据
```

## 竞态条件处理

```typescript
// 问题场景：用户快速输入搜索关键词
// "react" → "react query" → "react query tutorial"
// 三个请求同时发出，但返回顺序不确定

function SearchResults({ query }) {
  const { data } = useQuery({
    queryKey: ['search', query],
    queryFn: () => search(query),
    // React Query 自动处理竞态：
    // 当 queryKey 变化时，取消旧请求，发起新请求
    // 确保返回的数据对应最新的 query
  });

  return <Results data={data} />;
}

// React Query 3.x 自动使用 AbortController 取消请求
// 在 queryFn 中需要处理 abort signal
const search = async (query: string) => {
  const res = await fetch(`/api/search?q=${query}`, {
    // 不需要手动传 signal，React Query 自动处理
  });
  return res.json();
};
```

## 练习

### 练习一：缓存策略设计

为以下场景设计缓存策略（staleTime、refetchOnWindowFocus、refetchInterval）：

1. 用户个人资料（不经常变化）
2. 实时聊天消息
3. 商品库存数量
4. 系统配置（几乎不变）
5. 搜索结果（关键词参数化）

### 练习二：实现乐观更新

实现一个"点赞"功能的乐观更新：

```typescript
// 已知条件：
// - API: POST /api/posts/:id/like 返回 { likes: number }
// - 需要立即显示点赞数 +1
// - 失败时回滚并提示用户
// - 处理用户快速连续点击的情况
```

---

## 参考答案

### 练习一

```
1. 用户个人资料
   staleTime: 5 * 60 * 1000 (5 分钟)
   refetchOnWindowFocus: true
   refetchInterval: 0 (不轮询)
   理由：不经常变化，但切换窗口时应检查更新

2. 实时聊天消息
   staleTime: 0 (立即过期)
   refetchOnWindowFocus: true
   refetchInterval: 3000 (3 秒轮询)
   理由：需要实时性，每次获取最新数据

3. 商品库存数量
   staleTime: 30 * 1000 (30 秒)
   refetchOnWindowFocus: true
   refetchInterval: 0
   理由：库存可能变化，但不需要实时。用户看详情时刷新即可

4. 系统配置
   staleTime: Infinity (永不刷新)
   refetchOnWindowFocus: false
   refetchInterval: 0
   gcTime: Infinity
   理由：配置几乎不变，可以永久缓存

5. 搜索结果
   staleTime: 2 * 60 * 1000 (2 分钟)
   refetchOnWindowFocus: false
   refetchInterval: 0
   理由：相同关键词短时间内结果不变，但不需要窗口聚焦时刷新
```

### 练习二

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function LikeButton({ postId }: { postId: string }) {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${postId}/like`, { method: 'POST' }).then(r => r.json()),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      const previousPost = queryClient.getQueryData(['post', postId]);

      // 乐观更新：likes + 1
      queryClient.setQueryData(['post', postId], (old: any) => ({
        ...old,
        likes: old.likes + 1,
        isLiked: true,
      }));

      return { previousPost };
    },

    onError: (err, variables, context) => {
      // 回滚到之前的数据
      if (context?.previousPost) {
        queryClient.setQueryData(['post', postId], context.previousPost);
      }
      toast.error('点赞失败，请重试');
    },

    onSettled: () => {
      // 无论成功失败，都重新获取最新数据
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  return (
    <button
      onClick={() => likeMutation.mutate()}
      disabled={likeMutation.isPending}
    >
      {likeMutation.isPending ? '...' : '点赞'}
    </button>
  );
}
```

**处理快速连续点击**：React Query 的 `cancelQueries` 会在每次新 mutation 开始时取消之前的乐观更新，确保状态一致性。`onSettled` 中的 `invalidateQueries` 会用服务端真实数据覆盖所有乐观更新。

## 下一步

完成本课后，继续学习 [04. 路由架构设计](./04-routing-architecture.md)。

# 02. 状态管理架构 —— 全局状态、局部状态、服务端状态的边界划分

> 状态管理的核心问题不是"用什么库"，而是"这个状态应该放在哪里"

## 本课目标

- 理解前端状态的三种类型：UI 状态、应用状态、服务端状态
- 掌握 Redux Toolkit、Zustand、Pinia 三种全局状态方案的设计思路和适用场景
- 理解 React Query/SWR 为什么不是"又一个状态管理库"
- 学会判断一个状态应该放在局部还是全局
- 避免"所有状态都放 Redux"和"所有状态都用 useState"两个极端

## 状态管理的核心问题

新手最常问的问题是"用 Redux 还是 Zustand"，但更根本的问题是：

**这个状态应该由谁管理？**

```
状态的管理方式（从近到远）：

1. 组件内部（useState/useReducer）
   → 只有一个组件用，或者只有父子组件用

2. 父组件（props drilling）
   → 2-3 层的父子组件传递，Context 之前的选择

3. Context（React.createContext）
   → 需要跨多层组件传递，但更新不频繁

4. 全局状态库（Zustand/Jotai/Redux）
   → 多个不相关的组件需要共享，更新频繁

5. 服务端状态缓存（React Query/SWR）
   → 数据来自 API，需要缓存、重试、同步

6. URL（search params/hash）
   → 状态需要可分享、可书签、刷新不丢失

7. 浏览器存储（localStorage/sessionStorage）
   → 状态需要持久化，但不需要实时同步
```

选错管理方式的代价：

```
应该用 useState 的状态放到了 Redux：
  → 增加样板代码，每次输入都触发全局更新

应该用 React Query 的数据放到了 useState + useEffect：
  → 手动管理 loading/error，没有缓存，组件 remount 时重复请求

应该放 URL 的状态放到了 useState：
  → 用户刷新页面后筛选条件丢失，无法分享搜索结果
```

## 三种状态类型

### UI 状态（UI State）

UI 状态控制组件的外观和交互行为：

```typescript
// 模态框是否打开
const [isOpen, setIsOpen] = useState(false);

// 当前激活的 Tab
const [activeTab, setActiveTab] = useState('basic');

// 表单输入值
const [inputValue, setInputValue] = useState('');

// 拖拽状态
const [isDragging, setIsDragging] = useState(false);

// 特点：
// - 只在当前组件或父子组件中使用
// - 不需要持久化
// - 不需要跨组件共享
// - 更新频率高（用户每次交互）
```

UI 状态应该用 `useState` 或 `useReducer`，不需要引入任何库。

### 应用状态（Application State）

应用状态是需要在多个不相关组件间共享的业务数据：

```typescript
// 用户信息（导航栏、个人中心、权限判断都需要）
interface UserState {
  user: User | null;
  permissions: string[];
  login: (credentials: LoginParams) => Promise<void>;
  logout: () => void;
}

// 购物车（商品详情页添加、导航栏显示数量、结算页展示）
interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

// 主题设置（全局生效）
interface ThemeState {
  mode: 'light' | 'dark';
  primaryColor: string;
  toggleMode: () => void;
}

// 特点：
// - 多个不相关组件需要读取或修改
// - 可能需要持久化（购物车、主题）
// - 更新频率中等
// - 有明确的业务语义
```

应用状态是状态管理库的主战场。选什么库取决于复杂度。

### 服务端状态（Server State）

服务端状态是来自 API 的数据，前端只是缓存：

```typescript
// 用户列表（从 API 获取，需要缓存）
const { data: users, isLoading, error } = useQuery({
  queryKey: ['users', { role: 'admin' }],
  queryFn: () => fetchUsers({ role: 'admin' }),
});

// 商品详情（从 API 获取，需要缓存和自动刷新）
const { data: product } = useQuery({
  queryKey: ['product', productId],
  queryFn: () => fetchProduct(productId),
  staleTime: 5 * 60 * 1000, // 5 分钟内认为数据是新鲜的
});

// 特点：
// - 数据源在服务端，前端只是缓存副本
// - 需要处理 loading、error、empty 状态
// - 需要缓存失效策略
// - 可能有分页、搜索、过滤等参数
// - 多个组件可能请求同一份数据
```

服务端状态不应该用 `useState` + `useEffect` 手动管理，应该用 React Query 或 SWR。

## 全局状态方案对比

### Redux Toolkit

Redux 的核心思想是单一数据源、纯函数更新、时间旅行调试：

```typescript
import { createSlice, configureStore } from '@reduxjs/toolkit';

// 定义 slice
const userSlice = createSlice({
  name: 'user',
  initialState: {
    info: null as User | null,
    status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
  },
  reducers: {
    setUser(state, action) {
      state.info = action.payload;
      state.status = 'succeeded';
    },
    logout(state) {
      state.info = null;
      state.status = 'idle';
    },
  },
});

// 配置 store
const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
});

// 在组件中使用
function Navbar() {
  const user = useSelector((state) => state.user.info);
  const dispatch = useDispatch();

  return (
    <div>
      {user ? <span>{user.name}</span> : <button onClick={() => dispatch(login())}>登录</button>}
    </div>
  );
}
```

Redux Toolkit 的优势和代价：

```
优势：
- 强大的 DevTools（时间旅行、action 回放）
- 中间件生态（redux-thunk、redux-saga、redux-observable）
- 可预测的状态更新（纯函数 reducer）
- 社区成熟，最佳实践丰富

代价：
- 样板代码多（即使 Toolkit 简化了，还是比 Zustand 多）
- 学习曲线陡（action、reducer、selector、middleware、thunk）
- 对于简单状态过于复杂
- TypeScript 类型定义繁琐

适合：
- 大型应用，状态逻辑非常复杂
- 需要时间旅行调试
- 团队已经有 Redux 经验
- 需要复杂的异步流程管理（saga/observable）
```

### Zustand

Zustand 的核心思想是极简 API、无样板代码、直接的状态更新：

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 定义 store
interface UserStore {
  user: User | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  login: (credentials: LoginParams) => Promise<void>;
  logout: () => void;
}

const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'idle',
      login: async (credentials) => {
        set({ status: 'loading' });
        try {
          const user = await api.login(credentials);
          set({ user, status: 'succeeded' });
        } catch (error) {
          set({ status: 'failed' });
          throw error;
        }
      },
      logout: () => {
        set({ user: null, status: 'idle' });
      },
    }),
    { name: 'user-storage' }
  )
);

// 在组件中使用
function Navbar() {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  return (
    <div>
      {user ? (
        <span>{user.name} <button onClick={logout}>退出</button></span>
      ) : (
        <LoginButton />
      )}
    </div>
  );
}
```

Zustand 的优势和代价：

```
优势：
- API 极简，几乎无样板代码
- 学习成本低，10 分钟上手
- 支持 persist 中间件（持久化）
- 支持 devtools 中间件（Redux DevTools 兼容）
- TypeScript 支持好
- 性能好（自动选择性订阅）

代价：
- 中间件生态不如 Redux 丰富
- 没有内置的异步流程管理（但可以用 async/await）
- 对于大型应用，store 的组织需要团队约定
- 没有官方的 RTK Query 这样的数据获取方案

适合：
- 中小型应用
- 团队对 Redux 不熟悉
- 状态逻辑不是特别复杂
- 追求开发效率
```

### Pinia（Vue 生态）

Pinia 是 Vue 3 的官方状态管理库，替代 Vuex：

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 定义 store（Composition API 风格）
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const status = ref<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');

  const isLoggedIn = computed(() => user.value !== null);

  async function login(credentials: LoginParams) {
    status.value = 'loading';
    try {
      const result = await api.login(credentials);
      user.value = result;
      status.value = 'succeeded';
    } catch (error) {
      status.value = 'failed';
      throw error;
    }
  }

  function logout() {
    user.value = null;
    status.value = 'idle';
  }

  return { user, status, isLoggedIn, login, logout };
});

// 在组件中使用
<script setup>
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
</script>

<template>
  <div v-if="userStore.isLoggedIn">
    {{ userStore.user.name }}
    <button @click="userStore.logout">退出</button>
  </div>
  <LoginForm v-else />
</template>
```

Pinia 的优势：

```
优势：
- Vue 官方推荐，与 Vue 3 深度集成
- 支持 Composition API 和 Options API 两种风格
- TypeScript 支持好
- DevTools 支持完善
- 无需 mutations（直接修改 state）
- 模块化设计，每个 store 独立

代价：
- 仅限 Vue 生态
- 没有 Redux 那样的中间件系统
- 对于大型应用需要约定 store 的组织方式
```

## 如何选择状态管理方案

```
决策树：

这个状态来自 API 吗？
├── 是 → 用 React Query / SWR
│         （不要把 API 数据手动存到 Redux/Zustand）
│
└── 否 → 这个状态需要跨多少组件共享？
          │
          ├── 只在 1-2 个组件中使用 → useState
          │
          ├── 在父子/兄弟组件间传递 → props + useState
          │     （如果超过 3 层，考虑 Context）
          │
          ├── 在多个不相关组件中使用 → Context 或 Zustand
          │     （如果更新频繁，优先 Zustand）
          │
          └── 需要复杂的异步流程 → Redux Toolkit
                （撤销/重做、乐观更新、竞态处理）
```

一个常见的错误是把所有状态都塞进一个全局 store：

```typescript
// ❌ 错误：所有状态都放 Redux
const store = {
  user: { ... },
  theme: { ... },
  modal: { isOpen: false },        // 这个不需要全局
  form: { name: '', email: '' },   // 这个不需要全局
  pagination: { page: 1, size: 10 }, // 这个可能需要放 URL
  productList: { ... },            // 这个应该用 React Query
};

// ✅ 正确：按类型分离
// 全局应用状态：Zustand
const useAppStore = create(() => ({
  user: null,
  theme: 'light',
}));

// 服务端状态：React Query
const { data: products } = useQuery(['products'], fetchProducts);

// UI 状态：useState
const [isModalOpen, setIsModalOpen] = useState(false);

// URL 状态：useSearchParams
const [searchParams, setSearchParams] = useSearchParams();
```

## 练习

### 练习一：状态分类

以下状态分别属于哪种类型（UI 状态、应用状态、服务端状态）？应该用什么方式管理？

1. 当前登录用户的信息
2. 表单中的搜索关键词
3. 用户的通知列表（从 API 获取）
4. 侧边栏是否折叠
5. 当前选中的商品 SKU
6. 系统主题色（深色/浅色）
7. 购物车商品列表
8. 分页的当前页码（需要刷新后保持）
9. 拖拽排序的临时位置
10. 全局错误提示信息

### 练习二：重构状态管理

以下代码有什么问题？请重构。

```typescript
function ProductPage() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSku, setSelectedSku] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setSelectedSku(data.skus[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    setReviewsLoading(true);
    fetch(`/api/products/${id}/reviews`)
      .then(res => res.json())
      .then(data => {
        setReviews(data);
        setReviewsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetch(`/api/products/${id}/recommendations`)
      .then(res => res.json())
      .then(data => setRecommendations(data));
  }, [id]);

  // ... 渲染逻辑
}
```

---

## 参考答案

### 练习一

```
1. 当前登录用户的信息
   类型：应用状态
   方案：Zustand store（全局共享，更新频率低）
   理由：导航栏、个人中心、权限判断都需要

2. 表单中的搜索关键词
   类型：取决于场景
   方案：
   - 如果搜索结果需要可分享 → URL search params
   - 如果只是临时输入 → useState
   - 如果需要防抖和缓存搜索结果 → React Query

3. 用户的通知列表
   类型：服务端状态
   方案：React Query / SWR
   理由：数据来自 API，需要缓存、轮询刷新

4. 侧边栏是否折叠
   类型：UI 状态
   方案：useState 或 Zustand 的 UI slice
   理由：如果只有当前页面用 → useState；如果需要跨页面保持 → Zustand + persist

5. 当前选中的商品 SKU
   类型：UI 状态
   方案：useState
   理由：只在商品详情页使用，不需要全局共享

6. 系统主题色
   类型：应用状态
   方案：Zustand + persist 或 CSS 变量 + localStorage
   理由：全局生效，需要持久化

7. 购物车商品列表
   类型：应用状态（如果购物车数据存在前端）
   方案：Zustand + persist 或 React Query（如果购物车数据存在后端）
   理由：需要跨页面共享，可能需要持久化

8. 分页的当前页码
   类型：URL 状态
   方案：URL search params
   理由：用户刷新后需要保持，可以分享链接

9. 拖拽排序的临时位置
   类型：UI 状态
   方案：useState 或 useReducer
   理由：临时状态，更新频率极高，不需要全局

10. 全局错误提示信息
    类型：UI 状态（但可能需要全局访问）
    方案：Zustand 的 notification slice 或 Context
    理由：多个地方可能触发错误提示，但逻辑简单
```

### 练习二

**问题分析**：

1. 手动管理 6 个 loading/error 状态，代码重复
2. 没有缓存——用户切换 tab 再回来会重复请求
3. 没有错误重试机制
4. 没有数据过期和刷新策略
5. 推荐列表的加载没有做竞态处理

**重构方案**：

```typescript
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

function ProductPage() {
  const [quantity, setQuantity] = useState(1);
  const [selectedSkuId, setSelectedSkuId] = useState(null);

  // 服务端状态用 React Query
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    onSuccess: (data) => {
      if (!selectedSkuId) setSelectedSkuId(data.skus[0].id);
    },
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: () => fetchProductReviews(id),
    enabled: !!id,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['product-recommendations', id],
    queryFn: () => fetchProductRecommendations(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 推荐列表 10 分钟内不重新请求
  });

  // UI 状态保持 useState
  // quantity 和 selectedSkuId 是局部 UI 状态，不需要全局

  if (isLoading) return <ProductSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <ProductInfo product={product} selectedSkuId={selectedSkuId} onSkuChange={setSelectedSkuId} />
      <QuantitySelector value={quantity} onChange={setQuantity} />
      <ReviewList reviews={reviews} loading={reviewsLoading} />
      <RecommendationList products={recommendations} />
    </div>
  );
}
```

## 下一步

完成本课后，继续学习 [03. 数据获取与缓存策略](./03-data-fetching-caching.md)。

# 阶段实战：新闻阅读 App

## 做什么

构建完整新闻阅读 App：列表（FlatList + 下拉刷新 + 上拉加载）、详情（WebView）、收藏（AsyncStorage 持久化）、搜索（防抖 + 取消请求）。

综合运用 Expo + 导航 + 状态管理 + 网络请求。

## 技术栈

- Expo Router v4（导航）
- Zustand（状态管理）
- TanStack React Query（数据获取）
- Axios（HTTP）
- AsyncStorage（持久化）

## 项目结构

```
app/
├── _layout.tsx              # 根布局（QueryClientProvider）
├── (tabs)/
│   ├── _layout.tsx          # Tab 导航
│   ├── index.tsx            # 新闻列表
│   ├── search.tsx           # 搜索
│   └── favorites.tsx        # 收藏
└── article/[id].tsx         # 详情
api/news.ts                  # API
hooks/useNews.ts             # 数据 Hook
stores/favorites.ts          # 收藏 Store
```

## 配置

```bash
npx create-expo-app@latest news-app --template tabs
cd news-app
npm install zustand @tanstack/react-query axios
npm install @react-native-async-storage/async-storage expo-web-view
```

## HTTP 模块

```typescript
// utils/http.ts
import axios from 'axios'

const http = axios.create({ baseURL: 'https://api.example.com', timeout: 15000 })

http.interceptors.response.use(
  (res) => res.data,
  (err) => { throw new Error(err.response?.data?.message || '网络错误') }
)

export default http
```

## 数据 Hook

```typescript
// hooks/useNews.ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { newsApi } from '@/api/news'

export function useNewsList() {
  return useInfiniteQuery({
    queryKey: ['news'],
    queryFn: ({ pageParam = 1 }) => newsApi.getList(pageParam),
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  })
}

export function useNewsSearch(keyword: string) {
  return useQuery({
    queryKey: ['news', 'search', keyword],
    queryFn: () => newsApi.search(keyword),
    enabled: keyword.trim().length >= 2,
  })
}
```

## 收藏 Store（持久化）

```typescript
// stores/favorites.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const useFavoritesStore = create()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (article) => set((s) => ({
        favorites: s.favorites.some(a => a.id === article.id)
          ? s.favorites.filter(a => a.id !== article.id)
          : [article, ...s.favorites],
      })),
      isFavorite: (id) => get().favorites.some(a => a.id === id),
    }),
    { name: 'favorites', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

## 新闻列表

```typescript
// app/(tabs)/index.tsx
import { FlatList, ActivityIndicator, View, Text } from 'react-native'
import { useNewsList } from '@/hooks/useNews'
import NewsCard from '@/components/NewsCard'

export default function NewsFeed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch, isRefetching } = useNewsList()

  if (isLoading) return <ActivityIndicator size="large" style={{ flex: 1 }} />
  if (isError) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ef4444' }}>{error.message}</Text>
      <Text onPress={() => refetch()} style={{ color: '#3b82f6', marginTop: 8 }}>重试</Text>
    </View>
  )

  const articles = data?.pages.flatMap(p => p.articles) ?? []

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <NewsCard article={item} />}
      onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
      onEndReachedThreshold={0.5}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} /> : null}
    />
  )
}
```

## 搜索（防抖）

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react'
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

```typescript
// app/(tabs)/search.tsx
export default function SearchScreen() {
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounce(keyword, 300)
  const { data, isLoading } = useNewsSearch(debounced)

  return (
    <View>
      <TextInput value={keyword} onChangeText={setKeyword} placeholder="搜索..." clearButtonMode="while-editing" />
      {isLoading && <ActivityIndicator />}
      <FlatList data={data} renderItem={({ item }) => <NewsCard article={item} />} />
    </View>
  )
}
```

## 详情页（WebView）

```typescript
// app/article/[id].tsx
export default function ArticleScreen() {
  const { id } = useLocalSearchParams()
  const { data: article, isLoading } = useNewsDetail(id)
  const isFav = useFavoritesStore(s => s.favorites.some(a => a.id === id))
  const toggle = useFavoritesStore(s => s.toggleFavorite)

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{
        headerRight: () => (
          <TouchableOpacity onPress={() => article && toggle(article)}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#ef4444' : '#333'} />
          </TouchableOpacity>
        ),
      }} />
      {isLoading && <ActivityIndicator size="large" />}
      {article && <WebView source={{ uri: article.url }} />}
    </View>
  )
}
```

## 练习

### 练习一：完整 App

实现完整的新闻阅读 App：列表 + 搜索 + 收藏 + 详情。

### 练习二：分类标签

列表顶部添加分类标签（推荐/科技/财经），点击切换，React Query 自动重新请求。

### 练习三：夜间模式

实现主题切换，所有页面跟随，用 Zustand + AsyncStorage 持久化。

---

## 参考答案

### 练习一

按本课代码结构依次实现：HTTP 模块 → API → 数据 Hook → 收藏 Store → 各页面组件。

### 练习二

```typescript
const [category, setCategory] = useState('all')
const { data } = useInfiniteQuery({
  queryKey: ['news', category],
  queryFn: ({ pageParam }) => newsApi.getList(pageParam, category),
  // ...
})

// 顶部标签栏
<ScrollView horizontal>
  {['all', 'tech', 'finance'].map(c => (
    <TouchableOpacity key={c} onPress={() => setCategory(c)}>
      <Text style={category === c ? styles.active : styles.inactive}>{c}</Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

### 练习三

```typescript
const useThemeStore = create()(persist(
  (set, get) => ({
    mode: 'light',
    toggle: () => set({ mode: get().mode === 'light' ? 'dark' : 'light' }),
  }),
  { name: 'theme', storage: createJSONStorage(() => AsyncStorage) }
))
```

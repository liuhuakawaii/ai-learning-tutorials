# 阶段实战：新闻阅读 App

## 场景引入

前五节课学了环境搭建、核心组件、导航、状态管理、网络请求。现在整合知识构建完整新闻阅读 App：列表（FlatList + 下拉刷新 + 上拉加载）、详情（WebView）、收藏（AsyncStorage 持久化）、搜索（防抖 + 取消请求）。

## 学习目标

- 掌握项目架构设计
- 实现 FlatList 下拉刷新和上拉加载
- 使用 WebView 展示富文本
- AsyncStorage 数据持久化
- 综合运用前五节课知识

---

## 一、项目架构

```
news-app/
├── app/
│   ├── _layout.tsx              # 根布局（QueryClientProvider）
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab 导航
│   │   ├── index.tsx            # 新闻列表
│   │   ├── search.tsx           # 搜索
│   │   └── favorites.tsx        # 收藏
│   └── article/[id].tsx         # 详情
├── api/news.ts                  # API
├── components/NewsCard.tsx      # 卡片
├── hooks/useNews.ts             # 数据 Hook
├── stores/favorites.ts          # 收藏 Store
└── constants/theme.ts           # 主题
```

---

## 二、配置

```bash
npx create-expo-app@latest news-app --template tabs
cd news-app
npm install zustand @tanstack/react-query axios
npm install @react-native-async-storage/async-storage expo-web-view @expo/vector-icons
```

### 主题常量

```typescript
// constants/theme.ts
export const lightTheme = {
  background: '#F2F2F7', surface: '#FFFFFF', text: '#1A1A1A',
  textSecondary: '#8E8E93', primary: '#007AFF', destructive: '#FF3B30', separator: '#E5E5EA',
};
export const darkTheme = {
  background: '#000000', surface: '#1C1C1E', text: '#FFFFFF',
  textSecondary: '#8E8E93', primary: '#0A84FF', destructive: '#FF453A', separator: '#38383A',
};
export type Theme = typeof lightTheme;
```

### HTTP 模块

```typescript
// utils/http.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const http = axios.create({ baseURL: 'https://api.example.com', timeout: 15000 });

http.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => { const { code, data, message } = res.data; if (code !== 0) throw new Error(message); return data; },
  (err) => { if (!err.response) throw new Error('网络连接失败'); throw err; }
);

export default http;
```

---

## 三、API 与数据层

```typescript
// api/news.ts
import http from '@/utils/http';

export interface NewsArticle {
  id: string; title: string; summary: string;
  imageUrl: string; source: string; publishedAt: string; url: string;
}

export interface NewsListResponse { articles: NewsArticle[]; page: number; hasMore: boolean; }

export const newsApi = {
  getList: (page: number, limit = 20) => http.get<unknown, NewsListResponse>('/news', { params: { page, limit } }),
  getDetail: (id: string) => http.get<unknown, NewsArticle>(`/news/${id}`),
  search: (kw: string) => http.get<unknown, NewsArticle[]>('/news/search', { params: { q: kw } }),
};
```

```typescript
// hooks/useNews.ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { newsApi } from '@/api/news';

export function useNewsList() {
  return useInfiniteQuery({
    queryKey: ['news'],
    queryFn: ({ pageParam = 1 }) => newsApi.getList(pageParam),
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useNewsDetail(id: string) {
  return useQuery({ queryKey: ['news', id], queryFn: () => newsApi.getDetail(id), enabled: !!id });
}

export function useNewsSearch(kw: string) {
  return useQuery({ queryKey: ['news', 'search', kw], queryFn: () => newsApi.search(kw), enabled: kw.trim().length >= 2, staleTime: 120000 });
}
```

---

## 四、收藏 Store

```typescript
// stores/favorites.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsArticle } from '@/api/news';

interface State {
  favorites: NewsArticle[];
  toggleFavorite: (a: NewsArticle) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<State>()(
  persist(
    (set, get) => ({
      favorites: [],
      isFavorite: (id) => get().favorites.some((a) => a.id === id),
      toggleFavorite: (article) => set((s) => ({
        favorites: s.favorites.some((a) => a.id === article.id)
          ? s.favorites.filter((a) => a.id !== article.id)
          : [article, ...s.favorites],
      })),
    }),
    { name: 'news-favorites', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

---

## 五、核心组件

```typescript
// components/NewsCard.tsx
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NewsArticle } from '@/api/news';
import { useFavoritesStore } from '@/stores/favorites';
import { lightTheme } from '@/constants/theme';

export default function NewsCard({ article }: { article: NewsArticle }) {
  const router = useRouter();
  const isFav = useFavoritesStore((s) => s.favorites.some((a) => a.id === article.id));
  const toggle = useFavoritesStore((s) => s.toggleFavorite);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/article/[id]', params: { id: article.id } })}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>{article.title}</Text>
          <Text style={styles.summary} numberOfLines={2}>{article.summary}</Text>
          <View style={styles.meta}>
            <Text style={styles.source}>{article.source}</Text>
            <Text style={styles.time}>{article.publishedAt}</Text>
          </View>
        </View>
        {article.imageUrl && <Image source={{ uri: article.imageUrl }} style={styles.img} />}
      </View>
      <TouchableOpacity style={styles.favBtn} onPress={() => toggle(article)}>
        <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20}
          color={isFav ? lightTheme.destructive : lightTheme.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 6, borderRadius: 12, padding: 14, elevation: 2 },
  row: { flexDirection: 'row', gap: 12 },
  textCol: { flex: 1, gap: 6 },
  title: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', lineHeight: 22 },
  summary: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
  meta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  source: { fontSize: 12, color: '#007AFF', fontWeight: '500' },
  time: { fontSize: 12, color: '#8E8E93' },
  img: { width: 90, height: 90, borderRadius: 8 },
  favBtn: { position: 'absolute', top: 14, right: 14, padding: 4 },
});
```

```typescript
// components/EmptyState.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyState({ icon, title, sub }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string }) {
  return (
    <View style={styles.c}>
      <Ionicons name={icon} size={48} color="#8E8E93" />
      <Text style={styles.t}>{title}</Text>
      {sub && <Text style={styles.s}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  t: { fontSize: 17, fontWeight: '600' },
  s: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
});
```

---

## 六、页面

### 根布局

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 300000, retry: 2 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="article/[id]" options={{ title: '文章详情', headerBackTitle: '返回' }} />
      </Stack>
    </QueryClientProvider>
  );
}
```

### Tab 布局

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF', tabBarInactiveTintColor: '#8E8E93' }}>
      <Tabs.Screen name="index" options={{
        title: '新闻', tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="search" options={{
        title: '搜索', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="favorites" options={{
        title: '收藏', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
```

### 新闻列表

```typescript
// app/(tabs)/index.tsx
import { Text, FlatList, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useNewsList } from '@/hooks/useNews';
import NewsCard from '@/components/NewsCard';
import EmptyState from '@/components/EmptyState';

export default function NewsFeed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch, isRefetching } = useNewsList();

  if (isLoading) return <ActivityIndicator style={styles.center} size="large" />;
  if (isError) return (
    <View style={styles.center}>
      <Text style={{ color: '#FF3B30' }}>{error.message}</Text>
      <Text style={{ color: '#007AFF', marginTop: 8 }} onPress={() => refetch()}>重试</Text>
    </View>
  );

  const articles = data?.pages.flatMap((p) => p.articles) ?? [];
  if (!articles.length) return <EmptyState icon="newspaper-outline" title="暂无新闻" sub="下拉刷新试试" />;

  return (
    <FlatList data={articles} keyExtractor={(i) => i.id}
      renderItem={({ item }) => <NewsCard article={item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.5} refreshing={isRefetching} onRefresh={refetch}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} /> : null}
    />
  );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
```

### 搜索页面

```typescript
// app/(tabs)/search.tsx
import { useState } from 'react';
import { View, TextInput, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useNewsSearch } from '@/hooks/useNews';
import { useDebounce } from '@/hooks/useDebounce';
import NewsCard from '@/components/NewsCard';
import EmptyState from '@/components/EmptyState';

export default function SearchScreen() {
  const [kw, setKw] = useState('');
  const dk = useDebounce(kw, 300);
  const { data, isLoading, isError, error } = useNewsSearch(dk);

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <TextInput style={styles.input} placeholder="搜索新闻..." value={kw} onChangeText={setKw}
        autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />
      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} size="large" />}
      {isError && <Text style={{ textAlign: 'center', color: '#FF3B30', marginTop: 20 }}>{error.message}</Text>}
      {!isLoading && !isError && data?.length === 0 && dk.length >= 2 && (
        <EmptyState icon="search-outline" title="未找到结果" sub={`没有"${dk}"相关新闻`} />
      )}
      {data && data.length > 0 && (
        <FlatList data={data} keyExtractor={(i) => i.id}
          renderItem={({ item }) => <NewsCard article={item} />} contentContainerStyle={{ paddingVertical: 8 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { margin: 16, padding: 14, backgroundColor: '#fff', borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA' },
});
```

### 收藏页面

```typescript
// app/(tabs)/favorites.tsx
import { FlatList } from 'react-native';
import { useFavoritesStore } from '@/stores/favorites';
import NewsCard from '@/components/NewsCard';
import EmptyState from '@/components/EmptyState';

export default function FavoritesScreen() {
  const favs = useFavoritesStore((s) => s.favorites);
  if (!favs.length) return <EmptyState icon="heart-outline" title="暂无收藏" sub="点击爱心添加收藏" />;
  return (
    <FlatList data={favs} keyExtractor={(i) => i.id}
      renderItem={({ item }) => <NewsCard article={item} />} contentContainerStyle={{ paddingVertical: 8 }} />
  );
}
```

### 新闻详情

```typescript
// app/article/[id].tsx
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { WebView } from 'expo-web-view';
import { useNewsDetail } from '@/hooks/useNews';
import { useFavoritesStore } from '@/stores/favorites';
import { Ionicons } from '@expo/vector-icons';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: article, isLoading, isError, error, refetch } = useNewsDetail(id);
  const isFav = useFavoritesStore((s) => s.favorites.some((a) => a.id === id));
  const toggle = useFavoritesStore((s) => s.toggleFavorite);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{
        title: article?.title ?? '详情',
        headerRight: () => (
          <TouchableOpacity onPress={() => article && toggle(article)} style={{ padding: 8 }}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#FF3B30' : '#1A1A1A'} />
          </TouchableOpacity>
        ),
      }} />
      {isLoading && <ActivityIndicator style={styles.center} size="large" />}
      {isError && (
        <View style={styles.center}>
          <Text style={{ color: '#FF3B30' }}>{error?.message}</Text>
          <Text style={{ color: '#007AFF', marginTop: 8 }} onPress={refetch}>重试</Text>
        </View>
      )}
      {article && (
        <WebView source={{ uri: article.url }} style={{ flex: 1 }} startInLoadingState
          renderLoading={() => <ActivityIndicator style={styles.center} size="large" />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
```

### 防抖 Hook

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';
export function useDebounce<T>(v: T, d: number): T {
  const [dv, setDv] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}
```

---

## 七、测试清单

| 测试项 | 预期 |
|--------|------|
| 首页加载 | 显示列表，下拉刷新 |
| 上拉加载 | 滚动到底自动加载 |
| 点击新闻 | WebView 加载详情 |
| 收藏 | 爱心即时更新，重启不丢失 |
| 搜索 | 300ms 后自动搜索 |
| 错误 | 无网络友好提示 |

---

## 常见误区

1. FlatList 不设 keyExtractor → 渲染问题
2. WebView 不处理加载 → 白屏
3. 收藏只存内存 → 重启丢失
4. 搜索不防抖 → 每次按键都请求
5. 错误信息直接展示 → AxiosError 不友好
6. 忘记处理组件卸载 → 内存泄漏

---

## 工程建议

1. Mock 数据优先开发
2. 类型安全：所有 API 和 Props 定义类型
3. FlatList getItemLayout 优化滚动
4. 交互元素加 accessibilityLabel
5. 加载/错误/空状态抽为通用组件

---

## 小结

综合运用：Expo + TS 初始化、View/Text/FlatList 组件、Tab + Stack 导航、Zustand 收藏 + React Query 数据、Axios 封装与缓存。可扩展：登录、评论、推送通知。

---

## 练习

### 练习一：完善项目

详情页底部相关新闻推荐、收藏页左滑删除、下拉刷新自定义动画。

### 练习二：分类标签

列表顶部分类标签（推荐/科技/财经/体育），点击切换。

### 练习三：夜间模式

主题切换，所有页面跟随，持久化。

---

## 参考答案

### 练习一

相关新闻用 `useQuery(['related', id], () => newsApi.search(title.slice(0,10)))` 查询，FlatList horizontal 展示。左滑删除用 `Swipeable`（react-native-gesture-handler）包裹 renderItem。

### 练习二

顶部 ScrollView horizontal 标签栏，useState 管理当前分类，queryKey 包含 category，切换时 React Query 自动重新请求。

```typescript
const CATEGORIES = [{ key: 'all', label: '推荐' }, { key: 'tech', label: '科技' }, { key: 'finance', label: '财经' }];
const [category, setCategory] = useState('all');
// queryKey: ['news', category]
```

### 练习三

```typescript
// stores/theme.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme } from '@/constants/theme';

type Mode = 'light' | 'dark';
interface Store { mode: Mode; theme: Theme; toggle: () => void; }

export const useThemeStore = create<Store>()(
  persist(
    (set, get) => ({
      mode: 'light', theme: lightTheme,
      toggle: () => {
        const m = get().mode === 'light' ? 'dark' : 'light';
        set({ mode: m, theme: m === 'light' ? lightTheme : darkTheme });
      },
    }),
    { name: 'theme-mode', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ mode: s.mode }) }
  )
);
```

`partialize` 只持久化 mode，rehydrate 后根据 mode 重建 theme。所有组件用 `useThemeStore((s) => s.theme)` 获取颜色。

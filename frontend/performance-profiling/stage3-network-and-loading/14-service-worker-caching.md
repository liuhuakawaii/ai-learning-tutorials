# Service Worker 缓存策略

> Service Worker 可以让页面在弱网甚至离线时仍然可用。但缓存策略选错了，用户看到的可能是几天前的旧数据。

## Service Worker 能做什么

Service Worker 是运行在浏览器后台的 JavaScript 脚本，独立于页面。它能拦截网络请求，决定是从缓存返回还是从网络获取。

核心能力：
- **缓存静态资源**：JS、CSS、图片等不常变化的资源
- **离线可用**：缓存关键资源后，断网也能打开页面
- **后台同步**：在网络恢复时自动发送离线期间积累的数据
- **推送通知**：即使页面关闭也能接收推送

## 两种基本策略

### Cache First（缓存优先）

```
请求 → 缓存里有？ → 有 → 返回缓存
                   → 没有 → 请求网络 → 缓存响应 → 返回
```

适合不常变化的静态资源（字体、图片、打包后的 JS/CSS）。

```tsx
// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).then((response) => {
        const clone = response.clone()
        caches.open('static-v1').then((cache) => {
          cache.put(event.request, clone)
        })
        return response
      })
    })
  )
})
```

风险：资源更新后用户仍然看到旧版本，直到缓存过期或被手动清除。

### Network First（网络优先）

```
请求 → 请求网络 → 成功 → 返回网络响应
                 → 失败 → 返回缓存
```

适合需要最新数据的资源（API 响应、HTML 页面）。

```tsx
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open('dynamic-v1').then((cache) => {
          cache.put(event.request, clone)
        })
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
```

风险：离线时如果没有缓存，请求会失败。

### Stale While Revalidate（后台更新）

```
请求 → 缓存里有？ → 有 → 同时返回缓存 + 后台请求网络更新缓存
                   → 没有 → 请求网络 → 返回
```

适合更新频率中等、可以短暂显示旧数据的资源。

## Workbox

手写 Service Worker 容易出错。Google 的 Workbox 库封装了常见的缓存策略：

```tsx
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// 静态资源：缓存优先
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new CacheFirst({
    cacheName: 'static-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// 图片：缓存优先，带过期
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// API：网络优先
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-v1',
    networkTimeoutSeconds: 3,
  })
)
```

## 在 Network 面板里观察 Service Worker

打开 Network 面板，勾选 "Disable cache" 关闭浏览器缓存，但 Service Worker 缓存不受这个选项影响。

观察 Service Worker 的请求：

1. **首次访问**：Service Worker 安装，所有请求走网络，响应被缓存
2. **第二次访问**：缓存优先的资源直接从 Service Worker 返回（在瀑布图里这些请求会非常快，Size 列显示 "from ServiceWorker"）
3. **弱网/离线**：网络请求失败，Service Worker 从缓存返回

Service Worker 自身的注册和安装也会在 Network 面板里出现。`sw.js` 本身每次页面加载都会检查更新（浏览器行为）。

## 版本更新策略

最大的坑：用户缓存了旧版本的资源，你更新了代码，但用户看到的还是旧版本。

Workbox 的 `ExpirationPlugin` 可以设置缓存过期时间，但这意味着用户在过期前看到的都是旧内容。

更可靠的方式：
1. 静态资源的文件名带 hash（Webpack/Vite 默认行为：`app.3f8a2b.js`）
2. Service Worker 缓存这些带 hash 的文件
3. 部署新版本时，生成新的 `sw.js`，它会缓存新 hash 的文件并清理旧缓存

```tsx
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Webpack/Vite 会自动注入 precache 列表
precacheAndRoute(self.__WB_MANIFEST)

// 自动清理旧版本的缓存
cleanupOutdatedCaches()
```

## 练习

### 练习一：观察 Service Worker 缓存效果

如果你的项目或任何网站启用了 Service Worker：

1. 打开 Network 面板
2. 刷新页面，记录哪些请求来自 ServiceWorker（Size 列显示 "from ServiceWorker"）
3. 勾选 "Offline"（Application 面板 → Service Workers → Offline），再次刷新
4. 观察哪些资源仍然可用，哪些失败了

### 练习二：实现基本的缓存策略

在一个 React 项目里配置 Workbox：

1. 用 `vite-plugin-pwa` 或 `workbox-webpack-plugin` 配置 Service Worker
2. 设置静态资源用 Cache First 策略
3. 设置 API 请求用 Network First 策略
4. 部署后用 Network 面板验证缓存是否生效

---

## 参考答案

### 练习一

典型观察：
- 第二次访问时，JS/CSS/图片等静态资源通常来自 ServiceWorker，加载时间接近 0ms
- 离线后，静态资源仍然可用，但 API 请求会失败（除非也有缓存）
- HTML 页面如果用了 Network First 策略，离线时可能无法加载

### 练习二

配置 `vite-plugin-pwa` 的最小配置：

```tsx
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: /\.(?:js|css|woff2)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'static', expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
  ],
})
```

验证：首次加载后，在 Network 面板里第二次刷新应该看到静态资源来自 ServiceWorker。

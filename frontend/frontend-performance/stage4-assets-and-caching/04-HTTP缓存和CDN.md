# 第4课：HTTP 缓存和 CDN

> **课程定位**：利用 HTTP 缓存和 CDN 减少网络请求，加速资源加载
> **前置知识**：了解 HTTP 协议基础
> **预计时长**：35 分钟

## 场景引入

你的团队部署了一个新版本，修复了一个紧急 bug。但用户反馈"刷新了还是旧版"——原来静态资源被浏览器强缓存了 1 年，文件名又没带 hash，用户只能手动清缓存才能看到更新。反过来，另一个项目把 HTML 也设了强缓存，结果每次发布后用户看到的都是过期的页面。你需要理解强缓存和协商缓存的区别，为不同类型的资源配置正确的缓存策略。

---

## 学习目标

1. 理解强缓存和协商缓存的机制
2. 掌握 Cache-Control 各指令的含义
3. 了解 CDN 的工作原理和缓存策略
4. 学会为不同类型的资源设置合适的缓存策略

---

## 一、HTTP 缓存概览

```
┌──────────────────────────────────────────────────────────────┐
│              HTTP 缓存流程                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  浏览器请求资源                                               │
│    ↓                                                         │
│  ┌─────────────────────┐                                     │
│  │  有强缓存？          │                                     │
│  │  (Cache-Control/     │                                     │
│  │   Expires)           │                                     │
│  └─────────┬───────────┘                                     │
│       是 ↓         ↓ 否                                      │
│  ┌──────────────┐  ┌─────────────────────┐                   │
│  │ 直接使用缓存  │  │  发送条件请求        │                   │
│  │ 不发请求      │  │  (ETag/Last-Modified)│                   │
│  │ 状态码 200    │  └─────────┬───────────┘                   │
│  └──────────────┘       是 ↓         ↓ 否                    │
│                    ┌──────────────┐ ┌──────────────┐          │
│                    │ 资源未变化    │ │ 资源已变化    │          │
│                    │ 304          │ │ 200 新资源    │          │
│                    │ 使用缓存      │ │ 更新缓存      │          │
│                    └──────────────┘ └──────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、强缓存

### 2.1 Cache-Control

```
┌────────────────────┬─────────────────────────────────────────┐
│ 指令                │ 含义                                    │
├────────────────────┼─────────────────────────────────────────┤
│ max-age=31536000   │ 缓存有效期（秒）：1 年                  │
│ no-cache           │ 不直接使用缓存，每次发条件请求验证       │
│ no-store           │ 完全不缓存                               │
│ public             │ 可被任何缓存存储（CDN、代理）            │
│ private            │ 只能被浏览器缓存（不能 CDN 缓存）        │
│ immutable          │ 资源永远不变，不需要验证                 │
│ must-revalidate    │ 过期后必须验证才能使用                   │
└────────────────────┴─────────────────────────────────────────┘
```

### 2.2 常见配置

```
┌──────────────────────────────────────────────────────────────┐
│              不同资源的缓存策略                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  带 hash 的静态资源（JS/CSS/图片）：                          │
│  Cache-Control: public, max-age=31536000, immutable          │
│  → 缓存 1 年，文件名变了就是新资源                            │
│                                                              │
│  HTML 文件：                                                  │
│  Cache-Control: no-cache                                     │
│  → 每次验证，确保拿到最新的资源引用                           │
│                                                              │
│  API 响应：                                                   │
│  Cache-Control: private, no-store                            │
│  → 不缓存，每次请求最新数据                                   │
│                                                              │
│  用户头像等可变资源：                                         │
│  Cache-Control: private, max-age=3600                        │
│  → 缓存 1 小时，之后验证                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Expires（旧方案）

```
Expires: Thu, 01 Jan 2025 00:00:00 GMT

问题：
- 使用绝对时间，依赖客户端时钟准确
- Cache-Control: max-age 优先级更高

建议：只用 Cache-Control，不依赖 Expires
```

---

## 三、协商缓存

### 3.1 ETag

```
┌──────────────────────────────────────────────────────────────┐
│              ETag 工作流程                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  首次请求：                                                   │
│  → 服务器返回 ETag: "abc123"                                 │
│                                                              │
│  后续请求：                                                   │
│  → 浏览器发送 If-None-Match: "abc123"                        │
│  → 服务器比较 ETag                                           │
│     ├─ 相同 → 304 Not Modified（使用缓存）                   │
│     └─ 不同 → 200 OK（返回新资源和新 ETag）                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Last-Modified

```
┌──────────────────────────────────────────────────────────────┐
│              Last-Modified 工作流程                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  首次请求：                                                   │
│  → 服务器返回 Last-Modified: Wed, 01 Jan 2025 00:00:00 GMT   │
│                                                              │
│  后续请求：                                                   │
│  → 浏览器发送 If-Modified-Since: Wed, 01 Jan 2025 00:00:00  │
│  → 服务器比较修改时间                                         │
│     ├─ 未修改 → 304 Not Modified                             │
│     └─ 已修改 → 200 OK                                       │
│                                                              │
│  缺点：精度只到秒，1 秒内多次修改无法检测                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 对比

```
┌───────────────────┬────────────────┬────────────────────────┐
│                   │ ETag           │ Last-Modified          │
├───────────────────┼────────────────┼────────────────────────┤
│ 精度              │ 内容 hash      │ 秒级                   │
│ 性能              │ 需要计算 hash  │ 只比较时间             │
│ 推荐              │ ✅ 优先使用    │ 作为 ETag 的降级方案   │
└───────────────────┴────────────────┴────────────────────────┘
```

---

## 四、CDN

### 4.1 CDN 工作原理

```
┌──────────────────────────────────────────────────────────────┐
│              CDN 工作原理                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  没有 CDN：                                                   │
│  用户（上海）→ 源站（北京）→ 延迟 50ms                        │
│  用户（纽约）→ 源站（北京）→ 延迟 200ms                       │
│                                                              │
│  有 CDN：                                                     │
│  用户（上海）→ 上海节点 → 命中缓存 → 延迟 5ms                 │
│  用户（纽约）→ 纽约节点 → 命中缓存 → 延迟 5ms                 │
│                                                              │
│  CDN 节点缓存了资源，用户从最近的节点获取                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 CDN 缓存策略

```
┌──────────────────────────────────────────────────────────────┐
│              CDN 缓存配置                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  静态资源（JS/CSS/图片）：                                    │
│  Cache-Control: public, max-age=31536000, immutable          │
│  → CDN 和浏览器都缓存 1 年                                   │
│                                                              │
│  HTML：                                                       │
│  Cache-Control: no-cache                                     │
│  → CDN 不缓存（或缓存但每次验证）                             │
│  s-maxage=60 可以让 CDN 缓存 60 秒                           │
│                                                              │
│  API：                                                        │
│  Cache-Control: private, no-store                            │
│  → CDN 不缓存                                                │
│                                                              │
│  s-maxage：覆盖 CDN 的 max-age                               │
│  CDN-Stale-While-Revalidate：过期后异步验证                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 缓存失效

```
┌──────────────────────────────────────────────────────────────┐
│              缓存失效策略                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 文件名带 hash（推荐）                                     │
│     main.abc123.js → main.def456.js                          │
│     新文件名 = 新缓存，旧文件自然过期                         │
│                                                              │
│  2. 版本号路径                                                │
│     /v1/app.js → /v2/app.js                                  │
│                                                              │
│  3. CDN API 手动清除                                          │
│     调用 CDN 提供商的 Purge API                               │
│     适合 HTML 等不能带 hash 的资源                            │
│                                                              │
│  4. Cache-Control: no-cache                                  │
│     每次验证，适合需要及时更新的资源                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 五、构建工具配置

### 5.1 Vite

```javascript
// vite.config.js
export default {
  build: {
    // 文件名带 hash
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
};

// 服务器配置（如 Nginx）
// location /assets/ {
//   add_header Cache-Control "public, max-age=31536000, immutable";
// }
```

### 5.2 Next.js

```javascript
// next.config.js
module.exports = {
  // 静态资源自动带 hash
  // 无需额外配置

  // 自定义 HTTP 头
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

---

## 六、检查清单

```
┌──────────────────────────────────────────────────────────────┐
│              缓存策略检查清单                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  强缓存                                                      │
│  □ JS/CSS 文件名带 hash → 可缓存 1 年                        │
│  □ 图片文件名带 hash → 可缓存 1 年                            │
│  □ HTML → no-cache（每次验证）                               │
│  □ API → no-store（不缓存）                                  │
│                                                              │
│  协商缓存                                                    │
│  □ 服务器返回 ETag                                           │
│  □ 304 响应正常工作                                          │
│                                                              │
│  CDN                                                        │
│  □ 静态资源通过 CDN 分发                                     │
│  □ CDN 缓存策略与浏览器一致                                  │
│  □ 有缓存失效机制                                            │
│                                                              │
│  构建                                                        │
│  □ 构建输出文件名带 hash                                     │
│  □ 服务器配置了正确的 Cache-Control 头                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：检查缓存头

1. 打开一个网站的 Network 面板
2. 查看不同资源的 Cache-Control 头
3. 判断缓存策略是否合理

### 练习二：配置缓存策略

1. 为项目配置合理的缓存策略
2. 静态资源带 hash + 长缓存
3. HTML 用 no-cache

### 练习三：CDN 缓存验证

1. 部署到 CDN
2. 验证资源从 CDN 节点加载
3. 更新资源后验证缓存失效

---

## 参考答案

### 练习一：检查缓存头

**思路**：打开一个网站的 Network 面板，查看不同资源的 Cache-Control 头，判断缓存策略是否合理。

**答案**：

```markdown
以一个电商网站为例：

资源类型              Cache-Control                           评估
index.html           no-cache                                ✅ 正确（每次验证）
main.js              public, max-age=31536000, immutable      ✅ 正确（文件名带 hash）
style.css            public, max-age=31536000, immutable      ✅ 正确
hero.jpg             public, max-age=86400                    ⚠️ 可优化（应该带 hash + 长缓存）
api/products         no-store                                ✅ 正确（不缓存）
font.woff2           public, max-age=31536000, immutable      ✅ 正确

问题发现：
- hero.jpg 没有文件名 hash，max-age 只有 1 天
  → 应该用 contenthash 命名，max-age 设为 1 年
  → 或者用 CDN 的 s-maxage 单独控制 CDN 缓存

判断标准：
- 文件名带 hash → 可以缓存 1 年（immutable）
- 文件名不带 hash → 应该用 no-cache 或短 max-age
- HTML → 必须 no-cache（确保拿到最新的资源引用）
- API → no-store（不缓存）
```

**要点**：
- no-cache 不是"不缓存"，而是"每次验证"
- 文件名带 hash 的资源可以安全地缓存 1 年
- HTML 是入口文件，必须每次验证

### 练习二：配置缓存策略

**思路**：为项目配置合理的缓存策略，静态资源带 hash + 长缓存，HTML 用 no-cache。

**答案**：

```javascript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        // 文件名带 contenthash
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
};
```

```nginx
# Nginx 配置
server {
  # HTML 文件：no-cache（每次验证）
  location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # 静态资源：缓存 1 年（文件名带 hash）
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # API：不缓存
  location /api/ {
    add_header Cache-Control "no-store";
  }

  # 图片：缓存 1 年
  location /images/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

```markdown
验证方法：

1. 第一次访问：
   - HTML: 200（从服务器获取）
   - main.js: 200（从服务器获取）

2. 刷新页面：
   - HTML: 304（协商缓存，服务器验证未变化）
   - main.js: 200 from disk cache（强缓存，直接用缓存）

3. 更新代码后部署：
   - HTML: 200（no-cache，获取新版本）
   - main.js: 200（文件名 hash 变了，是新文件）
   - 旧的 main.js 缓存自动失效（文件名不同）
```

**要点**：
- 文件名 hash 是最可靠的缓存失效方案
- HTML 必须 no-cache，否则用户永远拿到旧版本
- API 用 no-store，不缓存敏感数据

### 练习三：CDN 缓存验证

**思路**：部署到 CDN，验证资源从 CDN 节点加载，更新资源后验证缓存失效。

**答案**：

```markdown
验证步骤：

1. 部署到 CDN（如 Cloudflare、AWS CloudFront）

2. 检查资源是否从 CDN 加载：
   - Network 面板 → 查看响应头
   - cf-cache-status: HIT → CDN 缓存命中
   - cf-cache-status: MISS → CDN 缓存未命中（回源）
   - x-cache: HIT from cloudfront → CloudFront 缓存命中

3. 更新资源后验证缓存失效：
   - 修改代码，重新构建部署
   - 刷新页面
   - 新的 main.[newhash].js: 200（新文件，CDN 缓存未命中）
   - 旧的 main.[oldhash].js: 200 from disk cache（浏览器缓存）

4. CDN 缓存失效机制：
   - 文件名 hash 变了 → 新 URL → CDN 自动回源
   - HTML 文件 → CDN 配置短 max-age 或 no-cache
   - 紧急更新 → 调用 CDN 的 Purge API 清除缓存

CDN 配置示例（Cloudflare）：
- Browser Cache TTL: 1 年（静态资源）
- Edge Cache TTL: 1 天（HTML）
- Cache Level: Standard
```

**要点**：
- CDN 让全球用户就近获取资源，减少网络延迟
- 文件名 hash 是 CDN 缓存失效的最可靠方案
- s-maxage 可以单独控制 CDN 缓存时间，与浏览器缓存分开

---

## 常见误区

1. **no-cache 就是不缓存**：`no-cache` 的真实含义是"不直接使用缓存，每次发条件请求验证"——如果资源没变，服务器返回 304，浏览器仍然用缓存。真正不缓存的是 `no-store`。
2. **HTML 和静态资源用同样的缓存策略**：HTML 文件是"入口"，必须每次验证（`no-cache`），否则用户永远拿到旧版引用。静态资源（JS/CSS/图片）文件名带 hash 后可以缓存 1 年（`immutable`），因为 hash 变了就是新文件。
3. **只配了浏览器缓存，没配 CDN 缓存**：浏览器缓存只对单个用户有效。CDN 缓存能让全球用户就近获取资源。静态资源应该同时配置浏览器和 CDN 的 `Cache-Control`，用 `s-maxage` 控制 CDN 缓存时间。
4. **用 Expires 代替 Cache-Control**：Expires 用绝对时间，依赖客户端时钟准确。Cache-Control 用相对时间（`max-age`），优先级更高且更可靠。

## 工程建议

1. **构建输出文件名带 contenthash**：Webpack/Vite 配置 `entryFileNames: 'assets/[name].[hash].js'`，确保文件内容变化时文件名也变，配合 `max-age=31536000 immutable` 实现"永久缓存+即时更新"。
2. **用 Nginx/CDN 配置分级缓存**：`/_next/static/` 资源缓存 1 年，HTML 文件 `no-cache`，API 响应 `no-store`。用 `s-maxage` 单独控制 CDN 缓存时间。
3. **用 CDN Purge API 处理紧急更新**：对于 HTML 等不能带 hash 的资源，发布后调用 CDN 的 Purge API 清除缓存，而不是依赖用户清缓存。
4. **监控缓存命中率**：在 CDN 控制台查看缓存命中率，如果命中率低于 80%，说明缓存策略可能配置有误或资源更新太频繁。

## 小结

1. **强缓存**：Cache-Control: max-age → 不发请求
2. **协商缓存**：ETag / Last-Modified → 304 验证
3. **HTML 用 no-cache**：确保拿到最新的资源引用
4. **静态资源用 immutable**：文件名带 hash，缓存 1 年
5. **CDN**：就近访问，减少网络延迟
6. **缓存失效**：文件名 hash 是最可靠的方案

---

## 下一课预告

下一课将学习 API 缓存和前端数据缓存——减少重复的网络请求。

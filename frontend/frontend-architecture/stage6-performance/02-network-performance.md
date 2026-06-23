# 02. 网络性能 —— HTTP 缓存、预加载、预连接

> 网络请求是性能优化的第一道关卡——减少请求、加速请求、提前请求

## 本课目标

- 精通 HTTP 缓存机制（强缓存与协商缓存），能为不同资源设计合理的缓存策略
- 掌握 preload、prefetch、preconnect 的使用时机和差异
- 理解 DNS 解析、TCP 连接、TLS 握手的性能影响
- 能分析网络瀑布图并识别优化机会

## 网络请求的生命周期

一个 HTTP 请求从发起到响应完成，经历多个阶段。每个阶段都有优化空间。

```
用户输入 URL
  │
  ├─ DNS 解析（域名 → IP）     ← preconnect / dns-prefetch
  ├─ TCP 连接（三次握手）       ← preconnect / keep-alive
  ├─ TLS 握手（HTTPS）         ← preconnect / TLS 1.3
  ├─ 发送请求
  ├─ 服务器处理（TTFB）         ← 后端优化、CDN
  ├─ 接收响应
  ├─ 浏览器解析                ← 资源优先级、preload
  └─ 渲染                     ← 关键渲染路径优化
```

对于一个首次访问的页面，DNS + TCP + TLS 可能就要 200-500ms。如果服务器在另一个大洲，这个数字可能翻倍。

## HTTP 缓存

HTTP 缓存是最"便宜"的性能优化——不需要改代码，只需要配置响应头。

### 强缓存（Strong Caching）

强缓存命中时，浏览器直接使用本地缓存，不发请求到服务器。

```
Cache-Control: max-age=31536000
│                │
│                └── 缓存有效期：31536000 秒（1 年）
└── 响应头指令

浏览器行为：
1. 在 max-age 期间内，直接使用缓存（状态码 200 from disk cache）
2. 不发送任何请求到服务器
3. 用户看到的是"瞬间加载"
```

**Cache-Control 常用指令**：

```
Cache-Control: max-age=31536000    # 缓存 1 年
Cache-Control: no-cache            # 每次都协商验证（不是不缓存！）
Cache-Control: no-store            # 真正的不缓存
Cache-Control: public              # CDN 可以缓存
Cache-Control: private             # 只有浏览器可以缓存
Cache-Control: immutable           # 资源永远不会变（配合哈希文件名）
```

**no-cache 的误解**：

```
no-cache ≠ 不缓存

no-cache 的真实含义：
- 浏览器可以缓存这个资源
- 但每次使用前必须向服务器验证（发请求确认资源有没有变）
- 如果服务器说"没变"，使用缓存（304）
- 如果服务器说"变了"，使用新资源（200）

真正不缓存的是 no-store
```

### 协商缓存（Conditional Caching）

协商缓存需要浏览器和服务器"对话"一次。

```
第一次请求：
  服务器返回资源，附带验证信息：
  ETag: "abc123"                    ← 资源的唯一标识（通常是内容哈希）
  Last-Modified: Wed, 15 Jan 2024   ← 资源最后修改时间
  Cache-Control: max-age=0          ← 强缓存已过期

第二次请求（强缓存过期后）：
  浏览器带上验证信息：
  If-None-Match: "abc123"           ← 对应 ETag
  If-Modified-Since: Wed, 15 Jan    ← 对应 Last-Modified

  服务器对比：
  - 资源没变 → 返回 304 Not Modified（只有 header，没有 body）
  - 资源变了 → 返回 200 + 新资源
```

**ETag vs Last-Modified**：

```
ETag：
  - 基于内容生成的哈希值
  - 精确到字节级别
  - 优先级高于 Last-Modified
  - 缺点：服务器需要计算哈希（有性能开销）

Last-Modified：
  - 基于文件修改时间
  - 精确到秒
  - 有些操作（如文件 touch）会改变时间但不改变内容
  - 优点：几乎零开销

实际使用：两者通常同时提供，浏览器优先使用 ETag
```

### 缓存策略设计

不同类型的资源需要不同的缓存策略。

```
策略一：长期缓存 + 文件名哈希
  适用：构建产物（JS、CSS、图片）
  原理：每次构建生成不同的文件名（app.a1b2c3.js），
        内容变了文件名就变了，可以放心缓存很久
  配置：Cache-Control: max-age=31536000, immutable
  
  Webpack/Vite 配置：
  output: {
    filename: '[name].[contenthash:8].js',  // 内容哈希
  }

策略二：协商缓存
  适用：HTML 入口文件、API 响应
  原因：HTML 不能用强缓存，否则用户永远看不到更新
  配置：Cache-Control: no-cache
        ETag: 基于内容哈希

策略三：短期缓存
  适用：频繁变化但不需要实时最新的资源
  例如：用户头像、商品缩略图
  配置：Cache-Control: max-age=3600（1 小时）

策略四：不缓存
  适用：敏感数据、一次性 token
  配置：Cache-Control: no-store
```

```javascript
// Nginx 缓存配置示例
// 静态资源（JS/CSS/图片）—— 长期缓存
location ~* \.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

// HTML 文件 —— 协商缓存
location ~* \.html$ {
  add_header Cache-Control "no-cache";
  etag on;
}

// API 响应 —— 不缓存
location /api/ {
  add_header Cache-Control "no-store";
}
```

## 资源预加载

### preload

`<link rel="preload">` 告诉浏览器"这个资源马上要用，立即开始下载"。

```html
<!-- 预加载关键资源 -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/images/hero.webp" as="image" type="image/webp">
<link rel="preload" href="/js/critical.js" as="script">
<link rel="preload" href="/css/critical.css" as="style">

<!-- 使用 preload 的典型场景 -->
<!-- 1. LCP 图片 -->
<link rel="preload" as="image" href="/images/hero.webp" type="image/webp">

<!-- 2. 关键字体（避免 FOIT） -->
<link rel="preload" as="font" href="/fonts/inter-latin.woff2" 
      type="font/woff2" crossorigin>

<!-- 3. CSS 中引用的关键背景图 -->
<link rel="preload" as="image" href="/images/bg-pattern.svg">
```

**preload 的注意事项**：

```
必须指定 as 属性：
  浏览器需要知道预加载资源的类型，才能正确设置优先级和应用 CSP 策略。
  没有 as 属性的 preload 会被浏览器忽略。

crossorigin 属性：
  字体和 fetch 请求必须加 crossorigin，否则浏览器会请求两次。
  原因：字体文件需要 CORS 头，浏览器默认用 no-cors 模式请求。

不要过度预加载：
  preload 会和其他请求竞争带宽。
  预加载太多资源反而会拖慢关键资源的加载。
  只预加载真正关键的 2-3 个资源。
```

### prefetch

`<link rel="prefetch">` 告诉浏览器"用户可能很快需要这个资源，空闲时下载"。

```html
<!-- 预取下一页可能需要的资源 -->
<link rel="prefetch" href="/js/about-page.js">
<link rel="prefetch" href="/api/products">

<!-- 典型场景：用户在首页，预取商品详情页的资源 -->
```

**preload vs prefetch 的关键区别**：

```
┌─────────────┬──────────────────┬──────────────────┐
│             │     preload      │    prefetch       │
├─────────────┼──────────────────┼──────────────────┤
│  优先级      │  高（与当前页面相关）│  最低（空闲时下载） │
│  时机        │  立即            │  浏览器空闲时      │
│  用途        │  当前页面关键资源  │  下一页可能需要的资源│
│  缓存        │  正常缓存         │  跨页面共享缓存    │
└─────────────┴──────────────────┴──────────────────┘

错误用法：
<link rel="preload" href="/js/next-page.js">  ← 当前页面用不到，浪费带宽

正确用法：
<link rel="prefetch" href="/js/next-page.js"> ← 下一页用，空闲时下载
```

### modulepreload

```html
<!-- ES Module 预加载 -->
<link rel="modulepreload" href="/js/utils.js">

<!-- 与 preload 的区别 -->
<!-- preload 只下载这个文件 -->
<link rel="preload" href="/js/utils.js" as="script">

<!-- modulepreload 会解析模块依赖图，预加载所有依赖 -->
<link rel="modulepreload" href="/js/utils.js">
<!-- 如果 utils.js import 了 helper.js，helper.js 也会被预加载 -->
```

## 预连接

### preconnect

`<link rel="preconnect">` 提前完成 DNS + TCP + TLS 握手。

```html
<!-- 提前连接到第三方源 -->
<link rel="preconnect" href="https://cdn.example.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://api.example.com">

<!-- 典型场景 -->
<!-- 1. 第三方 CDN 上的资源 -->
<link rel="preconnect" href="https://cdn.myapp.com">
<link rel="preload" as="style" href="https://cdn.myapp.com/critical.css">

<!-- 2. 第三方 API -->
<link rel="preconnect" href="https://api.stripe.com">

<!-- 3. Google Fonts（需要连接多个源） -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### dns-prefetch

`<link rel="dns-prefetch">` 只提前完成 DNS 解析。

```html
<!-- DNS 预解析（比 preconnect 开销更小） -->
<link rel="dns-prefetch" href="https://analytics.google.com">
<link rel="dns-prefetch" href="https://connect.facebook.net">

<!-- 适用场景：不确定是否会连接，但想提前准备好 DNS -->
<!-- 比如社交分享按钮、分析脚本 -->
```

**preconnect vs dns-prefetch**：

```
preconnect：DNS + TCP + TLS，开销较大，只用于确定会连接的源
dns-prefetch：只做 DNS，开销很小，用于可能连接的源

建议：
- 每个页面最多 2-3 个 preconnect（过多会浪费资源）
- dns-prefetch 可以多几个（开销极低）
- 优先对 LCP 资源所在源使用 preconnect
```

## 资源优先级

浏览器对不同资源有不同的默认加载优先级。

```
优先级从高到低：
1. HTML 文档        —— 最高
2. preload 的资源    —— 高
3. CSS（在 head 中） —— 高
4. JS（同步，head）  —— 中
5. 字体             —— 中（被 CSS 引用时）
6. 图片             —— 低（首屏图片会提升优先级）
7. prefetch 的资源   —— 最低

可以通过 Chrome DevTools Network 面板的 Priority 列查看每个请求的优先级。
```

```html
<!-- 控制资源优先级的方式 -->
<!-- 1. preload 提升优先级 -->
<link rel="preload" as="image" href="/images/hero.webp">

<!-- 2. fetchpriority 属性（较新 API） -->
<img src="/images/hero.webp" fetchpriority="high" alt="Hero">
<img src="/images/secondary.webp" fetchpriority="low" alt="Secondary">

<!-- 3. async/defer 控制 JS 加载行为 -->
<script src="/js/analytics.js" async></script>  <!-- 加载不阻塞，执行阻塞 -->
<script src="/js/app.js" defer></script>         <!-- 加载不阻塞，解析完再执行 -->
```

## 压缩与传输优化

### Brotli vs Gzip

```
压缩算法对比：
  Gzip：   压缩率中等，兼容性最好，CPU 开销低
  Brotli： 压缩率比 Gzip 高 15-25%，现代浏览器支持，CPU 开销较高

建议：
  - 静态资源构建时用 Brotli 压缩（最高质量 11）
  - 动态内容用 Gzip（兼容性好，压缩速度快）
  - Nginx/CDN 同时支持两种，根据 Accept-Encoding 头选择
```

```nginx
# Nginx 压缩配置
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 256;

# Brotli（需要 ngx_brotli 模块）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript;
```

### HTTP/2 和 HTTP/3

```
HTTP/1.1 的问题：
  - 队头阻塞：同一个连接上的请求必须排队
  - 每个域名 6 个连接的限制
  - 没有头部压缩

HTTP/2 的改进：
  - 多路复用：多个请求共享一个连接
  - 头部压缩（HPACK）
  - 服务器推送（Server Push，但实践中很少用）
  - 二进制协议

HTTP/3 的改进：
  - 基于 QUIC（UDP），避免 TCP 队头阻塞
  - 更快的连接建立（0-RTT）
  - 连接迁移（网络切换不断连）

对前端的影响：
  - HTTP/2 下不需要合并小文件（多路复用解决了队头阻塞）
  - 但合并文件对缓存粒度有影响（合并后一个文件改了整个都要重新下载）
  - 实际建议：适度合并，不要过度
```

### 第三方脚本治理

```
第三方脚本通常是性能的最大敌人：

典型问题：
  1. 加载阻塞（同步 script）
  2. 主线程占用（分析、广告脚本执行时间长）
  3. 请求瀑布（一个脚本触发多个子请求）
  4. 数据收集（持续上报数据占用带宽）

治理策略：
  1. 审计：列出所有第三方脚本，评估必要性
  2. 延迟加载：非关键脚本用 async/defer
  3. Facade 模式：用轻量占位符代替重量级组件
  4. 自托管：将第三方脚本代理到自己的 CDN
  5. 定期清理：移除不再使用的第三方脚本
```

```html
<!-- Facade 模式示例：YouTube 视频 -->
<!-- 不要直接嵌入 YouTube iframe（会加载大量 JS） -->
<!-- 用一个轻量的占位符代替 -->

<!-- 优化前：直接嵌入 -->
<iframe src="https://www.youtube.com/embed/xxx" width="800" height="450"></iframe>
<!-- 页面加载时立即引入 ~1MB 的 YouTube JS -->

<!-- 优化后：Facade 模式 -->
<div class="youtube-facade" data-video-id="xxx" onclick="loadYouTube(this)">
  <img src="https://img.youtube.com/vi/xxx/mqdefault.jpg" alt="Video thumbnail">
  <button class="play-button">▶</button>
</div>
<script>
function loadYouTube(container) {
  const videoId = container.dataset.videoId;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  iframe.width = '800';
  iframe.height = '450';
  iframe.allow = 'autoplay';
  container.replaceWith(iframe);
}
</script>
<!-- 用户点击时才加载 YouTube JS -->
```

## 实战：分析网络瀑布图

```
典型的问题模式：

模式一：串行请求瀑布
  HTML → CSS → 字体 → JS → 图片 → API
  每个资源都要等前一个加载完才开始
  优化：preload 关键资源，让它们并行加载

模式二：阻塞渲染的资源
  <head> 中有大量同步 JS
  HTML → JS(大) → CSS → 渲染
  优化：async/defer 非关键 JS，或移到 </body> 前

模式三：过多的第三方请求
  页面加载了 15 个第三方脚本（分析、广告、客服、A/B 测试）
  优化：延迟加载非关键第三方脚本，使用 facade 模式

模式四：缓存策略不当
  静态资源没有长期缓存，每次访问都重新下载
  优化：配置正确的 Cache-Control

模式五：资源没有压缩
  JS/CSS 文件没有启用 Gzip/Brotli
  体积可能是压缩后的 3-5 倍
  优化：配置服务器压缩
```

## Service Worker 缓存策略

```
Service Worker 可以拦截网络请求，实现更精细的缓存控制。

常见策略：
  Cache First：先查缓存，没有再请求网络
    适用：静态资源（JS、CSS、图片）
  
  Network First：先请求网络，失败再用缓存
    适用：API 请求、需要最新数据的页面
  
  Stale While Revalidate：先返回缓存，同时在后台更新缓存
    适用：不那么实时但需要快速响应的内容
  
  Network Only：只用网络，不缓存
    适用：非 GET 请求、实时性要求极高的数据
  
  Cache Only：只用缓存，不请求网络
    适用：预缓存的离线资源
```

```javascript
// Service Worker 缓存策略示例
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 静态资源：Cache First
  if (url.pathname.match(/\.(js|css|png|jpg|webp|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open('static-v1').then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }
  
  // API 请求：Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }
});
```

## 本课小结

```
网络性能优化的核心策略：

减少请求：
  - HTTP 缓存（避免重复请求）
  - 合并小资源（sprite、字体子集化）

加速请求：
  - CDN（减少网络距离）
  - HTTP/2 多路复用（避免队头阻塞）
  - 压缩（Brotli > Gzip）
  - 预连接（减少握手时间）

提前请求：
  - preload（当前页面关键资源）
  - prefetch（下一页资源）
  - preconnect（第三方源）

控制优先级：
  - fetchpriority（显式指定）
  - async/defer（JS 加载策略）
  - 资源顺序（HTML 中的位置）
```

## 练习

### 练习一：设计缓存策略

为以下资源设计合适的 HTTP 缓存策略，说明理由：

1. `index.html` —— SPA 入口文件
2. `app.a3f2b1c4.js` —— 构建产物，文件名含内容哈希
3. `vendor.d4e5f6a7.css` —— 第三方 CSS 库，含内容哈希
4. `/api/user/profile` —— 用户信息接口
5. `/images/logo.svg` —— 网站 Logo，偶尔更新
6. `/fonts/inter-latin.woff2` —— 网站字体文件

### 练习二：优化网络瀑布图

以下是优化前的页面加载瀑布图（简化）：

```
时间 0ms:    开始加载 HTML
时间 200ms:  HTML 完成，开始解析
时间 200ms:  发现 <link rel="stylesheet" href="app.css">
时间 200ms:  发现 <script src="analytics.js">
时间 200ms:  发现 <script src="app.js">
时间 200ms:  发现 <img src="hero.jpg">
时间 450ms:  CSS 加载完成
时间 450ms:  发现 CSS 中引用的字体 inter.woff2
时间 500ms:  analytics.js 加载完成
时间 500ms:  开始执行 analytics.js（耗时 200ms）
时间 700ms:  app.js 加载完成
时间 700ms:  开始执行 app.js（耗时 300ms）
时间 750ms:  字体加载完成
时间 800ms:  hero.jpg 加载完成
时间 1000ms: 页面可交互
```

请分析这个瀑布图中的问题，并给出优化方案。

---

## 参考答案

### 练习一

```
1. index.html
   策略：Cache-Control: no-cache
   理由：HTML 是入口，必须每次验证以确保用户能看到最新版本。
         no-cache 让浏览器每次都向服务器确认，但如果内容没变返回 304。
         配合 ETag 使用。

2. app.a3f2b1c4.js
   策略：Cache-Control: max-age=31536000, immutable
   理由：文件名含内容哈希，内容变了文件名就变了。
         可以放心缓存 1 年，immutable 告诉浏览器不需要重新验证。
         Webpack/Vite 默认会生成这种文件名。

3. vendor.d4e5f6a7.css
   策略：Cache-Control: max-age=31536000, immutable
   理由：同上，含内容哈希的构建产物可以长期缓存。

4. /api/user/profile
   策略：Cache-Control: no-store 或 Cache-Control: max-age=0
   理由：用户信息是敏感数据，且可能随时更新。
         no-store 确保不缓存，每次都从服务器获取最新数据。
         如果对实时性要求不高，可以用 max-age=0 + ETag 做协商缓存。

5. /images/logo.svg
   策略：Cache-Control: max-age=86400（1 天）+ ETag
   理由：Logo 偶尔更新，不需要每次都验证。
         1 天的缓存可以减少大部分重复请求。
         配合 ETag，缓存过期后可以验证是否真的变了。
         如果能接受更长的更新延迟，可以延长到 1 周。

6. /fonts/inter-latin.woff2
   策略：Cache-Control: max-age=31536000, immutable
   理由：字体文件几乎不会变（换字体通常就是新文件名）。
         长期缓存减少字体加载的延迟。
         注意：需要在 HTML 中用 <link rel="preload"> 预加载，
         否则字体要等 CSS 下载解析后才开始加载。
```

### 练习二

```
问题分析：

问题 1：字体发现太晚（450ms 才开始加载）
  原因：字体在 CSS 中 @font-face 引用，浏览器要等 CSS 下载解析后才知道需要字体
  影响：字体 750ms 才加载完成，可能导致 FOIT/FOUT
  优化：<link rel="preload" as="font" href="inter.woff2" crossorigin>
  效果：字体可以和 CSS 并行加载，提前 ~250ms

问题 2：analytics.js 同步执行阻塞主线程 200ms
  原因：analytics.js 用同步 <script> 加载，加载完立即执行
  影响：阻塞了 app.js 的执行和页面渲染
  优化：<script src="analytics.js" async> 或延迟到页面加载后
  效果：analytics.js 不再阻塞关键渲染

问题 3：hero.jpg 在 HTML 解析时就开始加载，但没有提升优先级
  原因：图片默认是低优先级，可能被 CSS 和 JS 抢占带宽
  影响：LCP 可能受图片加载时间影响
  优化：<link rel="preload" as="image" href="hero.jpg">
  或：<img src="hero.jpg" fetchpriority="high">
  效果：图片加载优先级提升

优化后的瀑布图：
```

```
时间 0ms:    开始加载 HTML
时间 200ms:  HTML 完成，开始解析
时间 200ms:  发现 preload: inter.woff2（立即开始下载）
时间 200ms:  发现 preload: hero.jpg（立即开始下载）
时间 200ms:  发现 <link rel="stylesheet" href="app.css">
时间 200ms:  发现 <script src="analytics.js" async>
时间 200ms:  发现 <script src="app.js" defer>
时间 350ms:  hero.jpg 加载完成（preload 提升了优先级）
时间 400ms:  inter.woff2 加载完成（与 CSS 并行）
时间 450ms:  CSS 加载完成
时间 700ms:  app.js 加载完成（defer 等待 DOM 解析）
时间 700ms:  analytics.js 异步加载完成（不影响主线程）
时间 1000ms: DOM 解析完成，执行 app.js
时间 1100ms: 页面可交互

改善：
- 字体加载提前 350ms
- analytics.js 不再阻塞主线程
- hero.jpg 加载提前 450ms
```

## 下一步

完成本课后，继续学习 [03. 渲染性能](./03-rendering-performance.md)。

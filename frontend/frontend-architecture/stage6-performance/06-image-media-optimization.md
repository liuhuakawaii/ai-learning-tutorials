# 06. 图片与媒体优化策略 —— 响应式图片、WebP/AVIF、懒加载、CDN、视频优化

> 图片通常占页面总资源的 50%-70%——优化图片是最直接的性能收益

## 本课目标

- 掌握响应式图片的实现方式（srcset、sizes、picture）
- 理解 WebP/AVIF 等现代图片格式的优势和兼容性
- 实现图片懒加载（原生和 JS 方案）
- 了解 CDN 图片处理和视频优化策略

## 图片对性能的影响

```
一个典型的电商首页资源分布：
  JS:   350KB (25%)
  CSS:   80KB (6%)
  图片: 900KB (65%)
  字体:  50KB (4%)

图片是最大的资源消耗者。
一张未优化的 1920x1080 JPEG 可能有 2-3MB，
而优化后可能只有 100-200KB，差距 10 倍以上。
```

## 响应式图片

不同设备需要不同大小的图片。在手机上加载桌面尺寸的图片是巨大的浪费。

### srcset 和 sizes

```html
<!-- srcset：提供多个图片候选，浏览器根据条件选择 -->
<img
  srcset="
    /images/hero-400w.webp 400w,
    /images/hero-800w.webp 800w,
    /images/hero-1200w.webp 1200w,
    /images/hero-1600w.webp 1600w
  "
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1200px) 50vw,
    33vw
  "
  src="/images/hero-800w.webp"
  alt="Hero image"
/>
```

```
srcset 中的 w 描述符：
  400w = 图片固有宽度 400px
  800w = 图片固有宽度 800px

sizes 告诉浏览器图片在不同视口宽度下的显示尺寸：
  (max-width: 600px) 100vw  → 视口 ≤ 600px 时，图片占满视口宽度
  (max-width: 1200px) 50vw  → 视口 ≤ 1200px 时，图片占视口一半
  33vw                       → 其他情况，图片占视口三分之一

浏览器根据 sizes 计算出需要的图片尺寸，
再从 srcset 中选择最接近的图片。

例如：iPhone (375px 宽度，2x 屏幕)
  需要的图片宽度 = 375 * 100% * 2 = 750px
  从 srcset 中选择 800w 的图片
```

### picture 元素

```html
<!-- picture：更精细的控制，支持格式选择和艺术指导 -->
<picture>
  <!-- 现代格式优先 -->
  <source srcset="/images/hero.avif" type="image/avif">
  <source srcset="/images/hero.webp" type="image/webp">
  <!-- 兜底 -->
  <img src="/images/hero.jpg" alt="Hero" width="1200" height="600">
</picture>

<!-- 艺术指导：不同视口用不同的裁剪 -->
<picture>
  <source
    media="(max-width: 600px)"
    srcset="/images/hero-mobile.webp"
  >
  <source
    media="(max-width: 1200px)"
    srcset="/images/hero-tablet.webp"
  >
  <img src="/images/hero-desktop.webp" alt="Hero">
</picture>

<!-- 组合使用：格式 + 尺寸 -->
<picture>
  <source
    type="image/avif"
    srcset="
      /images/hero-400.avif 400w,
      /images/hero-800.avif 800w,
      /images/hero-1200.avif 1200w
    "
    sizes="(max-width: 600px) 100vw, 50vw"
  >
  <source
    type="image/webp"
    srcset="
      /images/hero-400.webp 400w,
      /images/hero-800.webp 800w,
      /images/hero-1200.webp 1200w
    "
    sizes="(max-width: 600px) 100vw, 50vw"
  >
  <img
    src="/images/hero-800.jpg"
    alt="Hero"
    width="1200"
    height="600"
  >
</picture>
```

## 现代图片格式

### 格式对比

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  格式     │  压缩率   │  透明    │  动画    │  兼容性   │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│  JPEG    │  基准     │  不支持  │  不支持  │  全部     │
│  PNG     │  较大     │  支持    │  不支持  │  全部     │
│  WebP    │  -25-35% │  支持    │  支持    │  97%+    │
│  AVIF    │  -50%    │  支持    │  支持    │  90%+    │
│  JPEG XL │  -60%    │  支持    │  支持    │  极少     │
└──────────┴──────────┴──────────┴──────────┴──────────┘

WebP：目前兼容性最好的现代格式，几乎所有浏览器都支持
AVIF：压缩率最高，但编码速度较慢，Safari 16.4+ 才支持
JPEG XL：理论上最好，但浏览器支持极差（仅 Safari 部分支持）
```

### 格式选择策略

```html
<!-- 推荐策略：渐进增强 -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="...">
</picture>

<!-- 浏览器选择逻辑：
1. 支持 AVIF → 用 AVIF（最小体积）
2. 支持 WebP → 用 WebP（次小体积）
3. 都不支持 → 用 JPEG（兜底）
-->
```

## 图片懒加载

### 原生懒加载

```html
<!-- loading="lazy" 是最简单的懒加载方案 -->
<img src="/images/product-1.webp" loading="lazy" alt="Product 1" width="400" height="300">
<img src="/images/product-2.webp" loading="lazy" alt="Product 2" width="400" height="300">
<img src="/images/product-3.webp" loading="lazy" alt="Product 3" width="400" height="300">

<!-- 注意事项：
1. 必须指定 width 和 height（避免 CLS）
2. 首屏图片不要用 lazy（影响 LCP）
3. 兼容性：96%+ 浏览器支持
-->
```

### Intersection Observer 懒加载

```javascript
// 自定义懒加载（更灵活的控制）
function createLazyLoader(options = {}) {
  const { rootMargin = '200px', threshold = 0 } = options;
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          const srcset = img.dataset.srcset;
          
          if (src) img.src = src;
          if (srcset) img.srcset = srcset;
          
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    },
    { rootMargin, threshold }
  );
  
  return {
    observe(img) {
      observer.observe(img);
    },
    disconnect() {
      observer.disconnect();
    },
  };
}

// 使用
const lazyLoader = createLazyLoader({ rootMargin: '300px' });

document.querySelectorAll('img[data-src]').forEach(img => {
  lazyLoader.observe(img);
});
```

```html
<!-- HTML 结构 -->
<img
  class="lazy"
  data-src="/images/product-1.webp"
  data-srcset="/images/product-1-400.webp 400w, /images/product-1-800.webp 800w"
  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3C/svg%3E"
  alt="Product 1"
  width="400"
  height="300"
/>

<style>
  img.lazy {
    opacity: 0;
    transition: opacity 0.3s;
  }
  img.loaded {
    opacity: 1;
  }
</style>
```

### React 懒加载图片组件

```jsx
import { useState, useEffect, useRef } from 'react';

function LazyImage({ src, alt, width, height, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div
      ref={imgRef}
      className={className}
      style={{
        width,
        height,
        backgroundColor: '#f0f0f0',
        overflow: 'hidden',
      }}
    >
      {inView && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={() => setLoaded(true)}
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
          {...props}
        />
      )}
    </div>
  );
}
```

## CDN 图片处理

```
现代 CDN 提供实时图片处理能力，不需要在构建时生成多个尺寸。

请求格式：
https://cdn.example.com/images/hero.jpg?w=800&q=80&f=webp

常用参数：
  w=800     → 宽度 800px
  h=600     → 高度 600px
  q=80      → 质量 80%
  f=webp    → 输出 WebP 格式
  fit=cover → 裁剪模式
  blur=10   → 模糊（占位图）

优势：
1. 不需要预先生成所有尺寸和格式
2. 一个原图 URL + 参数 = 所有变体
3. 可以根据设备能力动态返回最优格式
4. 减少构建时间和存储成本
```

```html
<!-- 配合 CDN 的响应式图片 -->
<picture>
  <source
    type="image/avif"
    srcset="
      https://cdn.example.com/hero.jpg?w=400&f=avif 400w,
      https://cdn.example.com/hero.jpg?w=800&f=avif 800w,
      https://cdn.example.com/hero.jpg?w=1200&f=avif 1200w
    "
    sizes="(max-width: 600px) 100vw, 50vw"
  >
  <source
    type="image/webp"
    srcset="
      https://cdn.example.com/hero.jpg?w=400&f=webp 400w,
      https://cdn.example.com/hero.jpg?w=800&f=webp 800w,
      https://cdn.example.com/hero.jpg?w=1200&f=webp 1200w
    "
    sizes="(max-width: 600px) 100vw, 50vw"
  >
  <img
    src="https://cdn.example.com/hero.jpg?w=800"
    alt="Hero"
    width="1200"
    height="600"
  >
</picture>
```

## 视频优化

### 视频格式选择

```
MP4 (H.264)：兼容性最好，所有浏览器支持
WebM (VP9)：压缩率更好，Chrome/Firefox 支持
WebM (AV1)：压缩率最好，支持度逐渐提升

推荐策略：MP4 兜底 + WebM 优先
```

```html
<video controls width="800" poster="/images/video-poster.webp">
  <source src="/videos/intro.webm" type="video/webm">
  <source src="/videos/intro.mp4" type="video/mp4">
  您的浏览器不支持视频播放。
</video>
```

### 视频加载优化

```html
<!-- 1. 使用 poster 避免空白 -->
<video
  poster="/images/video-poster.webp"
  preload="none"
  controls
>
  <source src="/videos/intro.mp4" type="video/mp4">
</video>

<!-- 2. preload 策略 -->
<!-- auto: 浏览器决定（可能加载整个视频） -->
<!-- metadata: 只加载元数据（时长、尺寸） -->
<!-- none: 不预加载（推荐用于非首屏视频） -->

<!-- 3. 首屏视频需要特殊处理 -->
<video
  autoplay
  muted
  loop
  playsinline
  preload="auto"
  poster="/images/video-poster.webp"
>
  <source src="/videos/hero.webm" type="video/webm">
  <source src="/videos/hero.mp4" type="video/mp4">
</video>
<!-- 注意：autoplay 必须配合 muted，否则浏览器会阻止 -->
```

### 视频懒加载

```javascript
// 非首屏视频使用 Intersection Observer 懒加载
function lazyLoadVideo(video) {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        source.src = source.dataset.src;
      });
      video.load();
      observer.disconnect();
    }
  }, { rootMargin: '200px' });
  
  observer.observe(video);
}

document.querySelectorAll('video[data-lazy]').forEach(lazyLoadVideo);
```

```html
<!-- HTML -->
<video data-lazy controls poster="/images/poster.webp">
  <source data-src="/videos/intro.webm" type="video/webm">
  <source data-src="/videos/intro.mp4" type="video/mp4">
</video>
```

## 本课小结

```
图片优化清单：

格式选择：
  照片 → JPEG（兜底）/ WebP / AVIF
  图标 → SVG（矢量）/ WebP
  透明图 → PNG（兜底）/ WebP / AVIF

尺寸优化：
  响应式图片（srcset + sizes）
  不要加载大于显示尺寸的图片
  使用 CDN 实时裁剪

加载策略：
  首屏图片：preload，不要 lazy
  非首屏图片：loading="lazy"
  大量图片：Intersection Observer

必做项：
  <img> 必须有 width/height（避免 CLS）
  <img> 必须有 alt（可访问性）
  首屏 LCP 图片不要用 lazy
```

## 练习

### 练习一：优化图片加载

以下页面有图片性能问题，请优化：

```html
<!DOCTYPE html>
<html>
<head>
  <title>商品列表</title>
</head>
<body>
  <header>
    <img src="banner-1920x600.jpg" alt="Banner">
  </header>
  
  <main>
    <div class="product-grid">
      <div class="product-card">
        <img src="product-1.jpg" alt="Product 1">
        <h3>商品名称</h3>
        <p>价格</p>
      </div>
      <!-- 假设有 50 个商品卡片 -->
    </div>
  </main>
  
  <footer>
    <video src="brand-video.mp4" autoplay controls></video>
  </footer>
</body>
</html>
```

### 练习二：设计图片 CDN 方案

你正在为一个图片密集型网站（摄影社区）设计图片加载方案。需求：

1. 用户上传原图（可能 10MB+）
2. 在不同页面展示不同尺寸（缩略图、详情页、全屏查看）
3. 支持 WebP/AVIF 格式
4. 移动端和桌面端加载不同尺寸

请设计图片上传、存储和展示的完整方案。

---

## 参考答案

### 练习一

```html
<!DOCTYPE html>
<html>
<head>
  <title>商品列表</title>
  <!-- 优化：预加载 LCP 图片（Banner） -->
  <link rel="preload" as="image" href="banner-800.webp"
        type="image/webp" media="(max-width: 600px)">
  <link rel="preload" as="image" href="banner-1200.webp"
        type="image/webp" media="(min-width: 601px)">
</head>
<body>
  <header>
    <!-- 优化：响应式图片 + 现代格式 -->
    <picture>
      <source
        type="image/avif"
        srcset="banner-400.avif 400w, banner-800.avif 800w, banner-1200.avif 1200w"
        sizes="100vw"
      >
      <source
        type="image/webp"
        srcset="banner-400.webp 400w, banner-800.webp 800w, banner-1200.webp 1200w"
        sizes="100vw"
      >
      <!-- 优化：指定宽高避免 CLS -->
      <img src="banner-1200.jpg" alt="Banner" width="1920" height="600">
    </picture>
  </header>
  
  <main>
    <div class="product-grid">
      <div class="product-card">
        <!-- 优化：懒加载 + 响应式 + 现代格式 + 宽高 -->
        <picture>
          <source type="image/avif" srcset="product-1-200.avif 200w, product-1-400.avif 400w" sizes="(max-width: 600px) 50vw, 25vw">
          <source type="image/webp" srcset="product-1-200.webp 200w, product-1-400.webp 400w" sizes="(max-width: 600px) 50vw, 25vw">
          <img src="product-1-400.jpg" loading="lazy" alt="Product 1" width="400" height="400">
        </picture>
        <h3>商品名称</h3>
        <p>价格</p>
      </div>
      <!-- 50 个商品卡片都这样处理 -->
    </div>
  </main>
  
  <footer>
    <!-- 优化：视频懒加载 + poster + 不预加载 -->
    <video
      data-lazy
      controls
      preload="none"
      poster="brand-video-poster.webp"
      width="800"
    >
      <source data-src="brand-video.webm" type="video/webm">
      <source data-src="brand-video.mp4" type="video/mp4">
    </video>
  </footer>
  
  <!-- 视频懒加载脚本 -->
  <script>
    const videoObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const video = entry.target;
        video.querySelectorAll('source').forEach(s => s.src = s.dataset.src);
        video.load();
        videoObserver.unobserve(video);
      }
    }, { rootMargin: '200px' });
    
    document.querySelectorAll('video[data-lazy]').forEach(v => videoObserver.observe(v));
  </script>
</body>
</html>
```

### 练习二

```
图片 CDN 方案设计：

上传流程：
  用户上传原图 → 服务端存储原图（OSS/S3）→ 生成唯一 ID
  不在上传时生成缩略图（节省存储和处理时间）

存储策略：
  原图：冷存储（访问频率低，只在"查看原图"时使用）
  CDN 边缘节点：按需生成和缓存变体

URL 设计：
  https://cdn.example.com/{image_id}/{variant}

  variant 示例：
  thumb-200     → 200px 缩略图
  medium-800    → 800px 中等尺寸
  large-1600    → 1600px 大尺寸
  full          → 原图

CDN 配置：
  边缘函数（Edge Function）根据 URL 参数实时处理：
  1. 检查缓存中是否有该变体
  2. 有 → 直接返回
  3. 没有 → 从源站获取原图，裁剪/压缩，返回并缓存

前端展示：
```html
<!-- 缩略图列表 -->
<img
  srcset="
    https://cdn.example.com/{id}/thumb-200?format=avif 200w,
    https://cdn.example.com/{id}/thumb-400?format=avif 400w
  "
  sizes="(max-width: 600px) 50vw, 25vw"
  loading="lazy"
  alt="Photo"
  width="400" height="400"
>

<!-- 详情页 -->
<picture>
  <source
    type="image/avif"
    srcset="
      https://cdn.example.com/{id}/medium-800?format=avif 800w,
      https://cdn.example.com/{id}/large-1600?format=avif 1600w
    "
    sizes="(max-width: 600px) 100vw, 80vw"
  >
  <source
    type="image/webp"
    srcset="
      https://cdn.example.com/{id}/medium-800?format=webp 800w,
      https://cdn.example.com/{id}/large-1600?format=webp 1600w
    "
    sizes="(max-width: 600px) 100vw, 80vw"
  >
  <img src="https://cdn.example.com/{id}/medium-800" alt="Photo">
</picture>

<!-- 全屏查看（点击后加载原图） -->
<a href="https://cdn.example.com/{id}/full" target="_blank">
  查看原图
</a>
```

优势：
1. 不需要预生成所有尺寸（节省存储）
2. CDN 边缘处理延迟低（< 100ms）
3. 格式自动协商（根据 Accept 头返回最优格式）
4. 原图只存储一次，变体按需生成和缓存
```

## 下一步

完成本课后，继续学习 [07. 字体加载优化](./07-font-optimization.md)。

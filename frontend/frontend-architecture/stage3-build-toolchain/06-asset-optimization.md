# 06. 资源优化

> 图片压缩与格式转换、字体子集化、SVG Sprite——让静态资源更轻

## 本课目标

- 掌握图片压缩和现代格式转换（WebP/AVIF）
- 理解字体子集化的原理和实现
- 学会使用 SVG Sprite 管理图标
- 了解资源优化对性能的实际影响

## 图片优化

图片通常是前端项目中体积最大的静态资源。一个页面的图片总和可能超过 5 MB，而 JavaScript 代码可能只有 500 KB。

### 图片格式选择

| 格式 | 特点 | 适用场景 |
|------|------|----------|
| JPEG | 有损压缩，体积小 | 照片、背景图 |
| PNG | 无损压缩，支持透明 | 需要透明度的图片 |
| SVG | 矢量格式，无限缩放 | 图标、简单图形 |
| WebP | 有损/无损，体积比 JPEG 小 25-35% | 通用（兼容性已很好） |
| AVIF | 有损/无损，体积比 WebP 小 20% | 追求极致压缩 |

**推荐策略**：优先使用 SVG（图标），照片用 WebP/AVIF，PNG 只在需要透明度时使用。

### 图片压缩

**构建时压缩**：

```javascript
// vite.config.ts
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig({
  plugins: [
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: {
        plugins: [
          { name: 'removeViewBox' },
          { name: 'removeEmptyAttrs', active: false },
        ],
      },
    }),
  ],
});
```

**Webpack 中使用 image-minimizer-webpack-plugin**：

```javascript
// webpack.config.js
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new ImageMinimizerPlugin({
        generator: [
          {
            preset: 'webp',
            implementation: ImageMinimizerPlugin.sharpGenerate,
            options: { quality: 80 },
          },
          {
            preset: 'avif',
            implementation: ImageMinimizerPlugin.sharpGenerate,
            options: { quality: 70 },
          },
        ],
      }),
    ],
  },
};
```

### 格式转换：WebP 和 AVIF

现代图片格式的优势明显：

```bash
# 同一张 1920x1080 的照片
photo.jpg     450 KB
photo.webp    280 KB  # 节省 38%
photo.avif    180 KB  # 节省 60%
```

**HTML 中的兼容性写法**：

```html
<picture>
  <source srcset="photo.avif" type="image/avif">
  <source srcset="photo.webp" type="image/webp">
  <img src="photo.jpg" alt="photo" loading="lazy">
</picture>
```

浏览器会按优先级尝试加载：AVIF → WebP → JPEG。

**Vite 中自动生成多格式**：

```typescript
// vite-plugin-webp.ts
import { Plugin } from 'vite';
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';

export default function webpPlugin(): Plugin {
  return {
    name: 'vite-plugin-webp',

    async generateBundle(_, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (!/\.(png|jpe?g)$/.test(fileName)) continue;
        if (asset.type !== 'asset') continue;

        const buffer = asset.source instanceof Buffer
          ? asset.source
          : Buffer.from(asset.source);

        // 生成 WebP
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        const webpName = fileName.replace(/\.(png|jpe?g)$/, '.webp');
        this.emitFile({
          type: 'asset',
          fileName: webpName,
          source: webpBuffer,
        });
      }
    },
  };
}
```

### 图片懒加载

首屏以下的图片应该懒加载：

```html
<!-- 原生懒加载（推荐） -->
<img src="photo.jpg" loading="lazy" alt="photo">

<!-- 带占位符的懒加载 -->
<img
  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3C/svg%3E"
  data-src="photo.jpg"
  loading="lazy"
  alt="photo"
>
```

**注意**：首屏图片不要懒加载，会延迟 LCP（Largest Contentful Paint）。

### 响应式图片

根据屏幕大小加载不同尺寸的图片：

```html
<img
  srcset="
    photo-400w.webp 400w,
    photo-800w.webp 800w,
    photo-1200w.webp 1200w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  src="photo-800w.jpg"
  alt="photo"
>
```

## 字体优化

### 字体体积问题

中文字体文件通常很大：

```bash
# 常见中文字体
PingFang.ttc      17 MB
NotoSansCJK.otf   16 MB
MicrosoftYaHei.ttf 20 MB
```

一个 20 MB 的字体文件，用户要等很久才能看到文字。

### 字体子集化

字体子集化是指只保留项目中实际使用的字符：

```bash
# 原始字体
NotoSansCJK.otf   16 MB

# 子集化后（只保留常用中文字符 + 英文 + 数字）
NotoSansCJK-subset.otf   800 KB
```

**使用 fonttools 做子集化**：

```bash
pip install fonttools brotli

# 提取子集
pyftsubset NotoSansCJK.otf \
  --text-file=chars.txt \
  --output-file=NotoSansCJK-subset.otf \
  --layout-features='*'
```

```text
# chars.txt（项目中实际使用的字符）
你好世界这是一个测试页面欢迎使用我们的产品
```

**构建时自动子集化**：

```javascript
// webpack.config.js
const FontminPlugin = require('fontmin-webpack');

module.exports = {
  plugins: [
    new FontminPlugin({
      autodetect: true, // 自动检测使用的字符
    }),
  ],
};
```

### 字体加载策略

**1. font-display 控制加载行为**

```css
@font-face {
  font-family: 'MyFont';
  src: url('./font.woff2') format('woff2');
  font-display: swap; /* 先用系统字体，字体加载完再替换 */
}
```

`font-display` 的值：
- `swap`：先显示系统字体，加载完替换（推荐）
- `fallback`：短暂用系统字体，快速切换
- `optional`：只在网络好时加载
- `block`：先显示空白，加载完再显示（不推荐）

**2. 预加载关键字体**

```html
<head>
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
</head>
```

**3. 使用 woff2 格式**

```bash
# woff2 是目前最好的 Web 字体格式
font.woff     45 KB
font.woff2    32 KB  # 体积更小，压缩率更高
```

### 字体加载的 Runtime 优化

```typescript
// 使用 FontFace API 监控字体加载
const font = new FontFace('MyFont', 'url(/fonts/main.woff2)');

font.load().then(() => {
  document.fonts.add(font);
  console.log('字体加载完成');
}).catch((err) => {
  console.error('字体加载失败', err);
  // 回退到系统字体
});

// 监听字体加载状态
document.fonts.ready.then(() => {
  console.log('所有字体加载完成');
});
```

## SVG 优化

### SVG Sprite

把多个 SVG 图标合并成一个 Sprite 文件：

```html
<!-- sprite.svg -->
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-home" viewBox="0 0 24 24">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </symbol>
  <symbol id="icon-search" viewBox="0 0 24 24">
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </symbol>
</svg>
```

使用：

```html
<svg class="icon">
  <use href="/sprite.svg#icon-home"/>
</svg>
```

### 自动化 SVG Sprite

**使用 vite-plugin-svg-icons**：

```typescript
// vite.config.ts
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import path from 'path';

export default defineConfig({
  plugins: [
    createSvgIconsPlugin({
      iconDirs: [path.resolve(process.cwd(), 'src/icons')],
      symbolId: 'icon-[name]',
    }),
  ],
});
```

```typescript
// src/main.ts
import 'virtual:svg-icons-register';
```

```vue
<!-- 使用 -->
<template>
  <svg class="icon">
    <use href="#icon-home"/>
  </svg>
</template>
```

**目录结构**：

```
src/icons/
  home.svg
  search.svg
  user.svg
  settings.svg
```

### SVG 内联

小 SVG 可以内联到 JavaScript 中，减少 HTTP 请求：

```typescript
// vite.config.ts
export default defineConfig({
  assetsInlineLimit: 4096, // 4 KB 以下的资源内联
});
```

对于需要单独管理的 SVG，可以使用 `?raw` 后缀：

```typescript
import svgContent from './icon.svg?raw';
document.getElementById('container').innerHTML = svgContent;
```

## 资源哈希与缓存

### 内容哈希

使用内容哈希确保缓存正确失效：

```javascript
// Vite 默认配置
build: {
  rollupOptions: {
    output: {
      assetFileNames: 'assets/[name]-[hash][extname]',
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'assets/[name]-[hash].js',
    },
  },
},
```

**缓存策略**：

```
index.html          → 不缓存（或 short cache）
assets/*.js         → 长期缓存（1年）
assets/*.css        → 长期缓存（1年）
assets/*.webp       → 长期缓存（1年）
```

```nginx
# Nginx 配置
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

### 资源内联阈值

小资源内联可以减少 HTTP 请求，但会增加 JavaScript 体积：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    assetsInlineLimit: 4096, // 4 KB
  },
});
```

**如何判断**：HTTP 请求的开销大约等于 1-2 KB 的数据传输。小于 4 KB 的资源内联通常更划算。

## 综合资源优化配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import viteImagemin from 'vite-plugin-imagemin';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

export default defineConfig({
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  plugins: [
    // 图片压缩
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: {
        plugins: [
          { name: 'removeViewBox' },
          { name: 'removeComments' },
          { name: 'removeMetadata' },
        ],
      },
    }),

    // SVG Sprite
    createSvgIconsPlugin({
      iconDirs: ['./src/icons'],
      symbolId: 'icon-[name]',
    }),
  ],
});
```

## 常见误区

### 误区一：图片压缩会影响质量

**错误理解**：压缩图片一定会降低质量

**正确理解**：有损压缩在 80-85% 质量设置下，人眼几乎看不出差异，但体积可以减少 50% 以上。无损压缩则完全不影响质量。

### 误区二：所有图片都要转成 WebP

**错误理解**：WebP 最好，所有图片都用 WebP

**正确理解**：WebP 兼容性已经很好，但最好提供 fallback。SVG 图标不需要转 WebP。

### 误区三：字体子集化会丢失字符

**错误理解**：子集化后，如果新增了文字就会显示异常

**正确理解**：子集化需要配合 CI 流程，每次构建时重新提取字符。或者使用动态子集化服务（如 Google Fonts）。

## 本课小结

1. **图片优化**：压缩 + 现代格式（WebP/AVIF）+ 懒加载 + 响应式
2. **字体优化**：子集化 + woff2 格式 + font-display: swap + 预加载
3. **SVG 优化**：SVG Sprite + 内联小图标
4. **缓存策略**：内容哈希 + 长期缓存 + 正确的失效策略

## 练习

### 练习一：图片优化

在你的项目中：
1. 统计所有图片的总体积
2. 压缩图片并转换为 WebP 格式
3. 对比优化前后的总体积

### 练习二：SVG Sprite

把项目中的 SVG 图标整理成 SVG Sprite，使用构建插件自动化处理。

## 参考答案

### 练习一

```bash
# 1. 统计图片体积
find src -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | \
  xargs ls -lh | awk '{sum += $5} END {print sum/1024/1024 " MB"}'

# 2. 使用 sharp 批量转换
node -e "
const sharp = require('sharp');
const glob = require('glob');
const files = glob.sync('src/**/*.{png,jpg,jpeg}');
Promise.all(files.map(f =>
  sharp(f).webp({ quality: 80 }).toFile(f.replace(/\.\w+$/, '.webp'))
)).then(() => console.log('Done'));
"

# 3. 对比体积
# 典型结果：原始 5 MB → WebP 2.8 MB（节省 44%）
```

### 练习二

```
src/icons/
  home.svg
  search.svg
  user.svg
```

```typescript
// vite.config.ts
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

export default defineConfig({
  plugins: [
    createSvgIconsPlugin({
      iconDirs: ['./src/icons'],
      symbolId: 'icon-[name]',
    }),
  ],
});

// src/main.ts
import 'virtual:svg-icons-register';

// 使用
<svg class="icon"><use href="#icon-home"/></svg>
```

## 下一步

完成本课后，继续学习 [07. 环境变量与构建配置管理](./07-env-config.md)。

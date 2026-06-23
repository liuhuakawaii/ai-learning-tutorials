# 07. 字体加载优化 —— font-display、字体子集化、preload、FOIT/FOUT

> 字体是渲染阻塞资源——加载不当会导致文字不可见或布局跳动

## 本课目标

- 理解 FOIT（Flash of Invisible Text）和 FOUT（Flash of Unstyled Text）的成因
- 掌握 font-display 各值的行为差异和选择策略
- 学会字体子集化，减少字体文件体积
- 掌握字体预加载和缓存策略

## 字体加载的问题

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
}
```

当浏览器遇到使用自定义字体的文本时：

```
场景一：FOIT（Flash of Invisible Text）
  浏览器策略：等字体加载完再显示文字
  用户体验：页面加载时文字区域是空白的
  持续时间：直到字体加载完成（可能 2-5 秒）
  超时后：显示后备字体

场景二：FOUT（Flash of Unstyled Text）
  浏览器策略：先用后备字体显示，字体加载完后替换
  用户体验：页面先显示系统字体，加载完后字体突然变化
  问题：文字大小/间距变化可能导致布局跳动（CLS）
```

```
不同浏览器的默认行为：
  Chrome/Edge： FOIT，3 秒超时后降级为 FOUT
  Firefox：    FOIT，3 秒超时后降级为 FOUT
  Safari：     FOIT，更长的超时（可能 30 秒+）
  移动端：     通常 FOIT，超时时间各异

Safari 的 FOIT 问题最严重——用户可能看到长达 30 秒的空白文字。
```

## font-display

`font-display` 控制浏览器在字体加载期间的行为。

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-display: swap;  /* 关键属性 */
}
```

### 各值的行为

```
font-display: auto
  浏览器默认行为（通常是 block）

font-display: block
  加载期间：文字不可见（FOIT）
  超时时间：约 3 秒
  超时后：使用后备字体
  适用：几乎不推荐（用户体验差）

font-display: swap
  加载期间：立即显示后备字体
  字体加载完：替换为自定义字体
  问题：可能导致 FOUT 和布局跳动
  适用：正文内容、需要保证文字可见的场景

font-display: fallback
  加载期间：短暂隐藏（约 100ms）
  100ms 内加载完：直接显示自定义字体
  100ms 后：显示后备字体
  字体加载完：如果在 3 秒内完成，替换为自定义字体
  适用：平衡 FOIT 和 FOUT

font-display: optional
  加载期间：短暂隐藏（约 100ms）
  100ms 内加载完：直接显示自定义字体
  100ms 后：放弃加载自定义字体，使用后备字体
  适用：自定义字体不是必需的场景

font-display: swap 时的加载时间线：
0ms        ── 文本用后备字体显示
100ms      ── 字体仍未加载完成
500ms      ── 字体加载完成，替换为自定义字体（FOUT 发生）
             ── 用户看到字体变化

font-display: optional 时的加载时间线：
0ms        ── 文本隐藏
100ms      ── 超时，使用后备字体显示
             ── 如果字体在很短的时间内加载完成，下次页面访问时使用
```

### 选择策略

```
场景一：品牌字体，必须显示
  → font-display: swap
  → 配合字体预加载（减少 FOUT 持续时间）
  → 做好后备字体的 metrics 调整（减少布局跳动）

场景二：装饰性字体，不强求
  → font-display: optional
  → 字体加载慢就不显示，用后备字体也行

场景三：首屏关键文字
  → font-display: swap + preload
  → 确保字体尽早加载，减少 FOUT 时间

场景四：非首屏内容
  → font-display: fallback
  → 可以接受短暂的隐藏，但不要等太久
```

## 字体子集化

中文字体通常 2-10MB，全部加载不现实。子集化可以大幅减少体积。

```
一个完整中文字体：
  包含 20000+ 个字符
  体积：5-15MB
  加载时间：在 3G 网络下可能需要 30 秒+

子集化后：
  只包含页面实际使用的字符
  体积：10-100KB
  加载时间：< 1 秒
```

### 拉丁字符集子集化

```bash
# 使用 glyphhanger 工具
npx glyphhanger --subset=*.woff2 --LATIN

# 使用 pyftsubset（Python 工具）
pyftsubset "Inter-Regular.ttf" \
  --output-file="Inter-Regular-latin.woff2" \
  --flavor=woff2 \
  --layout-features="kern,liga" \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F"
```

### 中文字体子集化

```javascript
// 方案一：按需加载子集（推荐）
// 将中文字体拆分为多个小文件，按需加载

// font-split 配置示例（使用 cn-font-split）
// https://github.com/nicepkg/cn-font-split

// 方案二：使用 font-spider 提取页面中用到的字符
// npx font-spider index.html
// 只保留页面 HTML 中出现的字符

// 方案三：使用 CDN 动态子集化
// Google Fonts API 支持自动子集化
// https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap&subset=latin
```

### CSS unicode-range

```css
/* 按字符范围分多个 @font-face */
/* 拉丁字符 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131;
}

/* 扩展拉丁 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin-ext.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0100-024F;
}

/* 西里尔字符 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-cyrillic.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0400-045F;
}

/* 浏览器只会下载包含当前页面使用字符的字体文件 */
```

```css
/* 中文字体分片示例 */
@font-face {
  font-family: 'Noto Sans SC';
  src: url('/fonts/noto-sc-1.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+4E00-4FFF;  /* 常用汉字第一部分 */
}

@font-face {
  font-family: 'Noto Sans SC';
  src: url('/fonts/noto-sc-2.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+5000-5FFF;  /* 常用汉字第二部分 */
}
```

## 字体预加载

```html
<!-- 在 <head> 中预加载关键字体 -->
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/inter-latin.woff2" crossorigin>

<!-- 必须加 crossorigin 属性 -->
<!-- 原因：字体请求需要 CORS 头 -->
<!-- 没有 crossorigin，浏览器会用默认模式请求，发现需要 CORS 后重新请求 -->
<!-- 导致字体被下载两次 -->

<!-- 预连接字体 CDN -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**什么时候需要 preload 字体**：

```
需要 preload 的情况：
1. CSS 中 @font-face 引用的字体（浏览器要等 CSS 解析完才知道需要）
2. 首屏关键字体（减少 FOIT/FOUT 时间）
3. 通过 JS 动态加载的字体

不需要 preload 的情况：
1. 已经在 HTML 中用 <link> 直接引入的字体（Google Fonts 的方式）
2. 非首屏的装饰性字体
3. 使用 font-display: optional 的字体
```

## 减少布局跳动

使用 `font-display: swap` 时，后备字体和自定义字体的尺寸差异会导致 CLS。

### font-size-adjust

```css
/* font-size-adjust 调整后备字体的 x-height */
/* 让后备字体和自定义字体的视觉大小更接近 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-display: swap;
  font-size-adjust: 0.5;  /* x-height / font-size 的比值 */
}
```

### 手动调整后备字体

```css
/* 推荐的后备字体配置 */
body {
  font-family:
    'Inter',                          /* 自定义字体 */
    -apple-system,                    /* macOS/iOS 系统字体 */
    BlinkMacSystemFont,               /* Chrome macOS */
    'Segoe UI',                       /* Windows 系统字体 */
    Roboto,                           /* Android 系统字体 */
    'Helvetica Neue',                 /* macOS 旧版 */
    Arial,                            /* 通用后备 */
    sans-serif;                       /* 最终后备 */
}

/* 调整后备字体的 metrics 以减少 CLS */
/* 使用 Fontaine 或类似的工具 */
/* 自动为后备字体设置 size-adjust、ascent-override 等 */

/* 手动配置示例 */
@font-face {
  font-family: 'Fallback Sans';
  src: local('Arial');
  size-adjust: 105%;           /* 调整整体大小 */
  ascent-override: 90%;        /* 调整上升线 */
  descent-override: 20%;       /* 调整下降线 */
  line-gap-override: 0%;       /* 调整行间距 */
}

body {
  font-family: 'Inter', 'Fallback Sans', sans-serif;
}
```

## Google Fonts 优化

```html
<!-- 不推荐：默认方式（多一次重定向） -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- 推荐：预连接 + 直接链接 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- 更好：自托管字体文件 -->
<!-- 1. 下载字体文件 -->
<!-- 2. 存放在自己的 CDN 上 -->
<!-- 3. 用 @font-face 引用 -->
<!-- 好处：减少 DNS 查询、完全控制缓存策略、不受 Google 服务影响 -->
```

```css
/* 自托管 Google Fonts */
/* 使用 woff2 格式（体积最小） */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-024F;
}
```

## 本课小结

```
字体优化策略：

减少字体体积：
  - woff2 格式（压缩率最好）
  - 字体子集化（只包含需要的字符）
  - unicode-range 按需加载
  - 只加载需要的字重（不要加载所有 weight）

减少字体加载时间：
  - preload 关键字体
  - preconnect 字体 CDN
  - 自托管（减少 DNS 查询）
  - HTTP 缓存长期缓存

减少 FOIT/FOUT 影响：
  - font-display: swap（保证文字可见）
  - 调整后备字体 metrics（减少 CLS）
  - 预加载减少 FOUT 持续时间

目标：
  字体加载不阻塞首屏渲染
  字体替换不产生明显的布局跳动
```

## 练习

### 练习一：设计字体加载方案

你的项目需要使用以下字体：
- Inter（英文正文，400/500/600 三个字重）
- Noto Sans SC（中文正文，400/700 两个字重）
- Fira Code（代码块，400 一个字重）

请设计完整的字体加载方案。

### 练习二：减少 FOUT 布局跳动

以下页面在字体加载时有明显的布局跳动（CLS > 0.1），请分析原因并优化：

```html
<style>
  @font-face {
    font-family: 'Brand Font';
    src: url('/fonts/brand.woff2') format('woff2');
    font-display: swap;
  }
  
  h1 {
    font-family: 'Brand Font', serif;
    font-size: 48px;
    line-height: 1.2;
    margin-bottom: 24px;
  }
  
  .hero {
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea, #764ba2);
  }
</style>

<div class="hero">
  <h1>Welcome to Our Platform</h1>
</div>
```

---

## 参考答案

### 练习一

```html
<head>
  <!-- 预连接字体 CDN（如果使用自托管则不需要） -->
  <!-- 预加载首屏关键字体 -->
  <link rel="preload" as="font" type="font/woff2"
        href="/fonts/inter-latin-400.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2"
        href="/fonts/inter-latin-500.woff2" crossorigin>
</head>
```

```css
/* Inter - 英文正文 */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/inter-latin-500.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

/* Noto Sans SC - 中文正文（分片加载） */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/noto-sc-400-common.woff2') format('woff2');
  /* 常用 3500 字 */
  unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;
}

@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/noto-sc-400-ext.woff2') format('woff2');
  /* 扩展字符 */
  unicode-range: U+3400-4DBF, U+F900-FAFF;
}

@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/noto-sc-700-common.woff2') format('woff2');
  unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;
}

/* Fira Code - 代码块 */
@font-face {
  font-family: 'Fira Code';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/fira-code-latin-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}

/* 使用 */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

:lang(zh) body,
:lang(zh) {
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

code, pre {
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
}
```

```
方案要点：
1. Inter 只加载 latin 字符集（中文页面英文内容不多）
2. Noto Sans SC 分片加载，常用字和扩展字分开
3. 只加载需要的字重（不加载 Inter 的 300/700/800/900）
4. Fira Code 只加载 latin（代码通常是英文）
5. preload 首屏最常用的两个 Inter 字重
6. 中文字体用系统字体做后备（PingFang、YaHei）
```

### 练习二

```
布局跳动原因分析：

1. 'Brand Font' 和 serif 后备字体的 metrics 差异很大
   - Brand Font 的 x-height、ascent、descent 与 Times New Roman 不同
   - 字体加载前后，48px 的 h1 高度变化约 10-20px
   - 这导致 .hero 容器高度变化，产生 CLS

2. font-display: swap 允许 FOUT 发生
   - 先用 serif 显示 → 字体加载后替换为 Brand Font
   - 替换瞬间布局跳动
```

```css
/* 优化方案 */
@font-face {
  font-family: 'Brand Font';
  src: url('/fonts/brand.woff2') format('woff2');
  font-display: swap;
}

/* 创建后备字体，调整 metrics 匹配 Brand Font */
@font-face {
  font-family: 'Brand Fallback';
  src: local('Georgia');  /* 比 serif 更具体的后备 */
  size-adjust: 102%;
  ascent-override: 85%;
  descent-override: 20%;
  line-gap-override: 0%;
}

h1 {
  font-family: 'Brand Font', 'Brand Fallback', serif;
  font-size: 48px;
  line-height: 1.2;
  margin-bottom: 24px;
}

/* 预加载字体（减少 FOUT 持续时间） */
/* 在 <head> 中添加 */
/* <link rel="preload" as="font" type="font/woff2" href="/fonts/brand.woff2" crossorigin> */
```

```
优化点：
1. 用 Fontaine 工具自动计算后备字体的 metrics 调整值
2. preload 减少字体加载时间
3. 后备字体从 serif 改为 Georgia + metrics 调整
4. 测量 CLS：优化前 0.15 → 优化后 < 0.05
```

## 下一步

完成本课后，继续学习 [08. 服务端渲染与边缘渲染](./08-ssr-edge-rendering.md)。

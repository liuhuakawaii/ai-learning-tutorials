# 02 - SVG 动画

## 场景引入

品牌网站的 Logo 出场动画：一条线沿着轮廓慢慢"画"出来，最后填色。这种效果用纯 CSS 很难实现，但用 SVG 的 `stroke-dashoffset` 技术只需要几行代码。SVG 既是矢量图形（无限缩放不失真），又支持路径操作（精确控制动画轨迹），还能和 CSS/JS 无缝配合。

在实际项目中，SVG 动画的典型应用场景：
- **品牌 Logo 动画**：描边出场、渐显、变形等品牌动效
- **数据可视化**：环形进度条、折线图动画、数据更新动效
- **图标动效**：图标 hover 状态、加载动画、状态切换
- **背景装饰**：流动的线条、粒子效果、波浪动画
- **交互反馈**：按钮勾选动画、表单验证图标、操作成功提示

本课从描边动画入手，逐步讲解路径动画和形状变形（morphing）。

## 学习目标

- 理解 SVG `stroke-dasharray` 和 `stroke-dashoffset` 的工作原理
- 掌握用 CSS/JS 驱动 SVG 路径动画的方法
- 了解 SVG morphing 的实现思路和局限性
- 理解 SVG 坐标系和变换原点的特殊性
- 能实现 Logo 描边出场、进度环、形状变形等效果
- 掌握 SVG 动画的性能优化和调试技巧

## 一、SVG 基础回顾

在学习 SVG 动画之前，先回顾 SVG 的基本结构和常用元素：

```html
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- 基本形状 -->
  <rect x="10" y="10" width="80" height="80" fill="#3b82f6" />
  <circle cx="150" cy="50" r="40" fill="#ef4444" />
  <ellipse cx="50" cy="150" rx="40" ry="25" fill="#10b981" />
  <line x1="100" y1="100" x2="190" y2="190" stroke="#1e293b" stroke-width="2" />
  <polyline points="10,190 50,150 100,180 150,120 190,160" 
    fill="none" stroke="#f59e0b" stroke-width="2" />
  <polygon points="100,100 130,130 100,160 70,130" fill="#8b5cf6" />
  
  <!-- 路径（最灵活的元素） -->
  <path d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" 
    fill="none" stroke="#ec4899" stroke-width="3" />
</svg>
```

### viewBox 的作用

`viewBox` 定义了 SVG 的内部坐标系，格式为 `viewBox="x y width height"`：

```html
<!-- viewBox 和实际尺寸不同时，内容会自动缩放 -->
<svg width="100" height="100" viewBox="0 0 200 200">
  <!-- 内部坐标系是 200x200，但显示为 100x100 -->
  <circle cx="100" cy="100" r="80" fill="#3b82f6" />
</svg>
```

### path 的基本命令

SVG `<path>` 的 `d` 属性使用以下命令：

| 命令 | 含义 | 示例 |
|------|------|------|
| M x y | 移动到 | M 10 10 |
| L x y | 直线到 | L 100 100 |
| H x | 水平线 | H 100 |
| V y | 垂直线 | V 100 |
| Q cx cy x y | 二次贝塞尔曲线 | Q 50 10 100 100 |
| C cx1 cy1 cx2 cy2 x y | 三次贝塞尔曲线 | C 20 0 80 0 100 100 |
| A rx ry x-rotation large-arc sweep x y | 弧线 | A 50 50 0 0 1 100 100 |
| Z | 闭合路径 | Z |

大写命令使用绝对坐标，小写命令使用相对坐标。

## 二、描边动画原理

描边动画依赖两个属性：`stroke-dasharray`（虚线模式）和 `stroke-dashoffset`（虚线偏移）。

当 `stroke-dasharray` 的线段长度等于路径总长，间隔也等于路径总长时，整条路径要么完全可见，要么完全不可见——取决于偏移量。

```css
.animated-path {
  stroke-dasharray: 1000;    /* 线段长度 = 路径总长 */
  stroke-dashoffset: 1000;   /* 偏移 = 路径总长，路径隐藏 */
}
.animated-path.visible {
  stroke-dashoffset: 0;      /* 偏移 = 0，路径完全显示 */
}
```

从 `dashoffset: 路径总长` 过渡到 `dashoffset: 0`，就产生了"描边画出"的效果。

### stroke-dasharray 的详细用法

`stroke-dasharray` 接受一组数值，定义虚线的线段和间隔长度：

```css
/* 单值：线段和间隔交替 */
.simple { stroke-dasharray: 10; }
/* 等同于 stroke-dasharray: 10 10; */

/* 双值：线段长度 10，间隔 5 */
.two { stroke-dasharray: 10 5; }

/* 多值：循环使用 */
.complex { stroke-dasharray: 10 5 20 5; }
/* 线段10 间隔5 线段20 间隔5，然后重复 */
```

### 描边动画的视觉原理

```
stroke-dasharray: 100
stroke-dashoffset: 100  →  路径完全隐藏（虚线向左偏移了整个长度）

stroke-dasharray: 100
stroke-dashoffset: 50   →  路径显示一半

stroke-dasharray: 100
stroke-dashoffset: 0    →  路径完全显示
```

可以理解为：`stroke-dashoffset` 控制虚线模式的起始位置。正值让虚线向路径起点方向偏移，负值让虚线向路径终点方向偏移。

### 多段描边动画

```css
/* 多段路径使用不同的 dasharray 值 */
.path-segment-1 {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: draw 1s ease forwards;
}

.path-segment-2 {
  stroke-dasharray: 150;
  stroke-dashoffset: 150;
  animation: draw 1s ease forwards 0.3s;
}

.path-segment-3 {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: draw 1s ease forwards 0.6s;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}
```

## 三、获取路径长度

用 JavaScript 的 `getTotalLength()` 获取路径精确长度：

```javascript
const path = document.querySelector('.animated-path')
const length = path.getTotalLength()

path.style.strokeDasharray = length
path.style.strokeDashoffset = length

requestAnimationFrame(() => {
  path.style.transition = 'stroke-dashoffset 2s ease-in-out'
  path.style.strokeDashoffset = 0
})
```

完整示例——Logo 描边出场：

```html
<svg width="200" height="200" viewBox="0 0 200 200">
  <path class="logo-path"
    d="M20,100 L100,20 L180,100 L100,180 Z"
    fill="none" stroke="#3b82f6" stroke-width="3" />
</svg>
```

```javascript
const logoPath = document.querySelector('.logo-path')
const totalLength = logoPath.getTotalLength()
logoPath.style.strokeDasharray = totalLength
logoPath.style.strokeDashoffset = totalLength

setTimeout(() => {
  logoPath.style.transition = 'stroke-dashoffset 2s ease-in-out'
  logoPath.style.strokeDashoffset = 0
}, 100)
```

### 动态获取多个路径的长度

在实际项目中，页面可能有多个需要描边动画的路径，用 JavaScript 批量处理：

```javascript
document.querySelectorAll('.draw-animated').forEach(path => {
  const length = path.getTotalLength()
  path.style.strokeDasharray = length
  path.style.strokeDashoffset = length
  path.style.setProperty('--path-length', length)
})
```

```css
.draw-animated {
  animation: drawPath 2s ease-in-out forwards;
}

@keyframes drawPath {
  to { stroke-dashoffset: 0; }
}
```

### 常见形状的路径长度参考

| 形状 | 路径长度计算 |
|------|-------------|
| 圆形 | 2 × π × r |
| 矩形 | 2 × (width + height) |
| 等边三角形 | 3 × 边长 |
| 正五边形 | 5 × 边长 |

## 四、进度环

进度环是描边动画最实用的场景。用 `stroke-dashoffset` 控制圆环的可见弧长。

```html
<svg width="120" height="120">
  <circle cx="60" cy="60" r="50" fill="none"
    stroke="#e5e7eb" stroke-width="8" />
  <circle class="ring-fill" cx="60" cy="60" r="50" fill="none"
    stroke="#3b82f6" stroke-width="8" stroke-linecap="round"
    transform="rotate(-90 60 60)" />
</svg>
```

```javascript
const circle = document.querySelector('.ring-fill')
const radius = 50
const circumference = 2 * Math.PI * radius

circle.style.strokeDasharray = circumference
circle.style.strokeDashoffset = circumference

function setProgress(percent) {
  circle.style.strokeDashoffset =
    circumference - (percent / 100) * circumference
}

setProgress(75)  // 设置为 75%
```

`transform="rotate(-90 60 60)"` 让起点从顶部开始（SVG 圆默认起点在 3 点钟方向）。

### 进度环的数学原理

圆的周长公式：`C = 2πr`

当 `stroke-dasharray` 等于周长时，整个圆是一段完整的线段。通过 `stroke-dashoffset` 控制可见部分：

```
进度 0%：dashoffset = circumference（完全隐藏）
进度 25%：dashoffset = circumference * 0.75
进度 50%：dashoffset = circumference * 0.5
进度 100%：dashoffset = 0（完全显示）
```

### 带渐变色的进度环

```html
<svg width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="70" fill="none"
    stroke="#e5e7eb" stroke-width="10" />
  <circle class="gradient-ring" cx="80" cy="80" r="70" fill="none"
    stroke="url(#ringGradient)" stroke-width="10" stroke-linecap="round"
    transform="rotate(-90 80 80)" />
</svg>
```

```javascript
const gradientRing = document.querySelector('.gradient-ring')
const radius = 70
const circumference = 2 * Math.PI * radius

gradientRing.style.strokeDasharray = circumference
gradientRing.style.strokeDashoffset = circumference

// 动画设置进度
function animateProgress(targetPercent, duration = 1000) {
  const startOffset = parseFloat(gradientRing.style.strokeDashoffset)
  const endOffset = circumference - (targetPercent / 100) * circumference
  const startTime = performance.now()

  function update(currentTime) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    
    const currentOffset = startOffset + (endOffset - startOffset) * eased
    gradientRing.style.strokeDashoffset = currentOffset

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  requestAnimationFrame(update)
}

animateProgress(75)
```

### 带数字显示的进度环组件

```html
<div class="progress-ring-container" id="progressContainer">
  <svg width="140" height="140" viewBox="0 0 140 140">
    <circle cx="70" cy="70" r="60" fill="none"
      stroke="#f1f5f9" stroke-width="10" />
    <circle class="progress-ring" cx="70" cy="70" r="60" fill="none"
      stroke="#3b82f6" stroke-width="10" stroke-linecap="round"
      transform="rotate(-90 70 70)" />
  </svg>
  <div class="progress-text">0%</div>
</div>
```

```css
.progress-ring-container {
  position: relative;
  display: inline-block;
}

.progress-text {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28px;
  font-weight: bold;
  color: #1e293b;
}
```

```javascript
class ProgressRing {
  constructor(container, options = {}) {
    this.container = container
    this.ring = container.querySelector('.progress-ring')
    this.text = container.querySelector('.progress-text')
    this.radius = 60
    this.circumference = 2 * Math.PI * this.radius
    this.duration = options.duration || 1000

    this.ring.style.strokeDasharray = this.circumference
    this.ring.style.strokeDashoffset = this.circumference
  }

  setProgress(percent, animate = true) {
    const clamped = Math.max(0, Math.min(100, percent))
    const offset = this.circumference - (clamped / 100) * this.circumference

    if (animate) {
      this.animateTo(offset, clamped)
    } else {
      this.ring.style.strokeDashoffset = offset
      this.text.textContent = `${Math.round(clamped)}%`
    }
  }

  animateTo(targetOffset, targetPercent) {
    const startOffset = parseFloat(this.ring.style.strokeDashoffset)
    const startPercent = parseInt(this.text.textContent)
    const startTime = performance.now()

    const update = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / this.duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      const currentOffset = startOffset + (targetOffset - startOffset) * eased
      const currentPercent = startPercent + (targetPercent - startPercent) * eased

      this.ring.style.strokeDashoffset = currentOffset
      this.text.textContent = `${Math.round(currentPercent)}%`

      if (progress < 1) {
        requestAnimationFrame(update)
      }
    }

    requestAnimationFrame(update)
  }
}

// 使用
const ring = new ProgressRing(document.getElementById('progressContainer'))
ring.setProgress(75)
```

## 五、CSS 动画驱动 SVG

也可以用 CSS `@keyframes` 直接驱动：

```css
.draw-line {
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  animation: draw 2s ease-in-out forwards;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}

/* 多段路径依次绘制 */
.path-1 { stroke-dasharray: 300; stroke-dashoffset: 300; animation: draw 1s ease forwards 0s; }
.path-2 { stroke-dasharray: 200; stroke-dashoffset: 200; animation: draw 1s ease forwards 0.5s; }
.path-3 { stroke-dasharray: 150; stroke-dashoffset: 150; animation: draw 1s ease forwards 1s; }
```

通过 `animation-delay` 实现多段路径依次绘制。

### 描边动画 + 填充动画组合

先画出轮廓，再填充颜色：

```css
.logo-animated path {
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  fill: transparent;
  animation: 
    draw 2s ease forwards,
    fillIn 0.5s ease forwards 2s;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}

@keyframes fillIn {
  to { fill: #3b82f6; }
}
```

### 用 stroke-dasharray 实现虚线动画

```css
/* 虚线流动效果 */
.flowing-dash {
  stroke-dasharray: 10 5;
  animation: flowDash 1s linear infinite;
}

@keyframes flowDash {
  to { stroke-dashoffset: -15; }  /* 等于 dasharray 之和 */
}
```

## 六、SVG Morphing

形状变形是指一个形状平滑过渡到另一个形状。核心要求：两个路径必须有相同数量的控制点。

```html
<svg width="200" height="200" viewBox="0 0 200 200">
  <path id="morphPath"
    d="M100,20 L180,80 L160,170 L40,170 L20,80 Z"
    fill="#3b82f6" />
</svg>
<button id="morphBtn">变形</button>
```

```javascript
const path = document.getElementById('morphPath')

const shapes = {
  star: 'M100,20 L120,75 L180,80 L135,120 L150,175 L100,145 L50,175 L65,120 L20,80 L80,75 Z',
  pentagon: 'M100,20 L180,80 L160,170 L40,170 L20,80 Z'
}

let isStar = false
document.getElementById('morphBtn').addEventListener('click', () => {
  path.style.transition = 'd 0.6s ease-in-out'
  path.setAttribute('d', isStar ? shapes.pentagon : shapes.star)
  isStar = !isStar
})
```

CSS 的 `d` 属性动画是较新特性（Chrome 89+），旧浏览器需要用 Flubber 或 GSAP MorphSVG 库。

### Morphing 的路径点匹配要求

CSS `d` 属性动画要求两个路径有相同数量和类型的命令：

```css
/* 正确：两个路径都是 M + 5个L + Z */
.shape-a { d: path("M100,20 L180,80 L160,170 L40,170 L20,80 Z"); }
.shape-b { d: path("M100,10 L170,60 L140,150 L60,150 L30,60 Z"); }

/* 错误：命令数量不同，无法平滑过渡 */
.shape-a { d: path("M100,20 L180,80 L160,170 Z"); }
.shape-b { d: path("M100,20 L180,80 L160,170 L40,170 L20,80 Z"); }
```

### 多形状 Morphing 序列

```javascript
const morphSequence = [
  'M100,20 L180,80 L160,170 L40,170 L20,80 Z',  // 五边形
  'M100,10 L130,80 L190,80 L140,120 L160,190 L100,150 L40,190 L60,120 L10,80 L70,80 Z',  // 五角星
  'M100,20 C140,20 180,60 180,100 C180,140 140,180 100,180 C60,180 20,140 20,100 C20,60 60,20 100,20 Z',  // 圆形
]

let currentShape = 0
const morphPath = document.getElementById('morphPath')

function morphToNext() {
  currentShape = (currentShape + 1) % morphSequence.length
  morphPath.style.transition = 'd 0.8s ease-in-out'
  morphPath.setAttribute('d', morphSequence[currentShape])
}

// 每 2 秒切换一次形状
setInterval(morphToNext, 2000)
```

## 七、SVG 的 transform-origin

SVG 元素的默认变换原点是画布原点（0,0），不是元素中心。需要配合 `transform-box: fill-box` 使用。

```css
.svg-element {
  transform-box: fill-box;  /* 变换原点相对于元素边界 */
  transform-origin: center; /* 现在 center 是元素自己的中心 */
  transition: transform 0.3s ease;
}

.svg-element:hover {
  transform: scale(1.1) rotate(5deg);
}
```

### SVG 变换原点的详细说明

```css
/* 默认情况：变换原点是 SVG 画布的 (0, 0) */
.svg-default {
  transform-origin: 0 0;  /* SVG 画布左上角 */
}

/* 使用 fill-box：变换原点相对于元素的边界框 */
.svg-fill-box {
  transform-box: fill-box;
  transform-origin: center;  /* 元素自己的中心 */
}

/* 使用 view-box：变换原点相对于 viewBox */
.svg-view-box {
  transform-box: view-box;
  transform-origin: 50% 50%;  /* viewBox 的中心 */
}
```

### SVG 元素的旋转动画

```css
/* 让 SVG 图标绕自己的中心旋转 */
.icon-spin {
  transform-box: fill-box;
  transform-origin: center;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 让 SVG 元素绕指定点旋转 */
.orbit {
  transform-box: fill-box;
  transform-origin: 50% 100%;  /* 底部中心 */
  animation: orbit 3s ease-in-out infinite;
}

@keyframes orbit {
  0%, 100% { transform: rotate(-15deg); }
  50% { transform: rotate(15deg); }
}
```

## 八、SVG 与 CSS 滤镜

SVG 支持丰富的滤镜效果，可以和动画结合创造独特的视觉效果：

```html
<svg width="200" height="200">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="40" fill="#3b82f6" filter="url(#glow)" />
</svg>
```

```css
/* 滤镜动画 */
.glow-animated {
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { filter: drop-shadow(0 0 5px #3b82f6); }
  50% { filter: drop-shadow(0 0 20px #3b82f6); }
}
```

## 九、SVG 路径动画实战：签名效果

实现一个手写签名的动画效果：

```html
<div class="signature-container">
  <svg width="400" height="150" viewBox="0 0 400 150">
    <path class="signature-path"
      d="M30,100 C30,50 60,30 80,60 C100,90 90,120 110,80 
         C130,40 150,60 170,50 C190,40 200,70 220,60 
         C240,50 250,30 270,60 C290,90 280,100 300,80 
         C320,60 340,70 360,60"
      fill="none" stroke="#1e293b" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <button id="replayBtn">重播</button>
</div>
```

```css
.signature-path {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: signWrite 3s ease-in-out forwards;
}

@keyframes signWrite {
  to { stroke-dashoffset: 0; }
}
```

```javascript
const signaturePath = document.querySelector('.signature-path')
const replayBtn = document.getElementById('replayBtn')

// 获取实际路径长度并设置
const pathLength = signaturePath.getTotalLength()
signaturePath.style.strokeDasharray = pathLength
signaturePath.style.strokeDashoffset = pathLength

// 开始动画
setTimeout(() => {
  signaturePath.style.transition = 'stroke-dashoffset 3s ease-in-out'
  signaturePath.style.strokeDashoffset = 0
}, 100)

// 重播功能
replayBtn.addEventListener('click', () => {
  signaturePath.style.transition = 'none'
  signaturePath.style.strokeDashoffset = pathLength
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      signaturePath.style.transition = 'stroke-dashoffset 3s ease-in-out'
      signaturePath.style.strokeDashoffset = 0
    })
  })
})
```

### 多段路径的签名效果

复杂签名通常由多条路径组成，需要依次绘制：

```html
<svg width="400" height="150" viewBox="0 0 400 150">
  <path class="sig-segment" data-order="1"
    d="M30,80 C50,30 80,50 100,70" fill="none" stroke="#1e293b" stroke-width="2" />
  <path class="sig-segment" data-order="2"
    d="M100,70 C120,90 140,40 170,60" fill="none" stroke="#1e293b" stroke-width="2" />
  <path class="sig-segment" data-order="3"
    d="M170,60 C200,80 220,30 260,50" fill="none" stroke="#1e293b" stroke-width="2" />
  <path class="sig-segment" data-order="4"
    d="M260,50 C290,70 310,40 350,60" fill="none" stroke="#1e293b" stroke-width="2" />
</svg>
```

```javascript
const segments = document.querySelectorAll('.sig-segment')
let totalDelay = 0

segments.forEach((seg, index) => {
  const length = seg.getTotalLength()
  seg.style.strokeDasharray = length
  seg.style.strokeDashoffset = length
  seg.style.strokeLinecap = 'round'
  seg.style.strokeLinejoin = 'round'

  setTimeout(() => {
    seg.style.transition = `stroke-dashoffset 0.8s ease-in-out`
    seg.style.strokeDashoffset = 0
  }, totalDelay)

  totalDelay += 800  // 每段 0.8 秒
})
```

## 十、SVG 图标动画

### 勾选动画

表单提交成功后的勾选动画：

```html
<svg class="checkmark" width="60" height="60" viewBox="0 0 60 60">
  <circle class="checkmark-circle" cx="30" cy="30" r="25" 
    fill="none" stroke="#10b981" stroke-width="3" />
  <path class="checkmark-check" d="M18 30 L26 38 L42 22" 
    fill="none" stroke="#10b981" stroke-width="3" 
    stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

```css
.checkmark {
  display: none;
}

.checkmark.show {
  display: block;
}

.checkmark-circle {
  stroke-dasharray: 157;  /* 2 * π * 25 */
  stroke-dashoffset: 157;
  animation: circleAnim 0.6s ease forwards;
}

.checkmark-check {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: checkAnim 0.4s ease forwards 0.5s;
}

@keyframes circleAnim {
  to { stroke-dashoffset: 0; }
}

@keyframes checkAnim {
  to { stroke-dashoffset: 0; }
}
```

### 加载动画

```html
<svg class="loader" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="15" fill="none" 
    stroke="#3b82f6" stroke-width="3"
    stroke-dasharray: 70 30  /* 部分可见 */
    stroke-linecap="round" />
</svg>
```

```css
.loader {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

## 十一、性能优化

### SVG 动画的性能考虑

```css
/* 好：使用 transform 和 opacity 动画 */
.svg-animate-good {
  transform: scale(1.1);
  opacity: 0.8;
}

/* 差：修改 SVG 属性触发重绘 */
.svg-animate-bad {
  /* 避免在动画中修改这些属性 */
  /* r, cx, cy, width, height, d */
}
```

### 简化 SVG 路径

复杂的 SVG 路径会增加渲染负担：

```javascript
// 使用 SVGO 简化 SVG 路径
// npm install -g svgo
// svgo input.svg -o output.svg
```

### 使用 CSS 变量优化多路径动画

```css
.draw-path {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: drawPath 2s ease-in-out forwards;
  animation-delay: var(--delay, 0s);
}

@keyframes drawPath {
  to { stroke-dashoffset: 0; }
}
```

```javascript
document.querySelectorAll('.draw-path').forEach((path, index) => {
  path.style.setProperty('--path-length', path.getTotalLength())
  path.style.setProperty('--delay', `${index * 0.2}s`)
})
```

## 常见误区

1. **随便猜路径长度**：`stroke-dasharray` 必须用 `getTotalLength()` 获取实际长度。
2. **忘记 `transform-box: fill-box`**：SVG 元素默认变换原点是画布原点，不是元素中心。
3. **Morphing 路径点数不匹配**：两个形状必须有相同数量的控制点。
4. **大量 SVG 元素同时动画**：重绘成本很高，复杂场景考虑用 Canvas。
5. **忽略 `stroke-linecap`**：圆形端帽会让路径看起来更长，需要调整 dasharray。
6. **忘记设置 `viewBox`**：没有 viewBox 的 SVG 在响应式布局中会出问题。
7. **在动画中修改 `d` 属性**：性能较差，优先使用 `stroke-dashoffset`。

## 工程建议

1. 描边动画的路径长度用 JavaScript 动态获取并设置 CSS 变量：
   ```javascript
   document.querySelectorAll('.draw').forEach(path => {
     path.style.setProperty('--length', path.getTotalLength())
   })
   ```
2. 交互场景用 JS 控制 `stroke-dashoffset`；纯展示用 CSS `@keyframes`。
3. 生产环境的 morphing 建议用 GSAP MorphSVG 插件，兼容性和效果更好。
4. 大量 SVG 元素（几百个）考虑用 Canvas 或 WebGL 替代。
5. 使用 `will-change: transform` 优化 SVG 元素的变换动画。
6. SVG 图标建议使用 `<symbol>` 和 `<use>` 复用，减少 DOM 体积。
7. 复杂 SVG 动画考虑使用 Lottie 导出，性能和兼容性更好。

## 小结

本课学习了 SVG 动画的三大核心：描边动画（`stroke-dasharray` + `stroke-dashoffset`）、路径动画（`getTotalLength` 配合过渡）、形状变形（morphing）。SVG 动画的优势在于矢量精度和路径控制，适合 Logo 动画、图标动效、数据可视化等场景。掌握这些技术后，可以实现各种精致的矢量动画效果。

## 练习

### 练习一：签名动画

用 SVG `<path>` 画一个简单的字母轮廓，实现"笔迹写出"的 3 秒动画。

### 练习二：环形进度条组件

封装可复用的环形进度条，通过 `setProgress(percent)` 控制进度，支持自定义颜色和大小。

### 练习三：汉堡菜单变叉号

用 SVG 三条横线实现经典的汉堡菜单变叉号动画。

### 练习四：多段 Logo 描边

设计一个由多条路径组成的 Logo，实现依次描边出场效果，每段之间有 0.3 秒延迟。

### 练习五：SVG 加载动画

实现三种不同的 SVG 加载动画：旋转圆环、脉冲圆点、波浪线。

---

## 参考答案

### 练习一

**思路**：用 `<path>` 画轮廓，`getTotalLength()` 获取长度，设置 dasharray/dashoffset 后过渡到 0。

```html
<svg width="300" height="200" viewBox="0 0 300 200">
  <path id="signature"
    d="M30,150 Q50,30 80,80 Q110,130 130,50 Q150,100 180,40 Q200,80 220,150"
    fill="none" stroke="#1e293b" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

```javascript
const sig = document.getElementById('signature')
const length = sig.getTotalLength()
sig.style.strokeDasharray = length
sig.style.strokeDashoffset = length
setTimeout(() => {
  sig.style.transition = 'stroke-dashoffset 3s ease-in-out'
  sig.style.strokeDashoffset = 0
}, 100)
```

### 练习二

**思路**：用 SVG `<circle>` 画环，封装成函数返回 `setProgress`。

```javascript
function createProgressRing({ size = 120, strokeWidth = 8, fillColor = '#3b82f6', container }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  svg.innerHTML = `
    <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="${strokeWidth}" />
    <circle class="ring" cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${fillColor}" stroke-width="${strokeWidth}" stroke-linecap="round" transform="rotate(-90 ${center} ${center})" style="transition: stroke-dashoffset 1s ease-in-out;" />
  `

  const ring = svg.querySelector('.ring')
  ring.style.strokeDasharray = circumference
  ring.style.strokeDashoffset = circumference
  container.appendChild(svg)

  return (percent) => {
    const clamped = Math.max(0, Math.min(100, percent))
    ring.style.strokeDashoffset = circumference - (clamped / 100) * circumference
  }
}
```

### 练习三

**思路**：三条线用 CSS transition 控制 transform，中间线淡出，上下线移到中间并旋转。

```html
<button class="menu-icon" id="menuIcon">
  <svg width="24" height="24" viewBox="0 0 24 24">
    <line class="line top-line" x1="3" y1="6" x2="21" y2="6" />
    <line class="line mid-line" x1="3" y1="12" x2="21" y2="12" />
    <line class="line bot-line" x1="3" y1="18" x2="21" y2="18" />
  </svg>
</button>
```

```css
.menu-icon { background: none; border: none; cursor: pointer; padding: 8px; }
.line {
  stroke: #1e293b; stroke-width: 2; stroke-linecap: round;
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform-origin: center;
}
.menu-icon.active .top-line { transform: translateY(6px) rotate(45deg); }
.menu-icon.active .mid-line { opacity: 0; }
.menu-icon.active .bot-line { transform: translateY(-6px) rotate(-45deg); }
```

```javascript
document.getElementById('menuIcon').addEventListener('click', function() {
  this.classList.toggle('active')
})
```

### 练习四

**思路**：每条路径单独获取长度，用 JavaScript 依次触发动画。

```html
<svg width="200" height="200" viewBox="0 0 200 200">
  <path class="logo-seg" data-index="0"
    d="M20,100 L100,20" fill="none" stroke="#3b82f6" stroke-width="3" />
  <path class="logo-seg" data-index="1"
    d="M100,20 L180,100" fill="none" stroke="#ef4444" stroke-width="3" />
  <path class="logo-seg" data-index="2"
    d="M180,100 L100,180" fill="none" stroke="#10b981" stroke-width="3" />
  <path class="logo-seg" data-index="3"
    d="M100,180 L20,100" fill="none" stroke="#f59e0b" stroke-width="3" />
</svg>
```

```javascript
document.querySelectorAll('.logo-seg').forEach((path, index) => {
  const length = path.getTotalLength()
  path.style.strokeDasharray = length
  path.style.strokeDashoffset = length
  path.style.strokeLinecap = 'round'

  setTimeout(() => {
    path.style.transition = 'stroke-dashoffset 0.8s ease-in-out'
    path.style.strokeDashoffset = 0
  }, index * 300)
})
```

### 练习五

**思路**：三种加载动画分别用 CSS 动画实现。

```html
<!-- 旋转圆环 -->
<svg class="loader-spinner" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="15" fill="none" 
    stroke="#3b82f6" stroke-width="3"
    stroke-dasharray: 70 30 stroke-linecap="round" />
</svg>

<!-- 脉冲圆点 -->
<svg class="loader-dots" width="60" height="20" viewBox="0 0 60 20">
  <circle class="dot dot-1" cx="10" cy="10" r="4" fill="#3b82f6" />
  <circle class="dot dot-2" cx="30" cy="10" r="4" fill="#3b82f6" />
  <circle class="dot dot-3" cx="50" cy="10" r="4" fill="#3b82f6" />
</svg>

<!-- 波浪线 -->
<svg class="loader-wave" width="80" height="30" viewBox="0 0 80 30">
  <path d="M0,15 Q10,0 20,15 Q30,30 40,15 Q50,0 60,15 Q70,30 80,15"
    fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
</svg>
```

```css
/* 旋转圆环 */
.loader-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 脉冲圆点 */
.loader-dots .dot {
  animation: pulse 1.4s ease-in-out infinite;
}

.loader-dots .dot-2 { animation-delay: 0.2s; }
.loader-dots .dot-3 { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 波浪线 */
.loader-wave path {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: waveFlow 1.5s ease-in-out infinite;
}

@keyframes waveFlow {
  0% { stroke-dashoffset: 200; }
  50% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -200; }
}
```

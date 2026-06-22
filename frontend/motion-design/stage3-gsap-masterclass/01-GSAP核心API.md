# 第一课：GSAP 核心 API — 动画引擎的基石

## 场景引入

你在做一个产品着陆页，需要一个 hero 区域的文字从下方滑入、渐显，同时背景图片缓慢放大。用 CSS `@keyframes` 可以做，但你很快发现问题：多个动画之间的时间协调变得极其痛苦——你得手动算 `animation-delay`，改一个就要改一串。更糟的是，产品经理说"把第二个动画提前 0.3 秒开始"，你得重新算所有偏移量。

GSAP（GreenSock Animation Platform）就是为了解决这类问题而生的。它不是一个简单的动画库，而是一个精密的动画引擎，提供了对时间、缓动、序列化和并行控制的完整掌控。

与 CSS 动画相比，GSAP 的核心优势在于：

- **精确的时间控制**：可以随时暂停、反转、变速、跳到任意时间点
- **强大的序列编排**：Timeline 让多个动画像视频剪辑一样排列组合
- **统一的属性系统**：CSS 属性、SVG 属性、JS 对象属性都能用同一套 API 操作
- **出色的兼容性**：处理了各种浏览器差异，包括 `transform-origin`、GPU 加速等底层细节

## 学习目标

- 掌握 `gsap.to()`、`gsap.from()`、`gsap.fromTo()` 三种核心补间方法
- 理解 GSAP 的属性系统和缓动函数
- 学会用 Timeline 编排多步动画序列
- 掌握 `gsap.set()` 和 `gsap.quickTo()` 等辅助方法
- 能独立完成一个带时间控制的复杂动画编排

## 一、安装与基本配置

GSAP 的核心包是免费的，直接通过 npm 安装：

```bash
npm install gsap
```

在项目中引入：

```javascript
import gsap from "gsap"
```

GSAP 不依赖 DOM，可以在任何 JavaScript 环境中运行。它操作的是对象属性，只不过在浏览器环境中，这些属性恰好映射到了 DOM 元素的样式。

### 在 HTML 中直接使用

如果你不用构建工具，也可以通过 CDN 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  // gsap 全局可用
  gsap.to(".box", { x: 200, duration: 1 })
</script>
```

### GSAP 的版本选择

GSAP 3.x 是当前的主版本，向下兼容 GSAP 2.x 的大部分语法。如果你在网上看到用 `TweenMax`、`TweenLite` 写的代码，那是 GSAP 2.x 的写法，在 3.x 中统一用 `gsap` 命名空间。

## 二、gsap.to() — 从当前位置到目标状态

`gsap.to()` 是最常用的方法，它将元素从**当前状态**动画到**你指定的目标状态**。

```javascript
// 将 .box 元素在 1 秒内移动到 x: 200 的位置
gsap.to(".box", {
  x: 200,
  duration: 1,
  ease: "power2.out"
})
```

### 核心配置项详解

```javascript
gsap.to(".box", {
  x: 200,              // 目标值
  duration: 1,         // 动画时长，单位秒（默认 0.5）
  ease: "power2.out",  // 缓动函数（默认 "power1.out"）
  delay: 0.5,          // 延迟多少秒后开始
  repeat: 2,           // 重复次数，-1 为无限循环
  yoyo: true,          // 配合 repeat，让动画像溜溜球一样来回播放
  stagger: 0.1,        // 多个元素时，每个元素之间的延迟
  overwrite: true,     // 是否覆盖同一目标上的其他动画
  paused: true,        // 创建时是否暂停
  onComplete: () => {},       // 动画完成回调
  onUpdate: () => {},         // 每帧更新回调
  onStart: () => {},          // 动画开始回调
  onRepeat: () => {},         // 每次重复时回调
  onCompleteParams: [arg1],   // 回调参数
})
```

### 一个脉冲动画示例

```javascript
// 一个脉冲动画：放大 → 回到原始大小，无限循环
gsap.to(".pulse-btn", {
  scale: 1.1,
  duration: 0.8,
  ease: "power1.inOut",
  repeat: -1,
  yoyo: true
})
```

### 同时动画多个属性

```javascript
// 一个元素可以同时对多个属性做动画
gsap.to(".card", {
  x: 100,          // 水平移动
  y: -50,          // 垂直移动
  rotation: 15,    // 旋转
  scale: 1.2,      // 放大
  opacity: 0.8,    // 半透明
  borderRadius: "50%",  // 变成圆形
  duration: 1,
  ease: "power2.inOut"
})
```

所有属性会在同一个时间轴上同步进行，GSAP 在底层会将 `transform` 相关属性合并为一个 `matrix` 变换，避免多次重排。

### 理解 GSAP 的属性映射

GSAP 会自动将常见的 CSS 属性映射为简写：

| GSAP 属性 | CSS 等价 | 说明 |
|-----------|---------|------|
| `x` | `transform: translateX()` | 水平位移 |
| `y` | `transform: translateY()` | 垂直位移 |
| `rotation` | `transform: rotate()` | 旋转角度 |
| `scale` | `transform: scale()` | 缩放 |
| `scaleX` | `transform: scaleX()` | 水平缩放 |
| `scaleY` | `transform: scaleY()` | 垂直缩放 |
| `skewX` | `transform: skewX()` | 水平倾斜 |
| `skewY` | `transform: skewY()` | 垂直倾斜 |
| `opacity` | `opacity` | 透明度 |
| `width` | `width` | 宽度 |
| `height` | `height` | 高度 |
| `backgroundColor` | `background-color` | 背景色 |
| `color` | `color` | 文字颜色 |
| `borderRadius` | `border-radius` | 圆角 |

这种映射的好处是，GSAP 会在底层用 `transform` 合并所有变换，避免多次重排，性能远优于逐个设置 CSS 属性。

### 选择器的多种形式

```javascript
// CSS 选择器字符串
gsap.to(".box", { x: 100 })

// DOM 元素
const el = document.querySelector(".box")
gsap.to(el, { x: 100 })

// NodeListOf（多个元素）
const boxes = document.querySelectorAll(".box")
gsap.to(boxes, { x: 100, stagger: 0.1 })

// 数组
gsap.to([el1, el2, el3], { x: 100, stagger: 0.1 })
```

## 三、gsap.from() — 从指定状态到当前位置

`gsap.from()` 的逻辑和 `.to()` 相反：你指定**起始状态**，元素会从那个状态动画到它的**当前样式**。

```javascript
// 元素从左侧 100px 外、完全透明，滑入到当前位置
gsap.from(".card", {
  x: -100,
  opacity: 0,
  duration: 0.6,
  ease: "power2.out"
})
```

这在页面加载动画中特别好用——你不需要修改元素的 CSS 初始状态，GSAP 会临时将元素设置到 `from` 的状态，然后动画回原始样式。

### from() 的工作原理

理解 `from()` 的内部机制很重要：

1. GSAP 首先读取元素当前的 CSS 样式作为**目标状态**
2. 然后立即将元素设置为你传入的 `from` 参数值
3. 最后创建一个从 `from` 值到原始 CSS 值的动画

这意味着 `from()` 会**瞬间改变元素的初始位置**，然后动画回来。

### from() 的一个重要陷阱

`from()` 动画结束后，元素会回到 CSS 中定义的原始状态。如果你在动画结束后立即用 DevTools 检查，可能会看到元素"闪烁"了一下。这是因为 GSAP 在动画完成后会移除内联样式。解决方法是使用 `fromTo()` 明确两端状态，或者在完成后用 `set()` 锁定最终状态。

```javascript
// ❌ 可能导致闪烁
gsap.from(".box", { opacity: 0, duration: 1 })

// ✅ 用 fromTo() 明确两端状态
gsap.fromTo(".box",
  { opacity: 0 },   // 起始
  { opacity: 1, duration: 1 }  // 结束
)

// ✅ 或者在完成后锁定
gsap.from(".box", {
  opacity: 0,
  duration: 1,
  onComplete: () => gsap.set(".box", { opacity: 1 })
})
```

### from() 与 stagger 配合

`from()` 在批量元素入场动画中非常强大：

```javascript
// 五个卡片依次从下方滑入
gsap.from(".card", {
  y: 60,
  opacity: 0,
  duration: 0.5,
  stagger: 0.1,
  ease: "power2.out"
})
```

## 四、gsap.fromTo() — 同时指定起止状态

当你需要精确控制动画的起点和终点时，用 `fromTo()`：

```javascript
gsap.fromTo(".banner",
  { x: -200, opacity: 0 },   // 起始状态
  {
    x: 0,
    opacity: 1,
    duration: 0.8,
    ease: "power3.out"
  }
)
```

`fromTo()` 的优势是意图明确——不会依赖元素当前的 CSS 状态，在复杂场景下更可控。

### fromTo vs from vs to 的选择

| 场景 | 推荐方法 | 原因 |
|------|---------|------|
| 元素从当前状态到目标 | `to()` | 最简单 |
| 元素从某状态回到当前样式 | `from()` | 不需要改 CSS |
| 需要精确控制两端 | `fromTo()` | 最可控 |
| 动画方向可能变化 | `fromTo()` | 避免依赖隐式状态 |

## 五、gsap.set() — 瞬间设置属性

`gsap.set()` 是一个零时长的动画，用于瞬间将元素设置到指定状态：

```javascript
// 瞬间将元素移到 x: 100
gsap.set(".box", { x: 100, opacity: 0 })
```

它等价于 `gsap.to(".box", { x: 100, duration: 0 })`，但语义更清晰。

### set() 的典型用法

```javascript
// 1. 初始化元素状态（配合后续动画）
gsap.set(".hero-title", { y: 50, opacity: 0 })
gsap.to(".hero-title", { y: 0, opacity: 1, duration: 1, delay: 0.3 })

// 2. 在动画链中重置状态
const tl = gsap.timeline()
tl.to(".box", { x: 200, duration: 1 })
  .set(".box", { x: 0 })  // 瞬间回到起点
  .to(".box", { y: 100, duration: 1 })

// 3. 响应式布局重置
window.addEventListener("resize", () => {
  if (window.innerWidth < 768) {
    gsap.set(".sidebar", { x: -300 })
  } else {
    gsap.set(".sidebar", { x: 0 })
  }
})
```

## 六、gsap.quickTo() — 高性能频繁更新

当你需要频繁更新动画目标值（比如跟随鼠标），用 `quickTo()` 比反复调用 `to()` 性能更好：

```javascript
// 创建一个可复用的快速更新函数
const xTo = gsap.quickTo(".follower", "x", {
  duration: 0.5,
  ease: "power3"
})

const yTo = gsap.quickTo(".follower", "y", {
  duration: 0.5,
  ease: "power3"
})

// 在鼠标移动时调用
document.addEventListener("mousemove", (e) => {
  xTo(e.clientX)
  yTo(e.clientY)
})
```

`quickTo()` 内部会复用同一个动画实例，避免每次 `mousemove` 都创建新动画，性能远优于：

```javascript
// ❌ 每次鼠标移动都创建新动画
document.addEventListener("mousemove", (e) => {
  gsap.to(".follower", { x: e.clientX, y: e.clientY, duration: 0.5 })
})
```

## 七、Timeline — 动画序列编排

单独的 `to/from/fromTo` 是"一次性"的，当你需要多个动画按顺序或并行播放时，Timeline 是核心工具。

```javascript
const tl = gsap.timeline()

tl.to(".title", { y: -30, opacity: 1, duration: 0.5 })
  .to(".subtitle", { y: -20, opacity: 1, duration: 0.4 }, "-=0.2")
  .to(".cta-button", { scale: 1, opacity: 1, duration: 0.3 }, "-=0.1")
```

### position 参数

Timeline 的第三个参数是 **position 参数**，它决定了当前动画在时间轴上的位置：

```javascript
const tl = gsap.timeline()

// 绝对时间：在时间轴的 1 秒处开始
tl.to(".a", { x: 100, duration: 1 }, 1)

// 相对偏移：在上一个动画结束前 0.3 秒开始
tl.to(".b", { x: 100, duration: 1 }, "-=0.3")

// 标签定位
tl.addLabel("scene2", 2)
tl.to(".c", { x: 100 }, "scene2")
```

常用 position 值：

| 值 | 含义 |
|---|------|
| `">"` | 紧接上一个动画结束（默认） |
| `"<"` | 与上一个动画同时开始 |
| `-=0.3` | 在上一个动画结束前 0.3 秒 |
| `+=0.5` | 在上一个动画结束后 0.5 秒 |
| `"myLabel"` | 跳到指定标签位置 |

### Timeline 的 defaults 配置

```javascript
const tl = gsap.timeline({
  defaults: {
    duration: 0.5,
    ease: "power2.out"
  }
})

// 这两个动画都会使用 defaults 中的 duration 和 ease
tl.from(".title", { y: 30, opacity: 0 })
  .from(".subtitle", { y: 20, opacity: 0 }, "-=0.2")
  .from(".button", { scale: 0.8, opacity: 0 }, "-=0.1")
```

### Timeline 的控制能力

Timeline 创建后不是只能播放，你可以完全控制它的生命周期：

```javascript
const tl = gsap.timeline({ paused: true }) // 创建时暂停

tl.play()     // 播放
tl.pause()    // 暂停
tl.reverse()  // 反转播放
tl.restart()  // 从头开始
tl.seek(1.5)  // 跳到 1.5 秒处
tl.timeScale(2) // 2 倍速播放
tl.progress(0.5) // 直接跳到 50% 进度
tl.totalDuration() // 获取总时长
tl.kill()     // 销毁动画，释放资源
```

这让你可以用滚动位置、鼠标位置或任何用户交互来驱动动画进度。

### Timeline 的事件回调

```javascript
const tl = gsap.timeline({
  onStart: () => console.log("Timeline 开始"),
  onUpdate: () => console.log("Timeline 更新"),
  onComplete: () => console.log("Timeline 完成"),
  onRepeat: () => console.log("Timeline 重复"),
  onReverseComplete: () => console.log("Timeline 反转完成")
})

// 也可以给单个动画加回调
tl.to(".box", {
  x: 200,
  duration: 1,
  onComplete: () => console.log("box 动画完成")
})
```

## 八、缓动函数（Easing）

缓动决定了动画在时间维度上的"节奏"。GSAP 内置了大量缓动，通过 `ease` 属性配置：

```javascript
// 常用缓动
gsap.to(".box", { x: 300, ease: "power2.out" })    // 减速出场
gsap.to(".box", { x: 300, ease: "power2.in" })      // 加速入场
gsap.to(".box", { x: 300, ease: "power2.inOut" })   // 先加速后减速
gsap.to(".box", { x: 300, ease: "elastic.out(1, 0.3)" }) // 弹性
gsap.to(".box", { x: 300, ease: "back.out(1.7)" })  // 回弹
gsap.to(".box", { x: 300, ease: "bounce.out" })      // 弹跳
gsap.to(".box", { x: 300, ease: "steps(10)" })       // 阶梯
```

### 缓动的分类

GSAP 的缓动分为几大类：

| 类别 | in | out | inOut | 适用场景 |
|------|-----|------|-------|---------|
| `power` | 慢→快 | 快→慢 | 慢→快→慢 | 通用动画 |
| `back` | 有回退 | 有回弹 | 两者兼有 | 强调感 |
| `elastic` | 弹簧振荡 | 弹簧振荡 | 弹簧振荡 | 活泼感 |
| `bounce` | — | 弹跳落地 | — | 物理弹跳 |
| `steps` | 阶梯式 | 阶梯式 | 阶梯式 | 帧动画 |

### 缓动参数调节

部分缓动支持参数调节：

```javascript
// back 缓动：参数控制回弹幅度
gsap.to(".box", { x: 300, ease: "back.out(1.7)" })   // 标准回弹
gsap.to(".box", { x: 300, ease: "back.out(3)" })      // 更强回弹

// elastic 缓动：参数1=振幅，参数2=周期
gsap.to(".box", { x: 300, ease: "elastic.out(1, 0.3)" })  // 标准弹性
gsap.to(".box", { x: 300, ease: "elastic.out(2, 0.1)" })  // 更强弹性

// steps 缓动：参数为步数
gsap.to(".box", { x: 300, ease: "steps(8)" })  // 8 步完成
```

### 选择缓动的原则

**入场动画用 `out`（减速到达），出场动画用 `in`（加速离开），转场动画用 `inOut`**。

具体选择：

- **UI 交互**（按钮、菜单）：`power2.out` — 自然舒适
- **入场强调**（标题、卡片）：`back.out(1.7)` — 有个性
- **物理模拟**（掉落、碰撞）：`bounce.out` — 真实感
- **弹性反馈**（拉伸、压缩）：`elastic.out(1, 0.3)` — 生动
- **精确步进**（计数器、帧动画）：`steps(n)` — 离散感

## 九、stagger — 批量元素的错开动画

当选择器匹配多个元素时，`stagger` 让它们依次执行动画：

```javascript
gsap.from(".card", {
  y: 60,
  opacity: 0,
  duration: 0.5,
  stagger: 0.1,  // 每个元素间隔 0.1 秒
  ease: "power2.out"
})
```

### stagger 的高级用法

```javascript
// 从中心向两边扩散
gsap.from(".item", {
  y: 40,
  opacity: 0,
  stagger: {
    amount: 1,        // 总分散时间为 1 秒
    from: "center",   // 从中心开始
    ease: "power1.inOut"
  }
})

// 随机顺序
gsap.from(".item", {
  y: 40,
  opacity: 0,
  stagger: {
    each: 0.1,
    from: "random"
  }
})

// 网格模式（适用于瀑布流或网格布局）
gsap.from(".grid-item", {
  scale: 0.8,
  opacity: 0,
  stagger: {
    grid: [4, 5],     // 4行5列的网格
    from: "start",    // 从左上角开始
    amount: 1.5
  }
})
```

## 十、实战：一个完整的入场动画编排

把以上知识组合起来，做一个产品卡片的入场动画：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <style>
    .product-card {
      width: 300px;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      background: white;
    }
    .product-image {
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .product-title {
      font-size: 1.5rem;
      margin: 16px 0 8px;
    }
    .price-tag {
      display: inline-block;
      background: #ff6b6b;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="product-card">
    <div class="product-image">
      <img src="product.jpg" alt="产品图片" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    <h2 class="product-title">无线降噪耳机</h2>
    <p class="product-desc">沉浸式音质，40小时续航</p>
    <span class="price-tag">¥899</span>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    function animateProductCard(cardEl) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

      // 卡片整体从下方滑入
      tl.from(cardEl, {
        y: 60,
        opacity: 0,
        duration: 0.7
      })

      // 图片放大到原始尺寸
      .from(cardEl.querySelector(".product-image"), {
        scale: 1.2,
        duration: 0.6
      }, "-=0.3")

      // 标题文字逐字出现
      .from(cardEl.querySelector(".product-title"), {
        y: 20,
        opacity: 0,
        duration: 0.4
      }, "-=0.2")

      // 描述文字滑入
      .from(cardEl.querySelector(".product-desc"), {
        x: -30,
        opacity: 0,
        duration: 0.3
      }, "-=0.1")

      // 价格标签弹出
      .from(cardEl.querySelector(".price-tag"), {
        scale: 0,
        ease: "back.out(1.7)",
        duration: 0.4
      }, "-=0.1")

      return tl
    }

    // 执行动画
    const card = document.querySelector(".product-card")
    animateProductCard(card)
  </script>
</body>
</html>
```

注意 `defaults` 配置——它让 Timeline 内的所有动画共享相同的默认参数，减少重复代码。

## 十一、动画实例的生命周期

每个 GSAP 动画调用都会返回一个动画实例，理解它的生命周期很重要：

```javascript
const tween = gsap.to(".box", { x: 200, duration: 1 })

// 查询状态
tween.progress()      // 当前进度 0-1
tween.time()          // 当前时间
tween.isActive()      // 是否正在播放
tween.paused()        // 是否暂停
tween.reversed()      // 是否反转

// 控制
tween.pause()
tween.resume()
tween.reverse()
tween.restart()
tween.seek(0.5)       // 跳到 0.5 秒
tween.timeScale(2)    // 2 倍速

// 销毁（释放资源）
tween.kill()
```

### 为什么需要 kill()

```javascript
// ❌ 不清理：每次滚动都创建新动画，旧的还在运行
function onScroll() {
  gsap.to(".indicator", { width: scrollPercent + "%" })
}

// ✅ 清理旧动画再创建新的
let indicatorTween
function onScroll() {
  indicatorTween?.kill()
  indicatorTween = gsap.to(".indicator", { width: scrollPercent + "%" })
}

// ✅ 或者用 overwrite: "auto" 自动覆盖同目标的旧动画
function onScroll() {
  gsap.to(".indicator", { width: scrollPercent + "%", overwrite: "auto" })
}
```

## 常见误区

1. **滥用 `gsap.set()` 代替 CSS 初始状态**：GSAP 的 `set()` 会在元素上写入内联样式，会覆盖 CSS 类的优先级。能用 CSS 解决的初始状态，不要用 JS。

2. **忘记 Timeline 的 `defaults`**：每个动画都写 `ease` 和 `duration` 是冗余的，用 `defaults` 统一管理。

3. **在循环中创建动画但不销毁**：如果动画是在事件回调或 `useEffect` 中创建的，必须在清理时 `kill()` 掉，否则内存泄漏。

4. **混淆 `from()` 和 `to()` 的方向**：`from()` 是"从 A 到当前"，`to()` 是"从当前到 B"。如果你发现动画方向和预期相反，检查是不是用反了。

5. **忽略 transform-origin**：GSAP 默认的 `transformOrigin` 是 `"50% 50% 0"`（元素中心）。如果旋转或缩放的中心点不对，需要显式设置 `transformOrigin`。

6. **在 `from()` 中使用 `immediateRender: false`**：如果 `from()` 动画在 Timeline 中间，你可能需要 `immediateRender: false` 来阻止它在 Timeline 开始前就执行。

7. **数值单位问题**：`x: "100%"` 是相对于元素自身宽度，而 `x: 100` 是像素值。混淆两者会导致意料之外的位移距离。

## 工程建议

1. **命名你的 Timeline**：用 `tl.addLabel("hero-enter")` 给关键时间点命名，比硬编码数字更易维护。

2. **用 `defaults` 减少配置噪音**：Timeline 的 `defaults` 对象能大幅减少样板代码。

3. **缓存 Timeline 引用**：如果你需要在其他地方控制同一个动画（暂停、反转），把 `tl` 存到变量或 ref 中。

4. **用 `paused: true` + 手动 `play()`**：在 React 等框架中，创建时暂停、在适当时机播放，比依赖 `delay` 更可控。

5. **开发时用 GSDevTools**：GSAP 提供了可视化调试工具 GSDevTools（需付费 Club GreenSock 会员），可以图形化控制 Timeline 的播放、拖拽进度条。

6. **避免同时对同一元素的同一属性创建多个动画**：除非你明确使用 `overwrite: "auto"`，否则后创建的动画会和先创建的动画冲突。

## 小结

本课我们掌握了 GSAP 的核心补间方法——`to()`、`from()`、`fromTo()`、`set()`、`quickTo()`——以及 Timeline 序列编排。GSAP 的本质是一个时间控制系统：补间定义"什么变化"，Timeline 定义"何时变化"，缓动定义"怎么变化"。这三者组合起来，就能精确控制任何复杂的动画编排。

## 练习

### 练习一：弹跳入场动画

编写一个函数，让一个元素先从屏幕外（y: -200）掉落到中心位置，使用 `bounce.out` 缓动，然后在中心位置做两次轻微的上下弹跳（yoyo + repeat）。

### 练习二：产品展示序列

创建一个 Timeline，实现以下效果：
1. 一个产品图片从左侧滑入（x: -300 → 0），持续 0.8 秒
2. 产品名称从下方淡入，比上一个动画早 0.3 秒开始
3. 三个特性标签依次从右侧滑入，每个间隔 0.15 秒
4. 整个 Timeline 在创建时暂停，点击按钮后播放

### 练习三：跟随鼠标的光晕

用 `quickTo()` 实现一个圆形光晕跟随鼠标移动的效果，光晕需要有 0.5 秒的延迟跟随，使用 `power3` 缓动。

### 练习四：交错网格动画

创建一个 4×4 的方块网格，用 `stagger` 的网格模式实现从中心向外扩散的缩放动画。

---

## 参考答案

### 练习一

**思路**：用 `from()` 设定初始位置，`bounce.out` 做第一次落地，然后用 `to()` 配合 `yoyo` 和 `repeat` 做后续弹跳。关键是让弹跳在第一次落地动画结束后才开始。

**答案**：

```javascript
function bounceIn(element) {
  const tl = gsap.timeline()

  // 从上方掉落，使用弹跳缓动
  tl.from(element, {
    y: -200,
    duration: 0.8,
    ease: "bounce.out"
  })

  // 落地后做轻微弹跳
  .to(element, {
    y: -20,
    duration: 0.2,
    ease: "power1.out",
    repeat: 3,
    yoyo: true
  })

  return tl
}
```

**要点**：
- `bounce.out` 模拟物理弹跳效果，参数控制弹跳次数和衰减
- `yoyo: true` 让动画自动反转，配合 `repeat: 3` 产生来回弹跳
- 用 Timeline 串联两个阶段，确保弹跳在落地后才开始

### 练习二

**思路**：用 Timeline 的 `defaults` 简化配置，position 参数用 `"<"` 和 `"-="` 控制并行和提前量。

**答案**：

```javascript
const productTl = gsap.timeline({
  paused: true,
  defaults: { ease: "power2.out" }
})

// 1. 产品图片从左侧滑入
productTl.from(".product-image", {
  x: -300,
  opacity: 0,
  duration: 0.8
})

// 2. 产品名称淡入（提前 0.3 秒）
.from(".product-name", {
  y: 30,
  opacity: 0,
  duration: 0.5
}, "-=0.3")

// 3. 三个特性标签依次滑入
.from(".feature-tag", {
  x: 50,
  opacity: 0,
  duration: 0.4,
  stagger: 0.15
}, "-=0.2")

// 绑定按钮播放
document.querySelector(".play-btn").addEventListener("click", () => {
  productTl.play()
})
```

**要点**：
- `paused: true` 让 Timeline 创建后不自动播放
- `stagger` 属性让同一选择器匹配的多个元素依次执行动画
- `defaults` 统一了缓动函数，减少重复代码

### 练习三

**思路**：用 `quickTo()` 创建两个可复用的更新函数，分别控制 x 和 y，在 `mousemove` 事件中调用。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <style>
    body { margin: 0; height: 100vh; background: #1a1a2e; cursor: none; }
    .glow {
      position: fixed;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,0.6), transparent);
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const xTo = gsap.quickTo(".glow", "x", { duration: 0.5, ease: "power3" })
    const yTo = gsap.quickTo(".glow", "y", { duration: 0.5, ease: "power3" })

    document.addEventListener("mousemove", (e) => {
      xTo(e.clientX)
      yTo(e.clientY)
    })
  </script>
</body>
</html>
```

**要点**：
- `quickTo()` 复用同一个动画实例，性能远优于反复调用 `gsap.to()`
- `power3` 缓动让跟随有明显的延迟感和弹性
- `pointer-events: none` 防止光晕阻挡鼠标事件

### 练习四

**思路**：用 `stagger` 的 `grid` 配置和 `from: "center"` 实现从中心扩散。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <style>
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 60px);
      gap: 8px;
      justify-content: center;
      margin-top: 100px;
    }
    .cell {
      width: 60px;
      height: 60px;
      background: #6366f1;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="grid">
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
    <div class="cell"></div> <div class="cell"></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    gsap.from(".cell", {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.7)",
      stagger: {
        grid: [4, 4],
        from: "center",
        amount: 1
      }
    })
  </script>
</body>
</html>
```

**要点**：
- `grid: [4, 4]` 告诉 GSAP 这是一个 4 行 4 列的网格
- `from: "center"` 让动画从网格中心向四周扩散
- `amount` 定义总分散时间，而不是每个元素的间隔

# 第四课：Text 动画 — 文字的生命力

## 场景引入

你打开 Apple 的产品页面，标题文字逐字浮现，每个字母带有轻微的旋转和位移。向下滚动，介绍文字逐行从模糊变为清晰。继续滚动，数字从 0 快速跳动到最终值。

这些效果用纯 CSS 几乎不可能实现——CSS 无法将文本节点拆分成独立的字母单元。GSAP 的 SplitText 插件和 TextPlugin 解决了这个问题。

为什么文字动画如此重要？因为文字是页面信息传递的核心载体。一个精心设计的文字动画可以：
- 引导用户的阅读顺序，让注意力按设计者预期流动
- 创造节奏感，让页面从"静态文档"变成"有呼吸的体验"
- 强化品牌调性——科技品牌偏爱干净的擦除效果，潮流品牌偏爱弹跳和旋转

## 学习目标

- 掌握 SplitText 的三种拆分模式：字符、单词、行
- 学会用 stagger 创建逐字/逐行动画
- 理解 TextPlugin 的打字机效果
- 能实现一个完整的品牌标题动画序列
- 了解文字动画的性能考量和可访问性处理

## 一、SplitText 插件基础

SplitText 可以将文本拆分成独立的字符、单词或行，每个单元都可被独立动画化。它的工作原理是将原始文本节点替换为 `<div>` 或 `<span>` 包裹的子元素。

```javascript
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(SplitText)

const split = new SplitText(".headline", { type: "chars,words,lines" })
// split.chars — 字符数组（每个字符一个 <div>）
// split.words — 单词数组（每个单词一个 <div>）
// split.lines — 行数组（每行一个 <div>）
```

三种拆分类型可以单独或组合使用。拆分后直接对数组执行 GSAP 动画即可。

### 拆分后的 DOM 结构

原始 HTML：
```html
<h1 class="headline">Hello World</h1>
```

执行 `new SplitText(".headline", { type: "chars" })` 后，DOM 变为：
```html
<h1 class="headline">
  <div style="display:inline-block">H</div>
  <div style="display:inline-block">e</div>
  <div style="display:inline-block">l</div>
  <div style="display:inline-block">l</div>
  <div style="display:inline-block">o</div>
  <div style="display:inline-block">&nbsp;</div>
  <div style="display:inline-block">W</div>
  <div style="display:inline-block">o</div>
  <div style="display:inline-block">r</div>
  <div style="display:inline-block">l</div>
  <div style="display:inline-block">d</div>
</h1>
```

每个字符被包裹在一个 `display: inline-block` 的 `<div>` 中，这样就可以对每个字符独立设置 `transform`、`opacity` 等属性。

### linesClass 和 wordsClass

拆分时可以为每行或每个单词添加自定义 CSS 类，方便后续样式控制：

```javascript
const split = new SplitText(".headline", {
  type: "lines,words",
  linesClass: "split-line",
  wordsClass: "split-word"
})
```

拆分后的 DOM：
```html
<h1 class="headline">
  <div class="split-line">
    <div class="split-word">Hello</div>
    <div class="split-word">World</div>
  </div>
</h1>
```

## 二、逐字动画

逐字动画是最经典的文字动效，适用于标题、Logo、Slogan 等短文本：

```javascript
function animateHeadline(element) {
  const split = new SplitText(element, { type: "chars" })

  gsap.from(split.chars, {
    opacity: 0,
    y: 40,
    rotationX: -90,
    stagger: 0.02,
    duration: 0.8,
    ease: "back.out(1.7)"
  })
}
```

这段代码让每个字符从下方 40px 的位置出现，同时绕 X 轴旋转 90 度，最终归位。`back.out(1.7)` 缓动会让字符略微"弹过头"再回弹，增加动感。

### stagger 的高级控制

`stagger` 不只是时间延迟，支持从不同位置开始：

```javascript
// 从中心向两侧扩散
stagger: { each: 0.03, from: "center" }

// 从两端向中间汇聚
stagger: { each: 0.03, from: "edges" }

// 随机顺序
stagger: { each: 0.03, from: "random" }

// 从第 5 个字符开始
stagger: { each: 0.03, from: 5 }
```

| `from` 值 | 效果 | 适用场景 |
|-----------|------|----------|
| `"start"` | 从第一个开始（默认） | 常规标题、段落 |
| `"center"` | 从中心向两侧 | 强调中心的标题、Logo |
| `"edges"` | 从两端向中间 | 汇聚感、聚焦效果 |
| `"random"` | 随机顺序 | 轻松活泼的风格 |
| 数字 | 指定起始索引 | 需要从特定位置开始 |

### stagger 的 amount 和 grid

当需要控制总时长而非每个元素的延迟时，使用 `amount`：

```javascript
// each: 每个元素之间的延迟
stagger: { each: 0.03 } // 10 个字符 = 0.3 秒总延迟

// amount: 总延迟时间，自动均分
stagger: { amount: 0.5 } // 不管多少个字符，总延迟都是 0.5 秒
```

对于二维网格排列的文字，可以用 `grid` 参数：

```javascript
stagger: {
  each: 0.03,
  from: "center",
  grid: [3, 5], // 3 行 5 列的网格
  axis: "x"     // 优先沿 x 轴方向延迟
}
```

### 更多逐字动画变体

```javascript
// 字符从不同方向飞入
function flyInFromDirections(element) {
  const split = new SplitText(element, { type: "chars" })

  split.chars.forEach((char, i) => {
    const directions = [
      { x: -100, y: 0 },   // 左
      { x: 100, y: 0 },    // 右
      { x: 0, y: -100 },   // 上
      { x: 0, y: 100 }     // 下
    ]
    const dir = directions[i % directions.length]

    gsap.from(char, {
      x: dir.x,
      y: dir.y,
      opacity: 0,
      duration: 0.8,
      delay: i * 0.05,
      ease: "power3.out"
    })
  })
}

// 字符旋转弹入
function spinIn(element) {
  const split = new SplitText(element, { type: "chars" })

  gsap.from(split.chars, {
    rotation: 360,
    scale: 0,
    opacity: 0,
    stagger: 0.04,
    duration: 1,
    ease: "elastic.out(1, 0.5)"
  })
}

// 字符从模糊到清晰
function blurReveal(element) {
  const split = new SplitText(element, { type: "chars" })

  gsap.from(split.chars, {
    opacity: 0,
    filter: "blur(10px)",
    stagger: 0.03,
    duration: 0.6,
    ease: "power2.out"
  })
}
```

## 三、逐行动画与擦除效果

对于大段文字，逐行动画比逐字更合适。逐字动画会让段落显得过于花哨，分散阅读注意力：

```javascript
function animateParagraph(element) {
  const split = new SplitText(element, {
    type: "lines",
    linesClass: "line-wrapper"
  })

  gsap.from(split.lines, {
    y: 30,
    opacity: 0,
    stagger: 0.1,
    duration: 0.6,
    ease: "power2.out"
  })
}
```

### 文字擦除效果

配合 `overflow: hidden` 实现经典的"擦除"出现。这种效果在高端品牌网站中非常常见，因为它显得干净利落：

```javascript
function wipeReveal(element) {
  const split = new SplitText(element, {
    type: "lines",
    linesClass: "line-mask"
  })

  gsap.set(".line-mask", { overflow: "hidden" })

  gsap.from(split.lines, {
    y: "100%",
    stagger: 0.12,
    duration: 0.8,
    ease: "power3.out"
  })
}
```

每行文字从容器底部向上滑入，像是被遮罩"擦"出来。关键在于 `overflow: hidden` 配合 `y: "100%"`——字符本身在容器外面，向上移动进入可视区域。

### 擦除效果的进阶变体

```javascript
// 带颜色过渡的擦除
function colorWipeReveal(element) {
  const split = new SplitText(element, {
    type: "lines",
    linesClass: "color-line"
  })

  gsap.set(".color-line", { overflow: "hidden" })

  const tl = gsap.timeline()

  tl.from(split.lines, {
    y: "100%",
    stagger: 0.12,
    duration: 0.6,
    ease: "power3.out"
  })
  .to(split.lines, {
    color: "#3b82f6",
    stagger: 0.08,
    duration: 0.4
  }, "-=0.3")
}

// 带背景色块擦除的效果
function blockWipeReveal(element) {
  const split = new SplitText(element, {
    type: "lines",
    linesClass: "block-line"
  })

  split.lines.forEach((line, i) => {
    const tl = gsap.timeline({ delay: i * 0.15 })

    // 先用色块覆盖
    tl.from(line, {
      scaleX: 0,
      transformOrigin: "left center",
      duration: 0.4,
      ease: "power3.inOut"
    })
    // 色块移走，露出文字
    .to(line, {
      scaleX: 0,
      transformOrigin: "right center",
      duration: 0.4,
      ease: "power3.inOut"
    })
  })
}
```

## 四、TextPlugin — 打字机效果

TextPlugin 提供逐字替换文本的能力，适合打字机效果和文本切换动画：

```javascript
import { TextPlugin } from "gsap/TextPlugin"
gsap.registerPlugin(TextPlugin)

// 基础打字机
gsap.to(".typewriter", {
  text: { value: "这是一段逐字出现的文字" },
  duration: 2,
  ease: "none"
})
```

### 带光标的打字机

真正的打字机效果需要一个闪烁的光标：

```javascript
function typewriterEffect(element, text) {
  const tl = gsap.timeline()

  tl.to(element, {
    text: { value: text },
    duration: text.length * 0.05,
    ease: "none"
  })
  .to(".cursor", {
    opacity: 0,
    repeat: -1,
    yoyo: true,
    duration: 0.5
  })

  return tl
}
```

对应的 HTML 和 CSS：

```html
<div class="typewriter-container">
  <span class="typewriter-text"></span>
  <span class="cursor">|</span>
</div>
```

```css
.typewriter-container {
  display: inline-flex;
  align-items: center;
}

.cursor {
  font-weight: 100;
  color: #3b82f6;
  margin-left: 2px;
}
```

### TextPlugin 配置选项

```javascript
gsap.to(element, {
  text: {
    value: "新文字",
    delimiter: "",        // 分隔符（逐字为空）
    padSpace: true,       // 用空格填充保持宽度稳定
    oldClass: "old-text", // 被替换文字的 CSS 类
    newClass: "new-text"  // 新文字的 CSS 类
  },
  duration: 1
})
```

`padSpace: true` 的作用：当新文字比旧文字短时，用空格填充剩余位置，避免容器宽度突然收缩导致布局跳动。

`oldClass` 和 `newClass` 的应用：可以给新旧文字设置不同的颜色、字重、透明度，实现交叉淡入淡出效果：

```javascript
gsap.to(".dynamic-text", {
  text: {
    value: "全新内容",
    oldClass: "text-exit",
    newClass: "text-enter"
  },
  duration: 0.8
})
```

```css
.text-exit {
  opacity: 0.3;
  color: #9ca3af;
}
.text-enter {
  opacity: 1;
  color: #3b82f6;
  font-weight: 600;
}
```

### 多段文本切换

用 Timeline 串联多段文本切换：

```javascript
function textCycle(element, texts) {
  const tl = gsap.timeline({ repeat: -1 })

  texts.forEach(text => {
    tl.to(element, {
      text: { value: text, padSpace: true },
      duration: 0.8,
      ease: "power2.inOut"
    })
    .to({}, { duration: 2 }) // 暂停 2 秒
  })

  return tl
}

// 使用
textCycle(".tagline", [
  "用科技重新定义未来",
  "让创意驱动每一步",
  "为用户创造非凡体验"
])
```

## 五、数字计数动画

数字计数是数据展示页面的标配动效。核心思路是用 GSAP 动画一个数值对象，在 `onUpdate` 回调中更新 DOM：

```javascript
function countUp(element, target, duration = 2) {
  const obj = { value: 0 }

  gsap.to(obj, {
    value: target,
    duration,
    ease: "power1.out",
    onUpdate: () => {
      element.textContent = Math.round(obj.value).toLocaleString()
    }
  })
}
```

### 带格式的计数

实际项目中数字往往需要格式化——货币符号、百分比、千分位分隔符：

```javascript
function formattedCountUp(element, target, format = "number") {
  const obj = { value: 0 }
  const formatters = {
    number: (v) => Math.round(v).toLocaleString(),
    currency: (v) => "¥" + Math.round(v).toLocaleString(),
    percent: (v) => Math.round(v) + "%",
    decimal: (v) => v.toFixed(1),
    compact: (v) => {
      const num = Math.round(v)
      if (num >= 10000) return (num / 10000).toFixed(1) + "万"
      return num.toLocaleString()
    }
  }

  gsap.to(obj, {
    value: target,
    duration: 2,
    ease: "power1.out",
    onUpdate: () => {
      element.textContent = formatters[format](obj.value)
    }
  })
}
```

### 数字滚动效果

比单纯数字变化更有视觉冲击力的是"数字轮盘"效果——每个数位独立滚动到目标值：

```javascript
function rollingCounter(element, target) {
  const digits = String(target).split("")

  element.innerHTML = digits.map(digit =>
    `<span class="digit-wrapper">
       <span class="digit-strip" data-target="${digit}">
         ${[...Array(10)].map((_, i) => `<span class="digit">${i}</span>`).join("")}
       </span>
     </span>`
  ).join("")

  element.querySelectorAll(".digit-strip").forEach((strip, i) => {
    const targetDigit = parseInt(strip.dataset.target)
    gsap.to(strip, {
      y: -targetDigit * 40, // 假设每个数字高 40px
      duration: 1.5,
      delay: i * 0.1,
      ease: "back.out(1.5)"
    })
  })
}
```

对应 CSS：

```css
.digit-wrapper {
  display: inline-block;
  overflow: hidden;
  height: 40px;
  width: 28px;
}

.digit-strip {
  display: flex;
  flex-direction: column;
}

.digit {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
}
```

## 六、多语言文本注意事项

中文和英文的拆分有本质区别：

```javascript
// 英文：按单词和字符拆分，语义清晰
const enSplit = new SplitText(".en-text", { type: "words,chars" })

// 中文：没有空格分隔，words 拆分不符合语义
const cnSplit = new SplitText(".cn-text", { type: "chars" })
```

中文文本建议只用 `type: "chars"` 或 `type: "lines"`。对于中文段落，`lines` 拆分配合擦除效果是最优雅的方案。

### 中文逐字动画的注意事项

中文字符等宽，逐字动画的节奏感天然比英文均匀。但要注意：
- 中文标点符号（，。！？）也是独立字符，动画时要考虑它们的视觉权重
- 中英文混排时，英文单词会被拆成多个字符，节奏会不均匀
- 对于中英混排文本，可以考虑用 `type: "words"` 配合自定义分词逻辑

### 处理富文本中的链接和强调

如果文本中包含 `<strong>`、`<a>` 等标签，SplitText 会保留这些标签：

```html
<h1 class="title">欢迎来到 <strong>GSAP</strong> 的世界</h1>
```

拆分后，`<strong>` 内的文字会被拆分但保留标签嵌套。需要注意：
- 某些特殊字符（如 `&amp;`）可能被拆成多个部分
- 嵌套标签过深时动画可能不流畅
- 建议在拆分前简化 HTML 结构

## 七、实战：品牌标题动画序列

将前面学到的技术组合成一个完整的品牌标题入场动画：

```javascript
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { TextPlugin } from "gsap/TextPlugin"

gsap.registerPlugin(SplitText, TextPlugin)

function animateBrandHero() {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

  // 主标题：逐字弹入
  const titleSplit = new SplitText(".brand-title", { type: "chars" })
  tl.from(titleSplit.chars, {
    y: 80, opacity: 0, rotationX: -60,
    stagger: { each: 0.03, from: "center" },
    duration: 1
  })

  // 副标题：逐行擦除
  const subSplit = new SplitText(".brand-subtitle", {
    type: "lines", linesClass: "subtitle-line"
  })
  gsap.set(".subtitle-line", { overflow: "hidden" })
  tl.from(subSplit.lines, {
    y: "100%", stagger: 0.1, duration: 0.7
  }, "-=0.4")

  // 标语：打字机
  tl.to(".brand-tagline", {
    text: { value: "用科技重新定义未来" },
    duration: 1.5, ease: "none"
  }, "-=0.2")

  // CTA：弹入
  tl.from(".brand-cta", {
    scale: 0, ease: "back.out(1.7)", duration: 0.6
  }, "-=0.5")

  return tl
}
```

### 对应的 HTML 结构

```html
<section class="hero">
  <h1 class="brand-title">NEXUS TECH</h1>
  <p class="brand-subtitle">我们用技术连接未来</p>
  <p class="brand-tagline"></p>
  <button class="brand-cta">开始探索</button>
</section>
```

### 对应的 CSS

```css
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}

.brand-title {
  font-size: 4rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  perspective: 500px;
}

.brand-subtitle {
  font-size: 1.5rem;
  color: #6b7280;
  margin-top: 1rem;
}

.brand-tagline {
  font-size: 1.2rem;
  color: #3b82f6;
  min-height: 1.5em;
  margin-top: 0.5rem;
}

.brand-cta {
  margin-top: 2rem;
  padding: 0.8rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}
```

## 八、文字动画的性能优化

文字动画的性能瓶颈主要来自 DOM 操作——SplitText 会创建大量 DOM 节点：

```javascript
// 100 个字符 = 100 个额外的 DOM 节点
// 如果页面有 10 个标题，就是 1000 个额外节点
```

### 性能优化策略

```javascript
// 1. 拆分后立即动画，动画完成后 revert
const split = new SplitText(element, { type: "chars" })
gsap.from(split.chars, {
  opacity: 0,
  stagger: 0.02,
  duration: 0.8,
  onComplete: () => split.revert() // 动画结束后恢复原始 DOM
})

// 2. 对不可见区域的文字延迟拆分
function lazySplitText(element) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const split = new SplitText(element, { type: "chars" })
        gsap.from(split.chars, { opacity: 0, y: 20, stagger: 0.02 })
        observer.unobserve(entry.target)
      }
    })
  })
  observer.observe(element)
}

// 3. 限制同时动画的字符数量
// 长文本不要逐字动画，改用逐行
```

### will-change 的使用

```css
/* 为即将动画的字符添加 will-change */
.split-char {
  will-change: transform, opacity;
}

/* 动画结束后移除 */
.split-char.animated {
  will-change: auto;
}
```

## 九、可访问性处理

文字动画必须考虑可访问性。对于有前庭功能障碍（vestibular disorders）的用户，文字运动可能引发恶心或眩晕：

```javascript
// 检测减弱动效偏好
function animateWithAccessibility(element) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches

  if (prefersReducedMotion) {
    // 直接显示文字，不做动画
    gsap.set(element, { opacity: 1 })
    return
  }

  // 正常执行动画
  const split = new SplitText(element, { type: "chars" })
  gsap.from(split.chars, {
    opacity: 0,
    y: 40,
    stagger: 0.02,
    duration: 0.8
  })
}
```

### ARIA 属性

```html
<!-- 确保动画文字对屏幕阅读器可读 -->
<h1 aria-label="NEXUS TECH" class="brand-title">
  <span aria-hidden="true">NEXUS TECH</span>
</h1>
```

`aria-hidden="true"` 防止屏幕阅读器逐字朗读被拆分的字符，同时 `aria-label` 提供完整文本。

## 常见误区

1. **忘记 `revert()`**：SplitText 会修改 DOM 结构。需要恢复原始 HTML 时调用 `split.revert()`。特别是在 React 的 `useEffect` 清理函数中必须 revert。

2. **响应式布局中拆分行**：窗口大小变化时换行位置改变，`lines` 拆分会过时。需在 resize 时重新拆分。

3. **stagger 值过大**：100 个字符 × 0.05 秒 = 5 秒延迟，体验很差。长文本应减少 stagger 值或改用逐行动画。

4. **对输入框使用 SplitText**：输入框内容是动态的，不适用。

5. **忽略 `prefers-reduced-motion`**：建议用媒体查询在用户偏好减弱动效时禁用动画。

6. **拆分后忘记设置初始状态**：如果用 `gsap.from()` 但没有设置元素初始可见，页面加载时文字会闪现。

7. **在高频更新的场景中反复拆分**：resize 事件会高频触发，需要用 debounce 包裹重新拆分逻辑。

## 工程建议

1. **用 CSS 类控制初始状态**：比在 JS 中设置更清晰。

2. **为动画元素添加 `will-change: transform, opacity`**。

3. **在 resize 时重新拆分**：

```javascript
let splitInstance
function handleResize() {
  if (splitInstance) splitInstance.revert()
  splitInstance = new SplitText(".headline", { type: "chars,lines" })
}

// 防抖处理
let resizeTimer
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(handleResize, 250)
})
```

4. **用 `prefers-reduced-motion` 尊重用户偏好**。

5. **拆分完成后 revert**：如果动画是一次性的，在 `onComplete` 中调用 `split.revert()` 恢复 DOM。

6. **避免在高频交互中拆分**：鼠标移动、滚动等事件中不要触发 SplitText，性能代价很高。

## 小结

SplitText 将文本拆分为可独立动画的单元，配合 stagger 可以创建逐字、逐行、从中心扩散等多种序列效果。TextPlugin 提供打字机式文本替换。关键在于选择合适的粒度（字符 vs 行）和合适的运动方式。文字动画的核心原则是：服务于内容，而不是喧宾夺主。

## 练习

### 练习一：逐字弹跳标题

创建 `bounceText(selector)`，让每个字符从上方落下，`bounce.out` 缓动，从中心向两侧依次出现。

### 练习二：多段打字机动画

创建 `typeSequence(selector, texts)`，依次将每段文字用打字机效果显示，每段显示完暂停 1 秒。

### 练习三：数字滚动计数器

创建 `rollingNumber(element, target)`，实现数字从 0 滚动到目标值的效果，要求每个数位独立滚动，带有弹性缓动。支持千分位格式化。

### 练习四：文字擦除与颜色渐变

创建 `colorWipeText(selector)`，实现文字逐行擦除出现，同时颜色从灰色渐变到目标色。要求用 Timeline 编排时序。

---

## 参考答案

### 练习一

**思路**：SplitText 拆分字符，`stagger.from: "center"` 从中心开始。

**答案**：

```javascript
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(SplitText)

function bounceText(selector) {
  const split = new SplitText(selector, { type: "chars" })

  gsap.from(split.chars, {
    y: -150,
    opacity: 0,
    duration: 1,
    ease: "bounce.out",
    stagger: { each: 0.04, from: "center" }
  })

  return split
}
```

**要点**：
- `bounce.out` 缓动模拟真实物理弹跳
- `from: "center"` 让中心字符先出现，视觉上像波浪扩散
- 返回 `split` 实例以便后续 revert

### 练习二

**思路**：Timeline 中用 `set` 清空文字再 `to` 打字，空对象动画实现"等待"。

**答案**：

```javascript
import { gsap } from "gsap"
import { TextPlugin } from "gsap/TextPlugin"

gsap.registerPlugin(TextPlugin)

function typeSequence(selector, texts) {
  const element = document.querySelector(selector)
  const tl = gsap.timeline()

  texts.forEach((text, index) => {
    tl.set(element, { text: "" })
    tl.to(element, {
      text: { value: text, delimiter: "" },
      duration: text.length * 0.06,
      ease: "none"
    })
    if (index < texts.length - 1) {
      tl.to({}, { duration: 1.5 })
    }
  })

  return tl
}
```

**要点**：
- `set` 清空文字是关键，否则新文字会追加到旧文字后面
- 空对象 `to({}, { duration: 1.5 })` 实现纯等待
- `delimiter: ""` 确保逐字出现

### 练习三

**思路**：每个数位用一个容器包裹 0-9 的数字列，通过 translateY 滚动到目标数字。用 `back.out` 缓动增加弹性。

**答案**：

```javascript
import { gsap } from "gsap"

function rollingNumber(element, target) {
  const formatted = target.toLocaleString()
  const chars = formatted.split("")

  element.innerHTML = chars.map(char => {
    if (char === ",") return '<span class="separator">,</span>'
    const digit = parseInt(char)
    return `<span class="digit-wrapper">
      <span class="digit-strip" data-target="${digit}">
        ${[...Array(10)].map((_, i) =>
          `<span class="digit">${i}</span>`
        ).join("")}
      </span>
    </span>`
  }).join("")

  element.querySelectorAll(".digit-strip").forEach((strip, i) => {
    const targetDigit = parseInt(strip.dataset.target)
    gsap.to(strip, {
      y: -targetDigit * 40,
      duration: 1.5,
      delay: i * 0.12,
      ease: "back.out(1.5)"
    })
  })
}
```

```css
.digit-wrapper {
  display: inline-block;
  overflow: hidden;
  height: 40px;
  width: 28px;
  vertical-align: bottom;
}

.separator {
  display: inline-block;
  height: 40px;
  line-height: 40px;
  font-size: 2rem;
  font-weight: 700;
}

.digit-strip {
  display: flex;
  flex-direction: column;
}

.digit {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
}
```

**要点**：
- 千分位逗号作为独立的 `.separator` 元素，不参与滚动
- 每个数位的滚动通过 `translateY` 实现，性能优于逐帧更新文本
- `back.out(1.5)` 让数字略微"滚过头"再回弹

### 练习四

**思路**：SplitText 按行拆分，Timeline 中先设置 `overflow: hidden`，然后 `from` 实现擦除，同时 `to` 改变颜色。

**答案**：

```javascript
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(SplitText)

function colorWipeText(selector, targetColor = "#1f2937") {
  const split = new SplitText(selector, {
    type: "lines",
    linesClass: "wipe-line"
  })

  gsap.set(".wipe-line", { overflow: "hidden" })

  const tl = gsap.timeline()

  split.lines.forEach((line, i) => {
    gsap.set(line, { color: "#d1d5db" })

    tl.from(line, {
      y: "100%",
      duration: 0.6,
      ease: "power3.out"
    }, i * 0.12)
    .to(line, {
      color: targetColor,
      duration: 0.4,
      ease: "power2.out"
    }, i * 0.12 + 0.3)
  })

  return tl
}
```

**要点**：
- 初始颜色设为浅灰 `#d1d5db`，动画后过渡到目标色
- 擦除和颜色变化的时间有重叠，产生"边出现边变色"的效果
- 每行的延迟通过 `i * 0.12` 手动控制，比 stagger 更灵活

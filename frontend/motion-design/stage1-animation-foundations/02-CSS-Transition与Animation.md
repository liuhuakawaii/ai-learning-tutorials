# 第二课：CSS Transition 与 Animation

## 场景引入

CSS 提供了两种动画机制：`transition` 处理状态之间的过渡，`animation` 处理复杂的多帧动画。很多开发者分不清两者的适用场景，要么把 `animation` 用在只需要过渡的地方，要么用 `transition` 硬凑多步动画。本课系统梳理两者的区别、用法和性能考量。

## 学习目标

- 掌握 `transition` 的四个子属性及其组合用法
- 掌握 `@keyframes` 和 `animation` 的完整语法
- 理解 `transition` 和 `animation` 的本质区别
- 了解 CSS 动画的性能陷阱与优化策略
- 学会用 CSS 变量实现动态动画参数
- 掌握动画调试和性能分析工具

## 一、CSS Transition

### 1.1 四个子属性

`transition` 由四个子属性组成，控制过渡的各个方面：

```css
.card {
  transition-property: transform, opacity;      /* 过渡的属性 */
  transition-duration: 0.3s, 0.2s;              /* 持续时间 */
  transition-timing-function: ease-out;          /* 缓动函数 */
  transition-delay: 0s;                          /* 延迟 */
}
```

多属性分别设置不同参数：

```css
.modal {
  transition-property: opacity, transform;
  transition-duration: 0.3s, 0.3s;
  transition-timing-function: ease-out, cubic-bezier(0.34, 1.56, 0.64, 1);
  transition-delay: 0s, 0.05s;  /* transform 比 opacity 延迟 50ms，创造层次感 */
}
```

**简写形式**：

```css
/* 单个属性 */
.card {
  transition: transform 0.3s ease-out;
}

/* 多个属性 */
.card {
  transition: transform 0.3s ease-out,
              opacity 0.2s ease-out,
              box-shadow 0.25s ease-out;
}

/* 带延迟 */
.modal {
  transition: opacity 0.3s ease-out 0.1s,
              transform 0.3s ease-out 0s;
}
```

### 1.2 哪些属性可以过渡

可过渡属性需要满足：**值可以在两个状态之间线性插值**。

```css
/* 可过渡：数值类型 */
transform: scale(1) → scale(1.2)       /* 数值 */
opacity: 0 → 1                         /* 数值 */
width: 100px → 200px                   /* 长度 */
height: 0 → 300px                      /* 长度 */
margin: 10px → 20px                    /* 长度 */
background-color: #fff → #000          /* 颜色 */
border-radius: 0 → 50%                /* 百分比 */
font-size: 14px → 18px                /* 长度 */
box-shadow: 0 2px 4px → 0 8px 24px    /* 阴影 */

/* 不可过渡：离散值 */
display: none → block                  /* 离散值 */
font-family: Arial → Helvetica         /* 字符串 */
visibility: 可过渡但行为特殊            /* 阶跃式切换 */
```

**visibility 的特殊行为**：`visibility` 可以过渡，但不是渐变——它在动画结束时瞬间切换。常与 `opacity` 配合实现"淡出后隐藏"：

```css
.tooltip {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0.3s;
}
.tooltip.visible {
  opacity: 1;
  visibility: visible;
}
```

### 1.3 避免 transition: all

```css
/* 差：任何属性变化都触发过渡，包括非预期的属性 */
.button { transition: all 0.2s ease-out; }

/* 好：明确指定属性，只过渡需要的属性 */
.button {
  transition-property: background-color, transform, box-shadow;
  transition-duration: 0.2s;
  transition-timing-function: ease-out;
}
```

**为什么避免 `all`？**
1. 性能浪费：浏览器需要检查所有可过渡属性
2. 意外副作用：修改 `font-size` 也会触发过渡
3. 调试困难：难以追踪哪些属性正在过渡

### 1.4 Transition 触发条件

`transition` 需要状态变化才能触发。常见触发方式：

```css
/* 伪类触发 */
.button {
  background: #3498db;
  transition: background-color 0.2s;
}
.button:hover {
  background: #2980b9;
}

/* class 切换（JS 控制） */
.modal {
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.3s, transform 0.3s;
}
.modal.open {
  opacity: 1;
  transform: translateY(0);
}
```

```javascript
// JS 切换 class
document.querySelector('.modal').classList.add('open')

// 直接修改样式（也能触发 transition）
element.style.opacity = '1'
```

### 1.5 Transition 的局限

`transition` 只能在两个状态之间切换，无法定义中间状态。如果需要多步动画，应该用 `@keyframes`：

```css
/* 差：用 transition 模拟多步动画，需要多次 class 切换 */
.shake {
  transform: translateX(0);
  transition: transform 0.1s;
}
.shake.step1 { transform: translateX(-10px); }
.shake.step2 { transform: translateX(10px); }
.shake.step3 { transform: translateX(0); }

/* 好：用 @keyframes 一步到位 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}
.shake { animation: shake 0.3s ease-in-out; }
```

## 二、CSS Animation

### 2.1 @keyframes 定义关键帧

`@keyframes` 定义动画的中间状态，支持两种语法：

```css
/* from/to 语法（只有起止） */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 百分比语法（任意中间帧） */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* 复杂多帧动画 */
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); }
}
```

**省略起止帧**：如果省略 `0%` 或 `100%`，浏览器会使用元素的当前计算样式：

```css
/* 从当前状态开始，到 scale(1.2) 结束 */
@keyframes grow {
  to { transform: scale(1.2); }
}
```

### 2.2 animation 属性详解

`animation` 是一个简写属性，包含 8 个子属性：

```css
.spinner {
  animation-name: rotate;                    /* 关键帧名称 */
  animation-duration: 1s;                     /* 单次循环时长 */
  animation-timing-function: linear;          /* 缓动函数 */
  animation-delay: 0s;                        /* 开始前延迟 */
  animation-iteration-count: infinite;        /* 循环次数 */
  animation-direction: normal;                /* 播放方向 */
  animation-fill-mode: forwards;              /* 开始前/结束后状态 */
  animation-play-state: running;              /* 播放/暂停 */
}
```

**简写形式**：

```css
/* 顺序：name duration timing-function delay iteration-count direction fill-mode */
.spinner {
  animation: rotate 1s linear infinite;
}

.fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

.bounce {
  animation: bounce 0.6s ease-in-out 0.2s infinite alternate;
}
```

### 2.3 animation-direction 四种模式

- `normal`：0% → 100%，每次从头开始
- `reverse`：100% → 0%，反向播放
- `alternate`：0% → 100% → 0%，来回交替
- `alternate-reverse`：100% → 0% → 100%，反向交替

```css
/* 呼吸灯效果：用 alternate 实现平滑来回 */
@keyframes breathe {
  from { box-shadow: 0 0 5px rgba(52, 152, 219, 0.3); }
  to { box-shadow: 0 0 20px rgba(52, 152, 219, 0.8); }
}
.breathing-light {
  animation: breathe 2s ease-in-out infinite alternate;
}
```

### 2.4 animation-fill-mode

- `none`：动画前后不受关键帧影响（默认）
- `forwards`：动画结束后保持最后一帧状态
- `backwards`：延迟期间应用第一帧状态
- `both`：同时应用 forwards 和 backwards

```css
/* 元素入场动画：延迟期间就显示第一帧，结束后保持最后一帧 */
.fade-in {
  opacity: 0;
  animation: fadeIn 0.3s ease-out 0.5s both;
}
@keyframes fadeIn {
  to { opacity: 1; }
}
```

**fill-mode 的实际应用场景**：

```css
/* 场景 1：元素入场（最常用） */
.element-enter {
  animation: slideUp 0.4s ease-out forwards;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 场景 2：延迟入场（需要 backwards） */
.delayed-enter {
  animation: fadeIn 0.3s ease-out 1s both;
  /* both 确保延迟期间元素就不可见 */
}

/* 场景 3：循环动画（不需要 fill-mode） */
.spinner {
  animation: rotate 1s linear infinite;
  /* infinite 循环不需要 fill-mode */
}
```

### 2.5 animation-play-state

```css
/* 暂停和恢复动画 */
.spinner.paused {
  animation-play-state: paused;
}
```

```javascript
// JS 控制播放状态
const spinner = document.querySelector('.spinner')
spinner.classList.toggle('paused')

// 或者直接用 WAAPI 控制（更推荐）
const animation = spinner.getAnimations()[0]
animation.pause()
animation.play()
```

### 2.6 多动画叠加

一个元素可以同时应用多个动画，用逗号分隔：

```css
.animated-element {
  animation: fadeIn 0.3s ease-out forwards,
             slideUp 0.4s ease-out forwards,
             pulse 2s ease-in-out 0.5s infinite;
}
```

**叠加顺序**：后定义的动画优先级更高。如果多个动画同时修改同一个属性，后定义的会覆盖前面的。

```css
/* fadeIn 和 slideUp 都修改 opacity，slideUp 会覆盖 fadeIn 的 opacity */
.animated-element {
  animation: fadeIn 0.3s ease-out,   /* opacity: 0 → 1 */
             slideUp 0.4s ease-out;  /* 不修改 opacity，只修改 transform */
}
```

## 三、Transition vs Animation

| 特性 | Transition | Animation |
|------|-----------|-----------|
| 触发方式 | 需要状态变化 | 自动播放或 class |
| 关键帧 | 只有起止 | 任意多帧 |
| 循环 | 不支持 | infinite |
| 精细控制 | 较少 | direction/fill/play-state |
| 适用场景 | 悬停、聚焦 | 加载、入场、循环 |
| 性能 | 通常更好 | 复杂动画可能更重 |
| JS 交互 | 简单 | 支持暂停、反转等 |

**选择原则**：
- 两点之间的状态切换 → `transition`
- 多步、循环、自动播放 → `animation`
- 需要精确控制播放进度 → Web Animations API（下一课）

## 四、CSS 变量与动态动画

### 4.1 用 CSS 变量控制动画参数

CSS 变量（Custom Properties）可以让动画参数动态化：

```css
.dynamic-card {
  --hover-scale: 1.05;
  --hover-duration: 0.3s;
  --hover-easing: ease-out;

  transform: scale(1);
  transition: transform var(--hover-duration) var(--hover-easing);
}
.dynamic-card:hover {
  transform: scale(var(--hover-scale));
}
```

```html
<!-- 不同元素使用不同参数 -->
<div class="dynamic-card" style="--hover-scale: 1.1">卡片 1</div>
<div class="dynamic-card" style="--hover-scale: 1.03">卡片 2</div>
```

### 4.2 CSS 变量实现交错动画

```css
.stagger-list {
  list-style: none;
  padding: 0;
}
.stagger-list li {
  opacity: 0;
  transform: translateX(-30px);
  animation: slideIn 0.4s ease-out forwards;
  animation-delay: calc(var(--i) * 100ms);
}
@keyframes slideIn {
  to { opacity: 1; transform: translateX(0); }
}
```

```html
<ul class="stagger-list">
  <li style="--i: 0">项目一</li>
  <li style="--i: 1">项目二</li>
  <li style="--i: 2">项目三</li>
  <li style="--i: 3">项目四</li>
  <li style="--i: 4">项目五</li>
</ul>
```

### 4.3 JS 动态修改 CSS 变量

```javascript
// 通过 JS 动态调整动画参数
document.documentElement.style.setProperty('--hover-scale', '1.1')
document.documentElement.style.setProperty('--hover-duration', '0.5s')

// 响应式调整：屏幕越小，动画越快
function updateAnimationParams() {
  const width = window.innerWidth
  if (width < 768) {
    document.documentElement.style.setProperty('--animation-duration', '0.2s')
  } else {
    document.documentElement.style.setProperty('--animation-duration', '0.3s')
  }
}
window.addEventListener('resize', updateAnimationParams)
```

## 五、性能优化

### 5.1 渲染管线性能等级

```css
/* 只触发 Composite（最快） */
transform: translateX(100px);
opacity: 0.5;

/* 触发 Paint（中等） */
background-color: red;
box-shadow: 0 2px 4px rgba(0,0,0,0.2);
outline: 2px solid blue;

/* 触发 Layout（最慢） */
width: 200px;
height: 100px;
margin-left: 100px;
padding: 10px;
font-size: 16px;
border-width: 2px;
```

### 5.2 用 transform 替代 layout 属性

```css
/* 差：触发 Layout */
.mover {
  position: relative;
  left: 0;
  transition: left 0.3s;
}
.mover.active { left: 200px; }

/* 好：只触发 Composite */
.mover {
  transform: translateX(0);
  transition: transform 0.3s;
}
.mover.active { transform: translateX(200px); }
```

```css
/* 差：动画宽度触发 Layout */
.expandable {
  width: 100px;
  transition: width 0.3s;
}
.expandable.expanded { width: 300px; }

/* 好：用 scale 替代，只触发 Composite */
.expandable {
  transform: scaleX(1);
  transform-origin: left;
  transition: transform 0.3s;
}
.expandable.expanded { transform: scaleX(3); }
```

### 5.3 will-change 提示

`will-change` 告诉浏览器元素即将变化的属性，让它提前优化：

```css
/* 浏览器会为该元素创建独立的合成层 */
.animated-element {
  will-change: transform, opacity;
}
```

**注意事项**：
- 不要滥用，每个 `will-change` 都会创建额外的合成层，消耗内存
- 动画结束后移除 `will-change`
- 不要对大量元素使用

```css
/* 差：所有卡片都创建合成层 */
.card { will-change: transform; }

/* 好：只在需要时添加 */
.card.animating { will-change: transform; }
```

### 5.4 减少重绘区域

```css
/* 差：大面积重绘 */
.full-page-overlay {
  background: rgba(0,0,0,0.5);
  transition: opacity 0.3s;
}

/* 好：用 pointer-events 控制交互，opacity 控制可见性 */
.overlay {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  /* 使用独立的合成层 */
  will-change: opacity;
}
.overlay.visible {
  opacity: 1;
  pointer-events: auto;
}
```

## 六、实战案例

### 6.1 按钮悬停效果

```css
.button {
  background: #3498db;
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
  transition-property: transform, box-shadow, background-color;
  transition-duration: 0.2s;
  transition-timing-function: ease-out;
}
.button:hover {
  background: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
}
.button:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(52, 152, 219, 0.3);
  transition-duration: 0.1s; /* 按下时更快 */
}
```

### 6.2 加载动画合集

```css
/* 旋转加载 */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner { animation: spin 1s linear infinite; }

/* 脉冲加载 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.pulse { animation: pulse 1.5s ease-in-out infinite; }

/* 骨架屏闪烁 */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: shimmer 1.5s infinite;
}

/* 三点跳动 */
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
}
.dot { animation: bounce 0.6s ease-in-out infinite; }
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
```

### 6.3 模态框入场出场

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0.3s;
}
.modal-overlay.open {
  opacity: 1;
  visibility: visible;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  transform: translateY(20px) scale(0.95);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-overlay.open .modal-content {
  transform: translateY(0) scale(1);
}
```

### 6.4 列表项交错入场

```html
<div class="list-container">
  <div class="list-item" style="--i: 0">项目一</div>
  <div class="list-item" style="--i: 1">项目二</div>
  <div class="list-item" style="--i: 2">项目三</div>
  <div class="list-item" style="--i: 3">项目四</div>
  <div class="list-item" style="--i: 4">项目五</div>
</div>
<style>
.list-item {
  opacity: 0;
  transform: translateY(20px);
  animation: listItemEnter 0.4s ease-out forwards;
  animation-delay: calc(var(--i) * 80ms + 0.2s);
}
@keyframes listItemEnter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
```

## 常见误区

### 误区一：用 transition 做多步动画

多步动画应该用 `@keyframes`，`transition` 只适合两点之间的过渡。用 `transition` 模拟多步动画需要多次 class 切换，代码复杂且难以维护。

### 误区二：忘记 animation-fill-mode

动画结束后元素会跳回初始状态。`forwards` 保持最终状态，`both` 同时处理延迟期间和结束后的状态。

```css
/* 差：动画结束跳回 opacity: 0 */
.element { animation: fadeIn 0.3s; }

/* 好：保持最终状态 */
.element { animation: fadeIn 0.3s forwards; }
```

### 误区三：用 margin/left/top 做位移动画

这些属性触发 Layout，应用 `transform: translateX()` 或 `translateY()`。

### 误区四：动画期间修改 transition

```css
/* 差：hover 时修改 transition-duration 会导致闪烁 */
.button { transition: background 0.3s; }
.button:hover {
  transition: background 0.1s; /* 不要这样做 */
  background: red;
}
```

### 误区五：忽略动画结束事件

```javascript
// 监听 transition 结束
element.addEventListener('transitionend', (e) => {
  // e.propertyName 告诉你是哪个属性的过渡结束了
  if (e.propertyName === 'opacity') {
    element.classList.remove('animating')
  }
})

// 监听 animation 结束
element.addEventListener('animationend', (e) => {
  element.classList.remove('animating')
})
```

## 工程建议

1. **入场动画用 `animation`**。元素首次出现时没有旧状态，`transition` 无法触发。
2. **状态切换用 `transition`**。悬停、激活等交互反馈。
3. **始终指定 `transition-property`**。避免 `all` 的副作用。
4. **优先使用 `transform` 和 `opacity`**。GPU 合成层处理，不触发 Layout。
5. **使用 `prefers-reduced-motion`**。尊重用户偏好。
6. **用 CSS 变量统一管理动画参数**。便于全局调整和响应式适配。
7. **动画结束后清理 `will-change`**。避免不必要的内存消耗。
8. **用 Chrome DevTools 的 Animation 面板调试**。可以慢放、暂停和检查动画。

## 小结

- `transition` 适合两点间的状态过渡，由状态变化触发
- `animation` + `@keyframes` 适合多步、循环和自动播放的动画
- `animation-fill-mode: forwards` 防止动画结束跳回
- CSS 变量可以让动画参数动态化，实现交错和响应式动画
- 性能核心：只动画 `transform` 和 `opacity`，避免触发 Layout
- `will-change` 可以提示浏览器优化，但不要滥用

## 练习

### 练习一：卡片悬停效果

实现卡片悬停时同时发生：阴影扩大、上移 4px、边框变色。使用 `transition`，不使用 `all`。

### 练习二：三点跳动加载

用 `@keyframes` 实现三个点依次上下跳动的加载动画，无限循环。

### 练习三：列表交错入场

为 5 个列表项实现交错入场：每项从左侧滑入并淡入，延迟 100ms。用单个 `@keyframes` 和 CSS 变量实现。

### 练习四：呼吸灯效果

实现一个圆形元素的呼吸灯效果：背景色和阴影在两个状态之间平滑过渡，使用 `animation` 和 `alternate` 方向。

### 练习五：模态框入场出场

实现一个模态框组件，点击按钮打开，点击遮罩层关闭。入场时遮罩层淡入 + 内容区从下方滑入，出场时反向。使用 `transition` 实现。

---

## 参考答案

### 练习一

```css
.card {
  background: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transform: translateY(0);
  transition-property: transform, box-shadow, border-color;
  transition-duration: 0.25s;
  transition-timing-function: ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  border-color: #3498db;
}
```

**要点**：明确指定三个过渡属性，避免 `all`。`ease-out` 缓动让悬停反馈更自然。`transform: translateY(-4px)` 比 `margin-top` 性能更好。

### 练习二

```html
<div class="loader">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>
<style>
.loader { display: flex; gap: 6px; align-items: center; }
.dot {
  width: 8px; height: 8px; border-radius: 50%; background: #3498db;
  animation: bounce 0.6s ease-in-out infinite alternate;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}
</style>
```

**要点**：`alternate` 让动画来回平滑。`nth-child` 设置不同延迟实现错位。`ease-in-out` 让两端减速更自然。

### 练习三

```html
<ul class="list">
  <li style="--i: 0">项目一</li>
  <li style="--i: 1">项目二</li>
  <li style="--i: 2">项目三</li>
  <li style="--i: 3">项目四</li>
  <li style="--i: 4">项目五</li>
</ul>
<style>
.list { list-style: none; padding: 0; }
.list li {
  opacity: 0;
  transform: translateX(-30px);
  animation: slideIn 0.4s ease-out forwards;
  animation-delay: calc(var(--i) * 100ms);
}
@keyframes slideIn {
  to { opacity: 1; transform: translateX(0); }
}
</style>
```

**要点**：CSS 变量 `--i` 控制每个元素的延迟。`calc(var(--i) * 100ms)` 计算实际延迟时间。`forwards` 确保动画结束后保持可见状态。

### 练习四

```html
<div class="breathing-light"></div>
<style>
.breathing-light {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #3498db;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
  animation: breathe 2s ease-in-out infinite alternate;
}
@keyframes breathe {
  from {
    background: #3498db;
    box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
  }
  to {
    background: #5dade2;
    box-shadow: 0 0 30px rgba(52, 152, 219, 0.8);
  }
}
</style>
```

**要点**：`alternate` 让动画来回平滑过渡，不需要定义 0% → 100% → 0% 的完整关键帧。同时动画 `background` 和 `box-shadow` 创造更真实的呼吸效果。

### 练习五

```html
<button class="open-btn" onclick="openModal()">打开弹窗</button>
<div class="modal-overlay" onclick="closeModal(event)">
  <div class="modal-content">
    <h2>标题</h2>
    <p>内容</p>
    <button onclick="closeModal(event)">关闭</button>
  </div>
</div>
<style>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0.3s;
}
.modal-overlay.open {
  opacity: 1;
  visibility: visible;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  transform: translateY(20px);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-overlay.open .modal-content {
  transform: translateY(0);
}
</style>
<script>
function openModal() {
  document.querySelector('.modal-overlay').classList.add('open')
}
function closeModal(e) {
  if (e.target === e.currentTarget || e.target.tagName === 'BUTTON') {
    document.querySelector('.modal-overlay').classList.remove('open')
  }
}
</script>
```

**要点**：`visibility` 与 `opacity` 配合实现"淡出后隐藏"。内容区使用弹性缓动 `cubic-bezier(0.34, 1.56, 0.64, 1)` 创造活泼的入场效果。点击遮罩层和按钮都能关闭，通过事件目标判断。

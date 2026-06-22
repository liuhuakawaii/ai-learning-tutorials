# 第六课：阶段实战——10 个经典 CSS 动画

## 场景引入

前五课我们学习了动画原理、CSS Transition/Animation、WAAPI、rAF 和缓动函数。本课综合运用这些知识，实现 10 个真实项目中常见的 CSS 动画效果。每个动画都是独立可用的组件，可直接复制到项目中。

这些动画覆盖了前端开发中最常见的交互场景：加载状态、导航反馈、内容展示、数据可视化、用户引导。掌握它们，你就拥有了应对 90% 动画需求的能力。

## 学习目标

- 综合运用 CSS 动画知识实现真实场景效果
- 掌握常见 UI 动画的实现思路和代码模式
- 学会分析动画需求并拆解为技术方案
- 了解每个动画的性能优化要点
- 掌握动画的无障碍适配方案

## 一、脉冲呼吸灯

**场景**：在线状态指示器、通知提醒、新消息提示。

```css
.pulse-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2ecc71;
  position: relative;
}
.pulse-dot::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: rgba(46, 204, 113, 0.4);
  animation: pulse 2s ease-out infinite;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}
```

**实现思路**：用 `::before` 伪元素创建一个比原点大的半透明圆，通过 `scale` 放大并 `opacity` 淡出，模拟声波扩散效果。`ease-out` 缓动让扩散速度逐渐减慢，更接近真实波纹。

**进阶：双层脉冲**

```css
.pulse-dot-double {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e74c3c;
  position: relative;
}
.pulse-dot-double::before,
.pulse-dot-double::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: rgba(231, 76, 60, 0.4);
  animation: pulse 2s ease-out infinite;
}
.pulse-dot-double::after {
  animation-delay: 0.6s;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}
```

双层脉冲通过错开 `animation-delay` 产生连续波纹效果，更适合强调紧急通知。

## 二、骨架屏闪烁

**场景**：内容加载占位符、列表加载、卡片加载。

```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
```

**实现思路**：用渐变背景模拟"光束扫过"效果。`background-size: 400%` 让渐变比元素宽 4 倍，通过移动 `background-position` 让高光区域从右向左移动。`1.4s` 的时长不会太快（显得焦虑）也不会太慢（显得卡顿）。

**进阶：完整的文章卡片骨架屏**

```html
<div class="card-skeleton">
  <div class="skeleton skeleton-avatar"></div>
  <div class="skeleton skeleton-title"></div>
  <div class="skeleton skeleton-text"></div>
  <div class="skeleton skeleton-text" style="width: 80%"></div>
</div>

<style>
.card-skeleton {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.skeleton-title {
  width: 60%;
  height: 20px;
  margin-top: 12px;
  border-radius: 4px;
}
.skeleton-text {
  width: 100%;
  height: 14px;
  margin-top: 8px;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
</style>
```

## 三、汉堡菜单变叉号

**场景**：移动端导航菜单切换按钮。

```css
.hamburger {
  width: 24px;
  height: 18px;
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: #333;
  border-radius: 1px;
  transition: transform 0.3s ease, opacity 0.2s ease;
}
.hamburger.active span:nth-child(1) {
  transform: translateY(8px) rotate(45deg);
}
.hamburger.active span:nth-child(2) {
  opacity: 0;
}
.hamburger.active span:nth-child(3) {
  transform: translateY(-8px) rotate(-45deg);
}
```

**实现思路**：三条横线通过 `translateY` 移动到中间位置，然后旋转形成 X。中间的线直接淡出。关键计算：三条线间距是 `(18 - 2*3) / 2 = 6px`，所以每条线需要移动 `8px`（6px + 2px 线宽的一半）才能对齐到中间。

**完整 HTML 示例**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  .hamburger {
    width: 30px; height: 24px;
    position: relative; cursor: pointer;
    display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 4px;
    border-radius: 4px;
  }
  .hamburger:hover { background: rgba(0,0,0,0.05); }
  .hamburger span {
    display: block; width: 100%; height: 2px;
    background: #333; border-radius: 1px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.2s ease;
    transform-origin: center;
  }
  .hamburger.active span:nth-child(1) {
    transform: translateY(10px) rotate(45deg);
  }
  .hamburger.active span:nth-child(2) {
    opacity: 0;
  }
  .hamburger.active span:nth-child(3) {
    transform: translateY(-10px) rotate(-45deg);
  }
</style>
</head>
<body>
<div class="hamburger" id="hamburger">
  <span></span><span></span><span></span>
</div>
<script>
document.getElementById('hamburger').addEventListener('click', function() {
  this.classList.toggle('active')
})
</script>
</body>
</html>
```

**注意**：使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 让旋转有弹性过冲，增加趣味性。

## 四、波纹点击效果

**场景**：Material Design 风格按钮、触摸反馈。

```css
.ripple-btn {
  position: relative;
  overflow: hidden;
  padding: 12px 24px;
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.ripple-btn::after {
  content: '';
  position: absolute;
  width: 100%;
  padding-top: 100%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0);
  opacity: 1;
  pointer-events: none;
}
.ripple-btn.animate::after {
  animation: ripple 0.6s ease-out;
}
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}
```

```javascript
document.querySelector('.ripple-btn').addEventListener('click', function(e) {
  const rect = this.getBoundingClientRect()
  this.style.setProperty('--x', (e.clientX - rect.left) + 'px')
  this.style.setProperty('--y', (e.clientY - rect.top) + 'px')
  this.classList.remove('animate')
  void this.offsetWidth // 强制重排，重启动画
  this.classList.add('animate')
})
```

**进阶：精确定位波纹起点**

```css
.ripple-btn-v2::after {
  content: '';
  position: absolute;
  width: 200%;
  padding-top: 200%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%) scale(0);
  left: var(--x);
  top: var(--y);
  opacity: 1;
  pointer-events: none;
}
.ripple-btn-v2.animate::after {
  animation: ripple-v2 0.6s ease-out;
}
@keyframes ripple-v2 {
  to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
```

这个版本的波纹从点击位置精确扩散，而不是从按钮中心扩散。

## 五、打字机效果

**场景**：终端风格展示、标题动画、引导文案。

```css
.typewriter {
  display: inline-block;
  overflow: hidden;
  border-right: 2px solid #333;
  white-space: nowrap;
  width: 0;
  animation:
    typing 3s steps(20) forwards,
    blink 0.7s step-end infinite;
}
@keyframes typing { to { width: 20ch; } }
@keyframes blink { 50% { border-color: transparent; } }
```

**实现思路**：`steps(20)` 将宽度变化分成 20 步，每步显示一个字符（假设等宽字体）。`ch` 单位表示字符宽度，`20ch` 就是 20 个字符的宽度。光标闪烁用 `border-right` 的颜色切换实现。

**进阶：多行打字机**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  .terminal {
    background: #1a1a2e;
    color: #0f0;
    font-family: 'Courier New', monospace;
    padding: 20px;
    border-radius: 8px;
    max-width: 500px;
  }
  .line {
    overflow: hidden;
    white-space: nowrap;
    border-right: 2px solid #0f0;
    width: 0;
    margin: 4px 0;
  }
  .line.done {
    border-right: none;
    width: auto;
  }
  .cursor-blink {
    animation: blink 0.7s step-end infinite;
  }
  @keyframes blink { 50% { border-color: transparent; } }
</style>
</head>
<body>
<div class="terminal" id="terminal"></div>

<script>
async function typeLine(container, text, speed = 50) {
  const line = document.createElement('div')
  line.className = 'line cursor-blink'
  container.appendChild(line)

  for (let i = 0; i < text.length; i++) {
    line.textContent += text[i]
    await new Promise(r => setTimeout(r, speed))
  }

  line.classList.remove('cursor-blink')
  line.classList.add('done')
}

async function runTerminal() {
  const terminal = document.getElementById('terminal')
  const lines = [
    '$ npm install animation-kit',
    '✓ 已安装 3 个依赖',
    '$ npm run build',
    '✓ 构建完成，用时 1.2s',
    '$ 启动动画引擎...'
  ]

  for (const line of lines) {
    await typeLine(terminal, line, 40)
    await new Promise(r => setTimeout(r, 300))
  }
}

runTerminal()
</script>
</body>
</html>
```

## 六、卡片 3D 翻转

**场景**：产品卡片正反面展示、记忆翻牌游戏、详情预览。

```css
.flip-card {
  width: 300px;
  height: 200px;
  perspective: 1000px;
}
.flip-card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.6s ease;
  transform-style: preserve-3d;
}
.flip-card:hover .flip-card-inner {
  transform: rotateY(180deg);
}
.flip-card-front,
.flip-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.flip-card-front {
  background: #3498db;
  color: #fff;
}
.flip-card-back {
  background: #2c3e50;
  color: #fff;
  transform: rotateY(180deg);
}
```

**关键属性解析**：
- `perspective: 1000px`：定义 3D 空间的"景深"。值越小，3D 效果越夸张；值越大，越接近正交投影。
- `transform-style: preserve-3d`：让子元素保持在 3D 空间中，而不是被"拍扁"到 2D。
- `backface-visibility: hidden`：隐藏元素的背面。当卡片旋转 180° 时，正面被隐藏，反面可见。

**完整 HTML 示例**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; gap: 24px;
    align-items: center; justify-content: center;
    min-height: 100vh; background: #f0f2f5;
  }
  .flip-card {
    width: 280px; height: 180px;
    perspective: 800px; cursor: pointer;
  }
  .flip-card-inner {
    width: 100%; height: 100%; position: relative;
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-style: preserve-3d;
  }
  .flip-card.flipped .flip-card-inner {
    transform: rotateY(180deg);
  }
  .flip-card-front, .flip-card-back {
    position: absolute; inset: 0;
    backface-visibility: hidden;
    border-radius: 12px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .flip-card-front {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
  }
  .flip-card-back {
    background: linear-gradient(135deg, #f093fb, #f5576c);
    color: #fff;
    transform: rotateY(180deg);
  }
  .flip-card h3 { margin: 0 0 8px; }
  .flip-card p { margin: 0; opacity: 0.9; font-size: 14px; }
</style>
</head>
<body>
<div class="flip-card" onclick="this.classList.toggle('flipped')">
  <div class="flip-card-inner">
    <div class="flip-card-front">
      <h3>前端工程师</h3>
      <p>点击查看技能</p>
    </div>
    <div class="flip-card-back">
      <h3>核心技能</h3>
      <p>HTML / CSS / JS / React / Vue</p>
    </div>
  </div>
</div>
</body>
</html>
```

## 七、列表交错入场

**场景**：列表加载动画、菜单展开、通知堆叠。

```css
.stagger-list {
  list-style: none;
  padding: 0;
}
.stagger-list li {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.4s ease-out forwards;
}
.stagger-list li:nth-child(1) { animation-delay: 0ms; }
.stagger-list li:nth-child(2) { animation-delay: 80ms; }
.stagger-list li:nth-child(3) { animation-delay: 160ms; }
.stagger-list li:nth-child(4) { animation-delay: 240ms; }
.stagger-list li:nth-child(5) { animation-delay: 320ms; }
@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(0); }
}
```

**进阶：用 CSS 自定义属性动态设置延迟**

```css
.stagger-list-dynamic li {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.4s ease-out forwards;
  animation-delay: calc(var(--index) * 80ms);
}
```

```javascript
document.querySelectorAll('.stagger-list-dynamic li').forEach((li, i) => {
  li.style.setProperty('--index', i)
})
```

这样不需要为每个子元素写 `nth-child` 规则，列表项数量可变。

**进阶：交错入场 + 交错出场**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh; background: #f0f2f5;
    font-family: -apple-system, sans-serif;
  }
  .list-container {
    width: 300px; background: #fff;
    border-radius: 8px; padding: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .list-item {
    padding: 12px 16px;
    margin: 4px 0;
    background: #f8f9fa;
    border-radius: 6px;
    opacity: 0;
    transform: translateX(-20px);
    animation: slideIn 0.3s ease-out forwards;
  }
  .list-item.exit {
    animation: slideOut 0.2s ease-in forwards;
  }
  @keyframes slideIn {
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOut {
    to { opacity: 0; transform: translateX(20px); height: 0; padding: 0; margin: 0; }
  }
  button {
    margin-top: 16px; padding: 10px 24px;
    border: none; border-radius: 6px;
    background: #e74c3c; color: #fff;
    cursor: pointer; font-size: 14px;
  }
</style>
</head>
<body>
<div class="list-container" id="list">
  <div class="list-item" style="--delay: 0ms">任务一：设计数据库</div>
  <div class="list-item" style="--delay: 80ms">任务二：实现 API</div>
  <div class="list-item" style="--delay: 160ms">任务三：前端对接</div>
  <div class="list-item" style="--delay: 240ms">任务四：测试验收</div>
  <div class="list-item" style="--delay: 320ms">任务五：部署上线</div>
</div>
<button id="clearBtn">清空列表</button>

<script>
document.querySelectorAll('.list-item').forEach((item, i) => {
  item.style.animationDelay = `${i * 80}ms`
})

document.getElementById('clearBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.list-item:not(.exit)')
  items.forEach((item, i) => {
    setTimeout(() => {
      item.classList.add('exit')
    }, i * 60)
  })
})
</script>
</body>
</html>
```

## 八、进度环

**场景**：文件上传进度、技能等级展示、健康数据展示。

```css
.progress-ring {
  width: 100px;
  height: 100px;
  transform: rotate(-90deg);
}
.progress-ring circle {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
}
.progress-ring .bg { stroke: #eee; }
.progress-ring .fill {
  stroke: #3498db;
  stroke-dasharray: 283;
  stroke-dashoffset: 283;
  transition: stroke-dashoffset 1s ease-out;
}
```

```javascript
function setProgress(percent) {
  const circle = document.querySelector('.progress-ring .fill')
  const circumference = 2 * Math.PI * 45 // r=45
  circle.style.strokeDashoffset = circumference - (percent / 100) * circumference
}
```

**原理**：`stroke-dasharray` 设置虚线模式（283 = 圆周长），`stroke-dashoffset` 控制虚线的偏移量。偏移量等于圆周长时完全不可见，偏移量为 0 时完全可见。

**完整 HTML 示例**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; gap: 40px;
    align-items: center; justify-content: center;
    min-height: 100vh; background: #f0f2f5;
  }
  .ring-container {
    position: relative; width: 120px; height: 120px;
  }
  .progress-ring {
    width: 120px; height: 120px;
    transform: rotate(-90deg);
  }
  .progress-ring circle {
    fill: none; stroke-width: 8; stroke-linecap: round;
  }
  .progress-ring .bg { stroke: #e8e8e8; }
  .progress-ring .fill {
    stroke: #3498db;
    stroke-dasharray: 283;
    stroke-dashoffset: 283;
    transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ring-text {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: bold; color: #2c3e50;
  }
</style>
</head>
<body>
<div class="ring-container">
  <svg class="progress-ring" viewBox="0 0 120 120">
    <circle class="bg" cx="60" cy="60" r="45" />
    <circle class="fill" cx="60" cy="60" r="45" id="ring" />
  </svg>
  <div class="ring-text" id="ringText">0%</div>
</div>

<script>
function setProgress(percent) {
  const circle = document.getElementById('ring')
  const text = document.getElementById('ringText')
  const circumference = 2 * Math.PI * 45
  circle.style.strokeDashoffset = circumference - (percent / 100) * circumference
  text.textContent = `${percent}%`
}

// 模拟进度增长
let progress = 0
const interval = setInterval(() => {
  progress += Math.random() * 15
  if (progress >= 100) {
    progress = 100
    clearInterval(interval)
  }
  setProgress(Math.round(progress))
}, 300)
</script>
</body>
</html>
```

## 九、悬浮卡片阴影

**场景**：产品卡片、列表项、可点击内容区域。

```css
.float-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.float-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.07),
    0 12px 24px rgba(0, 0, 0, 0.1);
}
```

**实现思路**：悬浮时卡片向上移动 4px，同时阴影变大变深。多层阴影（`0 4px 6px` + `0 12px 24px`）模拟真实的投影效果——近处阴影小而深，远处阴影大而淡。

**进阶：带倾斜的 3D 卡片**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; gap: 24px;
    align-items: center; justify-content: center;
    min-height: 100vh; background: #f0f2f5;
  }
  .tilt-card {
    width: 250px; height: 160px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 12px; padding: 24px;
    color: #fff; cursor: pointer;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    transform-style: preserve-3d;
    perspective: 800px;
  }
  .tilt-card:hover {
    transform: perspective(800px) rotateX(5deg) rotateY(-5deg) translateY(-8px);
    box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);
  }
  .tilt-card h3 {
    margin: 0 0 8px;
    transform: translateZ(20px);
  }
  .tilt-card p {
    margin: 0; opacity: 0.9;
    transform: translateZ(10px);
  }
</style>
</head>
<body>
<div class="tilt-card">
  <h3>3D 倾斜卡片</h3>
  <p>鼠标悬浮查看效果</p>
</div>
</body>
</html>
```

## 十、加载旋转器

**场景**：按钮加载状态、页面加载、数据请求中。

```css
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #eee;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**进阶：三种常见旋转器变体**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; gap: 40px;
    align-items: center; justify-content: center;
    min-height: 100vh; background: #f0f2f5;
  }
  .spinner-group { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .label { font-size: 12px; color: #666; }

  /* 变体 1：经典旋转 */
  .spinner-1 {
    width: 40px; height: 40px;
    border: 3px solid #eee; border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* 变体 2：三点跳动 */
  .spinner-2 { display: flex; gap: 6px; }
  .spinner-2 span {
    width: 10px; height: 10px;
    background: #e74c3c; border-radius: 50%;
    animation: bounce 0.6s ease-in-out infinite;
  }
  .spinner-2 span:nth-child(2) { animation-delay: 0.1s; }
  .spinner-2 span:nth-child(3) { animation-delay: 0.2s; }

  /* 变体 3：脉冲圆环 */
  .spinner-3 {
    width: 40px; height: 40px;
    border: 3px solid #3498db; border-radius: 50%;
    animation: pulseSpin 1.2s ease-in-out infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }
  @keyframes pulseSpin {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(1.2); opacity: 0; }
  }
</style>
</head>
<body>
<div class="spinner-group">
  <div class="spinner-1"></div>
  <div class="label">经典旋转</div>
</div>
<div class="spinner-group">
  <div class="spinner-2"><span></span><span></span><span></span></div>
  <div class="label">三点跳动</div>
</div>
<div class="spinner-group">
  <div class="spinner-3"></div>
  <div class="label">脉冲圆环</div>
</div>
</body>
</html>
```

## 十一、综合实战：动画通知组件

将前面学到的多个动画组合成一个实用的通知组件：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body { margin: 0; font-family: -apple-system, sans-serif; }
  .notification-container {
    position: fixed; top: 20px; right: 20px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 9999;
  }
  .notification {
    padding: 14px 20px;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    min-width: 250px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateX(120%);
    animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    display: flex; align-items: center; gap: 10px;
  }
  .notification.exit {
    animation: slideOutRight 0.3s ease-in forwards;
  }
  .notification.success { background: #2ecc71; }
  .notification.error { background: #e74c3c; }
  .notification.info { background: #3498db; }
  .notification-icon { font-size: 18px; }
  @keyframes slideInRight {
    to { transform: translateX(0); }
  }
  @keyframes slideOutRight {
    to { transform: translateX(120%); opacity: 0; }
  }
  button {
    margin: 20px; padding: 10px 20px;
    border: none; border-radius: 6px;
    cursor: pointer; font-size: 14px;
    color: #fff;
  }
  .btn-success { background: #2ecc71; }
  .btn-error { background: #e74c3c; }
  .btn-info { background: #3498db; }
</style>
</head>
<body>
<button class="btn-success" onclick="notify('success', '操作成功！')">成功通知</button>
<button class="btn-error" onclick="notify('error', '发生错误！')">错误通知</button>
<button class="btn-info" onclick="notify('info', '这是一条信息')">信息通知</button>

<div class="notification-container" id="container"></div>

<script>
const icons = { success: '✓', error: '✗', info: 'ℹ' }

function notify(type, message) {
  const container = document.getElementById('container')
  const el = document.createElement('div')
  el.className = `notification ${type}`
  el.innerHTML = `<span class="notification-icon">${icons[type]}</span><span>${message}</span>`
  container.appendChild(el)

  setTimeout(() => {
    el.classList.add('exit')
    el.addEventListener('animationend', () => el.remove())
  }, 3000)
}
</script>
</body>
</html>
```

## 常见误区

### 误区一：不做动画降级

用 `prefers-reduced-motion` 提供无动画版本：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 误区二：动画时长随意设置

微交互 150-200ms，状态切换 200-300ms，页面转场 300-500ms。太短用户感知不到，太长用户觉得卡顿。

### 误区三：忽略硬件加速

用 `transform` 代替 `left/top/margin`，用 `opacity` 代替 `visibility`。`transform` 和 `opacity` 只触发 Composite，不触发 Layout 和 Paint。

### 误区四：动画完成后不清理

`animation-fill-mode: forwards` 会保留最终状态的样式，但更好的做法是动画结束后用 JS 设置最终状态并移除动画类。

### 误区五：在移动端使用过多动画

低端安卓设备的 GPU 性能有限，过多动画会导致掉帧和发热。移动端应减少同时运行的动画数量。

## 工程建议

1. **将动画封装为可复用的 CSS 类**。如 `.fade-in`、`.slide-up`，通过组合类名实现效果。
2. **用 CSS 自定义属性参数化**。`--duration`、`--delay` 让动画可配置，不需要修改 CSS。
3. **为动画添加 `will-change` 提示**。仅在动画即将开始时添加，动画结束后移除，不要全局使用。
4. **测试低端设备表现**。Chrome DevTools 的 Performance 面板可模拟 CPU 节流。
5. **使用 `transform` 和 `opacity` 做动画**。这两个属性不会触发重排和重绘。
6. **提供 `prefers-reduced-motion` 降级**。这是无障碍的基本要求。
7. **避免动画阻塞用户操作**。加载动画不应该阻止用户点击其他按钮。
8. **用 `animationend` 事件做动画后的逻辑**。不要用 `setTimeout` 猜测动画时长。

## 小结

- 10 个动画覆盖指示器、骨架屏、导航、按钮、文字、卡片、列表、进度、阴影、加载场景
- CSS 动画核心：`transform` + `opacity` 做高性能动画，`@keyframes` 做多步，`transition` 做状态切换
- 动画应有明确语义和合理时长，不同场景选择不同的缓动函数
- 用 `prefers-reduced-motion` 提供降级方案
- CSS 自定义属性让动画参数化，提高复用性
- 组合多个基础动画可以构建复杂的交互组件

## 练习

### 练习一：组合动画

将"脉冲呼吸灯"和"加载旋转器"组合：外圈脉冲扩散，内圈旋转。两个动画独立运行。

要求：
- 外圈用 `::before` 伪元素实现脉冲
- 内圈用 `border` 实现旋转
- 两个动画互不干扰
- 提供完整的 HTML 示例

### 练习二：自适应骨架屏

实现文章卡片骨架屏（圆形头像、矩形标题、三行正文），加载完成后淡出显示真实内容。

要求：
- 骨架屏包含头像、标题、正文三个区域
- 加载完成后骨架屏淡出，真实内容淡入
- 用 `animationend` 事件处理动画结束
- 提供完整的 HTML 示例

### 练习三：动画工具函数

实现 `animateClass(element, className, duration)`，添加动画类，结束后自动移除，返回 Promise。

要求：
- 解决重复添加同一类名不触发动画的问题
- 有安全超时防止 Promise 永远 pending
- 支持 `await` 链式调用
- 提供完整的使用示例

### 练习四：Tab 切换动画

实现一个带动画的 Tab 切换组件：点击 Tab 标签切换内容，内容有滑入/滑出效果。

要求：
- Tab 标签有下划线指示器，切换时带滑动动画
- 内容区域切换时有淡入淡出效果
- 支持键盘左右方向键切换
- 提供完整的 HTML 示例

### 练习五：动画队列管理

实现一个动画队列管理器：可以添加多个动画到队列中，按顺序执行，支持暂停和取消。

要求：
- `enqueue(animationFn)` 添加动画到队列
- `pause()` 暂停当前动画
- `resume()` 恢复执行
- `cancel()` 取消所有待执行动画
- 提供完整的使用示例

---

## 参考答案

### 练习一

**思路**：外圈脉冲用 `::before` 伪元素实现（scale + opacity），内圈旋转用 `border` + `rotate` 实现。两个动画分别在不同元素上，互不干扰。`z-index` 确保旋转器在脉冲上方。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; align-items: center;
    justify-content: center; min-height: 100vh;
    background: #f0f2f5;
  }
  .loading-indicator {
    width: 60px; height: 60px;
    position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .pulse-ring {
    position: absolute; inset: 0;
    border-radius: 50%;
    background: rgba(52, 152, 219, 0.2);
    animation: pulseExpand 2s ease-out infinite;
  }
  .spinner-inner {
    width: 28px; height: 28px;
    border: 3px solid rgba(52, 152, 219, 0.3);
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    z-index: 1;
  }
  @keyframes pulseExpand {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
</head>
<body>
<div class="loading-indicator">
  <div class="pulse-ring"></div>
  <div class="spinner-inner"></div>
</div>
</body>
</html>
```

**要点**：
- 脉冲和旋转分别在不同元素上，动画互不影响
- `z-index: 1` 确保旋转器始终在脉冲上方
- `ease-out` 让脉冲扩散速度逐渐减慢，更自然

### 练习二

**思路**：骨架屏和真实内容分别在两个容器中。加载完成后给骨架屏添加 `fade-out` 类，监听 `animationend` 事件，动画结束后隐藏骨架屏、显示真实内容。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; align-items: center;
    justify-content: center; min-height: 100vh;
    background: #f0f2f5; font-family: -apple-system, sans-serif;
  }
  .card {
    width: 320px; background: #fff;
    border-radius: 12px; padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    position: relative;
  }
  .skeleton-content .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }
  .skeleton-avatar { width: 48px; height: 48px; border-radius: 50%; }
  .skeleton-title { width: 60%; height: 20px; margin-top: 12px; border-radius: 4px; }
  .skeleton-text { width: 100%; height: 14px; margin-top: 8px; border-radius: 4px; }
  @keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  .skeleton-content.fade-out { animation: fadeOut 0.3s ease forwards; }
  .real-content { display: none; }
  .real-content.fade-in { animation: fadeIn 0.3s ease forwards; }
  @keyframes fadeOut { to { opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .real-avatar {
    width: 48px; height: 48px; border-radius: 50%;
    background: #3498db;
  }
  .real-title { font-size: 18px; font-weight: 600; margin-top: 12px; }
  .real-text { font-size: 14px; color: #666; margin-top: 8px; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="skeleton-content" id="skeleton">
    <div class="skeleton skeleton-avatar"></div>
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text" style="width: 80%"></div>
  </div>
  <div class="real-content" id="realContent">
    <div class="real-avatar"></div>
    <div class="real-title">文章标题</div>
    <div class="real-text">这是一段真实的正文内容。骨架屏加载完成后，会淡出并显示这段内容。</div>
  </div>
</div>

<script>
async function loadCard() {
  const skeleton = document.getElementById('skeleton')
  const real = document.getElementById('realContent')

  // 模拟加载
  await new Promise(r => setTimeout(r, 2000))

  // 骨架屏淡出
  skeleton.classList.add('fade-out')
  await new Promise(r => {
    skeleton.addEventListener('animationend', r, { once: true })
  })

  // 切换显示
  skeleton.style.display = 'none'
  real.style.display = 'block'
  real.classList.add('fade-in')
}

loadCard()
</script>
</body>
</html>
```

**要点**：
- `animationend` 事件在动画结束后触发，比 `setTimeout` 更可靠
- `{ once: true }` 确保事件监听器自动移除，防止内存泄漏
- 使用 `async/await` 让代码逻辑更清晰

### 练习三

**思路**：用 `void element.offsetWidth` 强制重排解决重复添加同一类名不触发动画的问题。用 `animationend` 事件检测动画结束，同时设置安全超时防止事件未触发时 Promise 永远 pending。

**答案**：

```javascript
function animateClass(element, className, duration) {
  return new Promise(resolve => {
    // 移除再添加，解决重复触发动画的问题
    element.classList.remove(className)
    void element.offsetWidth // 强制重排，重置动画状态
    element.classList.add(className)

    let resolved = false
    function done() {
      if (resolved) return
      resolved = true
      element.classList.remove(className)
      element.removeEventListener('animationend', onEnd)
      resolve()
    }

    function onEnd(e) {
      // 确保是目标动画结束
      if (e.target === element) done()
    }

    element.addEventListener('animationend', onEnd)

    // 安全超时：防止 animationend 未触发
    setTimeout(done, duration + 100)
  })
}

// 使用示例
async function showNotification(el) {
  el.textContent = '操作成功！'
  await animateClass(el, 'slide-in', 400)
  await new Promise(r => setTimeout(r, 2000))
  await animateClass(el, 'slide-out', 300)
  el.textContent = ''
}
```

**要点**：
- `void element.offsetWidth` 强制浏览器同步计算布局，重置动画状态
- `resolved` 标志防止 `animationend` 和 `setTimeout` 都触发时的重复调用
- `e.target === element` 确保是目标元素的动画结束，而不是子元素的

### 练习四

**思路**：Tab 标签下划线用 `transform: scaleX()` + `translateX()` 实现滑动动画。内容区域用 `opacity` + `transform` 实现淡入淡出。键盘事件监听 `keydown`，方向键切换 Tab。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body {
    margin: 0; display: flex; align-items: center;
    justify-content: center; min-height: 100vh;
    background: #f0f2f5; font-family: -apple-system, sans-serif;
  }
  .tabs {
    width: 400px; background: #fff;
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }
  .tab-header {
    display: flex; position: relative;
    border-bottom: 1px solid #eee;
  }
  .tab-label {
    flex: 1; padding: 14px; text-align: center;
    cursor: pointer; font-size: 14px; color: #666;
    transition: color 0.3s ease;
    user-select: none;
  }
  .tab-label.active { color: #3498db; font-weight: 600; }
  .tab-indicator {
    position: absolute; bottom: 0; left: 0;
    height: 2px; background: #3498db;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    width: 33.333%;
  }
  .tab-content-area {
    position: relative; min-height: 150px;
  }
  .tab-panel {
    position: absolute; inset: 0;
    padding: 20px; font-size: 14px; line-height: 1.6;
    opacity: 0; transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
  }
  .tab-panel.active {
    opacity: 1; transform: translateY(0);
    pointer-events: auto;
    position: relative;
  }
</style>
</head>
<body>
<div class="tabs" id="tabs">
  <div class="tab-header">
    <div class="tab-label active" data-index="0">首页</div>
    <div class="tab-label" data-index="1">关于</div>
    <div class="tab-label" data-index="2">联系</div>
    <div class="tab-indicator" id="indicator"></div>
  </div>
  <div class="tab-content-area">
    <div class="tab-panel active" data-index="0">
      <h3>欢迎回来</h3>
      <p>这是首页内容。Tab 切换时会有滑动动画效果。</p>
    </div>
    <div class="tab-panel" data-index="1">
      <h3>关于我们</h3>
      <p>我们是一支专注于前端动画的团队。</p>
    </div>
    <div class="tab-panel" data-index="2">
      <h3>联系我们</h3>
      <p>邮箱：hello@example.com</p>
    </div>
  </div>
</div>

<script>
const labels = document.querySelectorAll('.tab-label')
const panels = document.querySelectorAll('.tab-panel')
const indicator = document.getElementById('indicator')
let currentIndex = 0

function switchTab(index) {
  if (index === currentIndex) return
  labels[currentIndex].classList.remove('active')
  panels[currentIndex].classList.remove('active')
  currentIndex = index
  labels[currentIndex].classList.add('active')
  panels[currentIndex].classList.add('active')
  indicator.style.transform = `translateX(${currentIndex * 100}%)`
}

labels.forEach(label => {
  label.addEventListener('click', () => {
    switchTab(parseInt(label.dataset.index))
  })
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    switchTab((currentIndex + 1) % labels.length)
  } else if (e.key === 'ArrowLeft') {
    switchTab((currentIndex - 1 + labels.length) % labels.length)
  }
})
</script>
</body>
</html>
```

**要点**：
- 下划线用 `transform: translateX()` 移动，`cubic-bezier(0.34, 1.56, 0.64, 1)` 让滑动有弹性
- 内容面板用 `opacity` + `transform` 实现淡入淡出，`pointer-events: none` 防止不可见面板接收点击
- 键盘方向键循环切换，`(currentIndex - 1 + length) % length` 处理负数取模

### 练习五

**思路**：用一个数组存储待执行的动画函数。每个动画函数接收 `done` 回调，动画结束后调用 `done()` 通知队列执行下一个。`pause()` 设置暂停标志，`resume()` 恢复执行。

**答案**：

```javascript
class AnimationQueue {
  constructor() {
    this.queue = []
    this.running = false
    this.paused = false
    this.currentDone = null
  }

  enqueue(animationFn) {
    this.queue.push(animationFn)
    if (!this.running) this._next()
    return this
  }

  _next() {
    if (this.paused || this.queue.length === 0) {
      this.running = false
      return
    }

    this.running = true
    const fn = this.queue.shift()

    fn(() => {
      this.currentDone = null
      this._next()
    })
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
    if (!this.running && this.queue.length > 0) {
      this._next()
    }
  }

  cancel() {
    this.queue = []
    this.paused = false
    this.running = false
  }
}

// 使用示例
const queue = new AnimationQueue()

function animateElement(el, from, to, duration) {
  return done => {
    const start = performance.now()
    function step(timestamp) {
      const progress = Math.min((timestamp - start) / duration, 1)
      el.style.transform = `translateX(${from + (to - from) * progress}px)`
      if (progress < 1) requestAnimationFrame(step)
      else done()
    }
    requestAnimationFrame(step)
  }
}

const box = document.createElement('div')
box.style.cssText = 'width:50px;height:50px;background:#e74c3c;border-radius:8px;position:absolute;top:100px;'
document.body.appendChild(box)

queue
  .enqueue(animateElement(box, 0, 200, 500))
  .enqueue(done => setTimeout(done, 300)) // 暂停 300ms
  .enqueue(animateElement(box, 200, 400, 500))
  .enqueue(done => setTimeout(done, 300))
  .enqueue(animateElement(box, 400, 0, 500))
```

**要点**：
- 每个动画函数接收 `done` 回调，动画结束后调用 `done()` 推动队列
- `pause()` 只设置标志，当前动画会继续执行完，下一个才会暂停
- `cancel()` 清空队列，但不影响正在执行的动画
- 链式调用 `enqueue` 返回 `this`，方便连续添加

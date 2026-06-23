# 阶段实战：10 个生产级 CSS 动画

## 这节课做什么

前五课讲了原理、CSS Animation、WAAPI、rAF、缓动函数。现在把这些知识变成可直接用在项目里的组件。

10 个动画，每个独立可用，覆盖前端最常见的交互场景：加载、导航、反馈、展示、引导。

## 脉冲呼吸灯

在线状态、新消息提示。用 `::before` 伪元素做扩散波纹：

```css
.pulse {
  width: 12px; height: 12px; border-radius: 50%; background: #22c55e;
  position: relative;
}
.pulse::before {
  content: ''; position: absolute; inset: -4px; border-radius: 50%;
  background: rgba(34, 197, 94, 0.4);
  animation: pulse-ring 2s ease-out infinite;
}
@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}
```

双层脉冲更紧急——给 `::after` 加同样的动画，`animation-delay: 0.6s`。

## 骨架屏闪烁

内容加载占位。渐变背景做"光束扫过"：

```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

`background-size: 400%` 让渐变比元素宽 4 倍，移动 `background-position` 产生扫光。1.4s 不会太快（焦虑）也不会太慢（卡顿）。

## 汉堡菜单 → 叉号

三条线变 X。关键计算：三条线间距 `(18 - 2×3) / 2 = 6px`，每条线移动 `8px`（6 + 线宽一半）到中间：

```css
.hamburger { width: 24px; height: 18px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; }
.hamburger span { display: block; height: 2px; background: #333; border-radius: 1px; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; }
.hamburger.active span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
.hamburger.active span:nth-child(2) { opacity: 0; }
.hamburger.active span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }
```

`cubic-bezier(0.34, 1.56, 0.64, 1)` 让旋转有弹性过冲。

## 波纹点击效果

Material Design 风格。波纹从点击位置扩散：

```css
.ripple-btn { position: relative; overflow: hidden; padding: 12px 24px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.ripple-btn::after {
  content: ''; position: absolute; width: 200%; padding-top: 200%; border-radius: 50%;
  background: rgba(255,255,255,0.3);
  transform: translate(-50%,-50%) scale(0); left: var(--x); top: var(--y);
  pointer-events: none;
}
.ripple-btn.animate::after { animation: ripple 0.6s ease-out; }
@keyframes ripple { to { transform: translate(-50%,-50%) scale(1); opacity: 0; } }
```

```javascript
btn.addEventListener('click', function(e) {
  const r = this.getBoundingClientRect()
  this.style.setProperty('--x', (e.clientX - r.left) + 'px')
  this.style.setProperty('--y', (e.clientY - r.top) + 'px')
  this.classList.remove('animate')
  void this.offsetWidth
  this.classList.add('animate')
})
```

`void this.offsetWidth` 强制重排，重启动画。

## 打字机效果

`steps()` 让宽度逐字符增长：

```css
.typewriter {
  display: inline-block; overflow: hidden; white-space: nowrap; width: 0;
  border-right: 2px solid #333;
  animation: typing 3s steps(20) forwards, blink 0.7s step-end infinite;
}
@keyframes typing { to { width: 20ch; } }
@keyframes blink { 50% { border-color: transparent; } }
```

`ch` 单位 = 字符宽度，`steps(20)` 分 20 步。多行打字机需要用 JS 逐行控制（见练习）。

## 卡片 3D 翻转

三个关键属性配合：

```css
.flip-card { width: 300px; height: 200px; perspective: 1000px; cursor: pointer; }
.flip-card-inner {
  width: 100%; height: 100%; position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.flip-card:hover .flip-card-inner { transform: rotateY(180deg); }
.flip-card-front, .flip-card-back {
  position: absolute; inset: 0; backface-visibility: hidden;
  border-radius: 12px; display: flex; align-items: center; justify-content: center;
}
.flip-card-front { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
.flip-card-back { background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; transform: rotateY(180deg); }
```

`perspective` 定义景深，`preserve-3d` 保持 3D 空间，`backface-visibility: hidden` 隐藏背面。

## 列表交错入场

用 CSS 自定义属性参数化延迟：

```css
.stagger-item {
  opacity: 0; transform: translateY(16px);
  animation: fade-in-up 0.4s ease-out forwards;
  animation-delay: calc(var(--i) * 80ms);
}
@keyframes fade-in-up { to { opacity: 1; transform: translateY(0); } }
```

```javascript
document.querySelectorAll('.stagger-item').forEach((el, i) => el.style.setProperty('--i', i))
```

不需要为每个子元素写 `nth-child` 规则，列表项数量可变。

## 进度环

`stroke-dasharray` 和 `stroke-dashoffset` 配合：

```css
.progress-ring { width: 100px; height: 100px; transform: rotate(-90deg); }
.progress-ring circle { fill: none; stroke-width: 8; stroke-linecap: round; }
.progress-ring .bg { stroke: #e2e8f0; }
.progress-ring .fill { stroke: #3b82f6; stroke-dasharray: 283; stroke-dashoffset: 283; transition: stroke-dashoffset 1s ease-out; }
```

```javascript
function setProgress(percent) {
  const circle = document.querySelector('.progress-ring .fill')
  const circumference = 2 * Math.PI * 45
  circle.style.strokeDashoffset = circumference - (percent / 100) * circumference
}
```

283 = 圆周长（`2π × 45`）。偏移量从 283（不可见）到 0（满圆）。

## 悬浮卡片阴影

多层阴影模拟真实投影——近处阴影小而深，远处大而淡：

```css
.card {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 12px 24px rgba(0,0,0,0.1);
}
```

## 加载旋转器

```css
.spinner {
  width: 40px; height: 40px;
  border: 3px solid #e2e8f0; border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

三点跳动变体：

```css
.bounce-dots { display: flex; gap: 6px; }
.bounce-dots span {
  width: 10px; height: 10px; background: #ef4444; border-radius: 50%;
  animation: bounce 0.6s ease-in-out infinite;
}
.bounce-dots span:nth-child(2) { animation-delay: 0.1s; }
.bounce-dots span:nth-child(3) { animation-delay: 0.2s; }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
```

## 无障碍

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

这不是可选的。部分用户对动画敏感或会引发前庭系统不适。

## 练习

### 练习一：组合加载指示器

外圈脉冲扩散（`::before`），内圈旋转（`border` + `rotate`）。两个动画独立运行，互不干扰。写完整 HTML。

### 练习二：骨架屏→真实内容切换

文章卡片：圆形头像 + 矩形标题 + 三行正文。2 秒后骨架屏淡出，真实内容淡入。用 `animationend` 事件处理切换，不要用 `setTimeout` 猜时长。

### 练习三：带动画的 Tab 切换

Tab 标签有下划线指示器，切换时滑动。内容区域淡入淡出。支持键盘左右方向键。写完整 HTML。

---

## 参考答案

### 练习一

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; }
  .loader { width: 60px; height: 60px; position: relative; display: flex; align-items: center; justify-content: center; }
  .loader::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: rgba(59,130,246,0.2);
    animation: pulse-ring 2s ease-out infinite;
  }
  .loader-inner {
    width: 28px; height: 28px; z-index: 1;
    border: 3px solid rgba(59,130,246,0.3); border-top-color: #3b82f6;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes pulse-ring { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="loader"><div class="loader-inner"></div></div>
</body>
</html>
```

### 练习二

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f1f5f9; font-family: system-ui, sans-serif; }
  .card { width: 320px; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .skeleton .sk { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
  .sk-avatar { width: 48px; height: 48px; border-radius: 50%; }
  .sk-title { width: 60%; height: 20px; margin-top: 12px; border-radius: 4px; }
  .sk-text { width: 100%; height: 14px; margin-top: 8px; border-radius: 4px; }
  @keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
  .skeleton.fade-out { animation: fadeOut 0.3s ease forwards; }
  .real { display: none; }
  .real.fade-in { animation: fadeIn 0.3s ease forwards; }
  @keyframes fadeOut { to { opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .real-avatar { width: 48px; height: 48px; border-radius: 50%; background: #3b82f6; }
  .real-title { font-size: 18px; font-weight: 600; margin-top: 12px; }
  .real-text { font-size: 14px; color: #64748b; margin-top: 8px; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="skeleton" id="skeleton">
    <div class="sk sk-avatar"></div>
    <div class="sk sk-title"></div>
    <div class="sk sk-text"></div>
    <div class="sk sk-text" style="width:80%"></div>
  </div>
  <div class="real" id="real">
    <div class="real-avatar"></div>
    <div class="real-title">文章标题</div>
    <div class="real-text">骨架屏加载完成后，会淡出并显示这段真实内容。</div>
  </div>
</div>
<script>
async function load() {
  const sk = document.getElementById('skeleton'), real = document.getElementById('real')
  await new Promise(r => setTimeout(r, 2000))
  sk.classList.add('fade-out')
  await new Promise(r => sk.addEventListener('animationend', r, { once: true }))
  sk.style.display = 'none'
  real.style.display = 'block'
  real.classList.add('fade-in')
}
load()
</script>
</body>
</html>
```

### 练习三

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f1f5f9; font-family: system-ui, sans-serif; }
  .tabs { width: 400px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .tab-header { display: flex; position: relative; border-bottom: 1px solid #e2e8f0; }
  .tab-label { flex: 1; padding: 14px; text-align: center; cursor: pointer; font-size: 14px; color: #64748b; user-select: none; transition: color 0.2s; }
  .tab-label.active { color: #3b82f6; font-weight: 600; }
  .indicator { position: absolute; bottom: 0; left: 0; height: 2px; background: #3b82f6; width: 33.333%; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .tab-body { position: relative; min-height: 120px; }
  .panel { position: absolute; inset: 0; padding: 20px; font-size: 14px; line-height: 1.6; opacity: 0; transform: translateY(8px); transition: opacity 0.25s, transform 0.25s; pointer-events: none; }
  .panel.active { opacity: 1; transform: translateY(0); pointer-events: auto; position: relative; }
</style>
</head>
<body>
<div class="tabs" id="tabs">
  <div class="tab-header">
    <div class="tab-label active" data-i="0">首页</div>
    <div class="tab-label" data-i="1">关于</div>
    <div class="tab-label" data-i="2">联系</div>
    <div class="indicator" id="indicator"></div>
  </div>
  <div class="tab-body">
    <div class="panel active" data-i="0"><h3>欢迎</h3><p>首页内容。用方向键切换 Tab。</p></div>
    <div class="panel" data-i="1"><h3>关于</h3><p>我们是专注于前端动画的团队。</p></div>
    <div class="panel" data-i="2"><h3>联系</h3><p>hello@example.com</p></div>
  </div>
</div>
<script>
const labels = document.querySelectorAll('.tab-label')
const panels = document.querySelectorAll('.panel')
const indicator = document.getElementById('indicator')
let cur = 0

function switchTo(i) {
  if (i === cur) return
  labels[cur].classList.remove('active')
  panels[cur].classList.remove('active')
  cur = i
  labels[cur].classList.add('active')
  panels[cur].classList.add('active')
  indicator.style.transform = `translateX(${cur * 100}%)`
}

labels.forEach(l => l.addEventListener('click', () => switchTo(+l.dataset.i)))
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') switchTo((cur + 1) % labels.length)
  else if (e.key === 'ArrowLeft') switchTo((cur - 1 + labels.length) % labels.length)
})
</script>
</body>
</html>
```

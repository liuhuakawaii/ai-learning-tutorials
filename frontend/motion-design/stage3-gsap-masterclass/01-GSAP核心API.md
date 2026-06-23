# GSAP 核心 API

## GSAP 解决什么问题

CSS 动画能做过渡和关键帧，但遇到这些场景就力不从心：

- 需要精确控制播放进度（暂停、倒放、跳到 50%）
- 多个动画需要严格编排顺序（先 A 再 B，B 完成后 C 和 D 同时开始）
- 运行时动态改变动画参数
- 需要自定义缓动曲线

GSAP（GreenSock Animation Platform）就是为这些场景设计的。它不是 CSS 动画的替代品，而是补充。

## 安装

```bash
npm install gsap
```

```javascript
import gsap from 'gsap'
```

## gsap.to()：从当前到目标

最基本的用法——把元素从当前状态动画到目标状态：

```javascript
gsap.to('.box', {
  x: 200,          // translateX(200px)
  opacity: 0.5,
  duration: 0.8,
  ease: 'power2.out',
})
```

GSAP 会自动把 `x` 映射到 `translateX`，`y` 映射到 `translateY`，`rotation` 映射到 `rotate`。不需要手写 `transform`。

## gsap.from()：从起始到当前

```javascript
gsap.from('.box', {
  x: -200,         // 从左侧 200px 处滑入
  opacity: 0,
  duration: 0.6,
  ease: 'power2.out',
})
```

元素会从 `x: -200, opacity: 0` 动画回到 CSS 中定义的位置和透明度。

## gsap.fromTo()：同时指定起始和目标

```javascript
gsap.fromTo('.box',
  { x: -200, opacity: 0 },      // from
  { x: 200, opacity: 1, duration: 0.8, ease: 'power2.out' }  // to
)
```

## stagger：交错动画

列表入场的利器——每个元素延迟 N 毫秒：

```javascript
gsap.from('.list-item', {
  y: 30,
  opacity: 0,
  duration: 0.4,
  stagger: 0.08,     // 每个元素延迟 80ms
  ease: 'power2.out',
})
```

`stagger` 也可以是对象，做更精细的控制：

```javascript
gsap.from('.grid-item', {
  scale: 0,
  opacity: 0,
  duration: 0.5,
  stagger: {
    each: 0.06,
    from: 'center',   // 从中心向外扩散
    grid: 'auto',
  },
})
```

## 缓动函数

GSAP 内置了大量缓动，比 CSS 的 5 种丰富得多：

```javascript
// 常用缓动
ease: 'power1.out'      // 类似 ease-out
ease: 'power2.out'      // 更明显的减速
ease: 'power2.inOut'    // 两头慢中间快
ease: 'back.out(1.7)'   // 弹性回弹
ease: 'elastic.out(1, 0.3)' // 弹簧效果
ease: 'bounce.out'      // 弹跳
```

用 GSAP 官方的 Ease Visualizer（https://gsap.com/docs/v3/Eases）可以直观对比。

## 常用属性速查

| GSAP 属性 | CSS 等价 | 说明 |
|-----------|---------|------|
| `x`, `y` | `translateX/Y` | 位移 |
| `xPercent`, `yPercent` | `translate(-50%, -50%)` | 百分比位移 |
| `rotation` | `rotate` | 旋转（度） |
| `scale`, `scaleX/Y` | `scale` | 缩放 |
| `opacity` | `opacity` | 透明度 |
| `backgroundColor` | `background-color` | 背景色 |
| `duration` | — | 时长（秒） |
| `delay` | — | 延迟（秒） |
| `ease` | `transition-timing-function` | 缓动 |
| `repeat` | `animation-iteration-count` | 重复次数 |
| `yoyo` | — | 往返（配合 repeat） |
| `onComplete` | — | 完成回调 |

## 实用示例

### 元素入场

```javascript
function revealUp(selector) {
  gsap.from(selector, {
    y: 40, opacity: 0, duration: 0.6,
    ease: 'power2.out', stagger: 0.1,
  })
}
```

### 悬停反馈

```javascript
const btn = document.querySelector('.btn')
btn.addEventListener('mouseenter', () => {
  gsap.to(btn, { scale: 1.05, duration: 0.2, ease: 'power2.out' })
})
btn.addEventListener('mouseleave', () => {
  gsap.to(btn, { scale: 1, duration: 0.2, ease: 'power2.out' })
})
```

### 循环动画

```javascript
gsap.to('.dot', {
  y: -20, duration: 0.5, ease: 'power1.inOut',
  repeat: -1, yoyo: true, stagger: 0.1,
})
```

`repeat: -1` = 无限循环，`yoyo: true` = 往返。

## GSAP vs CSS 动画选择

| 场景 | 推荐 | 原因 |
|------|------|------|
| 简单悬停/过渡 | CSS | 语法简单，浏览器原生 |
| 关键帧循环 | CSS | `@keyframes` 够用 |
| 精确控制播放 | GSAP | CSS 做不到暂停/倒放/跳转 |
| 复杂编排 | GSAP | Timeline API |
| 运行时动态参数 | GSAP | JS 控制 |
| 60fps 高性能 | 两者都行 | GSAP 底层也用 rAF |

## 练习

### 练习一：卡片入场

10 张卡片从下方 40px 滑入并淡入，每张间隔 80ms。使用 `gsap.from()` + `stagger`。

### 练习二：按钮动画

实现按钮点击效果：按下时 `scale: 0.95`，松开时弹回 `scale: 1`（用 `back.out(1.7)` 缓动）。

### 练习三：循环加载动画

三个圆点上下跳动，用 `repeat: -1` + `yoyo` + `stagger` 实现。

---

## 参考答案

### 练习一

```javascript
gsap.from('.card', {
  y: 40, opacity: 0, duration: 0.5,
  stagger: 0.08, ease: 'power2.out',
})
```

### 练习二

```javascript
const btn = document.querySelector('.btn')
btn.addEventListener('mousedown', () => {
  gsap.to(btn, { scale: 0.95, duration: 0.1 })
})
btn.addEventListener('mouseup', () => {
  gsap.to(btn, { scale: 1, duration: 0.3, ease: 'back.out(1.7)' })
})
```

### 练习三

```javascript
gsap.from('.dot', {
  y: 20, opacity: 0.3, duration: 0.5,
  ease: 'power1.inOut',
  repeat: -1, yoyo: true,
  stagger: 0.15,
})
```

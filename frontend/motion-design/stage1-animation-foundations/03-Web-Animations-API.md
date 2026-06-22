# 第三课：Web Animations API

## 场景引入

CSS 动画方便但在需要精确控制播放进度、暂停、反转或动态调整参数时力不从心。Web Animations API（WAAPI）是浏览器原生的 JavaScript 动画接口，将 CSS 动画的能力带入 JS 世界，让我们完全掌控动画的生命周期。

想象一个音乐播放器的进度条：用户拖拽滑块时动画需要暂停、松手后从当前位置继续、双倍速播放时动画也要同步加速。这些场景用纯 CSS 几乎无法实现，但 WAAPI 可以轻松搞定。

## 学习目标

- 掌握 `element.animate()` 的基本用法和参数
- 理解 Animation 对象的生命周期和状态
- 学会用 WAAPI 控制动画的播放、暂停、反转和速度
- 了解 WAAPI 与 CSS 动画的协作方式
- 掌握 WAAPI 的高级用法：时间控制、批量操作、动画编排
- 理解 WAAPI 的兼容性和渐进增强策略

## 一、element.animate() 基础

### 1.1 基本用法

```javascript
const box = document.querySelector('.box')
box.animate(
  [
    { transform: 'translateX(0)', opacity: 1 },
    { transform: 'translateX(200px)', opacity: 0.5 }
  ],
  { duration: 500, easing: 'ease-out', fill: 'forwards' }
)
```

第一个参数是**关键帧数组**，第二个是**时间配置**。返回一个 `Animation` 对象，可以用来控制动画。

### 1.2 关键帧格式

WAAPI 支持两种关键帧格式：

```javascript
// 数组格式（简写）
element.animate([
  { opacity: 0, transform: 'scale(0.8)' },
  { opacity: 1, transform: 'scale(1)' }
], { duration: 300 })

// 带 offset 的精确控制
element.animate([
  { opacity: 0, offset: 0 },      // 0% 处
  { opacity: 1, offset: 0.5 },    // 50% 处
  { opacity: 0.8, offset: 1 }     // 100% 处
], { duration: 1000 })

// 对象格式（按属性分组）
element.animate({
  opacity: [0, 1],
  transform: ['scale(0.8)', 'scale(1)']
}, { duration: 300 })
```

**offset 的范围**：0 到 1，对应 CSS `@keyframes` 的 0% 到 100%。如果省略 offset，浏览器会自动均匀分布。

### 1.3 时间配置

```javascript
const options = {
  duration: 500,              // 单次循环时长（毫秒）
  easing: 'ease-in-out',      // 缓动函数
  delay: 100,                 // 开始前延迟
  iterations: Infinity,       // 无限循环
  direction: 'alternate',     // 播放方向
  fill: 'forwards',           // 开始前/结束后状态
  endDelay: 0                 // 结束后延迟
}
```

**配置项详解**：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| duration | number | 0 | 毫秒，不是秒 |
| easing | string | 'linear' | CSS 缓动函数 |
| delay | number | 0 | 开始前延迟（毫秒） |
| endDelay | number | 0 | 结束后延迟（毫秒） |
| iterations | number | 1 | 循环次数，Infinity 无限 |
| direction | string | 'normal' | normal/reverse/alternate/alternate-reverse |
| fill | string | 'none' | none/forwards/backwards/both |

### 1.4 与 CSS @keyframes 等价

```css
/* CSS 版本 */
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
.element { animation: slideIn 0.4s ease-out forwards; }
```

```javascript
// WAAPI 等价版本
element.animate([
  { opacity: 0, transform: 'translateX(-30px)' },
  { opacity: 1, transform: 'translateX(0)' }
], {
  duration: 400,
  easing: 'ease-out',
  fill: 'forwards'
})
```

## 二、Animation 对象

### 2.1 播放控制

`element.animate()` 返回的 `Animation` 对象提供了完整的播放控制：

```javascript
const animation = element.animate(keyframes, options)

// 播放控制
animation.pause()           // 暂停
animation.play()            // 恢复
animation.reverse()         // 反转方向
animation.cancel()          // 取消（移除动画效果）
animation.finish()          // 跳到结束状态

// 时间控制
animation.currentTime = 500 // 跳转到 500ms 处
animation.currentTime = 0   // 回到起点
```

**典型使用场景**：

```javascript
// 场景 1：暂停/恢复按钮
toggleBtn.addEventListener('click', () => {
  if (animation.playState === 'running') {
    animation.pause()
    toggleBtn.textContent = '播放'
  } else {
    animation.play()
    toggleBtn.textContent = '暂停'
  }
})

// 场景 2：反转动画（如关闭弹窗）
closeBtn.addEventListener('click', () => {
  animation.reverse()
})

// 场景 3：重置动画
resetBtn.addEventListener('click', () => {
  animation.currentTime = 0
  animation.pause()
})
```

### 2.2 状态与事件

```javascript
// 只读属性
console.log(animation.playState)    // 'idle'|'running'|'paused'|'finished'
console.log(animation.currentTime)  // 当前时间（毫秒）
console.log(animation.playbackRate) // 播放速度倍率
console.log(animation.startTime)    // 开始时间
console.log(animation.timeline)     // 关联的时间线

// 事件监听
animation.onfinish = () => console.log('动画完成')
animation.oncancel = () => console.log('动画取消')

// Promise 形式（推荐）
animation.finished.then(() => console.log('动画完成'))
```

**playState 四种状态**：

| 状态 | 说明 |
|------|------|
| idle | 初始状态，动画尚未开始 |
| running | 正在播放 |
| paused | 已暂停 |
| finished | 已完成 |

### 2.3 获取所有动画

```javascript
// 获取元素上的所有动画（包括 CSS 动画和 WAAPI 动画）
element.getAnimations()

// 获取文档中所有动画
document.getAnimations()

// 过滤特定动画
const cssAnimations = element.getAnimations()
  .filter(a => a instanceof CSSAnimation)

const waapiAnimations = element.getAnimations()
  .filter(a => a instanceof KeyframeEffect)
```

### 2.4 Animation 层叠顺序

同一元素上的多个 WAAPI 动画会按创建顺序层叠，后创建的优先级更高：

```javascript
// 两个动画同时修改 transform
const anim1 = element.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(100px)' }],
  { duration: 1000, fill: 'forwards' }
)
const anim2 = element.animate(
  [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }],
  { duration: 1000, fill: 'forwards' }
)
// anim2 的 scale 会覆盖 anim1 的 translateX
// 但 CSS 的层叠规则会合并不同属性
```

## 三、实用模式

### 3.1 Promise 等待完成

```javascript
function animateWithPromise(element, keyframes, options) {
  return element.animate(keyframes, options).finished
}

async function sequence() {
  const box = document.querySelector('.box')
  await animateWithPromise(box,
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 300, fill: 'forwards' }
  )
  await animateWithPromise(box,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }],
    { duration: 500, fill: 'forwards', easing: 'ease-out' }
  )
}
```

### 3.2 并行动画编排

```javascript
async function parallelAnimation() {
  const header = document.querySelector('.header')
  const sidebar = document.querySelector('.sidebar')
  const content = document.querySelector('.content')

  // 三个元素同时入场
  await Promise.all([
    animateWithPromise(header,
      [{ opacity: 0, transform: 'translateY(-20px)' },
       { opacity: 1, transform: 'translateY(0)' }],
      { duration: 400, fill: 'forwards', easing: 'ease-out' }
    ),
    animateWithPromise(sidebar,
      [{ opacity: 0, transform: 'translateX(-20px)' },
       { opacity: 1, transform: 'translateX(0)' }],
      { duration: 400, fill: 'forwards', easing: 'ease-out' }
    ),
    animateWithPromise(content,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 400, fill: 'forwards', easing: 'ease-out' }
    )
  ])

  console.log('所有元素入场完成')
}
```

### 3.3 动态调整播放速度

```javascript
const animation = element.animate(keyframes, options)

// 调整播放速度
animation.playbackRate = 2    // 2 倍速
animation.playbackRate = 0.5  // 半速
animation.playbackRate = -1   // 倒放（需要动画正在运行或暂停）

// 平滑过渡到新速度
function smoothRateChange(targetRate) {
  const current = animation.playbackRate
  const step = (targetRate - current) / 10
  let count = 0
  const interval = setInterval(() => {
    count++
    animation.playbackRate = current + step * count
    if (count >= 10) clearInterval(interval)
  }, 16)
}

// 进度条跟随滚动
window.addEventListener('scroll', () => {
  const scrollProgress = window.scrollY / (document.body.scrollHeight - window.innerHeight)
  animation.currentTime = scrollProgress * animation.effect.getTiming().duration
})
```

### 3.4 批量控制

```javascript
function pauseAll() {
  document.getAnimations().forEach(a => a.pause())
}

function resumeAll() {
  document.getAnimations().forEach(a => a.play())
}

function setGlobalSpeed(rate) {
  document.getAnimations().forEach(a => {
    a.playbackRate = rate
  })
}

// 暂停页面上所有动画（用于性能优化）
function pauseOffscreenAnimations() {
  document.getAnimations().forEach(animation => {
    const element = animation.effect.target
    const rect = element.getBoundingClientRect()
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0
    if (!isVisible && animation.playState === 'running') {
      animation.pause()
    }
  })
}
```

### 3.5 动画队列

```javascript
async function animateQueue(element, keyframesArray, options) {
  for (const keyframes of keyframesArray) {
    const animation = element.animate(keyframes, { fill: 'forwards', ...options })
    await animation.finished
  }
}

// 使用示例：元素依次执行三个动画
await animateQueue(box, [
  [{ opacity: 0 }, { opacity: 1 }],
  [{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }],
  [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]
], { duration: 500, easing: 'ease-out' })
```

### 3.6 弹性反馈动画

```javascript
function bounceFeedback(element) {
  return element.animate([
    { transform: 'scale(1)', offset: 0 },
    { transform: 'scale(0.95)', offset: 0.3 },
    { transform: 'scale(1.02)', offset: 0.6 },
    { transform: 'scale(1)', offset: 1 }
  ], {
    duration: 300,
    easing: 'ease-out'
  }).finished
}

// 按钮点击反馈
button.addEventListener('click', async () => {
  await bounceFeedback(button)
  // 执行后续逻辑
})
```

### 3.7 抖动动画

```javascript
function shake(element, intensity = 5) {
  return element.animate([
    { transform: 'translateX(0)' },
    { transform: `translateX(-${intensity}px)` },
    { transform: `translateX(${intensity}px)` },
    { transform: `translateX(-${intensity * 0.7}px)` },
    { transform: `translateX(${intensity * 0.7}px)` },
    { transform: `translateX(-${intensity * 0.3}px)` },
    { transform: `translateX(${intensity * 0.3}px)` },
    { transform: 'translateX(0)' }
  ], {
    duration: 500,
    easing: 'ease-out'
  }).finished
}

// 表单验证失败时抖动输入框
shake(document.querySelector('.invalid-input'))
```

## 四、WAAPI 与 CSS 动画协作

### 4.1 JS 控制 CSS 动画

CSS 动画也可以通过 JS 控制：

```css
.box { animation: slideIn 0.5s ease-out forwards; }
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
```

```javascript
const cssAnim = document.querySelector('.box').getAnimations()[0]
cssAnim.pause()
cssAnim.playbackRate = 2
cssAnim.currentTime = 250
```

### 4.2 混合策略

**混合策略**：基础状态动画用 CSS `transition`，复杂交互用 WAAPI。

```javascript
// 点击弹性反馈用 WAAPI
button.addEventListener('click', () => {
  button.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(0.95)' },
    { transform: 'scale(1.02)' },
    { transform: 'scale(1)' }
  ], { duration: 300, easing: 'ease-out' })
})

// 悬停效果用 CSS transition
// 在 CSS 中定义 .button:hover { transform: translateY(-2px) }
```

### 4.3 CSS 动画与 WAAPI 的优先级

当 CSS 动画和 WAAPI 同时作用于同一元素的同一属性时，WAAPI 优先级更高：

```css
.box { animation: cssMove 2s linear infinite; }
@keyframes cssMove {
  to { transform: translateX(100px); }
}
```

```javascript
// WAAPI 会覆盖 CSS 动画的 transform
box.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(300px)' }],
  { duration: 1000, fill: 'forwards' }
)
```

## 五、高级用法

### 5.1 动态生成关键帧

```javascript
function createPathAnimation(element, path, duration = 2000) {
  // path 是坐标点数组 [{x, y}, ...]
  const keyframes = path.map((point, index) => ({
    transform: `translate(${point.x}px, ${point.y}px)`,
    offset: index / (path.length - 1)
  }))

  return element.animate(keyframes, {
    duration,
    easing: 'ease-in-out',
    fill: 'forwards'
  })
}

// 使用示例：沿圆形路径运动
const circlePath = []
for (let i = 0; i <= 360; i += 10) {
  const rad = (i * Math.PI) / 180
  circlePath.push({
    x: Math.cos(rad) * 100,
    y: Math.sin(rad) * 100
  })
}
createPathAnimation(element, circlePath, 3000)
```

### 5.2 时间线控制

```javascript
// 创建一个动画并手动控制时间线
const animation = element.animate(
  [
    { transform: 'translateX(0) rotate(0deg)', background: '#3498db' },
    { transform: 'translateX(300px) rotate(360deg)', background: '#e74c3c' }
  ],
  { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
)
animation.pause()

// 通过滑块控制进度
const scrubber = document.getElementById('scrubber')
scrubber.addEventListener('input', () => {
  const progress = scrubber.value / 100
  const timing = animation.effect.getTiming()
  animation.currentTime = progress * timing.duration
})
```

### 5.3 获取动画信息

```javascript
const animation = element.animate(keyframes, options)

// 获取时间信息
const timing = animation.effect.getTiming()
console.log(timing.duration)       // 时长
console.log(timing.delay)          // 延迟
console.log(timing.iterations)     // 循环次数
console.log(timing.direction)      // 方向
console.log(timing.easing)         // 缓动

// 获取当前进度
const progress = animation.currentTime / timing.duration
console.log(`进度: ${(progress * 100).toFixed(1)}%`)

// 获取关键帧信息
const keyframes = animation.effect.getKeyframes()
console.log(keyframes)
```

### 5.4 动画事件监听

```javascript
const animation = element.animate(keyframes, options)

// 使用事件属性
animation.onfinish = () => {
  console.log('动画完成')
  element.classList.add('animation-done')
}

animation.oncancel = () => {
  console.log('动画被取消')
}

// 使用 addEventListener（更灵活）
animation.addEventListener('finish', (event) => {
  console.log('动画完成', event)
})

animation.addEventListener('cancel', (event) => {
  console.log('动画取消', event)
})
```

## 六、实际应用案例

### 6.1 手风琴组件

```javascript
class Accordion {
  constructor(element) {
    this.element = element
    this.content = element.querySelector('.accordion-content')
    this.isOpen = false
    this.animation = null
    element.querySelector('.accordion-header')
      .addEventListener('click', () => this.toggle())
  }

  toggle() {
    if (this.animation) this.animation.cancel()
    const height = this.content.scrollHeight

    if (this.isOpen) {
      this.animation = this.content.animate(
        [{ height: height + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 300, easing: 'ease-in-out', fill: 'forwards' }
      )
    } else {
      this.content.style.overflow = 'hidden'
      this.animation = this.content.animate(
        [{ height: '0px', opacity: 0 }, { height: height + 'px', opacity: 1 }],
        { duration: 300, easing: 'ease-in-out', fill: 'forwards' }
      )
    }
    this.animation.onfinish = () => {
      this.isOpen = !this.isOpen
      if (this.isOpen) this.content.style.overflow = ''
    }
  }
}
```

### 6.2 拖拽释放动画

```javascript
class DragRelease {
  constructor(element) {
    this.element = element
    this.startX = 0
    this.currentX = 0
    this.animation = null

    element.addEventListener('mousedown', (e) => this.onStart(e))
    document.addEventListener('mousemove', (e) => this.onMove(e))
    document.addEventListener('mouseup', () => this.onEnd())
  }

  onStart(e) {
    if (this.animation) this.animation.cancel()
    this.startX = e.clientX - this.currentX
  }

  onMove(e) {
    this.currentX = e.clientX - this.startX
    this.element.style.transform = `translateX(${this.currentX}px)`
  }

  onEnd() {
    // 释放时回弹到原位
    this.animation = this.element.animate(
      [
        { transform: `translateX(${this.currentX}px)` },
        { transform: 'translateX(0)' }
      ],
      { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
    )
    this.currentX = 0
  }
}
```

### 6.3 进度条动画

```javascript
class AnimatedProgress {
  constructor(element) {
    this.element = element
    this.bar = element.querySelector('.progress-bar')
    this.animation = null
  }

  setProgress(percent, duration = 500) {
    if (this.animation) this.animation.cancel()

    this.animation = this.bar.animate(
      [
        { width: this.bar.style.width || '0%' },
        { width: `${percent}%` }
      ],
      { duration, easing: 'ease-out', fill: 'forwards' }
    )

    return this.animation.finished
  }

  // 平滑过渡到新值
  async animateTo(percent) {
    await this.setProgress(percent)
  }
}

// 使用示例
const progress = new AnimatedProgress(document.querySelector('.progress'))
await progress.animateTo(75)
```

### 6.4 列表项交错入场

```javascript
function staggerEntrance(elements, options = {}) {
  const { delay = 80, duration = 400, distance = 30 } = options

  const animations = Array.from(elements).map((el, index) => {
    return el.animate([
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration,
      delay: index * delay,
      easing: 'ease-out',
      fill: 'forwards'
    })
  })

  return Promise.all(animations.map(a => a.finished))
}

// 使用示例
const items = document.querySelectorAll('.list-item')
await staggerEntrance(items, { delay: 100, distance: 20 })
```

## 七、兼容性与渐进增强

### 7.1 浏览器支持

WAAPI 在现代浏览器中支持良好：
- Chrome 36+
- Firefox 48+
- Safari 13.1+
- Edge 79+

### 7.2 特性检测

```javascript
if (typeof Element.prototype.animate === 'function') {
  // 使用 WAAPI
  element.animate(keyframes, options)
} else {
  // 降级到 CSS 动画
  element.classList.add('animate-css')
}
```

### 7.3 渐进增强策略

```javascript
function animateElement(element, keyframes, options) {
  if (typeof element.animate === 'function') {
    return element.animate(keyframes, options).finished
  }

  // 降级：用 CSS transition 模拟
  return new Promise(resolve => {
    const { duration = 300, easing = 'ease-out', fill = 'forwards' } = options
    const startFrame = keyframes[0]
    const endFrame = keyframes[keyframes.length - 1]

    Object.assign(element.style, startFrame)
    element.style.transition = `all ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      Object.assign(element.style, endFrame)
      setTimeout(() => {
        if (fill !== 'forwards') {
          element.style.transition = ''
          Object.assign(element.style, startFrame)
        }
        resolve()
      }, duration)
    })
  })
}
```

## 常见误区

### 误区一：忘记 fill: forwards

WAAPI 动画结束后默认回到初始状态，需要 `fill: 'forwards'` 保持最终状态。

```javascript
// 差：动画结束跳回
element.animate(keyframes, { duration: 300 })

// 好：保持最终状态
element.animate(keyframes, { duration: 300, fill: 'forwards' })
```

### 误区二：不处理动画冲突

同一元素叠加多个 WAAPI 动画会产生意外效果。先取消旧动画：

```javascript
// 差：直接创建新动画
element.animate(keyframes, options)

// 好：先取消旧动画
element.getAnimations().forEach(a => a.cancel())
element.animate(keyframes, options)
```

### 误区三：直接修改 currentTime 导致跳变

```javascript
// 差：直接修改可能导致视觉跳变
animation.currentTime = 0
animation.play()

// 好：先暂停再修改
animation.pause()
animation.currentTime = 0
animation.play()
```

### 误区四：忽略动画完成回调

```javascript
// 差：不等待动画完成就执行后续逻辑
element.animate(keyframes, options)
doSomethingImmediately()

// 好：等待动画完成
await element.animate(keyframes, options).finished
doSomethingAfterAnimation()
```

### 误区五：在循环动画中使用 fill

```javascript
// 差：无限循环时 fill 无效
element.animate(keyframes, {
  iterations: Infinity,
  fill: 'forwards'  // 无限循环永远不会结束，fill 无意义
})

// 好：循环动画不需要 fill
element.animate(keyframes, {
  iterations: Infinity
})
```

## 工程建议

1. **简单状态过渡用 CSS，复杂交互控制用 WAAPI**。
2. **用 `animation.finished` 替代 `onfinish`**。Promise 更容易组合。
3. **用 `getAnimations()` 排查动画问题**。可以查看所有活跃动画。
4. **框架组件卸载时取消动画**。防止内存泄漏。
5. **批量操作用 `document.getAnimations()`**。统一控制页面动画。
6. **用特性检测确保兼容性**。WAAPI 不支持时降级到 CSS。
7. **动画前先取消旧动画**。避免冲突和内存泄漏。
8. **用 `playbackRate` 实现动画与业务逻辑同步**。如视频播放速度与动画同步。

## 小结

- `element.animate()` 接受关键帧数组和时间配置，返回 Animation 对象
- Animation 对象提供完整的播放控制：play、pause、reverse、currentTime
- `animation.finished` 返回 Promise，适合 async/await 编排
- CSS 动画和 WAAPI 可以混合使用，CSS 管状态，WAAPI 管交互
- WAAPI 支持动态生成关键帧、时间线控制、批量操作等高级用法
- 使用特性检测和渐进增强确保兼容性

## 练习

### 练习一：手风琴动画

用 WAAPI 实现手风琴展开/收起。展开时高度从 0 过渡到 `scrollHeight`，收起反向。

### 练习二：动画队列

实现 `animateQueue(element, keyframesArray, options)`，按顺序播放每个动画，返回 Promise。

### 练习三：进度控制

实现进度条动画，通过 range input 滑块控制动画播放进度。

### 练习四：弹性按钮反馈

实现按钮点击时的弹性反馈动画：按下时缩小到 0.95，释放时弹回到 1.02，再回到 1。要求用 WAAPI 实现，返回 Promise。

### 练习五：滚动驱动动画

实现一个函数 `scrollAnimation(element, keyframes, options)`，让动画进度跟随页面滚动位置。滚动到元素可见时开始，完全离开时结束。

---

## 参考答案

### 练习一

**思路**：用 `animate()` 控制高度和透明度，通过 `scrollHeight` 获取实际内容高度。

```javascript
class Accordion {
  constructor(element) {
    this.element = element
    this.content = element.querySelector('.accordion-content')
    this.isOpen = false
    this.animation = null
    element.querySelector('.accordion-header')
      .addEventListener('click', () => this.toggle())
  }

  toggle() {
    if (this.animation) this.animation.cancel()
    const height = this.content.scrollHeight

    if (this.isOpen) {
      this.animation = this.content.animate(
        [{ height: height + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 300, easing: 'ease-in-out', fill: 'forwards' }
      )
    } else {
      this.content.style.overflow = 'hidden'
      this.animation = this.content.animate(
        [{ height: '0px', opacity: 0 }, { height: height + 'px', opacity: 1 }],
        { duration: 300, easing: 'ease-in-out', fill: 'forwards' }
      )
    }
    this.animation.onfinish = () => {
      this.isOpen = !this.isOpen
      if (this.isOpen) this.content.style.overflow = ''
    }
  }
}
```

**要点**：先取消旧动画防止冲突。`scrollHeight` 获取内容实际高度。`overflow: hidden` 防止展开时内容溢出。`onfinish` 中恢复 overflow 设置。

### 练习二

**思路**：遍历关键帧数组，依次创建动画并等待完成。

```javascript
async function animateQueue(element, keyframesArray, options) {
  for (const keyframes of keyframesArray) {
    const animation = element.animate(keyframes, { fill: 'forwards', ...options })
    await animation.finished
  }
}

// 使用示例
await animateQueue(box, [
  [{ opacity: 0 }, { opacity: 1 }],
  [{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }],
  [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]
], { duration: 500, easing: 'ease-out' })
```

**要点**：`for...of` 循环确保顺序执行。`await animation.finished` 等待每个动画完成。`fill: 'forwards'` 保持每个动画的最终状态。

### 练习三

**思路**：创建动画后暂停，通过滑块的 input 事件控制 `currentTime`。

```html
<input type="range" id="scrubber" min="0" max="100" value="0">
<div class="box" style="width:50px;height:50px;background:#3498db;border-radius:4px;"></div>
<script>
const box = document.querySelector('.box')
const scrubber = document.getElementById('scrubber')

const animation = box.animate(
  [
    { transform: 'translateX(0) rotate(0deg)', background: '#3498db' },
    { transform: 'translateX(300px) rotate(360deg)', background: '#e74c3c' }
  ],
  { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
)
animation.pause()

scrubber.addEventListener('input', () => {
  const progress = scrubber.value / 100
  const timing = animation.effect.getTiming()
  animation.currentTime = progress * timing.duration
})
</script>
```

**要点**：创建动画后立即暂停。滑块值映射到动画时间。`effect.getTiming().duration` 获取动画总时长。

### 练习四

**思路**：用三个关键帧实现缩小、弹回、恢复的效果。

```javascript
function bounceFeedback(element) {
  return element.animate([
    { transform: 'scale(1)', offset: 0 },
    { transform: 'scale(0.95)', offset: 0.3 },
    { transform: 'scale(1.02)', offset: 0.6 },
    { transform: 'scale(1)', offset: 1 }
  ], {
    duration: 300,
    easing: 'ease-out'
  }).finished
}

// 使用示例
button.addEventListener('click', async () => {
  button.disabled = true
  await bounceFeedback(button)
  // 执行提交逻辑
  button.disabled = false
})
```

**要点**：三个关键帧分别对应缩小（0.3 处）、弹回（0.6 处）、恢复（1 处）。`ease-out` 缓动让动画更自然。返回 Promise 便于后续操作。

### 练习五

**思路**：用 IntersectionObserver 检测元素可见性，结合 scroll 事件控制动画进度。

```javascript
function scrollAnimation(element, keyframes, options = {}) {
  const { duration = 1000, easing = 'ease-in-out' } = options

  const animation = element.animate(keyframes, {
    duration,
    easing,
    fill: 'forwards'
  })
  animation.pause()

  function updateProgress() {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight

    // 元素进入视口时开始，离开时结束
    const enterPoint = windowHeight
    const leavePoint = -rect.height
    const totalDistance = enterPoint - leavePoint
    const currentPosition = rect.top - leavePoint
    const progress = 1 - (currentPosition / totalDistance)

    // 限制在 0-1 范围内
    const clampedProgress = Math.max(0, Math.min(1, progress))
    const timing = animation.effect.getTiming()
    animation.currentTime = clampedProgress * timing.duration
  }

  window.addEventListener('scroll', updateProgress, { passive: true })
  updateProgress() // 初始化

  // 返回清理函数
  return () => {
    window.removeEventListener('scroll', updateProgress)
    animation.cancel()
  }
}

// 使用示例
const cleanup = scrollAnimation(
  document.querySelector('.animated-element'),
  [
    { opacity: 0, transform: 'translateY(50px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ],
  { duration: 1000 }
)

// 组件卸载时清理
// cleanup()
```

**要点**：创建动画后暂停，通过 scroll 事件计算进度。`getBoundingClientRect()` 获取元素位置。`passive: true` 提升滚动性能。返回清理函数防止内存泄漏。

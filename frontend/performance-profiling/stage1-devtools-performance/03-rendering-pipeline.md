# 渲染流水线追踪

> 你说一个元素"变了"，浏览器要走多少步才能让用户看到这个变化？搞清楚这个过程，才能判断优化应该从哪一步入手。

## 从 DOM 变化到像素更新

当 JavaScript 修改了 DOM（比如 `element.style.width = '200px'`），浏览器不会立刻在屏幕上画出来。它要经过一个完整的渲染流水线：

1. **Style（样式计算）**：确定每个元素最终应用了哪些 CSS 规则
2. **Layout（布局）**：计算每个元素在页面上的位置和大小
3. **Paint（绘制）**：把元素的像素信息写入一个绘制记录列表
4. **Composite（合成）**：把多个图层合并，提交给 GPU 显示在屏幕上

并不是每次修改都会触发所有步骤。改什么属性，决定了走多远。

## 三种修改的代价差异

**只触发 Composite**：改 `transform`、`opacity`。这些属性由 GPU 直接处理，不需要重新计算布局或绘制。这是最便宜的修改。

**触发 Paint + Composite**：改 `color`、`background`、`box-shadow`。元素大小和位置没变，但外观变了，需要重新绘制。

**触发 Layout + Paint + Composite**：改 `width`、`height`、`margin`、`font-size`。元素的几何信息变了，必须从布局开始重新计算。这是最贵的修改。

这个差异就是为什么"用 `transform: translateX()` 代替 `left`"是性能优化的经典建议——不是 `transform` 本身更快，而是它跳过了 Layout 和 Paint 两个步骤。

## 在 Performance 面板里观察

录制一次交互操作（比如点击按钮触发一个动画），在 Main 轨道上找到对应的色块区域。

你会看到不同颜色的色块代表不同阶段：

- 紫色色块：**Recalculate Style** — 样式计算
- 紫色色块：**Layout** — 布局计算
- 绿色色块：**Paint** — 绘制记录
- 绿色色块：**Composite Layers** — 合成

如果一次操作同时出现了 Layout、Paint 和 Composite，说明触发了完整的渲染流水线。如果只有 Composite，说明优化做得好。

## 强制同步布局

有一种情况会让渲染流水线的代价急剧放大：**强制同步布局（Forced Synchronous Layout）**。

正常的流程是：JavaScript 执行 → 样式计算 → 布局 → 绘制。JavaScript 和布局是分开的阶段。

但如果你在 JavaScript 里先修改了样式，然后立刻读取布局信息（比如 `offsetHeight`），浏览器必须提前执行布局来给你返回正确的值。这就是强制同步布局。

```tsx
function badPattern() {
  // 修改
  element.style.width = '200px'
  // 读取 —— 触发强制同步布局
  const height = element.offsetHeight
  // 再修改
  element.style.height = `${height * 2}px`
}
```

更糟糕的是 **布局抖动（Layout Thrashing）**——在一个循环里反复修改和读取：

```tsx
function layoutThrashing() {
  const boxes = document.querySelectorAll('.box')
  boxes.forEach((box) => {
    // 读取 —— 强制布局
    const width = (box as HTMLElement).offsetWidth
    // 修改 —— 标记为需要重新布局
    ;(box as HTMLElement).style.width = `${width * 1.1}px`
  })
}
```

每一轮循环都会触发一次完整的布局计算。如果有 100 个元素，就是 100 次布局。

在 Performance 面板里，你会看到大量紧密排列的紫色 Layout 色块——这就是布局抖动的特征。

## 读写分离

解决强制同步布局的办法很简单：把所有读操作集中在一起，所有写操作集中在一起。

```tsx
function optimized() {
  const boxes = document.querySelectorAll('.box')

  // 先读取所有尺寸
  const widths = Array.from(boxes).map(
    (box) => (box as HTMLElement).offsetWidth
  )

  // 再批量写入
  boxes.forEach((box, i) => {
    ;(box as HTMLElement).style.width = `${widths[i] * 1.1}px`
  })
}
```

这样只触发一次布局（第一次读取时），而不是每轮循环都触发。

## requestAnimationFrame 的正确位置

如果你的代码需要基于布局信息做修改，应该把读和写都放到 `requestAnimationFrame` 里：

```tsx
function rafOptimized() {
  const boxes = document.querySelectorAll('.box')

  // 读
  const widths = Array.from(boxes).map(
    (box) => (box as HTMLElement).offsetWidth
  )

  // 写放到下一帧
  requestAnimationFrame(() => {
    boxes.forEach((box, i) => {
      ;(box as HTMLElement).style.width = `${widths[i] * 1.1}px`
    })
  })
}
```

浏览器会在 rAF 回调执行后自动安排一次渲染，所以不需要手动触发。

## Layout 层的性能

Layout 的计算复杂度取决于受影响的元素数量。改一个元素的 `width` 可能导致它的父元素、兄弟元素、子元素都需要重新计算布局——这就是所谓的"布局影响范围"。

在 Performance 面板的 Layout 色块详情里，可以看到 **Layout Scope**：
- **Layout tree size**：参与布局计算的元素总数
- **Layout root**：布局的根节点

如果 Layout tree size 很大（几千个元素），即使单次布局也需要很长时间。这时候需要考虑减少 DOM 规模或用 CSS Containment 限制布局范围。

## CSS Containment

`contain` 属性告诉浏览器某个元素的内部变化不会影响外部：

```css
.card {
  contain: layout style paint;
}
```

`contain: layout` 表示元素的布局完全独立，内部变化不会触发外部的重新布局。`contain: style` 限制样式计算的范围。`contain: paint` 限制绘制的范围。

在大型列表里给每个列表项加 `contain: layout style paint`，可以显著减少 Layout 的影响范围。

## 练习

### 练习一：观察不同的属性修改

写一个包含 200 个方块的页面，分别用以下方式做动画，录制 Performance trace 并对比渲染流水线：

1. 用 `element.style.left` 移动方块
2. 用 `element.style.transform = 'translateX()'` 移动方块

记录每种方式在 Main 轨道上触发了哪些阶段（Layout？Paint？Composite？）。

### 练习二：修复布局抖动

以下代码有布局抖动问题，用 Performance 面板确认问题存在，然后修复它：

```tsx
function BuggyList() {
  const [scale, setScale] = useState(1)

  const handleScale = () => {
    const items = document.querySelectorAll('.list-item')
    items.forEach((item) => {
      const el = item as HTMLElement
      const width = el.offsetWidth
      el.style.width = `${width * scale}px`
    })
    setScale((s) => s + 1.1)
  }

  return (
    <div>
      <button onClick={handleScale}>放大</button>
      {Array.from({ length: 200 }, (_, i) => (
        <div key={i} className="list-item" style={{ width: 100, height: 20, background: '#4f46e5', margin: 2 }} />
      ))}
    </div>
  )
}
```

---

## 参考答案

### 练习一

- `left` 属性：触发 Layout → Paint → Composite。每次修改都导致完整流水线，Main 轨道上有密集的紫色 Layout 色块
- `transform` 属性：只触发 Composite。Main 轨道上几乎没有额外色块，FPS 保持绿色

这就是为什么 CSS 动画优先用 `transform` 和 `opacity`。

### 练习二

问题在于 `el.offsetWidth` 的读取穿插在样式修改之间，每次循环都触发强制布局。

修复方案：

```tsx
const handleScale = () => {
  const items = document.querySelectorAll('.list-item')
  const widths = Array.from(items).map(
    (item) => (item as HTMLElement).offsetWidth
  )
  items.forEach((item, i) => {
    ;(item as HTMLElement).style.width = `${widths[i] * scale}px`
  })
  setScale((s) => s * 1.1)
}
```

录制修复后的版本，应该只看到一次 Layout 而不是 200 次。

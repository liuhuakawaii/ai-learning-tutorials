# 03. 渲染性能 —— 关键渲染路径、重排重绘、合成层、requestAnimationFrame

> 浏览器把像素画到屏幕上有一条固定路径——理解它，才能避免踩坑

## 本课目标

- 理解浏览器的关键渲染路径（Critical Rendering Path）
- 掌握重排（Reflow）和重绘（Repaint）的触发条件与优化方法
- 理解合成层（Compositing Layer）的原理和如何利用 GPU 加速
- 正确使用 requestAnimationFrame 和 requestIdleCallback

## 从 DOM 到像素

浏览器把 HTML 字符串变成屏幕上的像素，经历以下步骤：

```
HTML ──解析──→ DOM Tree ─┐
                         ├─合并→ Render Tree ──布局──→ Paint ──合成──→ 屏幕像素
CSS ──解析──→ CSSOM ─────┘

详细过程：
1. 解析 HTML → 构建 DOM Tree
2. 解析 CSS → 构建 CSSOM
3. DOM + CSSOM → Render Tree（只包含可见元素）
4. Layout（布局/重排）→ 计算每个元素的位置和大小
5. Paint（绘制）→ 填充像素（颜色、阴影、边框等）
6. Compositing（合成）→ 把多个图层合并成最终画面
```

### DOM Tree 和 Render Tree 的区别

```html
<div>
  <h1>标题</h1>
  <p style="display: none">隐藏的段落</p>
  <p>可见的段落</p>
</div>
```

```
DOM Tree（包含所有节点）：
div
├── h1
├── p (display: none)
└── p

Render Tree（只包含可见节点）：
div
├── h1
└── p
│   └── "可见的段落"

display: none 的元素不在 Render Tree 中。
visibility: hidden 的元素在 Render Tree 中（占位但不绘制）。
```

## 重排（Reflow / Layout）

重排是浏览器重新计算元素位置和大小的过程。这是最昂贵的操作。

### 什么会触发重排

```javascript
// 读取布局属性
element.offsetWidth
element.offsetHeight
element.clientWidth
element.clientHeight
element.scrollWidth
element.scrollHeight
element.offsetTop
element.offsetLeft
element.getClientRects()
element.getBoundingClientRect()

// 改变几何属性
element.style.width = '200px'
element.style.height = '100px'
element.style.margin = '10px'
element.style.padding = '5px'
element.style.border = '1px solid #000'
element.style.display = 'block'  // 从 none 变为 block
element.style.position = 'absolute'

// 改变 DOM 结构
element.appendChild(newChild)
element.removeChild(child)
element.insertBefore(newChild, reference)
element.innerHTML = 'new content'

// 强制同步布局（最常被忽略的问题）
element.style.width = '100px'
console.log(element.offsetWidth)  // ← 强制浏览器立即计算布局！
```

### 强制同步布局（Forced Synchronous Layout）

```javascript
// 坏的写法：读写交替，触发多次重排
function resizeAllParagraphs() {
  const paragraphs = document.querySelectorAll('p');
  for (const p of paragraphs) {
    p.style.width = p.offsetWidth + 10 + 'px';
    // 写 → 读 → 写 → 读
    // 每次读 offsetWidth 都强制重排
  }
}

// 好的写法：先读后写，只触发一次重排
function resizeAllParagraphs() {
  const paragraphs = document.querySelectorAll('p');
  const widths = [];
  
  // 先读取所有宽度
  for (const p of paragraphs) {
    widths.push(p.offsetWidth);
  }
  
  // 再写入所有新宽度
  for (let i = 0; i < paragraphs.length; i++) {
    paragraphs[i].style.width = widths[i] + 10 + 'px';
  }
}
```

### 布局抖动（Layout Thrashing）

```javascript
// 布局抖动：在循环中反复读写布局属性
// 这是 React/Vue 等框架中常见的性能问题

// 典型场景：动画
function animate() {
  const boxes = document.querySelectorAll('.box');
  boxes.forEach(box => {
    const current = box.getBoundingClientRect(); // 读 → 触发重排
    box.style.left = current.left + 1 + 'px';    // 写 → 标记需要重排
  });
  requestAnimationFrame(animate); // 下一帧又来一遍
}

// 解决方案：用 transform 代替 left/top
function animate() {
  const boxes = document.querySelectorAll('.box');
  let offset = 0;
  function step() {
    offset += 1;
    boxes.forEach(box => {
      box.style.transform = `translateX(${offset}px)`; // 只触发合成，不重排
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

## 重绘（Repaint）

重绘是重新填充像素的过程，不涉及几何计算。

```javascript
// 触发重绘但不触发重排的操作
element.style.color = 'red'
element.style.backgroundColor = '#f00'
element.style.visibility = 'hidden'  // 隐藏但保留空间
element.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'
element.style.outline = '2px solid blue'

// 重排一定会触发重绘
// 重绘不一定触发重排
```

### 优化重绘

```javascript
// 使用 will-change 提示浏览器
.element {
  will-change: transform;  /* 告诉浏览器这个元素要频繁变换 */
}

// 使用 contain 限制影响范围
.card {
  contain: layout;  /* 这个元素的布局变化不影响外部 */
}

.card-isolated {
  contain: strict;  /* layout + paint + size 都隔离 */
}
```

## 合成层（Compositing Layer）

合成层是 GPU 加速的基础。理解合成层是做高性能动画的关键。

### 什么是合成层

```
普通元素：
  所有元素在同一个层（根层）中
  任何一个元素变化，整个层都要重绘
  CPU 处理

合成层（Compositing Layer）：
  特定元素会被提升为独立的层
  这个层的变化只影响这个层本身
  GPU 处理（硬件加速）

浏览器把多个层"合成"到一起，形成最终画面。
```

### 什么会创建合成层

```css
/* 1. 3D 变换 */
.element {
  transform: translateZ(0);
  transform: translate3d(0, 0, 0);
}

/* 2. will-change: transform 或 opacity */
.element {
  will-change: transform;
}

/* 3. CSS 动画中的 transform 和 opacity */
.element {
  animation: slide 1s ease-in-out;
}

/* 4. <video>、<canvas>、<iframe> 元素 */

/* 5. 有合成层后代的元素 */
```

### 合成层的性能优势

```javascript
// 动画性能对比

// 方案 A：改变 left（触发重排 + 重绘 + 合成）
.box {
  position: absolute;
  left: 0;
  transition: left 0.3s;
}
.box.moved { left: 100px; }
// 性能：差。left 变化 → 重排 → 重绘 → 合成

// 方案 B：改变 transform（只触发合成）
.box {
  transform: translateX(0);
  transition: transform 0.3s;
}
.box.moved { transform: translateX(100px); }
// 性能：好。transform 变化只在合成层处理，GPU 加速

// 方案 C：提前提升为合成层
.box {
  will-change: transform;
  transform: translateX(0);
  transition: transform 0.3s;
}
.box.moved { transform: translateX(100px); }
// 性能：最好。层已经提前创建，动画开始时不需要重新创建层
```

### 合成层的代价

```
合成层不是越多越好。每个合成层需要：
1. 内存：每个层都需要独立的纹理内存
2. GPU 资源：GPU 需要管理这些层
3. 合成成本：层数越多，合成到最终画面的成本越高

常见错误：
- 给所有元素加 will-change: transform
- 结果：页面创建了上百个合成层，内存暴涨，合成反而变慢

正确做法：
- 只为真正需要动画的元素创建合成层
- 动画结束后移除 will-change
- 监控层数量（Chrome DevTools Layers 面板）
```

```css
/* 坏的写法 */
* {
  will-change: transform;  /* 不要这样做！ */
}

/* 好的写法 */
.animated-element {
  will-change: transform;
}
/* 动画结束后通过 JS 移除 */
```

## requestAnimationFrame

`requestAnimationFrame`（rAF）是浏览器提供的动画帧回调 API。

### 为什么用 rAF 而不是 setTimeout

```javascript
// 坏的写法：用 setTimeout 做动画
function animate() {
  element.style.left = position + 'px';
  position += 1;
  setTimeout(animate, 16);  // 试图模拟 60fps
}
// 问题：
// 1. setTimeout 不保证和屏幕刷新率同步
// 2. 后台标签页仍在执行（浪费资源）
// 3. 可能掉帧（两次回调之间间隔不稳定）

// 好的写法：用 rAF
function animate(timestamp) {
  element.style.left = position + 'px';
  position += 1;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
// 优势：
// 1. 和屏幕刷新率同步（通常 60fps）
// 2. 后台标签页自动暂停
// 3. 浏览器可以优化回调执行时机
```

### rAF 的时间戳

```javascript
// 使用时间戳保证动画速度一致
let startTime = null;
const duration = 1000; // 动画持续 1 秒

function animate(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const progress = Math.min(elapsed / duration, 1);
  
  // 使用 easeInOut 缓动函数
  const eased = progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress;
  
  element.style.transform = `translateX(${eased * 300}px)`;
  
  if (progress < 1) {
    requestAnimationFrame(animate);
  }
}

requestAnimationFrame(animate);
```

### rAF 的执行时机

```
浏览器每一帧的执行顺序：

1. 处理输入事件（click、scroll、touch 等）
2. 执行 rAF 回调
3. 布局（Layout / 重排）
4. 绘制（Paint / 重绘）
5. 合成（Compositing）
6. 屏幕刷新

关键点：rAF 在布局和绘制之前执行。
所以如果你在 rAF 中读取布局属性，不会触发强制同步布局：

function animate(timestamp) {
  // 这里读取 offsetWidth 不会触发额外重排
  // 因为 rAF 在布局之前执行
  const width = element.offsetWidth;
  element.style.width = width + 1 + 'px';
  requestAnimationFrame(animate);
}
```

## requestIdleCallback

`requestIdleCallback` 在浏览器空闲时执行低优先级任务。

```javascript
// 适用场景：非紧急任务
// - 数据上报
// - 预加载资源
// - 后台数据处理
// - 分析统计

function processData(deadline) {
  // deadline.timeRemaining() 返回当前帧剩余的空闲时间（ms）
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    const task = tasks.shift();
    processTask(task);
  }
  
  // 如果还有任务没处理完，等下一帧空闲时继续
  if (tasks.length > 0) {
    requestIdleCallback(processData);
  }
}

requestIdleCallback(processData);

// 设置超时：如果 2 秒内都没找到空闲时间，也要执行
requestIdleCallback(processData, { timeout: 2000 });
```

### rAF vs rIC

```
requestAnimationFrame:
  - 每帧都会执行（60fps = 每 16.6ms）
  - 在布局和绘制之前
  - 适合：动画、视觉更新

requestIdleCallback:
  - 在帧的空闲时间执行
  - 不保证执行时机
  - 适合：低优先级、非视觉任务
  - 注意：不是所有浏览器都支持（Safari 不支持）
  - polyfill：用 setTimeout + requestAnimationFrame 模拟
```

## 实战：优化长列表渲染

```javascript
// 问题：渲染 10000 个列表项，页面卡顿

// 方案一：虚拟列表（只渲染可见区域）
// 详见 04 课

// 方案二：分批渲染（用 rAF 分批插入 DOM）
function renderInBatches(items, container, batchSize = 50) {
  let index = 0;
  
  function renderBatch() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + batchSize, items.length);
    
    for (let i = index; i < end; i++) {
      const li = document.createElement('li');
      li.textContent = items[i];
      fragment.appendChild(li);
    }
    
    container.appendChild(fragment);
    index = end;
    
    if (index < items.length) {
      requestAnimationFrame(renderBatch);
    }
  }
  
  requestAnimationFrame(renderBatch);
}
```

## 本课小结

```
渲染性能优化的核心原则：

1. 减少重排
   - 批量读写分离
   - 用 transform/left 代替 top/left
   - 用 contain 限制影响范围
   - 避免布局抖动

2. 减少重绘
   - 用 opacity/transform 做动画（只触发合成）
   - 用 will-change 提示浏览器
   - 避免大面积重绘

3. 合理使用合成层
   - 为动画元素创建合成层
   - 不要过度创建（内存代价）
   - 动画结束后清理

4. 正确使用动画 API
   - rAF：视觉动画
   - rIC：低优先级后台任务
   - CSS 动画/transition：简单动画优先用 CSS
```

## 练习

### 练习一：识别重排触发点

以下代码中，哪些操作会触发重排？哪些只触发重绘？

```javascript
const el = document.getElementById('box');

// 操作 A
el.style.color = 'red';

// 操作 B
el.style.width = '200px';

// 操作 C
console.log(el.offsetHeight);

// 操作 D
el.style.transform = 'translateX(100px)';

// 操作 E
el.style.display = 'none';

// 操作 F
el.style.opacity = '0.5';

// 操作 G
el.style.position = 'absolute';
el.style.left = '50px';

// 操作 H
console.log(el.getBoundingClientRect());
```

### 练习二：优化动画性能

以下动画代码有性能问题，请优化：

```javascript
// 当前实现：动画卡顿
function animateBox() {
  const box = document.getElementById('box');
  let left = 0;
  
  setInterval(() => {
    left += 2;
    box.style.left = left + 'px';
    
    // 同时改变背景色
    const hue = (left / 500) * 360;
    box.style.backgroundColor = `hsl(${hue}, 50%, 50%)`;
    
    if (left >= 500) {
      left = 0;
    }
  }, 16);
}
```

---

## 参考答案

### 练习一

```
操作 A：el.style.color = 'red'
  只触发重绘（不改变几何属性）

操作 B：el.style.width = '200px'
  触发重排 + 重绘（改变几何属性）

操作 C：console.log(el.offsetHeight)
  读取操作本身不触发重排，但如果之前有待处理的样式变更，
  会强制触发同步重排（Forced Synchronous Layout）

操作 D：el.style.transform = 'translateX(100px)'
  只触发合成（如果元素在合成层中）
  不触发重排和重绘（transform 不改变文档流中的位置）

操作 E：el.style.display = 'none'
  触发重排 + 重绘（元素从 Render Tree 中移除）

操作 F：el.style.opacity = '0.5'
  如果元素在合成层中：只触发合成
  如果元素不在合成层中：触发重绘

操作 G：el.style.position = 'absolute'; el.style.left = '50px'
  触发重排 + 重绘（改变几何属性）

操作 H：console.log(el.getBoundingClientRect())
  同操作 C，会强制同步重排
```

### 练习二

```javascript
// 优化后的实现
function animateBox() {
  const box = document.getElementById('box');
  let left = 0;
  let startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    
    // 用时间计算位置，保证帧率不稳定时动画速度一致
    left = (elapsed * 0.3) % 500;
    
    // 用 transform 代替 left（只触发合成，不重排）
    box.style.transform = `translateX(${left}px)`;
    
    // 用 CSS 自定义属性 + CSS 渐变代替 JS 计算颜色
    // 但如果必须用 JS，这样写也行（opacity/color 只触发重绘）
    const hue = (left / 500) * 360;
    box.style.backgroundColor = `hsl(${hue}, 50%, 50%)`;
    
    requestAnimationFrame(step);
  }
  
  requestAnimationFrame(step);
}

// 进一步优化：把颜色变化也放到 CSS 中
// CSS:
// @keyframes colorShift {
//   from { background-color: hsl(0, 50%, 50%); }
//   to { background-color: hsl(360, 50%, 50%); }
// }
// .box {
//   animation: colorShift 2s linear infinite;
// }
// JS 只负责 transform 动画
```

```
优化点总结：
1. setInterval → requestAnimationFrame（与屏幕刷新同步，后台暂停）
2. left → transform（避免重排，GPU 加速）
3. 魔法数字 16 → 基于时间戳计算（帧率不稳定时动画速度一致）
4. 可选：颜色变化用 CSS animation（让浏览器优化）
```

## 下一步

完成本课后，继续学习 [04. React/Vue 性能优化模式](./04-framework-performance.md)。

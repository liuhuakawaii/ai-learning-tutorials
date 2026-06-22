# 第二课：ScrollTrigger — 滚动驱动动画

## 场景引入

你在浏览一个设计感很强的官网，注意到：当你向下滚动时，图片从两侧滑入，文字逐段浮现，某个数据面板在进入视口后开始计数动画，而一个侧边导航栏在滚动到某个区域后"钉"在了屏幕顶部。

这些效果的共同点是：**动画的触发和进度由滚动位置决定**，而不是页面加载后自动播放。CSS 的 `@media` 查询只能做响应式布局，无法响应滚动位置。Intersection Observer API 能检测元素是否进入视口，但它无法告诉你"滚动到了元素的哪个百分比"，更无法让你把动画进度和滚动进度绑定。

GSAP 的 ScrollTrigger 插件就是为解决这个问题而生的。它是 GSAP 生态中使用最广泛的插件，几乎所有的现代动效网站都会用到它。

## 学习目标

- 掌握 ScrollTrigger 的基本配置和触发机制
- 学会用 `scrub` 实现滚动进度绑定动画进度
- 理解 `pin` 的工作原理和使用场景
- 掌握 `snap`、`batch`、`matchMedia` 等高级功能
- 能实现多段滚动动画的协调编排

## 一、安装与注册

ScrollTrigger 是 GSAP 的官方插件，包含在 gsap 包中，但需要手动注册：

```javascript
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)
```

注册只需做一次，通常在应用入口处执行。

### 为什么需要手动注册

GSAP 采用按需加载的设计。核心包 `gsap` 只包含补间功能，插件是独立模块。手动注册的好处是：

- **Tree-shaking 友好**：不用的插件不会被打包
- **明确依赖关系**：代码中一眼能看出用了哪些插件
- **避免命名冲突**：插件的属性名通过注册注入，不会意外覆盖

## 二、基础用法 — 滚动触发动画

最简单的 ScrollTrigger 配置是"元素进入视口时触发动画"：

```javascript
gsap.to(".fade-in-box", {
  opacity: 1,
  y: 0,
  duration: 1,
  scrollTrigger: {
    trigger: ".fade-in-box",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
})
```

### 关键配置项解析

- `trigger`：触发元素，可以是选择器或 DOM 元素
- `start`：触发位置，格式为 `"触发元素的哪一条边 视口的哪一条边"`
  - `"top 80%"` = 触发元素的顶部到达视口 80% 位置时
  - `"top center"` = 触发元素的顶部到达视口中心
  - `"bottom top"` = 触发元素的底部到达视口顶部
- `toggleActions`：定义动画在四个时刻的行为
  - 格式：`"onEnter onLeave onEnterBack onLeaveBack"`
  - 常用值：`"play none none reverse"`（进入时播放，回滚时反转）

### start 和 end 的格式

`start` 和 `end` 的格式都是 `"触发元素边界 视口边界"`：

```javascript
start: "top 80%"     // 元素顶部到达视口 80% 位置
start: "top center"  // 元素顶部到达视口中心
start: "top 200px"   // 元素顶部到达视口顶部下方 200px
start: "bottom top"  // 元素底部到达视口顶部
start: "center center" // 元素中心到达视口中心
```

视口边界可以是百分比、像素值或关键字（`top`、`center`、`bottom`）。

### toggleActions 的四个时刻

| 时刻 | 含义 |
|------|------|
| `onEnter` | 滚动方向向下，触发元素进入视口 |
| `onLeave` | 滚动方向向下，触发元素离开视口 |
| `onEnterBack` | 滚动方向向上，触发元素重新进入视口 |
| `onLeaveBack` | 滚动方向向上，触发元素从上方离开视口 |

每个时刻可选的动作为：`play`、`pause`、`resume`、`reset`、`restart`、`reverse`、`none`。

### 常用 toggleActions 组合

```javascript
// 进入时播放，回滚时反转（最常用）
toggleActions: "play none none reverse"

// 进入时播放，离开后重置，再次进入时重新播放
toggleActions: "play reset play reset"

// 进入时播放，离开时暂停，回滚时继续，再次离开时暂停
toggleActions: "play pause resume pause"

// 只播放一次，不反转
toggleActions: "play none none none"
```

### toggleClass — 滚动到指定位置时添加 CSS 类

```javascript
ScrollTrigger.create({
  trigger: ".feature-section",
  start: "top center",
  toggleClass: "is-visible"
})
```

这比手动操作 DOM 类更简洁，适合纯 CSS 过渡效果。

## 三、scrub — 滚动进度绑定动画进度

`scrub` 是 ScrollTrigger 最强大的功能之一。它让动画进度直接跟随滚动位置，而不是时间：

```javascript
gsap.to(".parallax-bg", {
  y: -200,
  scrollTrigger: {
    trigger: ".hero-section",
    start: "top top",
    end: "bottom top",
    scrub: true
  }
})
```

- `scrub: true`：动画进度和滚动位置同步（有轻微延迟，更平滑）
- `scrub: 1`：动画延迟 1 秒跟上滚动（更丝滑）
- `scrub: 0.5`：延迟 0.5 秒
- `scrub: 0`：完全同步，无延迟

### scrub 与时间动画的区别

```javascript
// 时间动画：触发后按 duration 播放，和滚动无关
gsap.to(".box-a", {
  x: 500,
  duration: 2,
  scrollTrigger: { trigger: ".section", start: "top center" }
})

// scrub 动画：滚动多少，动画就走多少
gsap.to(".box-b", {
  x: 500,
  scrollTrigger: {
    trigger: ".section",
    start: "top center",
    end: "bottom center",
    scrub: 1
  }
})
```

使用 `scrub` 时，`duration` 不再控制时长，而是控制动画的"距离感"——你可以把它理解为动画在滚动区间内的分布密度。

### scrub 的视觉直觉

想象一根绳子穿过一个管道。`start` 是管道入口，`end` 是管道出口，`scrub` 是绳子穿过管道的速度。当你滚动页面时，就像在拉动绳子。`scrub: true` 会让绳子有轻微的惯性，`scrub: 0` 则是绳子和你的手完全同步。

### scrub 动画的典型应用

```javascript
// 1. 视差滚动：背景移动速度和滚动不同
gsap.to(".hero-bg", {
  y: -150,
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    end: "bottom top",
    scrub: true
  }
})

// 2. 旋转进度：滚动时元素旋转
gsap.to(".gear", {
  rotation: 360,
  scrollTrigger: {
    trigger: ".section",
    start: "top bottom",
    end: "bottom top",
    scrub: 1
  }
})

// 3. 进度条：宽度随滚动增长
gsap.to(".progress-bar", {
  width: "100%",
  ease: "none",
  scrollTrigger: {
    trigger: document.documentElement,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.3
  }
})
```

## 四、pin — 将元素固定在视口中

`pin` 会将触发元素"钉"在视口中，直到 ScrollTrigger 结束：

```javascript
ScrollTrigger.create({
  trigger: ".sticky-panel",
  start: "top top",
  end: "+=500", // 向下滚动 500px 后解除固定
  pin: true
})
```

### pin 的工作原理

`pin` 本质上是给元素添加 `position: fixed`，并在滚动过程中动态调整。它会自动创建一个"占位"空间，防止布局塌陷。

### pin 配合 scrub 的典型用法

一个常见的效果：某个区域固定在屏幕上，同时内部内容随滚动变化：

```javascript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".showcase",
    start: "top top",
    end: "+=2000", // 固定 2000px 的滚动距离
    pin: true,
    scrub: 1
  }
})

tl.to(".slide-1", { opacity: 0, y: -100 })
  .from(".slide-2", { opacity: 0, y: 100 })
  .to(".slide-2", { opacity: 0, y: -100 })
  .from(".slide-3", { opacity: 0, y: 100 })
```

在这 2000px 的滚动距离中，三个幻灯片会依次出现和消失。

### pin 的 end 值写法

```javascript
end: "+=500"       // 向下滚动 500px 后结束
end: "+=100%"      // 向下滚动一个视口高度后结束
end: "bottom top"  // 元素底部到达视口顶部时结束
end: () => `+=${window.innerHeight * 3}` // 动态计算
```

### pinSpacing 的作用

默认情况下，`pin: true` 会在元素后面插入一个占位空间。如果你不需要这个空间（比如元素是 `position: absolute`），可以设置 `pinSpacing: false`：

```javascript
ScrollTrigger.create({
  trigger: ".overlay-section",
  start: "top top",
  end: "+=1000",
  pin: true,
  pinSpacing: false  // 不插入占位空间
})
```

### pin 的常见问题

1. **pin 元素内部有 `overflow: hidden`**：可能导致内容被裁剪。解决方案是给 pin 元素加一个 wrapper。
2. **pin 元素有 `transform` 父级**：`fixed` 定位在有 `transform` 的父元素内会失效。解决方案是调整 DOM 结构。
3. **移动端性能**：`pin` 在移动端可能产生抖动。建议在移动端禁用 pin，改用 CSS `position: sticky`。

## 五、snap — 滚动吸附

`snap` 可以让滚动在动画的特定位置"吸附"，产生类似翻页的效果：

```javascript
ScrollTrigger.create({
  trigger: ".slides-container",
  start: "top top",
  end: "+=3000",
  pin: true,
  scrub: 1,
  snap: {
    snapTo: 1 / 3, // 吸附到 0%, 33%, 66%, 100%
    duration: 0.3,
    ease: "power1.inOut"
  }
})
```

`snap` 的值可以是：
- 数字：吸附到等分点（`1/3` = 每 1/3 吸附一次）
- 数组：吸附到指定进度（`[0, 0.25, 0.5, 0.75, 1]`）
- `"labels"`：吸附到 Timeline 的标签位置
- 函数：自定义吸附逻辑

### snap 的高级配置

```javascript
snap: {
  snapTo: "labels",           // 吸附到标签
  duration: { min: 0.2, max: 0.6 },  // 吸附动画时长范围
  delay: 0.1,                 // 吸附前的延迟
  ease: "power1.inOut",       // 吸附缓动
  inertia: true,              // 惯性吸附
  directional: true           // 方向感知
}
```

### snap 的用户体验考量

snap 效果适合：
- 全屏幻灯片展示
- 时间线/年表类内容
- 步骤引导页面

不适合：
- 长文本阅读页面
- 需要自由滚动的列表
- 移动端（容易和原生滚动冲突）

## 六、batch — 批量元素的智能触发

对于大量元素（比如 50 个列表项），`stagger` 会让所有元素在同一个触发点依次播放，可能超出视口。ScrollTrigger 提供了 `batch()` 方法：

```javascript
ScrollTrigger.batch(".list-item", {
  onEnter: (elements) => {
    gsap.from(elements, {
      y: 40,
      opacity: 0,
      stagger: 0.05,
      duration: 0.6
    })
  },
  start: "top 85%"
})
```

`batch` 会将同一时间进入视口的元素分为一组，只对当前可见的元素执行动画。

### batch 与 stagger 的区别

| 特性 | stagger + ScrollTrigger | batch() |
|------|------------------------|---------|
| 触发方式 | 所有元素同时触发 | 按进入视口的时间分组 |
| 适用场景 | 元素数量少（<10） | 元素数量多（>10） |
| 性能 | 可能创建过多动画 | 只对可见元素创建动画 |
| 控制精度 | 精确到每个元素 | 按批次控制 |

### batch 的回调

```javascript
ScrollTrigger.batch(".item", {
  onEnter: (elements) => {
    gsap.from(elements, { opacity: 0, y: 30, stagger: 0.1 })
  },
  onLeave: (elements) => {
    gsap.to(elements, { opacity: 0, y: -30 })
  },
  onEnterBack: (elements) => {
    gsap.to(elements, { opacity: 1, y: 0 })
  },
  onLeaveBack: (elements) => {
    gsap.to(elements, { opacity: 0, y: 30 })
  },
  start: "top 85%",
  end: "bottom 15%"
})
```

## 七、ScrollTrigger.create() — 独立创建触发器

除了在 `gsap.to/from` 中内联 `scrollTrigger` 配置，你还可以用 `ScrollTrigger.create()` 独立创建触发器：

```javascript
ScrollTrigger.create({
  trigger: ".section",
  start: "top center",
  end: "bottom center",
  onEnter: () => console.log("进入"),
  onLeave: () => console.log("离开"),
  onEnterBack: () => console.log("回滚进入"),
  onLeaveBack: () => console.log("回滚离开"),
  onUpdate: (self) => {
    console.log("进度:", self.progress)
    console.log("方向:", self.direction) // 1=向下, -1=向上
  }
})
```

这种方式适合不绑定动画、只做滚动检测的场景。

### onUpdate 回调

`onUpdate` 在每次滚动时触发，`self` 参数包含丰富的信息：

```javascript
ScrollTrigger.create({
  trigger: ".section",
  start: "top top",
  end: "bottom top",
  onUpdate: (self) => {
    self.progress   // 0-1 的进度值
    self.direction  // 1 或 -1
    self.scroll()   // 当前滚动位置
    self.isActive   // 是否激活
    self.getVelocity() // 滚动速度（像素/秒）
  }
})
```

### 回调驱动非动画逻辑

```javascript
// 滚动到某个区域时改变导航高亮
ScrollTrigger.create({
  trigger: ".about-section",
  start: "top center",
  onEnter: () => {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active")
    })
    document.querySelector('[data-section="about"]').classList.add("active")
  }
})
```

## 八、matchMedia — 响应式动画

不同屏幕尺寸下，你可能需要完全不同的动画配置：

```javascript
ScrollTrigger.matchMedia({
  // 移动端
  "(max-width: 767px)": function () {
    gsap.from(".card", {
      y: 30,
      opacity: 0,
      scrollTrigger: {
        trigger: ".card",
        start: "top 90%"
      }
    })
  },

  // 桌面端
  "(min-width: 768px)": function () {
    gsap.from(".card", {
      x: -100,
      opacity: 0,
      scrollTrigger: {
        trigger: ".card",
        start: "top 70%"
      }
    })
  },

  // 所有尺寸通用
  "all": function () {
    gsap.to(".progress-bar", {
      width: "100%",
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3
      }
    })
  }
})
```

`matchMedia` 会在媒体查询匹配时执行对应的函数，不匹配时自动销毁其中创建的所有 ScrollTrigger 实例。

### 响应式动画的注意事项

```javascript
// 1. 用 ScrollTrigger.saveStyles() 保存初始样式
// 这样在窗口大小变化时，元素不会跳到错误的位置
ScrollTrigger.saveStyles(".hero, .card, .sidebar")

// 2. 在 matchMedia 中销毁旧实例
ScrollTrigger.matchMedia({
  "(max-width: 767px)": function () {
    // 这里的实例会在不匹配时自动销毁
  }
})

// 3. 手动刷新（在内容变化后）
ScrollTrigger.refresh()
```

## 九、实战：一个完整的滚动叙事页面

以下是一个"关于我们"页面的滚动动画编排：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    section { min-height: 100vh; padding: 80px 40px; }

    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f23;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      background: url('hero-bg.jpg') center/cover;
      opacity: 0.3;
    }
    .hero-content { position: relative; z-index: 1; text-align: center; }

    .stats-section {
      display: flex;
      justify-content: center;
      gap: 80px;
      align-items: center;
      background: #1a1a2e;
      color: white;
    }
    .stat-item { text-align: center; }
    .stat-number { font-size: 3rem; font-weight: bold; }
    .stat-label { margin-top: 8px; opacity: 0.7; }

    .history-section {
      background: #16213e;
      color: white;
      display: flex;
      align-items: center;
    }
    .history-content { max-width: 600px; margin: 0 auto; }
    .history-item {
      opacity: 0;
      padding: 40px 0;
      border-left: 3px solid #6366f1;
      padding-left: 24px;
    }

    .pin-spacer { background: #0a0a1a; }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <h1>我们的故事</h1>
      <p>从一个想法到改变世界</p>
    </div>
  </section>

  <section class="stats-section">
    <div class="stat-item">
      <div class="stat-number" data-target="150">0</div>
      <div class="stat-label">团队成员</div>
    </div>
    <div class="stat-item">
      <div class="stat-number" data-target="50">0</div>
      <div class="stat-label">服务城市</div>
    </div>
    <div class="stat-item">
      <div class="stat-number" data-target="1000000">0</div>
      <div class="stat-label">用户数量</div>
    </div>
  </section>

  <section class="history-section">
    <div class="history-content">
      <div class="history-item year-2018">
        <h3>2018 · 创立</h3>
        <p>三人团队，一间车库，一个改变行业的梦想。</p>
      </div>
      <div class="history-item year-2020">
        <h3>2020 · 成长</h3>
        <p>获得 A 轮融资，团队扩展到 50 人。</p>
      </div>
      <div class="history-item year-2023">
        <h3>2023 · 扩张</h3>
        <p>业务覆盖全国 50 个城市，用户突破百万。</p>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
  <script>
    gsap.registerPlugin(ScrollTrigger)

    function initScrollAnimations() {
      // Hero 区域：视差滚动
      gsap.to(".hero-bg", {
        y: -150,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      })

      // 统计数字：进入视口时计数
      document.querySelectorAll(".stat-number").forEach(el => {
        const target = parseInt(el.dataset.target)
        gsap.from(el, {
          textContent: 0,
          duration: 2,
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: el,
            start: "top 75%"
          },
          onUpdate: function () {
            const val = Math.round(parseFloat(el.textContent))
            if (target >= 10000) {
              el.textContent = (val / 10000).toFixed(0) + "万+"
            } else {
              el.textContent = val + "+"
            }
          }
        })
      })

      // 时间线：固定区域内的逐项展示
      const historyTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".history-section",
          start: "top top",
          end: "+=3000",
          pin: true,
          scrub: 1,
          snap: {
            snapTo: "labels",
            duration: { min: 0.2, max: 0.6 }
          }
        }
      })

      historyTl
        .addLabel("founding")
        .from(".year-2018", { opacity: 0, x: -50, duration: 0.5 })
        .addLabel("growth")
        .from(".year-2020", { opacity: 0, x: -50, duration: 0.5 })
        .addLabel("expansion")
        .from(".year-2023", { opacity: 0, x: -50, duration: 0.5 })
        .addLabel("future")
    }

    initScrollAnimations()
  </script>
</body>
</html>
```

## 十、ScrollTrigger 的实例管理

### 获取所有实例

```javascript
// 获取所有 ScrollTrigger 实例
const allTriggers = ScrollTrigger.getAll()

// 获取特定元素的实例
const myTrigger = ScrollTrigger.get(".my-element")
```

### 刷新与更新

```javascript
// 全量刷新（重新计算所有触发位置）
ScrollTrigger.refresh()

// 刷新时忽略某些元素
ScrollTrigger.refresh(true) // 参数为 deep 刷新

// 在内容变化后刷新
function afterContentUpdate() {
  // 等待 DOM 更新完成
  requestAnimationFrame(() => {
    ScrollTrigger.refresh()
  })
}
```

### 销毁实例

```javascript
// 销毁单个实例
const st = ScrollTrigger.create({ ... })
st.kill()

// 销毁所有实例
ScrollTrigger.getAll().forEach(st => st.kill())

// 在 React 组件卸载时清理
useEffect(() => {
  return () => {
    ScrollTrigger.getAll().forEach(st => st.kill())
  }
}, [])
```

## 常见误区

1. **忘记 `start` 和 `end` 的默认值**：默认 `start` 是 `"top bottom"`（元素顶部到达视口底部），`end` 是 `"bottom top"`。很多人不设 `end`，导致 scrub 动画的区间过长或过短。

2. **在 SPA 中忘记 `ScrollTrigger.refresh()`**：如果你动态添加或移除了内容（改变了页面高度），必须调用 `ScrollTrigger.refresh()` 重新计算触发位置。

3. **pin 元素后布局错乱**：pin 会自动添加 wrapper，但如果元素本身有 `overflow: hidden` 或复杂的定位，可能出现问题。建议 pin 的元素尽量用简单的布局。

4. **scrub 和 duration 混淆**：使用 scrub 时，`duration` 不再控制时间，而是控制动画在滚动区间内的"密度"。

5. **移动端性能问题**：`pin: true` 在移动端可能产生抖动。建议在移动端禁用 pin，改用 `position: sticky`。

6. **忘记注册插件**：`gsap.registerPlugin(ScrollTrigger)` 必须在使用前调用，否则 ScrollTrigger 不会工作，控制台也不会报错。

7. **在 `useEffect` 中创建但不在清理中销毁**：每次组件重新渲染都会创建新的 ScrollTrigger 实例，旧的不会自动销毁，导致性能问题和重复触发动画。

8. **`end` 值设置过短**：scrub 动画的 `end` 值决定了动画的滚动区间。如果太短，动画会在用户还没来得及看清时就结束了。

## 工程建议

1. **用 `ScrollTrigger.saveStyles()` 处理响应式**：

```javascript
// 在 resize 前保存当前样式
ScrollTrigger.saveStyles(".hero, .card")

ScrollTrigger.matchMedia({
  "(max-width: 768px)": function () {
    // 移动端的动画配置
    gsap.to(".card", { y: 0, scrollTrigger: { ... } })
  },
  "(min-width: 769px)": function () {
    // 桌面端的动画配置
    gsap.to(".card", { x: 100, scrollTrigger: { ... } })
  }
})
```

2. **用 `markers: true` 调试**：开发时在 ScrollTrigger 配置中加 `markers: true`，会在页面上显示触发位置的标记线。记得生产构建中移除。

3. **销毁时机**：在 React 组件卸载或页面切换时，调用 `ScrollTrigger.getAll().forEach(t => t.kill())` 清理所有实例。

4. **性能优先**：`scrub` 动画只使用 `transform` 和 `opacity`，避免触发布局重排的属性（如 `width`、`height`、`top`、`left`）。

5. **用 `onEnter` 和 `onLeave` 做非动画逻辑**：比如改变导航高亮、播放/暂停视频、触发数据加载等，不需要绑定动画时直接用回调。

6. **合理设置 `end` 值**：对于 scrub 动画，`end` 值决定了动画的滚动距离。全屏视差效果通常用 `"bottom top"`，固定区域展示用 `"+=Npx"` 或 `"+=100%"`。

## 小结

ScrollTrigger 将滚动转化为动画的控制信号——`trigger` 定义"在哪里触发"，`start/end` 定义"触发区间"，`scrub` 定义"是否绑定滚动进度"，`pin` 定义"是否固定元素"。这四个配置组合起来，几乎能实现任何滚动驱动的交互效果。

掌握 ScrollTrigger 的关键不是记住所有配置项，而是理解它的核心模型：**滚动位置 = 动画时间线的进度**。当你用这个心智模型去思考，很多复杂的滚动效果都能拆解为简单的"在哪里开始、在哪里结束、中间发生什么"。

## 练习

### 练习一：视差滚动

实现一个三层层叠视差效果：背景层（y 速度 -200）、中景层（y 速度 -100）、前景层（y 速度 0）。当用户滚动 `.parallax-section` 时，三层以不同速度移动，产生深度感。

### 练习二：固定区域幻灯片

创建一个被 pin 住的区域，在用户滚动 3000px 的过程中，依次展示 4 张图片（每张图片淡入 → 展示 → 淡出），并在滚动到每张图片时添加对应的导航高亮。

### 练习三：滚动进度指示器

创建一个页面顶部的进度条，宽度从 0% 到 100% 跟随页面滚动进度。用 `scrub` 实现。

### 练习四：数字滚动计数器

创建一个统计区域，包含 3 个数字（如 150+、50+、100 万+），当元素进入视口时，数字从 0 计数到目标值。

### 练习五：视差图片廊

创建一个图片廊，每张图片在滚动时有不同的视差速度，且图片在进入视口时有缩放效果。

---

## 参考答案

### 练习一

**思路**：三个元素分别设置不同的 `scrub` 位移值，共享同一个 `trigger`，通过不同的 `y` 值产生速度差。

**答案**：

```javascript
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function createParallax() {
  const triggerConfig = {
    trigger: ".parallax-section",
    start: "top bottom",
    end: "bottom top",
    scrub: true
  }

  // 背景层：移动最慢（视觉上最远）
  gsap.to(".parallax-bg", {
    y: -200,
    scrollTrigger: triggerConfig
  })

  // 中景层：中等速度
  gsap.to(".parallax-mid", {
    y: -100,
    scrollTrigger: triggerConfig
  })

  // 前景层：不动（或微动）
  gsap.to(".parallax-fg", {
    y: 0,
    scrollTrigger: triggerConfig
  })
}

createParallax()
```

**要点**：
- 三层共享同一个 trigger 配置，确保触发时机一致
- `y` 值的绝对值越大，该层移动越快（视觉上越近）
- `scrub: true` 让位移和滚动进度绑定

### 练习二

**思路**：用 Timeline + `pin` + `scrub` 实现固定区域，用 `addLabel` 标记每张图片的时间点，用 `snap` 让滚动吸附到每张图片。

**答案**：

```javascript
function createSlideshow() {
  const slides = document.querySelectorAll(".slide")
  const navItems = document.querySelectorAll(".nav-dot")

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".slideshow",
      start: "top top",
      end: "+=3000",
      pin: true,
      scrub: 0.5,
      snap: {
        snapTo: 1 / (slides.length - 1),
        duration: { min: 0.2, max: 0.5 },
        ease: "power1.inOut"
      },
      onUpdate: (self) => {
        // 根据进度更新导航高亮
        const index = Math.round(self.progress * (slides.length - 1))
        navItems.forEach((dot, i) => {
          dot.classList.toggle("active", i === index)
        })
      }
    }
  })

  slides.forEach((slide, i) => {
    if (i === 0) {
      tl.from(slide, { opacity: 0, duration: 0.5 })
    } else {
      tl.to(slides[i - 1], { opacity: 0, duration: 0.5 })
        .from(slide, { opacity: 0, duration: 0.5 }, "<")
    }
    tl.addLabel(`slide-${i}`)
  })
}

createSlideshow()
```

**要点**：
- `snap: 1 / (slides.length - 1)` 让滚动在每张图片之间吸附
- `onUpdate` 回调在每次 ScrollTrigger 刷新时执行，用于同步导航状态
- `"<"` position 参数让前一张淡出和后一张淡入同时进行

### 练习三

**思路**：用 `scrub` 绑定整个页面的滚动进度到一个元素的 `width` 属性。

**答案**：

```javascript
function createScrollProgress() {
  const bar = document.querySelector(".progress-bar")

  gsap.to(bar, {
    width: "100%",
    ease: "none",
    scrollTrigger: {
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.3
    }
  })
}

createScrollProgress()
```

```html
<style>
  .progress-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    z-index: 9999;
    background: rgba(0,0,0,0.1);
  }
  .progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
  }
</style>
<div class="progress-container">
  <div class="progress-bar"></div>
</div>
```

**要点**：
- `trigger: document.documentElement` 绑定整个页面
- `scrub: 0.3` 让进度条平滑跟随
- `ease: "none"` 让进度增长和滚动距离成线性关系

### 练习四

**思路**：用 `gsap.from()` 的 `textContent` 属性配合 `snap` 实现计数效果。

**答案**：

```javascript
function createCounters() {
  const counters = document.querySelectorAll(".stat-number")

  counters.forEach(counter => {
    const target = parseInt(counter.dataset.target)

    gsap.from(counter, {
      textContent: 0,
      duration: 2,
      snap: { textContent: 1 },
      ease: "power1.out",
      scrollTrigger: {
        trigger: counter,
        start: "top 80%",
        toggleActions: "play none none none"
      },
      onUpdate: function () {
        const val = Math.round(parseFloat(counter.textContent))
        if (target >= 10000) {
          counter.textContent = (val / 10000).toFixed(0) + "万+"
        } else {
          counter.textContent = val + "+"
        }
      }
    })
  })
}

createCounters()
```

**要点**：
- `snap: { textContent: 1 }` 让数字只显示整数
- `onUpdate` 在每帧更新数字显示格式
- `toggleActions: "play none none none"` 确保只播放一次

### 练习五

**思路**：用 `batch()` 批量处理图片，每张图片有不同的视差速度。

**答案**：

```javascript
function createGalleryParallax() {
  const items = document.querySelectorAll(".gallery-item")

  items.forEach((item, i) => {
    const img = item.querySelector("img")
    const direction = i % 2 === 0 ? -1 : 1

    gsap.from(item, {
      opacity: 0,
      y: 60,
      duration: 0.8,
      scrollTrigger: {
        trigger: item,
        start: "top 85%",
        toggleActions: "play none none reverse"
      }
    })

    gsap.to(img, {
      y: direction * 80,
      scale: 1.1,
      scrollTrigger: {
        trigger: item,
        start: "top bottom",
        end: "bottom top",
        scrub: 1
      }
    })
  })
}

createGalleryParallax()
```

**要点**：
- 每张图片有独立的 ScrollTrigger，可以有不同的触发位置和速度
- `direction` 变量让奇偶图片的视差方向相反，增加视觉层次
- `scrub: 1` 让视差效果平滑跟随滚动

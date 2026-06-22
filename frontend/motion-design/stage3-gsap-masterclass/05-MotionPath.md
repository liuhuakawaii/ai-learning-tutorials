# 第五课：MotionPath — 让元素沿路径运动

## 场景引入

你在一个产品着陆页上看到一个小图标沿着一条弧线从屏幕左侧飞到右侧，留下一串渐隐的轨迹。在另一个数据可视化页面中，一个数据点沿着贝塞尔曲线平滑移动，同时它的朝向始终与曲线方向一致。

这些效果的核心挑战是：CSS 的 `transform` 只能做线性的位移、旋转和缩放，无法让元素沿着一条**自定义曲线**运动。你可以用 CSS `offset-path` 和 `offset-distance` 来实现，但浏览器兼容性有限，且路径定义很不直观。

GSAP 的 MotionPath 插件让你用 SVG 路径数据或坐标数组来定义任意形状的运动轨迹，元素会自动沿着路径移动并保持正确的朝向。

为什么路径动画有价值？因为自然界中几乎没有什么东西是沿直线运动的——水流、鸟飞、行星运转，都是曲线。路径动画让网页动效更接近自然，更有生命力。

## 学习目标

- 掌握 MotionPath 的基本配置和路径定义方式
- 理解 `align` 和 `autoRotate` 的作用
- 学会用 SVG 路径数据驱动元素运动
- 能实现一个粒子沿曲线运动的动画效果
- 了解路径动画在数据可视化和交互设计中的应用

## 一、安装与注册

MotionPath 包含在 GSAP 包中，需要注册：

```javascript
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"

gsap.registerPlugin(MotionPathPlugin)
```

MotionPath 的工作原理：在每一帧中，根据动画进度（0-1），在路径上插值得到当前位置坐标，然后设置元素的 `transform: translate(x, y)`。如果启用了 `autoRotate`，还会计算路径在该点的切线方向并设置 `rotation`。

## 二、基础用法 — 坐标数组

最简单的路径是用坐标点数组定义。GSAP 会在点之间自动生成平滑的贝塞尔曲线：

```javascript
gsap.to(".dot", {
  motionPath: {
    path: [
      { x: 100, y: 0 },
      { x: 200, y: -80 },
      { x: 300, y: 0 }
    ],
    curviness: 1.5
  },
  duration: 2,
  ease: "power1.inOut"
})
```

- `path`：坐标数组，GSAP 会自动在点之间插值生成平滑曲线
- `curviness`：曲线的弯曲程度（默认 1），值越大曲线越平滑

### curviness 的效果

| 值 | 效果 | 适用场景 |
|---|------|----------|
| 0 | 直线连接各点 | 几何感、机械运动 |
| 0.5 | 轻微弯曲 | 自然的位移 |
| 1 | 中等弯曲（默认） | 通用场景 |
| 1.5 | 较大弯曲 | 流畅的弧线运动 |
| 2 | 非常弯曲 | 夸张的波浪效果 |

### 坐标数组的起点

坐标数组是相对于元素**当前位置**的偏移量，不是绝对页面坐标：

```javascript
// 元素当前位置为 (200, 300)
gsap.to(".dot", {
  motionPath: {
    path: [
      { x: 0, y: 0 },     // 起点：当前位置
      { x: 100, y: -50 },  // 向右 100，向上 50
      { x: 200, y: 0 }     // 向右 200，回到原始高度
    ]
  },
  duration: 2
})
```

## 三、使用 SVG 路径数据

更常见的是用 SVG 的 `d` 属性来定义路径，这样可以在设计工具中可视化地绘制曲线：

```html
<svg width="500" height="300" viewBox="0 0 500 300">
  <path
    id="motion-path"
    d="M 50 150 C 150 50, 350 50, 450 150 S 250 250, 50 150"
    fill="none"
    stroke="#ccc"
    stroke-width="2"
  />
</svg>

<div class="flyer" style="position: absolute;">🚀</div>
```

```javascript
gsap.to(".flyer", {
  motionPath: {
    path: "#motion-path",
    align: "#motion-path",
    autoRotate: true,
    alignOrigin: [0.5, 0.5]
  },
  duration: 3,
  ease: "power1.inOut"
})
```

### 关键配置项

- `path`：可以是选择器字符串，指向 SVG 的 `<path>` 元素
- `align`：让元素对齐到路径上（不只是位置，还包括旋转角度）
- `autoRotate`：让元素的朝向始终与路径的切线方向一致
- `alignOrigin`：元素的哪个点对齐到路径上，`[0.5, 0.5]` 表示中心点

### SVG 路径语法速查

理解常见的 SVG 路径命令有助于调试和微调路径：

```
M x y        — 移动到 (x, y)
L x y        — 直线到 (x, y)
C x1 y1, x2 y2, x y — 三次贝塞尔曲线
S x2 y2, x y         — 平滑三次贝塞尔（自动镜像控制点）
Q x1 y1, x y         — 二次贝塞尔曲线
A rx ry rot large sweep x y — 弧线
Z              — 闭合路径
```

## 四、align 与 autoRotate 的深入理解

### align

`align` 将元素的位置绑定到路径上的对应点。没有 `align` 时，元素只按照 `x, y` 坐标移动，路径只影响位移，不影响旋转。

```javascript
// 没有 align：元素移动但不旋转
gsap.to(".arrow", {
  motionPath: {
    path: "#curve",
    align: false
  }
})

// 有 align：元素沿着路径移动并自动对齐
gsap.to(".arrow", {
  motionPath: {
    path: "#curve",
    align: "#curve",
    alignOrigin: [0.5, 0.5]
  }
})
```

### autoRotate

`autoRotate: true` 让元素始终面向运动方向：

```javascript
// 箭头始终指向运动方向
gsap.to(".arrow", {
  motionPath: {
    path: "#trajectory",
    align: "#trajectory",
    autoRotate: true,
    alignOrigin: [0.5, 0.5]
  },
  duration: 4,
  ease: "none"
})
```

如果元素的"正面"不是默认的 0 度方向，可以用角度值调整：

```javascript
autoRotate: 90 // 元素默认朝下，需要旋转 90 度才朝右
```

### autoRotate 的偏移角度

不同元素的"正面"方向可能不同。一个向右的箭头图标，其默认朝向是 0 度；但一个向上的箭头，默认朝向是 -90 度。需要根据元素的视觉方向设置偏移：

```javascript
// 飞机图标默认朝右（0 度）
autoRotate: 0

// 鱼图标默认朝左（180 度）
autoRotate: 180

// 火箭图标默认朝上（-90 度）
autoRotate: -90
```

## 五、path 的两种形式

MotionPath 接受两种路径格式：

### 1. SVG 路径选择器

```javascript
motionPath: {
  path: "#my-svg-path",
  align: "#my-svg-path"
}
```

优点：路径可视化，可以用设计工具编辑。缺点：需要额外的 SVG 元素。

### 2. 坐标数组

```javascript
motionPath: {
  path: [
    { x: 0, y: 0 },
    { x: 100, y: -50 },
    { x: 200, y: 30 },
    { x: 300, y: 0 }
  ],
  type: "cubic", // 或 "soft"（默认）
  curviness: 1.2
}
```

- `type: "soft"`：使用 Catmull-Rom 样条，曲线更柔和，经过所有控制点
- `type: "cubic"`：使用三次贝塞尔，控制更精确，曲线可能不完全经过中间控制点

### soft vs cubic 的区别

```
soft（Catmull-Rom）：
  - 曲线必定经过所有控制点
  - 曲线更"圆润"
  - 适合自然运动轨迹

cubic（贝塞尔）：
  - 曲线只经过首尾控制点
  - 中间控制点是"吸引力"，不是必经点
  - 适合需要精确控制的场景
```

## 六、start 和 end — 控制路径范围

你可以只使用路径的一部分：

```javascript
gsap.to(".dot", {
  motionPath: {
    path: "#full-path",
    align: "#full-path",
    start: 0.2,  // 从路径的 20% 处开始
    end: 0.8     // 到路径的 80% 处结束
  },
  duration: 2
})
```

这在配合 ScrollTrigger 时特别有用——你可以让滚动进度映射到路径的某个区间。

### 路径进度的可视化

可以用 `onUpdate` 回调获取当前路径进度：

```javascript
gsap.to(".dot", {
  motionPath: {
    path: "#track",
    align: "#track",
    autoRotate: true,
    alignOrigin: [0.5, 0.5]
  },
  duration: 4,
  ease: "none",
  onUpdate: function () {
    const progress = this.progress()
    document.querySelector(".progress-bar").style.width = `${progress * 100}%`
  }
})
```

## 七、多元素沿同一路径运动

让多个元素沿同一路径运动，但起始时间不同：

```javascript
function createPathAnimation() {
  const path = "#flight-path"

  // 飞机 A
  gsap.to(".plane-a", {
    motionPath: {
      path: path,
      align: path,
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    duration: 4,
    ease: "power1.inOut"
  })

  // 飞机 B，延迟 1 秒
  gsap.to(".plane-b", {
    motionPath: {
      path: path,
      align: path,
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    duration: 4,
    delay: 1,
    ease: "power1.inOut"
  })
}
```

### 用 stagger 优化

如果元素数量较多，可以用 stagger：

```javascript
gsap.to(".particle", {
  motionPath: {
    path: "#orbit-path",
    align: "#orbit-path",
    autoRotate: true,
    alignOrigin: [0.5, 0.5]
  },
  duration: 3,
  stagger: 0.2,
  ease: "none",
  repeat: -1
})
```

### 不同起点的多元素运动

让多个元素从路径的不同位置开始运动：

```javascript
function staggeredPathElements(selector, path, count) {
  const elements = document.querySelectorAll(selector)

  elements.forEach((el, i) => {
    gsap.to(el, {
      motionPath: {
        path: path,
        align: path,
        autoRotate: true,
        alignOrigin: [0.5, 0.5],
        start: i / count,         // 不同的起始位置
        end: 1 + i / count        // 允许超过 1.0 循环回起点
      },
      duration: 4,
      ease: "none",
      repeat: -1
    })
  })
}
```

## 八、实战：太阳系轨道动画

一个简单的太阳系模型，行星沿椭圆轨道运动：

```javascript
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"

gsap.registerPlugin(MotionPathPlugin)

function createSolarSystem() {
  const planets = [
    { selector: ".mercury", duration: 3, size: 8, orbit: 60 },
    { selector: ".venus", duration: 5, size: 12, orbit: 100 },
    { selector: ".earth", duration: 8, size: 14, orbit: 150 },
    { selector: ".mars", duration: 12, size: 10, orbit: 200 }
  ]

  planets.forEach(planet => {
    gsap.set(planet.selector, {
      width: planet.size,
      height: planet.size,
      borderRadius: "50%"
    })

    // 用正弦/余弦生成椭圆轨道
    const points = []
    const segments = 36
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push({
        x: Math.cos(angle) * planet.orbit,
        y: Math.sin(angle) * planet.orbit * 0.6 // 椭圆：y 轴压缩
      })
    }

    gsap.to(planet.selector, {
      motionPath: {
        path: points,
        type: "cubic",
        curviness: 1.3
      },
      duration: planet.duration,
      ease: "none",
      repeat: -1
    })
  })
}

createSolarSystem()
```

### 对应的 HTML 和 CSS

```html
<div class="solar-system">
  <div class="sun"></div>
  <div class="orbit orbit-1"></div>
  <div class="orbit orbit-2"></div>
  <div class="orbit orbit-3"></div>
  <div class="orbit orbit-4"></div>
  <div class="planet mercury"></div>
  <div class="planet venus"></div>
  <div class="planet earth"></div>
  <div class="planet mars"></div>
</div>
```

```css
.solar-system {
  position: relative;
  width: 500px;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sun {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 20px #fbbf24;
  position: absolute;
  z-index: 10;
}

.orbit {
  position: absolute;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.orbit-1 { width: 120px; height: 72px; }
.orbit-2 { width: 200px; height: 120px; }
.orbit-3 { width: 300px; height: 180px; }
.orbit-4 { width: 400px; height: 240px; }

.planet {
  position: absolute;
  border-radius: 50%;
}

.mercury { background: #9ca3af; }
.venus { background: #fcd34d; }
.earth { background: #3b82f6; }
.mars { background: #ef4444; }
```

## 九、MotionPath 配合 ScrollTrigger

让滚动进度驱动路径动画：

```javascript
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function scrollPathAnimation() {
  gsap.to(".journey-dot", {
    motionPath: {
      path: "#journey-path",
      align: "#journey-path",
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    scrollTrigger: {
      trigger: ".journey-section",
      start: "top top",
      end: "+=3000",
      pin: true,
      scrub: 1
    }
  })
}

scrollPathAnimation()
```

在这个例子中，用户滚动页面时，小圆点会沿着 SVG 路径移动，滚动位置直接映射到路径进度。

### 沿路径滚动的完整案例：产品故事线

```html
<section class="story-section">
  <svg class="story-svg" viewBox="0 0 1000 600">
    <path id="story-path"
      d="M 50 300 C 200 100, 400 500, 500 300 S 800 100, 950 300"
      fill="none" stroke="#e5e7eb" stroke-width="2"
      stroke-dasharray="8 4"
    />
  </svg>

  <div class="story-marker">📍</div>

  <div class="story-point point-1" style="left: 50px; top: 280px;">
    <h3>起点</h3>
    <p>2020 年，从一个想法开始</p>
  </div>
  <div class="story-point point-2" style="left: 500px; top: 280px;">
    <h3>转折</h3>
    <p>2022 年，产品上线</p>
  </div>
  <div class="story-point point-3" style="left: 950px; top: 280px;">
    <h3>未来</h3>
    <p>2024 年，服务全球用户</p>
  </div>
</section>
```

```javascript
function createStoryScroll() {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".story-section",
      start: "top top",
      end: "+=3000",
      pin: true,
      scrub: 1
    }
  })

  // 标记点沿路径运动
  tl.to(".story-marker", {
    motionPath: {
      path: "#story-path",
      align: "#story-path",
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    duration: 1
  })

  // 在路径的关键点触发文字显现
  tl.from(".point-1", { opacity: 0, y: 20, duration: 0.1 }, 0)
  tl.from(".point-2", { opacity: 0, y: 20, duration: 0.1 }, 0.4)
  tl.from(".point-3", { opacity: 0, y: 20, duration: 0.1 }, 0.8)
}
```

## 十、路径动画的调试技巧

### 可视化路径

在开发阶段，始终让 SVG 路径可见：

```css
/* 开发时显示路径，上线时隐藏 */
.motion-path-debug {
  stroke: #3b82f6;
  stroke-width: 2;
  stroke-dasharray: 4 4;
  fill: none;
}
```

### 路径方向检测

如果元素运动方向反了，可以在 SVG 编辑器中反转路径，或者在代码中翻转起止点：

```javascript
// 原始：从左到右
start: 0, end: 1

// 翻转：从右到左
start: 1, end: 0
```

### 路径偏移修正

如果元素偏离路径，通常是 `alignOrigin` 设置不对。调试方法：

```javascript
// 先用 [0, 0]（左上角）对齐，观察偏移
gsap.to(".element", {
  motionPath: {
    path: "#path",
    align: "#path",
    alignOrigin: [0, 0] // 左上角对齐路径
  }
})

// 然后调整到 [0.5, 0.5]（中心）或其他值
```

## 常见误区

1. **忘记 `align` 只影响旋转**：如果只设 `path` 不设 `align`，元素只按坐标移动，不会沿路径旋转。很多"箭头不转弯"的问题就是忘了加 `align`。

2. **SVG 路径的 viewBox 问题**：MotionPath 使用的是 SVG 的内部坐标系，不是屏幕像素。如果你的 SVG 有 `viewBox`，路径坐标是相对于 viewBox 的。

3. **`alignOrigin` 的误解**：`[0.5, 0.5]` 是元素的中心点，`[0, 0]` 是左上角。选错会导致元素偏离路径。

4. **路径方向**：SVG 路径的方向是从起点到终点的绘制方向。如果元素运动方向反了，检查路径的绘制顺序。

5. **性能问题**：大量元素同时沿路径运动时，每帧都要计算路径插值，可能影响性能。建议限制同时运动的元素数量，或使用 `will-change: transform`。

6. **坐标数组的单位混淆**：坐标数组是相对偏移，SVG 路径是绝对坐标。混用时要注意参考系不同。

7. **`repeat: -1` 时路径不闭合**：如果路径首尾不相连，循环播放时元素会突然跳回起点。确保路径是闭合的（SVG 路径末尾加 `Z`，或坐标数组首尾点相同）。

## 工程建议

1. **用设计工具绘制路径**：在 Figma 或 Illustrator 中绘制 SVG 路径，导出 `d` 属性值，比手写坐标高效得多。

2. **用 `type: "cubic"` 获得更精确的控制**：`soft` 类型的曲线可能在拐点处不够锐利，`cubic` 类型提供更精确的贝塞尔控制。

3. **配合 `ease: "none"` 使用**：路径动画的"节奏"应该由路径本身的形状决定，而不是缓动函数。除非你刻意想要加速/减速效果。

4. **调试时可视化路径**：在 SVG 中给路径添加 `stroke`，让你能看到元素正在沿着什么轨迹运动。

5. **用 `repeat: -1` 创建循环运动**：路径动画天然适合循环——行星轨道、Loading 动画、背景装饰等。

6. **路径长度与速度的关系**：相同 duration 下，路径越长，元素运动速度越快。如果需要统一速度，需要根据路径长度调整 duration。

## 小结

MotionPath 让元素沿任意曲线运动——用坐标数组定义简单路径，用 SVG 路径数据定义复杂曲线。`align` 让元素朝向与路径一致，`autoRotate` 让元素面向运动方向。配合 ScrollTrigger，路径动画可以被滚动进度驱动，实现"沿着一条线讲故事"的效果。

路径动画的核心价值在于打破直线运动的限制。在真实的交互设计中，曲线运动比直线运动更自然、更有品质感。

## 练习

### 练习一：弹跳球路径

创建一个动画，让一个小球沿着一条正弦波形状的路径从左向右运动（使用坐标数组定义路径），同时小球始终面向运动方向。要求路径至少有 5 个控制点，形成 2 个完整的波峰。

### 练习二：滚动驱动的路径动画

在页面上绘制一条 SVG 曲线路径（比如一条从左下到右上的弧线），创建一个标记点沿这条路径运动。要求使用 ScrollTrigger 的 scrub 模式，让标记点的位置由滚动进度决定。当用户滚动到底部时，标记点到达路径终点。

### 练习三：多粒子环绕动画

创建 6 个粒子沿同一椭圆轨道运动，每个粒子起始位置不同（均匀分布在轨道上），颜色不同，大小不同。要求所有粒子匀速运动，用 `repeat: -1` 循环。

---

## 参考答案

### 练习一

**思路**：用坐标数组模拟正弦波，x 坐标等间距递增，y 坐标在正负值之间交替。用 `type: "cubic"` 让曲线更平滑。

**答案**：

```javascript
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"

gsap.registerPlugin(MotionPathPlugin)

function createSineWave() {
  // 生成正弦波坐标：5 个控制点形成 2 个波峰
  const points = []
  const amplitude = 80
  const segments = 8

  for (let i = 0; i <= segments; i++) {
    points.push({
      x: i * 60,
      y: Math.sin(i * Math.PI) * amplitude
    })
  }

  gsap.to(".ball", {
    motionPath: {
      path: points,
      type: "cubic",
      curviness: 1.2,
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    duration: 4,
    ease: "none",
    repeat: -1
  })
}

createSineWave()
```

**要点**：
- `Math.sin(i * Math.PI)` 在 `i` 为整数时产生正弦波的零点和极值点
- `type: "cubic"` 让曲线在控制点之间更平滑
- `ease: "none"` 保持匀速运动，让视觉效果更自然

### 练习二

**思路**：用 SVG 绘制路径，MotionPath 绑定到路径上，ScrollTrigger 的 scrub 将滚动进度映射到路径进度。

**答案**：

```html
<svg width="100%" height="600" viewBox="0 0 800 600">
  <path
    id="scroll-path"
    d="M 50 550 C 200 500, 300 100, 400 300 S 600 50, 750 50"
    fill="none"
    stroke="#e5e7eb"
    stroke-width="2"
    stroke-dasharray="8 4"
  />
</svg>
<div class="marker" style="position: absolute;"></div>
```

```javascript
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger)

function createScrollPath() {
  gsap.to(".marker", {
    motionPath: {
      path: "#scroll-path",
      align: "#scroll-path",
      autoRotate: true,
      alignOrigin: [0.5, 0.5]
    },
    scrollTrigger: {
      trigger: ".path-section",
      start: "top top",
      end: "+=2000",
      pin: true,
      scrub: 1
    }
  })
}

createScrollPath()
```

**要点**：
- SVG 路径用 `stroke-dasharray` 虚线显示，增强视觉引导
- `scrub: 1` 让标记点平滑跟随滚动，避免生硬跳动
- `pin: true` 固定区域让用户专注于路径动画

### 练习三

**思路**：用正弦/余弦生成椭圆坐标，每个粒子用不同的 `start` 值让它们均匀分布在轨道上。

**答案**：

```javascript
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"

gsap.registerPlugin(MotionPathPlugin)

function createOrbitalParticles() {
  const particles = document.querySelectorAll(".particle")
  const orbitRadiusX = 200
  const orbitRadiusY = 120
  const segments = 60

  // 生成椭圆轨道坐标
  const orbitPoints = []
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    orbitPoints.push({
      x: Math.cos(angle) * orbitRadiusX,
      y: Math.sin(angle) * orbitRadiusY
    })
  }

  particles.forEach((particle, index) => {
    const totalParticles = particles.length
    const startOffset = index / totalParticles

    gsap.set(particle, {
      width: 8 + index * 2,
      height: 8 + index * 2,
      borderRadius: "50%",
      backgroundColor: `hsl(${index * 60}, 70%, 60%)`
    })

    gsap.to(particle, {
      motionPath: {
        path: orbitPoints,
        type: "cubic",
        curviness: 1.3,
        start: startOffset,
        end: 1 + startOffset
      },
      duration: 6,
      ease: "none",
      repeat: -1
    })
  })
}

createOrbitalParticles()
```

```html
<div class="orbit-container">
  <div class="center-point"></div>
  <div class="particle" style="position: absolute;"></div>
  <div class="particle" style="position: absolute;"></div>
  <div class="particle" style="position: absolute;"></div>
  <div class="particle" style="position: absolute;"></div>
  <div class="particle" style="position: absolute;"></div>
  <div class="particle" style="position: absolute;"></div>
</div>
```

**要点**：
- `start: startOffset` 让每个粒子从轨道的不同位置开始
- `end: 1 + startOffset` 让粒子运动超过 100% 后回到起点，形成无缝循环
- `hsl()` 函数根据索引生成不同色相，视觉上更丰富
- 所有粒子使用相同的 `duration` 和 `ease: "none"`，确保匀速同步

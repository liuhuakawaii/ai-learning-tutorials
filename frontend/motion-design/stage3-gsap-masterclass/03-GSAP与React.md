# 第三课：GSAP 与 React — 在组件化世界中驾驭动画

## 场景引入

你在 React 项目中用 GSAP 写了一个入场动画，本地开发时一切正常。部署上线后，用户反馈：从首页跳转到详情页再返回，动画不触发了。DevTools 里一堆 "GSAP target not found" 警告。更诡异的是，React Strict Mode 下动画执行了两次。

这些问题的根源是 React 的声明式渲染模型和 GSAP 的命令式动画模型之间的冲突。React 控制 DOM 的创建和销毁，而 GSAP 直接操作 DOM 元素。

理解这个冲突的本质，是在 React 中正确使用 GSAP 的关键：

- **React 的世界**：状态驱动 UI，组件的生命周期由 React 管理，DOM 是"虚拟"的
- **GSAP 的世界**：直接操作真实 DOM，动画是命令式的，生命周期由开发者管理

`useGSAP` hook 就是这两者之间的桥梁。

## 学习目标

- 理解 GSAP 在 React 中的核心挑战：ref 管理、清理、Strict Mode
- 掌握 `@gsap/react` 包提供的 `useGSAP` hook
- 学会在 React 组件中正确创建和销毁 GSAP 动画
- 掌握 ScrollTrigger 在 React 中的集成方式
- 了解常见的动画模式和性能优化技巧

## 一、为什么需要 useGSAP

在 React 中使用 GSAP 的核心问题是**清理**。手动管理非常繁琐：

```javascript
// ❌ 手动管理：容易遗漏
useEffect(() => {
  const tl = gsap.timeline()
  tl.to(".box", { x: 100, duration: 1 })
  tl.to(".circle", { scale: 1.5, duration: 0.5 })
  return () => { tl.kill() }
}, [])
```

上面的代码看起来没问题，但有几个隐患：

1. **Strict Mode 双调用**：React 18 开发模式下，`useEffect` 会执行两次。第一次创建的动画还没来得及清理就被第二次覆盖。
2. **选择器作用域**：`.box` 可能匹配到其他组件的元素。
3. **清理不完整**：如果有多个动画，你需要手动追踪每一个并在清理时销毁。

`@gsap/react` 包提供的 `useGSAP` hook 自动处理这些问题。

## 二、安装与基本用法

```bash
npm install gsap @gsap/react
```

```javascript
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function AnimatedCard() {
  const containerRef = useRef(null)

  useGSAP(() => {
    gsap.from(".card", {
      y: 50,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out"
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <div className="card">内容</div>
    </div>
  )
}
```

### useGSAP 的核心优势

| 特性 | useEffect 手动管理 | useGSAP |
|------|-------------------|---------|
| Strict Mode 兼容 | 需要手动处理 | 自动处理 |
| 清理 | 手动 kill 每个动画 | 自动清理所有动画 |
| 选择器作用域 | 全局查找 | scope 隔离 |
| 代码量 | 多 | 少 |

### scope 的作用

`scope` 让选择器只在该 ref 子树内查找元素，避免全局污染，且组件卸载时自动销毁所有动画。

```javascript
// 两个组件的 .box 互不干扰
function PanelA() {
  const ref = useRef(null)
  useGSAP(() => { gsap.to(".box", { x: 100 }) }, { scope: ref })
  return <div ref={ref}><div className="box" /></div>
}

function PanelB() {
  const ref = useRef(null)
  useGSAP(() => { gsap.to(".box", { x: -100 }) }, { scope: ref })
  return <div ref={ref}><div className="box" /></div>
}
```

如果没有 `scope`，两个组件都会匹配到页面上所有的 `.box` 元素。有了 `scope`，选择器只在各自的 `ref` 子树内查找。

### scope 的内部实现

`scope` 本质上是在执行回调前，将 GSAP 的选择器上下文限制在指定元素内。当组件卸载时，`useGSAP` 会自动销毁在该 scope 内创建的所有动画实例。

## 三、依赖管理

`dependencies` 控制动画何时重新创建：

```javascript
function ProductCard({ isVisible }) {
  const containerRef = useRef(null)

  useGSAP(() => {
    if (isVisible) {
      gsap.from(".product-image", {
        scale: 0.8,
        opacity: 0,
        duration: 0.6
      })
    }
  }, { scope: containerRef, dependencies: [isVisible] })

  return (
    <div ref={containerRef}>
      {isVisible && <div className="product-image">...</div>}
    </div>
  )
}
```

当 `isVisible` 变化时，`useGSAP` 先清理旧动画，再重新执行。不依赖任何 props/state 时传空数组。

### dependencies 的行为规则

```javascript
// 1. 不传 dependencies：每次渲染都重新执行
useGSAP(() => {
  gsap.to(".box", { x: 100 })
})

// 2. 空数组：只在挂载时执行一次
useGSAP(() => {
  gsap.to(".box", { x: 100 })
}, { dependencies: [] })

// 3. 有依赖项：依赖变化时重新执行（先清理旧动画）
useGSAP(() => {
  gsap.to(".box", { x: isExpanded ? 200 : 0 })
}, { dependencies: [isExpanded] })
```

### 何时用 dependencies，何时不用

| 场景 | 做法 |
|------|------|
| 入场动画，只播放一次 | `dependencies: []` |
| 响应 props 变化的动画 | `dependencies: [propA, propB]` |
| 每次渲染都需要更新 | 不传 dependencies |
| 滚动触发动画 | `dependencies: []`（ScrollTrigger 自己管理触发） |

## 四、Timeline 在 React 中的用法

```javascript
function HeroSection() {
  const heroRef = useRef(null)

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

    tl.from(".hero-title", { y: 60, opacity: 0, duration: 0.8 })
      .from(".hero-subtitle", { y: 40, opacity: 0, duration: 0.6 }, "-=0.4")
      .from(".hero-cta", { scale: 0.8, opacity: 0, duration: 0.5 }, "-=0.2")
  }, { scope: heroRef })

  return (
    <section ref={heroRef} className="hero">
      <h1 className="hero-title">重新定义体验</h1>
      <p className="hero-subtitle">用动画讲述品牌故事</p>
      <button className="hero-cta">开始探索</button>
    </section>
  )
}
```

### 保存 Timeline 引用用于交互控制

```javascript
function PausableAnimation() {
  const containerRef = useRef(null)
  const tlRef = useRef(null)

  useGSAP(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true })
    tl.to(".orbit", { rotation: 360, duration: 3, ease: "none" })
    tlRef.current = tl
  }, { scope: containerRef })

  const handleToggle = () => {
    tlRef.current?.paused() ? tlRef.current.play() : tlRef.current?.pause()
  }

  return (
    <div ref={containerRef}>
      <div className="orbit" />
      <button onClick={handleToggle}>暂停/播放</button>
    </div>
  )
}
```

### 用 useRef 保存动画实例

在 React 中，如果你需要在组件的其他地方（事件处理函数、其他 hook）访问动画实例，必须用 `useRef` 保存：

```javascript
function InteractiveCard() {
  const containerRef = useRef(null)
  const tweenRef = useRef(null)

  useGSAP(() => {
    tweenRef.current = gsap.to(".card", {
      rotation: 360,
      duration: 2,
      paused: true
    })
  }, { scope: containerRef })

  const handleRotate = () => {
    tweenRef.current?.restart()
  }

  return (
    <div ref={containerRef}>
      <div className="card" />
      <button onClick={handleRotate}>旋转</button>
    </div>
  )
}
```

**注意**：不要用 `useState` 保存动画实例。`useState` 的 setter 会触发重新渲染，而动画实例的变化不应该导致组件重渲染。

## 五、ScrollTrigger 与 React

```javascript
import { ScrollTrigger } from "gsap/ScrollTrigger"
gsap.registerPlugin(ScrollTrigger)

function ScrollSection() {
  const sectionRef = useRef(null)

  useGSAP(() => {
    gsap.from(".scroll-item", {
      y: 60,
      opacity: 0,
      stagger: 0.1,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 70%",
        toggleActions: "play none none reverse"
      }
    })
  }, { scope: sectionRef })

  return (
    <div ref={sectionRef}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="scroll-item">项目 {i + 1}</div>
      ))}
    </div>
  )
}
```

动态内容变化后，`dependencies` 会触发 `useGSAP` 重新执行，ScrollTrigger 自动重新计算。

### ScrollTrigger 在 SPA 中的注意事项

```javascript
// 问题：SPA 路由切换后，旧页面的 ScrollTrigger 可能还在
// 解决方案：在路由切换时清理

function useScrollTriggerCleanup() {
  useEffect(() => {
    return () => {
      // 组件卸载时清理所有 ScrollTrigger 实例
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [])
}

// 或者在 useGSAP 中不需要手动清理，它会自动处理
```

### pin 在 React 中的使用

```javascript
function PinnedSection() {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "+=2000",
        pin: true,
        scrub: 1
      }
    })

    tl.to(".slide-1", { opacity: 0, y: -50 })
      .from(".slide-2", { opacity: 0, y: 50 })
      .to(".slide-2", { opacity: 0, y: -50 })
      .from(".slide-3", { opacity: 0, y: 50 })
  }, { scope: sectionRef })

  return (
    <div ref={sectionRef} className="pinned-container">
      <div className="slide-1">第一屏</div>
      <div className="slide-2">第二屏</div>
      <div className="slide-3">第三屏</div>
    </div>
  )
}
```

## 六、条件渲染的陷阱

```javascript
// ❌ 元素可能还未挂载
function BadExample({ show }) {
  const ref = useRef(null)
  useGSAP(() => {
    gsap.from(".panel", { x: -100, opacity: 0 })
  }, { scope: ref })
  return <div ref={ref}>{show && <div className="panel">内容</div>}</div>
}

// ✅ 正确：依赖条件变量
function GoodExample({ show }) {
  const ref = useRef(null)
  useGSAP(() => {
    if (show) {
      gsap.from(".panel", { x: -100, opacity: 0, duration: 0.5 })
    }
  }, { scope: ref, dependencies: [show] })
  return <div ref={ref}>{show && <div className="panel">内容</div>}</div>
}
```

### 条件渲染的三种处理方式

```javascript
// 方式一：用 dependencies 触发重建
function Method1({ show }) {
  const ref = useRef(null)
  useGSAP(() => {
    if (show) {
      gsap.from(".item", { opacity: 0, y: 20 })
    }
  }, { scope: ref, dependencies: [show] })
  return <div ref={ref}>{show && <div className="item" />}</div>
}

// 方式二：用 CSS 控制可见性，不卸载 DOM
function Method2({ show }) {
  const ref = useRef(null)
  useGSAP(() => {
    gsap.to(".item", {
      opacity: show ? 1 : 0,
      y: show ? 0 : 20,
      duration: 0.3
    })
  }, { scope: ref, dependencies: [show] })
  return <div ref={ref}><div className="item" /></div>
}

// 方式三：用 onEnter/onLeave 回调（适合列表）
function Method3({ items }) {
  const ref = useRef(null)
  useGSAP(() => {
    gsap.from(".item", {
      opacity: 0,
      y: 20,
      stagger: 0.1
    })
  }, { scope: ref, dependencies: [items] })
  return (
    <div ref={ref}>
      {items.map(item => <div key={item.id} className="item">{item.name}</div>)}
    </div>
  )
}
```

## 七、useGSAP 的返回值

`useGSAP` 返回一个 context 对象，包含 `contextSafe` 方法：

```javascript
function InteractiveBox() {
  const containerRef = useRef(null)

  const { contextSafe } = useGSAP(({ context }) => {
    // 动画定义
  }, { scope: containerRef })

  // contextSafe 包装的函数可以在动画上下文中安全执行
  const handleClick = contextSafe(() => {
    gsap.to(".box", {
      x: Math.random() * 200,
      duration: 0.5,
      ease: "power2.out"
    })
  })

  return (
    <div ref={containerRef}>
      <div className="box" onClick={handleClick}>点击我</div>
    </div>
  )
}
```

### contextSafe 的作用

`contextSafe` 将一个函数包装在 GSAP 的上下文中，确保：
1. 函数中创建的动画会被自动追踪和清理
2. 在组件卸载后调用不会产生错误
3. 在 Strict Mode 下行为正确

```javascript
// ❌ 不安全：直接在事件处理中创建动画
const handleClick = () => {
  gsap.to(".box", { x: 100 }) // 这个动画不会被自动清理
}

// ✅ 安全：用 contextSafe 包装
const handleClick = contextSafe(() => {
  gsap.to(".box", { x: 100 }) // 这个动画会被自动追踪
})
```

## 八、实战：产品展示组件

```javascript
import { useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function ProductShowcase({ product }) {
  const cardRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  // 入场动画
  useGSAP(() => {
    gsap.from(cardRef.current, {
      y: 40, opacity: 0, duration: 0.6, ease: "power2.out"
    })
  }, { scope: cardRef })

  // 悬停动画
  useGSAP(() => {
    gsap.to(cardRef.current, {
      y: isHovered ? -8 : 0,
      boxShadow: isHovered
        ? "0 20px 40px rgba(0,0,0,0.15)"
        : "0 4px 12px rgba(0,0,0,0.08)",
      duration: 0.3,
      ease: "power2.out"
    })
  }, { scope: cardRef, dependencies: [isHovered] })

  return (
    <div
      ref={cardRef}
      className="product-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p className="price">{product.price}</p>
    </div>
  )
}
```

### 更复杂的实战：模态框动画

```javascript
import { useRef, useState, useCallback } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function Modal({ isOpen, onClose, children }) {
  const overlayRef = useRef(null)
  const modalRef = useRef(null)
  const tlRef = useRef(null)

  useGSAP(() => {
    const tl = gsap.timeline({ paused: true })

    tl.fromTo(overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 }
    )
    .fromTo(modalRef.current,
      { opacity: 0, scale: 0.8, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" },
      "-=0.1"
    )

    tlRef.current = tl
  }, { scope: overlayRef })

  useGSAP(() => {
    if (isOpen) {
      tlRef.current?.play()
    } else {
      tlRef.current?.reverse()
    }
  }, { dependencies: [isOpen] })

  if (!isOpen && tlRef.current?.progress() === 0) return null

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
```

### 实战：滚动驱动的导航栏

```javascript
import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function ScrollNavbar() {
  const navRef = useRef(null)

  useGSAP(() => {
    let lastScroll = 0

    ScrollTrigger.create({
      start: "top -80",
      onUpdate: (self) => {
        const currentScroll = self.scroll()

        if (currentScroll > lastScroll && currentScroll > 80) {
          // 向下滚动：隐藏导航栏
          gsap.to(navRef.current, { y: -100, duration: 0.3, ease: "power2.in" })
        } else {
          // 向上滚动：显示导航栏
          gsap.to(navRef.current, { y: 0, duration: 0.3, ease: "power2.out" })
        }

        lastScroll = currentScroll
      }
    })
  })

  return (
    <nav ref={navRef} className="navbar">
      <div className="nav-logo">品牌</div>
      <div className="nav-links">
        <a href="#about">关于</a>
        <a href="#products">产品</a>
        <a href="#contact">联系</a>
      </div>
    </nav>
  )
}
```

### 实战：列表项动画

```javascript
import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function AnimatedList({ items }) {
  const listRef = useRef(null)

  useGSAP(() => {
    const listItems = listRef.current.querySelectorAll(".list-item")

    gsap.from(listItems, {
      x: -60,
      opacity: 0,
      duration: 0.5,
      stagger: 0.08,
      ease: "power2.out"
    })
  }, { scope: listRef, dependencies: [items] })

  return (
    <ul ref={listRef}>
      {items.map((item, i) => (
        <li key={item.id || i} className="list-item">
          {item.name}
        </li>
      ))}
    </ul>
  )
}
```

## 九、GSAP 与 React 的其他集成方式

### 不用 useGSAP 的替代方案

如果你不想引入 `@gsap/react`，可以自己封装一个清理逻辑：

```javascript
import { useEffect, useRef } from "react"
import gsap from "gsap"

function useGsapAnimation(callback, deps = []) {
  const ref = useRef(null)
  const contextRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    // 创建 GSAP 上下文
    contextRef.current = gsap.context(() => {
      callback(ref.current)
    }, ref.current)

    return () => {
      contextRef.current?.revert()
    }
  }, deps)

  return ref
}

// 使用
function MyComponent() {
  const containerRef = useGsapAnimation((el) => {
    gsap.from(".item", { opacity: 0, y: 20, stagger: 0.1 })
  })

  return (
    <div ref={containerRef}>
      <div className="item">A</div>
      <div className="item">B</div>
    </div>
  )
}
```

### gsap.context() 的作用

`gsap.context()` 创建一个动画上下文，所有在其中创建的动画都会被追踪。调用 `context.revert()` 可以一次性销毁所有动画：

```javascript
const ctx = gsap.context(() => {
  gsap.to(".a", { x: 100 })
  gsap.to(".b", { y: 100 })
  gsap.to(".c", { rotation: 360 })
}, containerElement) // 可选：限制作用域

// 一次性销毁上面三个动画
ctx.revert()
```

## 十、性能优化

### 避免不必要的动画重建

```javascript
// ❌ 每次渲染都重建动画
function Bad() {
  const ref = useRef(null)
  useGSAP(() => {
    gsap.to(".box", { x: 100, duration: 1 })
  }) // 没有 dependencies，默认每次渲染都执行
  return <div ref={ref}><div className="box" /></div>
}

// ✅ 只在挂载时执行一次
function Good() {
  const ref = useRef(null)
  useGSAP(() => {
    gsap.to(".box", { x: 100, duration: 1 })
  }, { scope: ref, dependencies: [] })
  return <div ref={ref}><div className="box" /></div>
}
```

### 使用 will-change 提示浏览器

```javascript
useGSAP(() => {
  gsap.set(".animated-element", { willChange: "transform" })
  gsap.to(".animated-element", { x: 200, duration: 1 })
}, { scope: ref })
```

### 减少重排

```javascript
// ❌ 触发布局重排
gsap.to(".box", { width: 200, height: 200 })

// ✅ 用 transform 实现缩放效果
gsap.to(".box", { scale: 2 })
```

### 批量动画的性能优化

```javascript
// ❌ 为每个元素创建单独的动画
items.forEach((item, i) => {
  gsap.to(item, { x: 100, delay: i * 0.1 })
})

// ✅ 用 stagger 批量处理
gsap.to(items, { x: 100, stagger: 0.1 })
```

## 十一、常见问题排查

### "GSAP target not found" 警告

```javascript
// 原因：元素还未挂载或已被卸载
// 解决：确保在 useGSAP 内部，且 scope 正确

// ❌
useGSAP(() => {
  gsap.to(".not-existing", { x: 100 })
})

// ✅
useGSAP(() => {
  gsap.to(".existing-element", { x: 100 })
}, { scope: containerRef })
```

### 动画执行两次（Strict Mode）

```javascript
// 原因：React 18 Strict Mode 下 useEffect 会执行两次
// 解决：使用 useGSAP，它会自动处理

// ❌ useEffect + GSAP
useEffect(() => {
  gsap.to(".box", { x: 100 }) // Strict Mode 下执行两次
}, [])

// ✅ useGSAP
useGSAP(() => {
  gsap.to(".box", { x: 100 }) // Strict Mode 下只执行一次
}, { scope: ref })
```

### 路由切换后动画不触发

```javascript
// 原因：旧路由的 ScrollTrigger 实例还在，新的无法创建
// 解决：在路由切换时清理

function App() {
  const location = useLocation()

  useEffect(() => {
    // 路由变化时清理所有 ScrollTrigger
    return () => {
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [location.pathname])

  return <Routes>...</Routes>
}
```

### 动画闪烁或跳动

```javascript
// 原因：from() 动画在元素挂载后才执行，导致初始状态可见
// 解决：用 CSS 设置初始状态，或用 gsap.set() 预设

function Card() {
  const ref = useRef(null)

  useGSAP(() => {
    // 先设置初始状态
    gsap.set(ref.current, { opacity: 0, y: 30 })
    // 再执行入场动画
    gsap.to(ref.current, { opacity: 1, y: 0, duration: 0.6 })
  }, { scope: ref })

  return <div ref={ref} className="card">内容</div>
}
```

## 常见误区

1. **在 `useGSAP` 外部创建动画**：不会被自动清理，导致内存泄漏和重复动画。
2. **忘记设置 `scope`**：选择器会在整个文档中查找，可能误操作其他组件的元素。
3. **用 `key` 代替清理**：强制重新挂载组件会导致整个组件树重建，性能很差。
4. **在回调中用 `document.querySelector`**：应该用 `ref` 获取元素引用。
5. **忽略 Strict Mode**：React 18 开发环境双调 `useEffect`，`useGSAP` 已处理但手动写的 `useEffect` 需要小心。
6. **用 `useState` 保存动画实例**：会导致不必要的重渲染，应该用 `useRef`。
7. **在 `dependencies` 中放入不必要的变量**：会导致动画频繁重建，影响性能。
8. **忘记注册插件**：ScrollTrigger、Flip 等插件必须在使用前注册。

## 工程建议

1. **统一注册插件**：在应用入口处一次性注册所有 GSAP 插件。

```javascript
// src/main.tsx 或 src/index.tsx
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Flip } from "gsap/Flip"

gsap.registerPlugin(ScrollTrigger, Flip)
```

2. **每个组件用独立的 `scope` ref**：确保动画范围隔离。

3. **用 `dependencies` 精确控制重渲染**：只在真正影响动画的变量变化时重建。

4. **开发时用 `markers: true` 调试 ScrollTrigger**：记得生产构建中移除。

5. **用 `contextSafe` 包装事件处理函数**：确保在事件处理中创建的动画也能被自动清理。

6. **避免在渲染函数中直接调用 GSAP**：所有 GSAP 调用都应该在 `useGSAP` 回调或 `contextSafe` 包装的函数中。

## 小结

`useGSAP` 是 GSAP 在 React 中的官方桥梁——`scope` 隔离动画范围，`dependencies` 控制重建时机，自动清理避免泄漏。掌握这三个核心概念，就能在 React 中流畅使用 GSAP 的全部能力。

核心心智模型：**把 GSAP 动画想象成 React 组件的一个副作用**。就像 `useEffect` 处理数据获取一样，`useGSAP` 处理动画。它们都需要：正确的时机执行、正确的依赖追踪、正确的清理。

## 练习

### 练习一：动画列表

创建 `AnimatedList` 组件，接收 `items` 数组。当 items 变化时，新元素从右侧滑入。用 `useGSAP` 的 `dependencies` 实现。

### 练习二：滚动进度指示器

创建 `ScrollProgress` 组件，在页面顶部显示进度条，宽度随滚动从 0% 到 100%。用 `useGSAP` + ScrollTrigger 的 `scrub` 实现。

### 练习三：悬停放大卡片

创建 `HoverCard` 组件，鼠标悬停时卡片放大并加深阴影，鼠标离开时恢复。用 `useGSAP` + `dependencies` 实现。

### 练习四：路由过渡动画

创建一个带页面过渡动画的路由系统，页面切换时旧页面淡出并向左滑动，新页面从右侧滑入并淡入。

### 练习五：可折叠面板

创建 `CollapsiblePanel` 组件，点击标题时内容区域展开/折叠，带平滑的高度动画。

---

## 参考答案

### 练习一

**思路**：用 `:not(.animated)` 区分新旧元素，`onComplete` 标记已动画元素。

**答案**：

```javascript
import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function AnimatedList({ items }) {
  const listRef = useRef(null)

  useGSAP(() => {
    const newItems = listRef.current.querySelectorAll(
      ".list-item:not(.animated)"
    )
    gsap.from(newItems, {
      x: 80, opacity: 0, duration: 0.4,
      stagger: 0.08, ease: "power2.out",
      onComplete: () => {
        newItems.forEach(el => el.classList.add("animated"))
      }
    })
  }, { scope: listRef, dependencies: [items] })

  return (
    <ul ref={listRef}>
      {items.map(item => (
        <li key={item.id} className="list-item">{item.name}</li>
      ))}
    </ul>
  )
}
```

**要点**：
- `:not(.animated)` 选择器只匹配新添加的元素
- `onComplete` 回调在动画完成后标记元素，避免重复动画
- `dependencies: [items]` 确保 items 变化时重新执行

### 练习二

**思路**：`trigger: document.documentElement` 绑定整个页面，`scrub: 0.3` 让进度条平滑跟随。

**答案**：

```javascript
import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function ScrollProgress() {
  const barRef = useRef(null)

  useGSAP(() => {
    gsap.to(barRef.current, {
      width: "100%",
      ease: "none",
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3
      }
    })
  }, { scope: barRef })

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "3px", zIndex: 9999 }}>
      <div ref={barRef} style={{
        height: "100%", width: "0%",
        background: "linear-gradient(90deg, #6366f1, #8b5cf6)"
      }} />
    </div>
  )
}
```

**要点**：
- `trigger: document.documentElement` 绑定整个文档
- `scrub: 0.3` 让进度条有轻微延迟，更平滑
- `ease: "none"` 让进度和滚动距离成线性关系

### 练习三

**思路**：用 `dependencies` 追踪 `isHovered` 状态，状态变化时执行悬停动画。

**答案**：

```javascript
import { useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function HoverCard({ children }) {
  const cardRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  useGSAP(() => {
    gsap.to(cardRef.current, {
      scale: isHovered ? 1.05 : 1,
      boxShadow: isHovered
        ? "0 20px 40px rgba(0,0,0,0.2)"
        : "0 4px 12px rgba(0,0,0,0.1)",
      duration: 0.3,
      ease: "power2.out"
    })
  }, { scope: cardRef, dependencies: [isHovered] })

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ padding: "20px", borderRadius: "12px", cursor: "pointer" }}
    >
      {children}
    </div>
  )
}
```

**要点**：
- `isHovered` 作为 `dependencies`，状态变化时自动触发动画
- `scale` 和 `boxShadow` 同时动画，产生立体悬停效果
- `ease: "power2.out"` 让动画自然舒适

### 练习四

**思路**：用 `useLocation` 追踪路由变化，在路由切换时执行离开/进入动画。

**答案**：

```javascript
import { useRef, useEffect } from "react"
import { useLocation, useOutlet } from "react-router-dom"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function AnimatedOutlet() {
  const outletRef = useRef(null)
  const location = useLocation()
  const outlet = useOutlet()
  const prevPathRef = useRef(location.pathname)

  useGSAP(() => {
    if (prevPathRef.current !== location.pathname) {
      const tl = gsap.timeline()

      // 旧页面离开
      tl.to(outletRef.current, {
        opacity: 0,
        x: -30,
        duration: 0.3,
        ease: "power2.in"
      })

      // 新页面进入
      .fromTo(outletRef.current,
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }
      )

      prevPathRef.current = location.pathname
    }
  }, { scope: outletRef, dependencies: [location.pathname] })

  return <div ref={outletRef}>{outlet}</div>
}
```

**要点**：
- `useLocation` 提供当前路由信息
- `useOutlet` 提供当前路由对应的组件
- `prevPathRef` 用于判断是否真的发生了路由变化
- Timeline 先执行离开动画，再执行进入动画

### 练习五

**思路**：用 `gsap.context()` 管理动画上下文，在展开/折叠时执行高度动画。

**答案**：

```javascript
import { useRef, useState, useCallback } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

function CollapsiblePanel({ title, children }) {
  const panelRef = useRef(null)
  const contentRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const tlRef = useRef(null)

  useGSAP(() => {
    const content = contentRef.current
    if (!content) return

    // 测量内容高度
    const fullHeight = content.scrollHeight

    const tl = gsap.timeline({ paused: true })

    tl.to(content, {
      height: fullHeight,
      opacity: 1,
      duration: 0.4,
      ease: "power2.out"
    })

    tlRef.current = tl
  }, { scope: panelRef, dependencies: [] })

  const toggle = useCallback(() => {
    if (isOpen) {
      tlRef.current?.reverse()
    } else {
      tlRef.current?.play()
    }
    setIsOpen(!isOpen)
  }, [isOpen])

  return (
    <div ref={panelRef} className="panel">
      <button onClick={toggle} className="panel-header">
        {title}
        <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.3s" }}>
          ▼
        </span>
      </button>
      <div
        ref={contentRef}
        className="panel-content"
        style={{ height: 0, opacity: 0, overflow: "hidden" }}
      >
        {children}
      </div>
    </div>
  )
}
```

**要点**：
- `scrollHeight` 获取内容的实际高度
- Timeline 的 `paused: true` 让动画不自动播放
- `play()` 和 `reverse()` 控制展开/折叠
- 初始状态用 CSS 设置 `height: 0` 和 `opacity: 0`

# 技术动画与动效

> 从 CSS 过渡到 Three.js 粒子流体，系统掌握 Web 动画全栈技术。

## 课程定位

本课程面向有前端基础、希望系统掌握 Web 动画与动效开发的工程师。不追求"酷炫 demo 堆砌"，而是围绕**动画原理、工程实践、性能优化**三条主线，带你从 CSS 过渡一路走到 Three.js 粒子系统，最终能独立完成品牌官网级别的动效开发。

**学完本课程你能：**

- 理解动画底层原理（帧率、缓动、时间管理），不再"凭感觉调参"
- 熟练使用 CSS Animations、Web Animations API、GSAP、Three.js 四套技术栈
- 实现滚动驱动、视差、粒子、3D 交互等高级动效
- 在 60fps 性能约束下做出生产级动画
- 独立完成从创意到落地的完整动效项目

## 课程大纲

| 阶段 | 主题 | 课时 | 内容概要 |
|------|------|------|----------|
| Stage 1 | 动画基础 | 6 课时 | 帧动画原理、CSS Transition/Animation、Web Animations API、requestAnimationFrame、缓动函数、阶段实战 |
| Stage 2 | CSS 高级动效 | 6 课时 | 3D 变换、SVG 动画、滚动驱动动画、视差效果、粒子系统、阶段实战 |
| Stage 3 | GSAP 大师课 | 6 课时 | GSAP 核心 API、ScrollTrigger、GSAP 与 React、Text 动画、MotionPath、阶段实战 |
| Stage 4 | Three.js 动画 | 6 课时 | Three.js 动画基础、物理动画、流体模拟、程序化动画、交互式 3D、阶段实战 |
| Stage 5 | 创意项目 | 6 课时 | 数据叙事、页面过渡、音频可视化、生成式艺术、性能优化、阶段实战 |

**共计：30 课时**

## 前置要求

- HTML/CSS/JavaScript 基础（ES6+ 语法）
- 了解 DOM 操作和事件机制
- 有 React 基础（Stage 3 涉及 GSAP + React）
- 了解 Canvas 2D 基本用法（Stage 2/4/5 会用到）

## 学习建议

1. **按顺序学习**：Stage 1→2→3→4→5，每阶段的实战课是前几课的综合应用
2. **动手优先**：每课的练习必须亲手写，不要只看代码
3. **关注性能**：从第一课就养成"动画必须 60fps"的意识
4. **浏览器 DevTools**：熟练使用 Performance 面板和 Layers 面板调试动画
5. **收集灵感**：关注 CodePen、Awwwards 上的动效作品，尝试复现

## 目录结构

```
motion-design/
├── README.md                          # 课程总览（本文件）
├── stage1-animation-foundations/      # 动画基础
│   ├── README.md                      # 阶段概述
│   ├── 01-动画原理.md
│   ├── 02-CSS-Transition与Animation.md
│   ├── 03-Web-Animations-API.md
│   ├── 04-请求动画帧.md
│   ├── 05-缓动函数深入.md
│   └── 06-阶段实战-CSS动画合集.md
├── stage2-css-transitions/            # CSS 高级动效
│   ├── README.md
│   ├── 01-3D变换动画.md
│   ├── 02-SVG动画.md
│   ├── 03-滚动驱动动画.md
│   ├── 04-视差效果.md
│   ├── 05-粒子系统.md
│   └── 06-阶段实战-交互式数据可视化.md
├── stage3-gsap-masterclass/           # GSAP 大师课
│   ├── README.md
│   ├── 01-GSAP核心API.md
│   ├── 02-ScrollTrigger.md
│   ├── 03-GSAP与React.md
│   ├── 04-Text动画.md
│   ├── 05-MotionPath.md
│   └── 06-阶段实战-品牌官网动效.md
├── stage4-threejs-motion/             # Three.js 动画
│   ├── README.md
│   ├── 01-Three.js动画基础.md
│   ├── 02-物理动画.md
│   ├── 03-流体模拟.md
│   ├── 04-程序化动画.md
│   ├── 05-交互式3D.md
│   └── 06-阶段实战-3D产品展示动画.md
├── stage5-creative-projects/          # 创意项目
│   ├── README.md
│   ├── 01-数据叙事动画.md
│   ├── 02-页面过渡动画.md
│   ├── 03-音频可视化.md
│   ├── 04-生成式艺术.md
│   ├── 05-性能优化.md
│   └── 06-阶段实战-完整创意网站.md
└── final-project/                     # 毕业项目
    ├── 项目说明.md
    ├── scripts/
    │   └── check.cjs
    └── reports/
        ├── stage1-report.md
        ├── stage2-report.md
        ├── stage3-report.md
        ├── stage4-report.md
        └── stage5-report.md
```

## 课程特色

- **工程驱动**：每课从真实问题出发，不堆砌 API 文档
- **代码完整**：所有示例可直接运行，拒绝伪代码
- **性能优先**：贯穿全课程的 60fps 意识和 GPU 加速策略
- **渐进实战**：每阶段一个综合实战，从零件到整机
- **中文讲解**：全程中文，术语附英文原文

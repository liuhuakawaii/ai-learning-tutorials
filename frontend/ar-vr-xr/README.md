# AR/VR/XR 空间计算开发

> 30 课时 · 5 个阶段 · 面向前端开发者的空间计算完整学习路径

## 课程简介

本课程从零开始，带你掌握 AR（增强现实）、VR（虚拟现实）、XR（扩展现实）和空间计算开发的完整技能栈。课程以 WebXR + Three.js 为主要技术栈，兼顾原生平台（Unity/Unreal），覆盖从 3D 数学到空间 UI 设计、从单人体验到多人协作的全链路开发能力。

**适合人群：** 有前端基础（HTML/CSS/JS/TypeScript），想进入空间计算领域的开发者。

**技术栈：** TypeScript、Three.js、WebXR Device API、Web Audio API、WebRTC、WebSockets

## 学习路线

```
Stage 1  空间计算基础 ──→ 理解空间计算核心概念、3D 数学、性能要求
    │
Stage 2  WebXR + Three.js ──→ 掌握 WebXR API 与 Three.js 的深度集成
    │
Stage 3  AR 开发 ──→ 图像/面部/物体追踪、GPS AR、LiDAR 扫描
    │
Stage 4  VR 开发 ──→ VR 交互设计、移动机制、多人协作、性能优化
    │
Stage 5  空间应用 ──→ AI 集成、数字孪生、商业模式、跨平台发布
```

## 课程大纲

| 阶段 | 名称 | 课时 | 内容概要 |
|------|------|------|----------|
| Stage 1 | 空间计算基础 | 6 | AR/VR/MR/XR 概念、3D 数学、空间 UI 设计、性能要求、开发环境搭建 |
| Stage 2 | WebXR + Three.js | 6 | WebXR API、AR/VR 会话、Three.js XR 集成、空间音频 |
| Stage 3 | AR 开发 | 6 | 图像追踪、面部追踪、物体追踪、GPS AR、LiDAR 扫描 |
| Stage 4 | VR 开发 | 6 | VR 交互设计、移动机制、UI 系统、多人协作、性能优化 |
| Stage 5 | 空间应用 | 6 | AI 与空间计算、数字孪生、商业模式、跨平台开发、发布分发 |

## 目录结构

```
ar-vr-xr/
├── README.md                          # 本文件
├── stage1-spatial-computing/          # 阶段 1：空间计算基础
│   ├── README.md
│   ├── 01-空间计算概览.md
│   ├── 02-3D数学复习.md
│   ├── 03-空间UI设计原则.md
│   ├── 04-性能要求.md
│   ├── 05-开发环境搭建.md
│   └── 06-阶段实战-第一个3D场景.md
├── stage2-webxr-threejs/              # 阶段 2：WebXR + Three.js
│   ├── README.md
│   ├── 01-WebXR-API入门.md
│   ├── 02-AR会话.md
│   ├── 03-VR会话.md
│   ├── 04-Three.js-XR集成.md
│   ├── 05-空间音频.md
│   └── 06-阶段实战-WebXR产品展示.md
├── stage3-ar-development/             # 阶段 3：AR 开发
│   ├── README.md
│   ├── 01-图像追踪.md
│   ├── 02-面部追踪.md
│   ├── 03-物体追踪.md
│   ├── 04-GPS-AR.md
│   ├── 05-LiDAR扫描.md
│   └── 06-阶段实战-AR导航应用.md
├── stage4-vr-development/             # 阶段 4：VR 开发
│   ├── README.md
│   ├── 01-VR交互设计.md
│   ├── 02-VR移动机制.md
│   ├── 03-VR-UI系统.md
│   ├── 04-VR多人协作.md
│   ├── 05-VR性能优化.md
│   └── 06-阶段实战-VR协作空间.md
├── stage5-spatial-apps/               # 阶段 5：空间应用
│   ├── README.md
│   ├── 01-空间计算与AI.md
│   ├── 02-数字孪生.md
│   ├── 03-空间计算商业模式.md
│   ├── 04-跨平台开发.md
│   ├── 05-发布与分发.md
│   └── 06-阶段实战-完整空间应用.md
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

## 环境要求

- **浏览器：** Chrome 79+ / Edge 79+（WebXR 支持需要 Android 或桌面端开启 WebXR Emulator）
- **运行时：** Node.js 18+
- **硬件：** 建议有一台支持 WebXR 的设备（Meta Quest 系列、Android ARCore 设备、或 iOS ARKit 设备）
- **开发工具：** VS Code + WebXR API Inspector 扩展

## 快速开始

```bash
# 进入毕业项目目录
cd final-project/spatial-showcase

# 安装依赖
npm install

# 启动开发服务器（需要 HTTPS 或 localhost）
npm run dev

# 运行验证脚本
node scripts/check.cjs
```

## 学习建议

1. **不要跳过 Stage 1 的数学部分** — 3D 数学是空间计算的基石，后续所有内容都依赖它
2. **准备一台 XR 设备** — WebXR 的真实体验无法完全用模拟器替代，建议至少有一台 Meta Quest
3. **每个阶段都动手做实战** — 每个 Stage 的最后一课是综合实战，务必完成
4. **关注性能** — 空间计算对性能要求极高（90fps+），从一开始就养成性能意识
5. **从 WebXR 入手** — WebXR 的开发迭代最快，适合学习；需要原生能力时再转向 Unity/Unreal

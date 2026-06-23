# WebGPU 粒子物理引擎

> WebGPU 创意编程课程毕业项目：百万级粒子的 GPU 物理引擎，支持力场和碰撞。

## 快速开始

```bash
cd webgpu-particles
npm install
npm run dev
# 打开 http://localhost:5173（需要 Chrome 113+ 或 Edge 113+）
```

浏览器要求：支持 WebGPU 的浏览器（Chrome 113+、Edge 113+）。

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
webgpu-particles/
├── src/
│   ├── compute/           # GPU 计算着色器
│   │   ├── particle-update.wgsl    # 粒子更新 Compute Shader
│   │   ├── collision.wgsl          # 碰撞检测 Compute Shader
│   │   └── ComputePipeline.ts      # 计算管线管理
│   ├── forces/            # 力场系统
│   │   ├── gravity.ts
│   │   ├── point-force.ts
│   │   ├── wind.ts
│   │   └── vortex.ts
│   ├── collision/         # 碰撞检测
│   │   ├── boundary.ts
│   │   └── spatial-hash.ts
│   ├── render/            # 渲染管线
│   │   ├── particle-render.wgsl    # 渲染着色器
│   │   └── RenderPipeline.ts
│   ├── scenes/            # 预设场景
│   │   ├── fireworks.ts
│   │   ├── galaxy.ts
│   │   └── rain.ts
│   ├── ui/                # 控制面板
│   ├── core/              # WebGPU 初始化与 Buffer 管理
│   └── main.ts
├── scripts/
│   └── check.js
├── tests/
├── reports/
│   └── final-report.md
├── package.json
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | WebGPU API 与 Compute Shader | `src/compute/` |
| 阶段二 | 力场建模与 GPU 并行计算 | `src/forces/` |
| 阶段三 | 空间划分与碰撞算法 | `src/collision/` |
| 阶段四 | Instanced Rendering 与 WGSL | `src/render/` |
| 阶段五 | 交互系统与场景编排 | `src/scenes/` + `src/ui/` |

## 验收建议

1. 打开页面，确认粒子正常渲染且有运动
2. 将粒子数量调到 100 万，确认帧率可接受
3. 点击"烟花"预设，确认粒子爆炸效果
4. 在粒子区域拖拽鼠标，确认有力场效果
5. 观察粒子碰边是否反弹

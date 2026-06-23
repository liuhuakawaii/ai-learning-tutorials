# Shader 特效展示站

> 图形学 Shader 课程毕业项目：包含 5+ 个 Shader 特效的在线展示站，每个效果有交互控制。

## 快速开始

```bash
cd shader-showcase
npm install
npm run dev
# 打开 http://localhost:5173
```

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
shader-showcase/
├── src/
│   ├── shaders/
│   │   ├── sdf-2d/              # 2D SDF 场景
│   │   │   ├── fragment.glsl
│   │   │   ├── vertex.glsl
│   │   │   └── config.ts        # 参数定义
│   │   ├── ray-marching/        # 3D Ray Marching
│   │   │   ├── fragment.glsl
│   │   │   ├── vertex.glsl
│   │   │   └── config.ts
│   │   ├── fractal/             # 分形
│   │   ├── noise/               # 噪声纹理
│   │   └── lighting/            # 光照与材质
│   ├── components/
│   │   ├── ShaderCanvas.tsx     # Shader 渲染画布
│   │   ├── ControlPanel.tsx     # 参数控制面板
│   │   ├── ShaderGrid.tsx       # 首页缩略图网格
│   │   └── CodeViewer.tsx       # 代码查看器
│   ├── renderer/                # WebGL/WebGPU 渲染器
│   ├── router/                  # 路由配置
│   └── App.tsx
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
| 阶段一 | SDF 建模与布尔运算 | `src/shaders/sdf-2d/` |
| 阶段二 | Ray Marching 与 3D 渲染 | `src/shaders/ray-marching/` |
| 阶段三 | 分形与噪声函数 | `src/shaders/fractal/` + `noise/` |
| 阶段四 | 光照模型与材质系统 | `src/shaders/lighting/` |
| 阶段五 | 展示站 UI 与交互系统 | `src/components/` |

## 验收建议

1. 首页能看到至少 5 个特效的缩略图
2. 点击任意特效进入详情页，Shader 正常渲染
3. 调整参数面板中的滑块，确认效果实时变化
4. Ray Marching 场景中旋转视角，确认 3D 效果正确
5. 运行 `node scripts/check.js` 确认所有必要文件存在

# 3D 数据大屏

Three.js 构建的 3D 数据可视化大屏，包含 3D 地球、网络拓扑、时序数据三大场景，支持自定义着色器特效。

## 技术栈

- Three.js + TypeScript
- Vue 3 / React（可选）
- ECharts（2D 辅助图表）
- GLSL 着色器
- Vite

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，默认进入大屏总览。

## 场景说明

| 场景 | 功能 |
|------|------|
| 3D 地球 | 飞线、热力层、城市数据点 |
| 网络拓扑 | 力导向布局、节点/边数据映射 |
| 时序数据 | 3D 柱状图、时间轴控件 |

## 交互

- 鼠标拖拽旋转视角
- 滚轮缩放
- 点击元素查看详情
- 顶部筛选器切换数据维度

## 项目结构

```
├── src/
│   ├── scenes/         # 3D 场景（Globe、Network、TimeSeries）
│   ├── charts/         # ECharts 面板
│   ├── shaders/        # GLSL 着色器
│   ├── data/           # 静态数据 JSON
│   └── main.ts
├── public/textures/    # 地球贴图等
├── package.json
└── scripts/
```

## 验证

```bash
node scripts/check.cjs
```

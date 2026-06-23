# 程序化世界生成器

可探索的程序化生成世界，包含地形、生物群落、植被、建筑、水体和天气系统。支持无限加载和种子控制。

## 技术栈

- Three.js + TypeScript
- Simplex Noise（自实现）
- Web Worker（地形异步生成）
- GLSL 着色器
- Vite

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开后进入世界，使用 WASD 移动，鼠标控制视角。

## 操作说明

- `WASD`：移动
- 鼠标：视角控制（点击锁定）
- `M`：切换小地图
- `T`：切换时间（加速日夜循环）
- `F`：切换天气

## 世界内容

- **地形**：多层噪声生成的山地、丘陵、平原
- **生物群落**：沙漠、草原、森林、苔原、热带雨林等
- **水体**：海洋、河流、湖泊
- **植被**：程序化树木、草地
- **建筑**：村庄、道路、遗迹
- **天气**：日夜循环、雾效、雨天

## 项目结构

```
├── src/
│   ├── world/          # Chunk、Biome、Terrain、Vegetation
│   ├── noise/          # Simplex、FBM、DomainWarp
│   ├── rendering/      # 着色器（地形、水面、天空、草地）
│   ├── player/         # 玩家控制、相机、小地图
│   ├── ui/             # HUD、控制面板
│   └── workers/        # 地形生成 Worker
├── public/textures/
├── package.json
└── scripts/
```

## 验证

```bash
node scripts/check.cjs
```

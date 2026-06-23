# 生成艺术系列

基于 TypeScript + Canvas/SVG 的生成艺术作品集，包含 5+ 种算法实现，支持参数调节和 SVG/PNG 导出。

## 技术栈

- TypeScript + Vite
- Canvas 2D / SVG 渲染
- lil-gui（参数面板）
- canvas-to-blob（PNG 导出）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，进入画廊选择作品。

## 导出作品

- 点击作品右上角的导出按钮
- 选择格式（SVG / PNG）
- PNG 支持 1x / 2x / 4x 分辨率

## 项目结构

```
├── src/
│   ├── artworks/           # 各算法作品（每件独立）
│   ├── gallery/            # 画廊展示
│   ├── core/               # Canvas 管理、导出、随机数
│   └── main.ts
├── package.json
├── vite.config.ts
└── scripts/
```

## 验证

```bash
node scripts/check.cjs
```

# 3D 编辑器

> Three.js 架构课程毕业项目：一个简化版 3D 场景编辑器，支持场景图、变换、撤销、序列化。

## 快速开始

```bash
cd three-editor
npm install
npm run dev
# 打开 http://localhost:5173
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| W | 移动模式 |
| E | 旋转模式 |
| R | 缩放模式 |
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z | 重做 |
| Delete | 删除选中物体 |
| F | 聚焦选中物体 |

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
three-editor/
├── src/
│   ├── core/
│   │   ├── scene-graph.ts     # 场景图管理
│   │   ├── selection.ts       # 选择系统
│   │   ├── transform.ts       # 变换系统
│   │   ├── history.ts         # 撤销重做
│   │   └── serialization.ts   # 序列化
│   ├── components/
│   │   ├── Viewport.tsx       # 3D 视口
│   │   ├── SceneTree.tsx      # 场景树面板
│   │   ├── Properties.tsx     # 属性面板
│   │   └── Toolbar.tsx        # 工具栏
│   ├── store/                 # 状态管理
│   ├── geometries/            # 内置几何体
│   └── App.tsx
├── scripts/
│   └── check.js
├── tests/
├── reports/
│   └── final-report.md
├── package.json
├── vite.config.ts
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | 场景图与节点管理 | `src/core/scene-graph.ts` |
| 阶段二 | Raycasting 与 TransformControls | `src/core/selection.ts` + `transform.ts` |
| 阶段三 | Command 模式与状态管理 | `src/core/history.ts` |
| 阶段四 | JSON/glTF 序列化 | `src/core/serialization.ts` |
| 阶段五 | 完整编辑器 UI 与交互 | `src/components/` |

## 验收建议

1. 创建几个物体，拖拽调整层级关系，确认场景树同步更新
2. 点击选中物体，使用 W/E/R 切换变换模式
3. 执行一系列操作后按 Ctrl+Z，确认能逐步撤销
4. 导出场景为 JSON，刷新页面后导入，确认场景恢复
5. 运行 `node scripts/check.js` 确认所有必要文件存在

# 2D 物理引擎

从零实现的 2D 物理引擎，支持刚体、碰撞检测与响应、约束系统，附带可视化调试界面和多个演示场景。

## 技术栈

- TypeScript + Vite
- Canvas 2D（调试渲染）
- Vitest（物理计算测试）
- 无第三方物理库依赖

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开后选择演示场景，用鼠标拖拽物体。

## 演示场景

- **堆叠**：物体堆叠测试稳定性
- **链条/绳摆**：约束系统展示
- **弹射**：碰撞 + 摩擦
- **多米诺**：连锁碰撞

## 调试控制

- `Space`：暂停/继续
- `N`：单步执行
- `V`：切换速度向量显示
- `B`：切换 AABB 显示
- `R`：重置场景

## 项目结构

```
├── src/
│   ├── math/           # Vec2、Mat2x2
│   ├── physics/        # Body、World、Collision、Solver
│   ├── debug/          # 调试渲染器
│   └── demos/          # 演示场景
├── tests/              # 单元测试
├── package.json
└── scripts/
```

## 验证

```bash
node scripts/check.cjs
```

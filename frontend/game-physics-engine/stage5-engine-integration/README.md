# 第五阶段：引擎集成

将所有模块整合为完整的 2D 物理引擎——设计引擎架构、集成渲染、实现调试可视化和性能分析，构建可展示的物理引擎。

## 课时列表

| 课时 | 标题 |
|------|------|
| 21 | [2D 物理引擎架构——World/Body/Shape/Constraint 的设计](21-engine-architecture.md) |
| 22 | [与渲染集成——将物理状态映射到 Canvas/WebGL](22-render-integration.md) |
| 23 | [可视化调试——碰撞体绘制、力向量可视化、碰撞点标注](23-debug-visualization.md) |
| 24 | [性能分析——碰撞检测次数、约束求解迭代、帧率监控](24-performance-profiling.md) |
| 25 | [阶段实战：构建一个完整的 2D 物理引擎并展示](25-complete-engine.md) |

## 验收标准

- 能设计 World/Body/Shape/Constraint 的清晰模块架构
- 能将物理状态正确映射到 Canvas 或 WebGL 渲染
- 能绘制碰撞体、力向量和碰撞点用于调试
- 能监控碰撞检测次数、求解迭代和帧率
- 完成完整的 2D 物理引擎，支持碰撞、刚体、约束和空间分区

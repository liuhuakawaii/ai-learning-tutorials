# 第二阶段：GPU 计算

深入 Compute Shader 的并行计算能力，实现并行归约、大规模粒子物理模拟、流体模拟和 GPU 排序，构建一个 GPU 加速的粒子物理引擎。

## 课时列表

| 课时 | 标题 |
|------|------|
| 06 | [并行归约——GPU 上的累加/最大值/直方图](06-parallel-reduction.md) |
| 07 | [粒子模拟——Compute Shader 实现 100 万粒子物理](07-particle-simulation.md) |
| 08 | [流体模拟——Navier-Stokes 的 GPU 实现](08-fluid-simulation.md) |
| 09 | [排序——GPU 并行排序（Bitonic Sort/Radix Sort）](09-gpu-sorting.md) |
| 10 | [阶段实战：构建 GPU 加速粒子物理引擎](10-particle-physics-engine.md) |

## 验收标准

- 能用 Compute Shader 实现并行归约操作
- 能在 GPU 上模拟百万级粒子的实时物理
- 能实现简化版 Navier-Stokes 流体模拟
- 能实现 Bitonic Sort 或 Radix Sort 的 GPU 并行版本
- 完成 GPU 加速粒子物理引擎，支持 100 万以上粒子

# 游戏物理引擎

> 从零构建一个简化物理引擎——碰撞检测、刚体动力学、约束系统。

## 适合谁

- 用过物理引擎（Matter.js/Cannon.js）但不理解内部原理
- 想深入理解碰撞检测（AABB/SAT/GJK）、刚体模拟、约束求解
- 想构建自己的物理引擎或为游戏添加物理效果

## 学完能做什么

- 实现 AABB、圆形、凸多边形的碰撞检测
- 实现 SAT 和 GJK 算法进行精确碰撞检测
- 实现刚体动力学（质量、力、冲量、旋转）
- 实现约束系统（距离约束、弹簧、关节约束）
- 构建一个完整的 2D 物理引擎

## 课程状态

课时数：25 / 25 ✅

## 学习路线

### 第一阶段：碰撞检测

1. [AABB 碰撞——轴对齐包围盒检测与响应](stage1-collision-detection/01-aabb-collision.md)
2. [圆形碰撞——圆-圆、圆-矩形检测](stage1-collision-detection/02-circle-collision.md)
3. [凸多边形碰撞——SAT（分离轴定理）算法](stage1-collision-detection/03-sat-algorithm.md)
4. [GJK 算法——Gilbert-Johnson-Keerthi 算法与 EPA 扩展](stage1-collision-detection/04-gjk-algorithm.md)
5. [阶段实战：实现一个带碰撞检测的弹球模拟](stage1-collision-detection/05-pinball-simulation.md)

### 第二阶段：刚体动力学

6. [运动学——位置、速度、加速度、积分器（Euler/Verlet/RK4）](stage2-rigid-body-dynamics/06-kinematics.md)
7. [力与冲量——重力、摩擦力、弹性力、冲量-动量定理](stage2-rigid-body-dynamics/07-forces-impulses.md)
8. [旋转动力学——角速度、角加速度、转动惯量、扭矩](stage2-rigid-body-dynamics/08-rotation.md)
9. [碰撞响应——冲量法、摩擦力模型、恢复系数](stage2-rigid-body-dynamics/09-collision-response.md)
10. [阶段实战：实现一个刚体堆叠模拟](stage2-rigid-body-dynamics/10-rigid-body-stacking.md)

### 第三阶段：约束系统

11. [距离约束——保持两点间固定距离](stage3-constraint-systems/11-distance-constraint.md)
12. [弹簧系统——胡克定律、阻尼、弹簧链](stage3-constraint-systems/12-spring-system.md)
13. [铰链约束——旋转关节、角度限制](stage3-constraint-systems/13-hinge-constraint.md)
14. [约束求解——迭代法、Sequential Impulse](stage3-constraint-systems/14-constraint-solver.md)
15. [阶段实战：实现一个绳索和链条模拟](stage3-constraint-systems/15-rope-chain.md)

### 第四阶段：空间分区

16. [网格分区——均匀网格、空间哈希](stage4-spatial-partitioning/16-grid-partition.md)
17. [四叉树——动态四叉树的插入/查询/删除](stage4-spatial-partitioning/17-quadtree.md)
18. [BVH——层次包围体的构建与遍历](stage4-spatial-partitioning/18-bvh.md)
19. [Broad Phase——Sweep and Prune、空间哈希对比](stage4-spatial-partitioning/19-broad-phase.md)
20. [阶段实战：优化物理引擎的碰撞检测性能](stage4-spatial-partitioning/20-optimize-collision.md)

### 第五阶段：引擎集成

21. [2D 物理引擎架构——World/Body/Shape/Constraint 的设计](stage5-engine-integration/21-engine-architecture.md)
22. [与渲染集成——将物理状态映射到 Canvas/WebGL](stage5-engine-integration/22-render-integration.md)
23. [可视化调试——碰撞体绘制、力向量可视化、碰撞点标注](stage5-engine-integration/23-debug-visualization.md)
24. [性能分析——碰撞检测次数、约束求解迭代、帧率监控](stage5-engine-integration/24-performance-profiling.md)
25. [阶段实战：构建一个完整的 2D 物理引擎并展示](stage5-engine-integration/25-complete-engine.md)

## 参考资源

- Matter.js 源码：https://github.com/liabru/matter-js
- Box2D 源码：https://github.com/erincatto/box2d
- Game Physics Engine Development（Ian Millington）
- Real-Time Collision Detection（Ericson）

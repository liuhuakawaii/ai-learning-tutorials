# 第二阶段：大型场景架构

## 阶段目标

掌握场景分区（Octree/BVH/Portal Culling）、资源管理、实例化渲染和后处理架构，能构建支持 10 万+ 面片的场景管理器。

## 课时列表

1. [场景分区——Octree/BVH/Portal Culling 原理与实现](06-spatial-partitioning.md)
2. [资源管理——纹理/模型异步加载、LOD 策略、内存预算](07-resource-management.md)
3. [实例化渲染——InstancedMesh 适用场景、与 BatchedMesh 对比](08-instanced-rendering.md)
4. [后处理架构——EffectComposer 的 Chain 设计、自定义 Pass](09-postprocessing.md)
5. [阶段实战：构建支持 10 万面片的场景管理器](10-scene-manager.md)

## 验收标准

- 能实现基于空间分区的场景管理（Octree 或 BVH）
- 能设计纹理和模型的异步加载策略和 LOD 切换机制
- 能用 InstancedMesh 实现大量相同物体的高效渲染
- 能用 EffectComposer 搭建后处理链并编写自定义 Pass

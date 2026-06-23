# Three.js 架构课

> 不是"怎么用 Three.js"，而是"Three.js 怎么设计的"以及"大型 3D 应用怎么架构"。

## 适合谁

- 用过 Three.js 做过 demo，但不理解其内部机制
- 想构建大型 3D 应用（编辑器、数字孪生、产品配置器）但不知道怎么组织代码
- 遇到性能问题只会"加 LOD"，没有系统性的优化方法

## 学完能做什么

- 理解 Three.js 的场景图、渲染管线、材质系统的内部设计
- 设计支持 10 万+ 面片的大型场景管理架构
- 构建一个简化版 3D 编辑器（选择/变换/撤销/序列化）
- 集成物理引擎和骨骼动画系统
- 用 Spector.js 和 GPU Profiler 系统性定位渲染瓶颈

## 学习路线

### 第一阶段：Three.js 内部架构

1. 场景图设计——Object3D 父子关系、矩阵更新链、dirty flag
2. 渲染管线——WebGLRenderer 内部流程、RenderList 排序、材质切换
3. 几何与缓冲区——BufferGeometry 内存布局、Attribute 系统、GPU 上传
4. 材质系统——ShaderMaterial vs RawShaderMaterial、uniform 管理、材质缓存
5. 阶段实战：阅读 Three.js 源码，画出完整渲染调用链

### 第二阶段：大型场景架构

6. 场景分区——Octree/BVH/Portal Culling 原理与实现
7. 资源管理——纹理/模型异步加载、LOD 策略、内存预算
8. 实例化渲染——InstancedMesh 适用场景、与 BatchedMesh 对比
9. 后处理架构——EffectComposer 的 Chain 设计、自定义 Pass
10. 阶段实战：构建支持 10 万面片的场景管理器

### 第三阶段：3D 编辑器架构

11. 选择与变换——Raycasting、Gizmo 实现、TransformControls 原理
12. 撤销/重做——Command 模式、操作历史、序列化
13. 场景序列化——JSON/GLTF 导出、自定义格式设计
14. 插件系统——事件总线、扩展注册、生命周期管理
15. 阶段实战：构建简化版 3D 编辑器

### 第四阶段：物理与动画

16. 物理引擎集成——Cannon.js/Ammo.js/Rapier 对比、与 Three.js 同步
17. 骨骼动画——Skeleton/SkinnedMesh、动画混合、状态机
18. 粒子系统——GPU 粒子、Transform Feedback、Billboard
19. 物理模拟——布料/流体/软体的简化实现
20. 阶段实战：构建带物理和动画的交互场景

### 第五阶段：性能与工程化

21. 性能分析——Spector.js、WebGL 调试、GPU Profiler
22. 渲染优化——Draw Call 合并、纹理图集、Shader 优化
23. 移动端适配——分辨率降级、Shader 简化、内存控制
24. 测试策略——视觉回归测试、截图对比、自动化测试
25. 阶段实战：为 3D 应用完成完整性能优化

## 验收标准

- 能画出 Three.js 一次完整渲染的调用链（Scene → Renderer → Program → Draw Call）
- 能实现一个支持空间分区的场景管理器
- 能构建一个带撤销/重做功能的 3D 编辑器
- 能用 Spector.js 定位渲染瓶颈并优化
- 能集成物理引擎实现碰撞检测和物理模拟

## 参考文档

- Three.js 源码：https://github.com/mrdoob/three.js
- Three.js 文档：https://threejs.org/docs/
- Spector.js：https://spector.babylonjs.com/
- Real-Time Rendering（Akenine-Möller et al.）

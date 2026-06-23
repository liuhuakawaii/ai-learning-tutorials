# WebGPU 创意编程

> WebGL 的下一代替代品——Compute Shader 让浏览器能做真正的 GPU 通用计算。

## 适合谁

- 想在浏览器中实现流体模拟、粒子物理、光线追踪等 GPU 密集型效果
- 想了解 WebGPU 的架构和 WGSL 着色器语言
- 想在最前沿的 Web 图形技术上建立能力

## 学完能做什么

- 用 WebGPU 渲染管线和 Compute Shader 构建高性能图形应用
- 用 WGSL 编写顶点/片段/计算着色器
- 实现 GPU 加速的粒子系统、流体模拟、群体行为
- 理解延迟渲染、全局光照等高级渲染技术
- 探索 NeRF、Gaussian Splatting 等前沿 3D 重建技术

## 学习路线

### 第一阶段：WebGPU 基础

1. WebGPU vs WebGL——架构差异、为什么 WebGPU 更好
2. 渲染管线——Vertex → Fragment 的 WGSL 实现
3. 缓冲与绑定——Buffer/BindGroup/BindGroupLayout
4. 计算着色器——Compute Shader 基础、工作组/调用
5. 阶段实战：用 WebGPU 渲染一个粒子系统

### 第二阶段：GPU 计算

6. 并行归约——GPU 上的累加/最大值/直方图
7. 粒子模拟——Compute Shader 实现 100 万粒子物理
8. 流体模拟——Navier-Stokes 的 GPU 实现
9. 排序——GPU 并行排序（Bitonic Sort/Radix Sort）
10. 阶段实战：构建 GPU 加速粒子物理引擎

### 第三阶段：高级渲染

11. 延迟渲染——G-Buffer、光照 Pass、多光源
12. 全局光照——Screen Space GI、Voxel GI
13. 阴影——Shadow Mapping、Cascaded Shadow Maps
14. 后处理——Tone Mapping、Bloom、TAA
15. 阶段实战：构建带全局光照的实时渲染器

### 第四阶段：生成与模拟

16. 程序化生成——噪声/分形/WFC 的 GPU 实现
17. 生命游戏——GPU 上的 Conway's Game of Life 变体
18. 群体模拟——Boids 算法（鸟群/鱼群行为）
19. 布料/软体——弹簧-质点系统的 GPU 加速
20. 阶段实战：构建实时群体模拟可视化

### 第五阶段：前沿应用

21. Neural Radiance Fields（NeRF）——WebGPU 实现神经辐射场
22. Gaussian Splatting——3D 高斯溅射的 Web 实现
23. 体积渲染——医学/气象数据的 3D 可视化
24. 机器学习推理——WebGPU 上的模型推理（ONNX/WebNN）
25. 阶段实战：构建 WebGPU 加速的 3D 场景重建工具

## 验收标准

- 能用 WGSL 编写顶点/片段/计算着色器
- 能用 Compute Shader 实现百万级粒子的实时物理模拟
- 能实现延迟渲染管线和全局光照
- 能在 GPU 上实现流体模拟和群体行为
- 能理解并实现 NeRF/Gaussian Splatting 的基本原理

## 参考资源

- WebGPU 规范：https://www.w3.org/TR/webgpu/
- WGSL 规范：https://www.w3.org/TR/WGSL/
- WebGPU Samples：https://webgpu.github.io/webgpu-samples/
- Learn WebGPU：https://codelao.com/tutorials/webgpu

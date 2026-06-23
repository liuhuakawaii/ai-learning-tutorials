# 第一阶段：WebGPU 基础

理解 WebGPU 的架构优势，掌握 WGSL 着色器语言和渲染管线，学会使用 Buffer/BindGroup 绑定资源，并初步接触 Compute Shader。

## 课时列表

| 课时 | 标题 |
|------|------|
| 01 | [WebGPU vs WebGL——架构差异、为什么 WebGPU 更好](01-webgpu-vs-webgl.md) |
| 02 | [渲染管线——Vertex → Fragment 的 WGSL 实现](02-rendering-pipeline.md) |
| 03 | [缓冲与绑定——Buffer/BindGroup/BindGroupLayout](03-buffers-and-bindings.md) |
| 04 | [计算着色器——Compute Shader 基础、工作组/调用](04-compute-shader-basics.md) |
| 05 | [阶段实战：用 WebGPU 渲染一个粒子系统](05-particle-system-basics.md) |

## 验收标准

- 能说清 WebGPU 与 WebGL 的架构差异和 WebGPU 的优势
- 能用 WGSL 编写 Vertex/Fragment Shader 并理解渲染管线流程
- 能正确使用 Buffer、BindGroup、BindGroupLayout 管理 GPU 资源
- 能编写基础 Compute Shader 并理解工作组模型
- 完成一个 WebGPU 粒子系统，包含渲染和计算管线

# 第一阶段：Three.js 内部架构

## 阶段目标

理解 Three.js 的场景图设计、渲染管线、BufferGeometry 内存布局和材质系统，能通过源码阅读画出完整的渲染调用链。

## 课时列表

1. [场景图设计——Object3D 父子关系、矩阵更新链、dirty flag](01-scene-graph.md)
2. [渲染管线——WebGLRenderer 内部流程、RenderList 排序、材质切换](02-render-pipeline.md)
3. [几何与缓冲区——BufferGeometry 内存布局、Attribute 系统、GPU 上传](03-buffer-geometry.md)
4. [材质系统——ShaderMaterial vs RawShaderMaterial、uniform 管理、材质缓存](04-material-system.md)
5. [阶段实战：阅读 Three.js 源码，画出完整渲染调用链](05-source-code-tracing.md)

## 验收标准

- 能画出 Three.js 场景图的父子关系和矩阵更新链
- 能说明 WebGLRenderer 内部的渲染流程（Scene → RenderList → Program → Draw Call）
- 能解释 BufferGeometry 的内存布局和 Attribute 如何上传到 GPU
- 能区分 ShaderMaterial 和 RawShaderMaterial 的使用场景

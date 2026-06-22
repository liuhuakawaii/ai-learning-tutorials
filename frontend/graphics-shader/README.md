# 3D 图形学与 Shader 编程

从数学基础到 WebGL/Three.js 再到 GLSL Shader，掌握 3D 图形编程核心能力。

## 课程简介

本课程面向有 JavaScript/TypeScript 基础的前端开发者，系统性地讲解 3D 图形编程所需的数学知识、WebGL 底层原理、Three.js 框架实战、GLSL Shader 编写技巧以及创意视觉项目的完整实现。课程以"数学→渲染管线→着色器→特效→项目"为主线，每一步都有可运行的代码示例，最终你将具备独立开发 3D 可视化应用和创意视觉作品的能力。

## 前置要求

- 熟悉 JavaScript/TypeScript 语法与 ES6+ 特性
- 了解基本的 HTML/CSS，能使用 Canvas 绘制简单图形
- 有基本的线性代数概念（向量、矩阵）者更佳，但非必需

## 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 课程代码统一语言 |
| Three.js | 3D 渲染框架 |
| GLSL | 着色器编程语言 |
| WebGL | 底层图形 API |
| React Three Fiber | React 生态下的 Three.js 封装 |
| Vite | 开发构建工具 |

## 课程阶段

| 阶段 | 名称 | 课时 | 简介 |
|------|------|------|------|
| Stage 1 | 3D 数学基础 | 12 | 向量、矩阵、四元数、坐标系变换，为图形学打下数学根基 |
| Stage 2 | WebGL 与 Three.js | 14 | WebGL 渲染管线、Three.js 核心 API、模型加载与场景搭建 |
| Stage 3 | Shader 编程 | 12 | GLSL 语法、顶点/片元着色器、Uniform/Varying、纹理映射 |
| Stage 4 | 高级特效 | 12 | 后处理、粒子系统、体积光、PBR 材质、程序化纹理 |
| Stage 5 | 创意项目实战 | 10 | 综合运用所学，完成可展示的创意 3D 作品 |

## 学习路线

```
数学基础 → WebGL 渲染管线 → Three.js 场景开发 → GLSL Shader → 高级特效 → 创意项目
   ↓            ↓                ↓                ↓            ↓           ↓
 向量矩阵    GPU 工作流      模型/光照/相机    着色器调试    后处理/PBR   完整作品
```

## 课程目录

### Stage 1：3D 数学基础

- 01-向量与坐标系.md
- 02-矩阵运算与变换.md
- 03-四元数与旋转.md
- 04-投影与视图变换.md
- 05-插值与曲线.md
- 06-碰撞检测数学.md
- 07-数学在图形学中的综合应用.md

### Stage 2：WebGL 与 Three.js

- 01-WebGL 渲染管线概述.md
- 02-第一个 WebGL 三角形.md
- 03-缓冲区与属性.md
- 04-Three.js 核心概念与场景搭建.md
- 05-几何体与材质.md
- 06-光照系统.md
- 07-相机与控制器.md
- 08-模型加载（glTF/FBX/OBJ）.md
- 09-动画系统.md
- 10-Three.js 性能优化.md
- 11-React Three Fiber 入门.md
- 12-React Three Fiber 进阶模式.md

### Stage 3：Shader 编程

- 01-GLSL 基础语法与数据类型.md
- 02-顶点着色器.md
- 03-片元着色器.md
- 04-Uniform 与 Varying.md
- 05-纹理采样与 UV 映射.md
- 06-噪声函数与程序化生成.md
- 07-Shader 中的光照模型.md
- 08-自定义 ShaderMaterial.md
- 09-Shader 调试与性能分析.md
- 10-Shader 编程综合实战.md

### Stage 4：高级特效

- 01-后处理效果（Bloom/Blur/色调映射）.md
- 02-粒子系统与 GPU 粒子.md
- 03-体积光与雾效.md
- 04-PBR 物理渲染.md
- 05-程序化纹理与分形.md
- 06-屏幕空间效果（SSAO/反射）.md
- 07-Compute Shader 入门.md
- 08-变形与骨骼动画 Shader.md
- 09-水体模拟与渲染.md
- 10-高级特效综合实战.md

### Stage 5：创意项目实战

- 01-创意编码方法论与工具链.md
- 02-交互式粒子艺术.md
- 03-Generative Art：程序化生成艺术.md
- 04-沉浸式 3D 场景.md
- 05-音乐可视化.md
- 06-Shadertoy 风格 Shader 创作.md
- 07-数据驱动的 3D 可视化.md
- 08-AR/VR 创意原型.md

## 学习建议

1. **动手优先**：每节课的代码示例务必本地运行，修改参数观察变化
2. **数学不跳过**：Stage 1 的数学基础直接决定后续 Shader 编写的上限
3. **善用调试工具**：Spector.js（WebGL 调试）、Shader playground（在线 GLSL 编辑）
4. **循序渐进**：先跑通 Three.js 场景，再写自定义 Shader，最后追求视觉效果
5. **参考社区**：Shadertoy、The Book of Shaders、Three.js Examples 是最好的学习资源

## 验证方式

每个阶段结束后运行对应的验证脚本：

```bash
cd graphics-shader-course/final-project
npm run check
```

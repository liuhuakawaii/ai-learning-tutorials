# Stage 3：Shader 编程

Shader 是 GPU 上运行的程序，直接决定画面的最终效果。本阶段系统讲解 GLSL 语法、顶点着色器与片元着色器的工作机制、Uniform/Varying 数据流、纹理采样、噪声函数等核心知识。学完本阶段，你将具备独立编写自定义 Shader 的能力。

## 课时列表

| 序号 | 文件 | 主题 |
|------|------|------|
| 01 | GLSL 基础语法与数据类型.md | float/vec/mat/sampler、内置函数、精度限定符 |
| 02 | 顶点着色器.md | 顶点变换、gl_Position、逐顶点计算 |
| 03 | 片元着色器.md | gl_FragColor、Alpha 测试、discard |
| 04 | Uniform 与 Varying.md | CPU→GPU 数据传递、插值机制、Uniform 缓冲区 |
| 05 | 纹理采样与 UV 映射.md | texture2D、UV 坐标系、多重纹理、立方体贴图 |
| 06 | 噪声函数与程序化生成.md | Perlin/Simplex 噪声、FBM、伪随机数生成 |
| 07 | Shader 中的光照模型.md | Lambert/Gourard/Phong/Blinn-Phong、法线贴图 |
| 08 | 自定义 ShaderMaterial.md | Three.js ShaderMaterial/RawShaderMaterial、defines/chunks 注入 |
| 09 | Shader 调试与性能分析.md | Spector.js、着色器重编译、GPU 性能瓶颈定位 |
| 10 | Shader 编程综合实战.md | 综合运用所学实现一个完整的自定义材质效果 |

## 学习目标

- 掌握 GLSL 的数据类型、内置函数和精度控制
- 理解顶点着色器和片元着色器在渲染管线中的角色与数据流
- 能使用 Uniform 从 CPU 传递数据，理解 Varying 的插值机制
- 实现纹理采样、UV 动画、多重纹理混合
- 掌握噪声函数的原理，能用 FBM 生成程序化纹理
- 实现 Phong/Blinn-Phong 光照模型和法线贴图
- 能在 Three.js 中编写和调试自定义 ShaderMaterial

## 阶段交付物

- **Shader 片段集**：至少 5 个独立的 Shader 效果（渐变、噪声纹理、法线贴图光照、UV 动画、自定义材质）
- **Shader 可视化工具**：一个可实时编辑 GLSL 并预览效果的开发页面
- **验证通过**：运行 `npm run check` 通过 Stage 3 的 Shader 编程验证

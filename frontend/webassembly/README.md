# WebAssembly 高性能 Web 开发

> 面向有前端基础的开发者，系统学习 WebAssembly 技术栈，掌握在浏览器中运行高性能代码的核心能力。

## 课程简介

WebAssembly（Wasm）是现代 Web 平台的二进制指令格式，让 C/C++、Rust 等编译型语言的代码能够以接近原生的速度在浏览器中运行。本课程从 WebAssembly 的底层原理出发，通过 Rust + wasm-bindgen、AssemblyScript、Emscripten 三条技术路线，系统讲解 Wasm 在图像处理、音视频编解码、物理引擎、密码学等高性能场景中的工程实践。

课程共 **30 课时**，分为 5 个阶段，每个阶段配有实践项目，最终完成一个完整的 **WASM 多媒体处理平台**。

## 前置要求

- 熟悉 HTML / CSS / JavaScript 基础
- 了解至少一门编译型语言（C、C++、Rust 任选其一，不要求精通）
- 了解 Node.js 基本使用
- 有命令行基本操作能力

## 学习成果

完成本课程后，你将能够：

1. 理解 WebAssembly 的二进制格式、内存模型和执行机制
2. 使用 Rust + wasm-bindgen / wasm-pack 构建高性能 Wasm 模块
3. 使用 AssemblyScript 以类 TypeScript 语法编写 Wasm 代码
4. 使用 Emscripten 将现有 C/C++ 项目编译为 Wasm
5. 在 Web 应用中集成 Wasm 模块，实现 Worker 多线程和 SIMD 加速
6. 掌握 Wasm 模块的性能分析、优化和工程化部署
7. 完成一个包含图像处理、音视频功能的多媒体处理平台

## 技术栈

| 技术 | 用途 |
|------|------|
| Rust | 主要 Wasm 编写语言，配合 wasm-bindgen / wasm-pack |
| AssemblyScript | 类 TypeScript 的 Wasm 编写语言，适合前端开发者 |
| Emscripten | 将 C/C++ 代码编译为 Wasm 的工具链 |
| wasm-bindgen | Rust/Wasm 与 JavaScript 的互操作绑定 |
| wasm-pack | Rust/Wasm 项目的构建与发布工具 |
| Web Workers | Wasm 模块的多线程执行环境 |
| SIMD | Wasm 的向量化指令集加速 |

## 学习路线

### 第一阶段：WebAssembly 基础与原理（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | WebAssembly 是什么：从 asm.js 到 Wasm | Wasm 的诞生背景、与 JS 的关系、浏览器支持现状 |
| 02 | Wasm 二进制格式与文本格式（WAT） | 模块结构、类型系统、指令集、内存模型 |
| 03 | 手写 WAT：理解栈式虚拟机 | 用 WAT 编写函数、控制流、内存操作 |
| 04 | JavaScript 与 Wasm 互操作基础 | 实例化模块、导入导出、类型映射、胶水代码 |
| 05 | Wasm 内存模型与线性内存 | 共享内存、TypedArray 视图、内存增长策略 |
| 06 | 阶段项目：用 WAT 实现一个简易计算器 | 综合运用 WAT 指令、JS 互操作、内存管理 |

### 第二阶段：Rust + Wasm 工程化（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 07 | Rust 快速上手：为 Wasm 准备 | Rust 基础语法、所有权模型、wasm32-unknown-unknown 目标 |
| 08 | wasm-bindgen 深入：类型映射与闭包 | 字符串/数组/结构体的跨语言传递、回调函数 |
| 09 | wasm-pack 工程实践 | 项目结构、构建流程、npm 发布、测试 |
| 10 | 错误处理与 panic 策略 | console_error_panic_hook、Result 类型映射、错误边界 |
| 11 | 数据密集型计算：矩阵运算实战 | 用 Rust 实现矩阵乘法、与 JS 实现性能对比 |
| 12 | 阶段项目：图像灰度化与滤镜处理 | Rust 实现图像像素操作、Canvas 集成、性能基准测试 |

### 第三阶段：AssemblyScript 与多语言 Wasm（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 13 | AssemblyScript 入门：类 TS 写 Wasm | 语法差异、类型限制、装饰器、编译目标 |
| 14 | AssemblyScript 内存管理 | Arena 分配器、GC 策略、手动内存控制 |
| 15 | Emscripten 实战：编译 C/C++ 到 Wasm | 工具链配置、编译选项、glue code 生成 |
| 16 | 移植现有 C 库到 Wasm | 以 libpng/zlib 为例，讲解交叉编译与裁剪 |
| 17 | 多语言 Wasm 模块对比与选型 | Rust vs AS vs C++ 的性能、体积、开发体验对比 |
| 18 | 阶段项目：用 AssemblyScript 实现 JSON 解析器 | 词法分析、语法树构建、与 JS JSON.parse 性能对比 |

### 第四阶段：进阶特性与性能优化（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 19 | Wasm 多线程：SharedArrayBuffer + Worker | 线程模型、Atomics、数据同步、线程池设计 |
| 20 | SIMD 指令加速 | 128 位向量运算、自动向量化、手写 SIMD intrinsics |
| 21 | Wasm 文件体积优化 | LTO、代码裁剪、wasm-opt、压缩策略 |
| 22 | 性能分析与调优 | Chrome DevTools Wasm 调试、火焰图、内存分析 |
| 23 | Wasm 组件模型（Component Model） | WASI、接口类型、模块组合规范 |
| 24 | 阶段项目：多线程图像处理 Pipeline | Worker 池 + SIMD 加速的批量图像处理 |

### 第五阶段：工程化与综合实战（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 25 | Wasm 模块的测试策略 | 单元测试、集成测试、跨语言测试、wasm-pack test |
| 26 | CI/CD 与自动化构建 | GitHub Actions、多目标构建、npm/wasm 包发布 |
| 27 | Wasm 在生产环境的应用案例 | Figma、Google Earth、AutoCAD Web 的架构分析 |
| 28 | Wasm + Web API 深度集成 | WebCodecs、WebGPU、OffscreenCanvas、File System Access |
| 29 | 综合项目开发（上）：架构与核心模块 | 多媒体处理平台的架构设计、模块划分、接口定义 |
| 30 | 综合项目开发（下）：集成与优化 | 模块集成、性能调优、部署上线、课程总结 |

## 课程项目

每个阶段包含一个阶段项目，最终汇聚为毕业项目：

- **阶段一**：WAT 计算器 — 理解 Wasm 底层指令
- **阶段二**：图像滤镜处理器 — Rust + wasm-bindgen 工程实践
- **阶段三**：JSON 解析器 — AssemblyScript 性能挑战
- **阶段四**：多线程图像 Pipeline — Worker + SIMD 进阶优化
- **毕业项目**：WASM 多媒体处理平台 — 综合运用全部技术

## 推荐资源

- [WebAssembly 官方文档](https://webassembly.org/)
- [Rust and WebAssembly Book](https://rustwasm.github.io/docs/book/)
- [AssemblyScript 官方文档](https://www.assemblyscript.org/)
- [Emscripten 官方文档](https://emscripten.org/)
- [WebAssembly MDN 文档](https://developer.mozilla.org/en-US/docs/WebAssembly)

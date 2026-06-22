# Stage 1: WASM 基础

## 阶段概述

本阶段从零开始理解 WebAssembly 的核心概念、执行模型和开发工具链。你将学会用 WAT 手写模块、用 C/C++ 和 AssemblyScript 编译 WASM，并在实际项目中完成 JavaScript 与 WASM 的互操作。

## 学习目标

- 理解 WebAssembly 的设计目标、二进制格式和浏览器执行流程
- 掌握 WAT 文本格式语法，能手写简单的 WASM 模块
- 熟悉 WASM 与 JavaScript 的导入导出、内存共享和类型映射机制
- 使用 Emscripten 工具链将 C/C++ 代码编译为 WASM
- 使用 AssemblyScript 编写可编译为 WASM 的 TypeScript 风格代码
- 在真实场景中对比 WASM 与 JavaScript 的性能差异

## 课程列表

| 序号 | 文件 | 主题 | 预计学时 |
|------|------|------|----------|
| 01 | 01-WebAssembly是什么.md | WASM 原理与设计目标、执行模型、浏览器调试 | 2h |
| 02 | 02-WASM文本格式.md | WAT 语法、S-expression、指令集、内存模型 | 2h |
| 03 | 03-WASM与JavaScript互操作.md | 导入导出、内存共享、胶水代码、类型映射 | 2h |
| 04 | 04-Emscripten工具链.md | Emscripten 安装、C/C++ 编译、优化选项 | 2h |
| 05 | 05-AssemblyScript入门.md | AssemblyScript 语法、内存管理、编译目标 | 2h |
| 06 | 06-阶段实战-图像处理加速.md | 图像滤镜算法、WASM 加速、性能基准测试 | 3h |

## 前置要求

- 熟悉 JavaScript 基础语法
- 了解 HTML Canvas 基本用法（阶段实战需要）
- 安装 Node.js 18+ 和现代浏览器（Chrome/Firefox）
- 安装 Emscripten SDK（第 4 课需要）

## 学习建议

1. 按顺序学习，每课都建立在前一课的基础上
2. 第 1-2 课重在理解原理，不要急于写代码
3. 第 3-5 课每个代码示例都要亲手运行
4. 第 6 课的实战项目建议完整做完，它是后续阶段的基础

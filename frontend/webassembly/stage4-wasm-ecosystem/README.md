# Stage 4: WASM 生态

## 阶段概述

本阶段深入 WebAssembly 的生态系统和工程实践。从 WASI 系统接口、组件模型互操作，到服务端运行时、插件系统架构、AI 推理集成，完整覆盖 WASM 在浏览器之外的核心应用场景。最后一课通过构建一个完整的 WASM 插件引擎，将所有知识融会贯通。

## 前置要求

- 完成 Stage 1（WASM 基础）、Stage 2（Rust + WASM）和 Stage 3（性能应用）
- 熟悉 Rust 基本语法、wasm-bindgen 和 wasm-pack 工具链
- 了解基本的系统编程概念（文件 I/O、进程间通信）

## 课程列表

| 序号 | 课程 | 主题 | 核心技能 |
|------|------|------|----------|
| 01 | WASI 标准 | 系统接口标准化 | 能力模型、fd_read/fd_write、Wasmtime 使用 |
| 02 | WASM 组件模型 | 跨语言互操作 | WIT 语法、组件链接、资源类型、wasm-tools |
| 03 | WASM 在服务端 | 服务端运行时 | Wasmtime/WasmEdge/Wasmer、微服务、边缘计算 |
| 04 | WASM 插件系统 | 插件架构设计 | 安全沙箱、宿主-插件通信、权限控制 |
| 05 | WASM 与 AI 推理 | 浏览器端推理 | ONNX Runtime Web、模型转换、WebGPU 协作 |
| 06 | 阶段实战 | WASM 插件引擎 | 完整插件系统、Rust 宿主、WIT 接口、热重载 |

## 学习目标

完成本阶段后，你将能够：

1. **理解 WASI 规范**，掌握基于能力的沙箱安全模型和系统接口调用方式
2. **使用组件模型**实现跨语言的模块互操作，编写 WIT 接口定义并用 wasm-tools 工具链管理组件
3. **在服务端部署 WASM 应用**，对比主流运行时特性，理解 WASM 与容器的差异和适用场景
4. **设计和实现插件系统**，利用 WASM 沙箱实现安全的第三方代码执行
5. **集成 AI 推理能力**，在浏览器端用 WASM 加速模型推理
6. **构建一个完整的 WASM 插件引擎**，综合运用 Rust、WIT、TypeScript 和工程化最佳实践

## 阶段项目

本阶段的实战项目是 **WASM 插件引擎**（第 06 课），它综合运用了前 5 课的知识：

- 使用 WASI 接口实现文件系统访问和环境变量读取
- 用 WIT 定义插件接口，实现跨语言插件兼容
- Rust 实现宿主引擎，管理插件加载、实例化和调用
- TypeScript 管理界面，支持插件热重载和性能监控
- 完整的错误处理和沙箱隔离机制

## 环境准备

```bash
# 确保 Rust 工具链已安装
rustup target add wasm32-wasi
rustup target add wasm32-unknown-unknown

# 安装 wasm-tools
cargo install wasm-tools

# 安装 Wasmtime CLI
curl https://wasmtime.dev/install.sh -sSf | bash

# 安装 wasm-pack
cargo install wasm-pack

# 安装 Node.js 依赖
npm install -g typescript ts-node
```

## 学习建议

1. **按顺序学习**：WASI → 组件模型 → 服务端 → 插件系统 → AI 推理 → 实战，知识层层递进
2. **动手实践**：每课都有练习题，务必完成代码编写并用 Wasmtime 运行验证
3. **关注生态演进**：WASI Preview 2 和组件模型仍在快速迭代，注意区分稳定特性和实验特性
4. **对比实验**：服务端 WASM 与 Docker 容器的对比是理解价值的关键，建议亲自测试启动速度和资源占用

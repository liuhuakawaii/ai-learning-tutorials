# Stage 2: Rust + WASM

## 阶段概述

本阶段从 Rust 语言基础出发，逐步掌握使用 Rust 开发 WebAssembly 模块的完整工具链。你将学会所有权系统、wasm-bindgen 绑定机制、wasm-pack 构建流程、web-sys/js-sys 的 DOM 操作能力，以及 WASM 内存管理的核心原理，最终通过实战项目——用 Rust 实现 Markdown 解析器——将所有知识串联。

## 课时列表

| 序号 | 文件 | 主题 | 核心内容 |
|------|------|------|----------|
| 01 | `01-Rust基础语法.md` | Rust 基础语法 | 所有权、借用、生命周期、模式匹配、错误处理、Cargo |
| 02 | `02-wasm-bindgen入门.md` | wasm-bindgen 入门 | 绑定机制、类型映射、导入导出、闭包、JsValue |
| 03 | `03-wasm-pack工具链.md` | wasm-pack 工具链 | 构建流程、目标选择、npm 包生成、CI/CD 集成 |
| 04 | `04-Web-Sys与Js-Sys.md` | Web-Sys 与 Js-Sys | DOM 操作、事件处理、Canvas API、Fetch、JS 内置对象 |
| 05 | `05-内存管理.md` | 内存管理 | 线性内存模型、分配器、内存增长、wasm-opt 优化 |
| 06 | `06-阶段实战-Rust实现Markdown解析器.md` | 阶段实战 | 词法分析、语法分析、AST、HTML 渲染、性能对比 |

## 学习目标

完成本阶段后，你将能够：

1. **编写安全的 Rust 代码**——理解所有权、借用和生命周期的核心规则，避免常见的编译错误
2. **使用 wasm-bindgen 实现 Rust ↔ JS 互操作**——在两种语言间自由传递数据和调用函数
3. **用 wasm-pack 构建可发布的 npm 包**——掌握 build/test/pack 全流程，集成到前端工程
4. **通过 web-sys 操作浏览器 API**——用 Rust 代码操作 DOM、处理事件、绘制 Canvas
5. **理解 WASM 内存模型**——知道线性内存如何工作、如何避免内存泄漏、如何优化内存性能
6. **独立完成 Rust + WASM 实战项目**——从解析器设计到 JS 集成，端到端交付一个可用模块

## 前置要求

- 完成 Stage 1（WASM 基础），理解 WAT 格式和 WASM 执行模型
- 基本的命令行操作能力
- 已安装 Rust 工具链（rustup）和 Node.js

## 环境准备

```bash
# 安装 Rust（如尚未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 添加 WASM 编译目标
rustup target add wasm32-unknown-unknown

# 安装 wasm-pack
cargo install wasm-pack

# 验证安装
rustc --version
wasm-pack --version
```

## 学习建议

- **动手优先**：每课的代码示例都要亲自运行，不要只看不练
- **拥抱编译器**：Rust 编译器的错误信息非常详细，认真阅读它能加速你的学习
- **循序渐进**：先掌握 01 的 Rust 基础，再进入 wasm-bindgen，不要跳课
- **对比学习**：每课的「常见误区」都是前人踩过的坑，务必通读

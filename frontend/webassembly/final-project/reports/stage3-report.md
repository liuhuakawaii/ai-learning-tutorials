# 第三阶段报告：AssemblyScript 与多语言 Wasm

## 学习总结

<!-- 总结本阶段的学习历程，重点记录 AssemblyScript 和 Emscripten 两种 Wasm 开发路线 -->

## 核心知识点

### AssemblyScript

<!-- 记录以下知识点：
- AssemblyScript 与 TypeScript 的语法差异
- 类型系统的限制（没有 any、union 类型受限等）
- 内存管理模型（Arena 分配器、GC 策略）
- 编译选项和优化配置
-->

### Emscripten 工具链

<!-- 记录对以下内容的理解：
- Emscripten 的编译流程（LLVM → Wasm + glue code）
- 编译选项的选择（-O2、-s WASM=1、-s MODULARIZE 等）
- 生成的胶水代码的结构和作用
- 文件系统模拟（FS API）
-->

### 移植 C 库到 Wasm

<!-- 记录移植 C 库的经验：
- 交叉编译的配置方法
- 依赖库的处理策略
- 裁剪和优化技巧
- 遇到的兼容性问题
-->

### 多语言 Wasm 对比

<!-- 记录三种技术路线的对比分析：
- Rust：安全性、性能、生态、学习曲线
- AssemblyScript：开发体验、包体积、适用场景
- C/C++ (Emscripten)：移植性、性能、胶水代码体积
- 各自的最佳使用场景
-->

## 实践心得

### JSON 解析器项目

<!-- 描述阶段项目的完成情况：
- AssemblyScript 实现的解析器功能
- 与 JS JSON.parse 的性能对比
- 内存管理的经验
- AssemblyScript 的开发体验总结
-->

### Emscripten 实践

<!-- 记录使用 Emscripten 编译 C 库的经验 -->

## 遇到的问题与解决

<!-- 列出本阶段遇到的主要问题及解决方法：

### 问题 1：xxx
**现象**：
**原因**：
**解决**：

-->

## 下一步计划

<!-- 对第四阶段（进阶特性与性能优化）的期望和准备 -->

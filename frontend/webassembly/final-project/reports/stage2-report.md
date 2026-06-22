# 第二阶段报告：Rust + Wasm 工程化

## 学习总结

<!-- 总结本阶段的学习历程，重点记录 Rust + wasm-bindgen 的工程化体验 -->

## 核心知识点

### Rust 与 Wasm 编译

<!-- 记录以下知识点：
- Rust 的 wasm32-unknown-unknown 编译目标
- 所有权模型对 Wasm 开发的影响
- #[wasm_bindgen] 属性宏的作用
- Cargo.toml 中 Wasm 相关的配置项
-->

### wasm-bindgen 深入

<!-- 记录对以下内容的理解：
- 类型映射规则（String、Vec、JsValue 等）
- 闭包和回调函数的传递
- 结构体的跨语言共享
- #[wasm_bindgen(start)] 入口函数
-->

### wasm-pack 工程实践

<!-- 记录对以下内容的理解：
- wasm-pack 的构建流程和输出产物
- 与 npm 生态的集成方式
- 测试策略（wasm-pack test --headless）
- 发布到 npm 的流程
-->

### 错误处理

<!-- 记录 Wasm 中的错误处理策略：
- console_error_panic_hook 的作用
- Result<T, JsValue> 的使用模式
- 如何将 Rust 错误传递给 JavaScript
-->

## 实践心得

### 图像灰度化与滤镜处理项目

<!-- 描述阶段项目的完成情况：
- Rust 实现了哪些图像处理算法
- 如何与 Canvas API 集成
- 性能基准测试的方法和结果
- 与纯 JS 实现的性能对比数据
-->

### 工程化体验

<!-- 记录 Rust + wasm-pack 的工程化体验：
- 开发流程是否顺畅
- 编译速度如何
- 调试体验如何
- 有哪些坑需要注意
-->

## 遇到的问题与解决

<!-- 列出本阶段遇到的主要问题及解决方法：

### 问题 1：xxx
**现象**：
**原因**：
**解决**：

### 问题 2：xxx
**现象**：
**原因**：
**解决**：

-->

## 下一步计划

<!-- 对第三阶段（AssemblyScript 与多语言 Wasm）的期望和准备 -->

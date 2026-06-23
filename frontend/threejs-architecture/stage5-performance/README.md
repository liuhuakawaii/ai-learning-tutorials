# 第五阶段：性能与工程化

## 阶段目标

掌握 3D 应用的性能分析方法（Spector.js、GPU Profiler）、渲染优化策略和测试方案，能为 3D 应用完成完整的性能优化。

## 课时列表

1. [性能分析——Spector.js、WebGL 调试、GPU Profiler](21-performance-profiling.md)
2. [渲染优化——Draw Call 合并、纹理图集、Shader 优化](22-render-optimization.md)
3. [移动端适配——分辨率降级、Shader 简化、内存控制](23-mobile-optimization.md)
4. [测试策略——视觉回归测试、截图对比、自动化测试](24-testing-strategy.md)
5. [阶段实战：为 3D 应用完成完整性能优化](25-full-optimization.md)

## 验收标准

- 能用 Spector.js 定位渲染瓶颈（Draw Call 数量、状态切换、纹理上传）
- 能用 Draw Call 合并和纹理图集减少渲染开销
- 能针对移动端做分辨率降级和 Shader 简化
- 能搭建视觉回归测试框架验证 3D 渲染的一致性

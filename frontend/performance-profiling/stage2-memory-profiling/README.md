# 第二阶段：内存分析

## 阶段目标

掌握 Memory 面板的堆快照、内存分配时间线和内存泄漏定位方法，能识别常见内存泄漏模式并用 WeakMap/WeakRef 等手段优化。

## 课时列表

1. [Memory 面板入门——堆快照、内存分配时间线、内存分配采样](06-memory-panel-intro.md)
2. [内存泄漏定位——堆快照对比（Comparison）、Detached DOM Tree](07-memory-leak-detection.md)
3. [常见内存泄漏模式——闭包引用、事件监听器未清理、定时器、全局变量](08-common-leak-patterns.md)
4. [内存优化实践——WeakMap/WeakRef、虚拟滚动、大列表的内存管理](09-memory-optimization.md)
5. [阶段实战：定位并修复一个真实应用的内存泄漏](10-stage2-practice-leak-fix.md)

## 验收标准

- 能用 Memory 面板拍摄堆快照并用 Comparison 视图对比差异
- 能通过 Detached DOM Tree 定位未被回收的 DOM 节点
- 能识别闭包引用、事件监听器未清理等常见内存泄漏模式
- 能用 WeakMap/WeakRef 解决内存泄漏问题

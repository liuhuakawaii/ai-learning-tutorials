# 第二阶段：内存管理

## 阶段目标

理解虚拟内存、页表、TLB 的工作原理，掌握内存分配机制和 OOM Killer 的触发条件，能用 /proc 和 pmap 分析进程的内存布局。

## 课时列表

1. [虚拟内存——页表、TLB、缺页中断的完整流程](06-virtual-memory.md)
2. [内存分配——brk/mmap、glibc malloc、jemalloc](07-memory-allocation.md)
3. [OOM Killer——什么触发它、怎么查、怎么防](08-oom-killer.md)
4. [内存映射——mmap、共享内存、文件映射](09-memory-mapping.md)
5. [阶段实战：用 /proc 和 pmap 分析一个进程的内存布局](10-proc-pmap-analysis.md)

## 验收标准

- 能画出虚拟地址到物理地址的翻译流程（页表 → TLB → 缺页中断）
- 能解释 brk 和 mmap 的使用场景和 glibc malloc 的分配策略
- 能说明 OOM Killer 的触发条件和 oom_score 的计算方式
- 能用 pmap 分析进程的内存段分布（堆、栈、mmap 区域）

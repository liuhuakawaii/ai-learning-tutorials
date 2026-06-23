# 第一阶段：进程与线程

## 阶段目标

理解进程、线程、协程的内核实现和切换开销，掌握进程调度和进程间通信机制，能用 strace 观察系统调用。

## 课时列表

1. [进程是什么——从 fork() 看进程创建的内核实现](01-fork-and-process.md)
2. [线程与协程——用户态调度 vs 内核态调度的取舍](02-thread-and-coroutine.md)
3. [进程调度——CFS 调度器、优先级、nice 值、cgroup](03-process-scheduling.md)
4. [进程间通信——管道、共享内存、消息队列、Socket](04-ipc.md)
5. [阶段实战：用 strace 观察一个 Web 服务器的系统调用](05-strace-web-server.md)

## 验收标准

- 能解释 fork() 创建进程的内核实现流程（复制页表、文件描述符等）
- 能区分进程、线程、协程的调度方式和切换开销
- 能说明 CFS 调度器的基本原理和 cgroup 的资源限制机制
- 能用 strace 观察并解释 Web 服务器的系统调用序列

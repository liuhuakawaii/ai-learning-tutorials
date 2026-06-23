# 面向开发者的操作系统课

> 容器、虚拟机、进程、线程——你每天都在用，但你知道它们在内核里长什么样吗？

## 适合谁

- 做过 Web 开发，但对操作系统的理解停留在"Linux 命令行"
- 用 Docker 但不知道容器和虚拟机的本质区别
- 遇到 OOM、进程被 kill、文件描述符耗尽时不知道怎么查

## 学完能做什么

- 理解进程/线程/协程的内核实现和切换开销
- 理解虚拟内存、页表、TLB 的工作原理
- 用 strace 观察系统调用并理解用户态/内核态切换
- 理解 I/O 多路复用（select/poll/epoll）的工程含义
- 排查 OOM、文件描述符耗尽、僵尸进程等常见问题

## 学习路线

### 第一阶段：进程与线程

1. 进程是什么——从 fork() 看进程创建的内核实现
2. 线程与协程——用户态调度 vs 内核态调度的取舍
3. 进程调度——CFS 调度器、优先级、nice 值、cgroup
4. 进程间通信——管道、共享内存、消息队列、Socket
5. 阶段实战：用 strace 观察一个 Web 服务器的系统调用

### 第二阶段：内存管理

6. 虚拟内存——页表、TLB、缺页中断的完整流程
7. 内存分配——brk/mmap、glibc malloc、jemalloc
8. OOM Killer——什么触发它、怎么查、怎么防
9. 内存映射——mmap、共享内存、文件映射
10. 阶段实战：用 /proc 和 pmap 分析一个进程的内存布局

### 第三阶段：文件系统

11. 文件系统基础——inode、硬链接、软链接、文件描述符
12. VFS 层——虚拟文件系统的统一抽象
13. 文件 I/O——buffered I/O vs direct I/O、writeback
14. 磁盘调度——I/O 调度器、SSD vs HDD 的差异
15. 阶段实战：用 iostat 和 blktrace 分析磁盘 I/O 瓶颈

### 第四阶段：I/O 模型

16. 阻塞 vs 非阻塞 I/O——系统调用层面的区别
17. I/O 多路复用——select/poll/epoll 的演进
18. epoll 的工程实现——ET vs LT、惊群问题、io_uring
19. 事件驱动模型——Node.js/libuv、Nginx 的 I/O 模型
20. 阶段实战：用 epoll 实现一个简单的 TCP 服务器

### 第五阶段：实战排查

21. 系统排查工具链——top/htop/vmstat/iostat/strace/ltrace
22. 进程问题排查——僵尸进程、孤儿进程、进程被 kill
23. 内存问题排查——OOM、内存泄漏、swap 使用过高
24. 文件描述符问题——fd 耗尽、too many open files
25. 阶段实战：排查三个真实生产环境的系统问题

## 验收标准

- 能用 strace 观察系统调用并解释每个调用的含义
- 能画出虚拟地址→物理地址的翻译流程（页表→TLB→缺页）
- 能解释 epoll 为什么比 select 高效
- 能排查 OOM、文件描述符耗尽等常见系统问题
- 能理解容器（namespace/cgroup）与虚拟机（hypervisor）的本质区别

## 参考文档

- Linux man pages：https://man7.org/linux/man-pages/
- Understanding the Linux Kernel（Bovet & Cesati）
- The Linux Programming Interface（Kerrisk）
- Brendan Gregg 的性能分析博客：https://www.brendangregg.com/

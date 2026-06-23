# 第三阶段：文件系统

## 阶段目标

理解文件系统基础（inode、硬链接、软链接）、VFS 层抽象、文件 I/O 模型和磁盘调度机制，能用 iostat 和 blktrace 分析磁盘 I/O 瓶颈。

## 课时列表

1. [文件系统基础——inode、硬链接、软链接、文件描述符](11-filesystem-basics.md)
2. [VFS 层——虚拟文件系统的统一抽象](12-vfs.md)
3. [文件 I/O——buffered I/O vs direct I/O、writeback](13-file-io.md)
4. [磁盘调度——I/O 调度器、SSD vs HDD 的差异](14-disk-scheduling.md)
5. [阶段实战：用 iostat 和 blktrace 分析磁盘 I/O 瓶颈](15-iostat-blktrace.md)

## 验收标准

- 能解释 inode、硬链接、软链接的区别和文件描述符的作用
- 能说明 VFS 层如何统一不同文件系统的接口
- 能区分 buffered I/O 和 direct I/O 的使用场景
- 能用 iostat 和 blktrace 分析磁盘 I/O 的延迟和吞吐量

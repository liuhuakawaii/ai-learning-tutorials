# 第五阶段：实战排查

## 阶段目标

掌握操作系统层面的系统性排查方法，能用 top/htop/vmstat/iostat/strace 等工具链排查僵尸进程、OOM、文件描述符耗尽等真实生产问题。

## 课时列表

1. [系统排查工具链——top/htop/vmstat/iostat/strace/ltrace](21-debugging-toolkit.md)
2. [进程问题排查——僵尸进程、孤儿进程、进程被 kill](22-zombie-orphan-kill.md)
3. [内存问题排查——OOM、内存泄漏、swap 使用过高](23-oom-memory-leak.md)
4. [文件描述符问题——fd 耗尽、too many open files](24-fd-exhaustion.md)
5. [阶段实战：排查三个真实生产环境的系统问题](25-real-production-debugging.md)

## 验收标准

- 能用 top/vmstat/iostat 快速定位系统瓶颈（CPU、内存、I/O）
- 能排查僵尸进程和孤儿进程并说明产生原因
- 能定位 OOM 问题并分析 /var/log/messages 中的 OOM 日志
- 能排查文件描述符耗尽（too many open files）并说明 ulimit 的作用

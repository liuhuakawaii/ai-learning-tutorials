# 系统排查工具链——top/htop/vmstat/iostat/strace/ltrace

## 排查的第一步：不要猜

系统变慢时，第一反应不应该是"可能是内存问题"或"可能是磁盘问题"。第一反应应该是：看一下整体状态。

## top / htop：CPU 和进程概览

```bash
top
```

关键指标：
- **%Cpu(s)**：CPU 使用分布（user/system/idle/iowait）
- **KiB Mem**：内存使用概况
- 进程列表：按 CPU 或内存排序

```
%Cpu(s): 25.0 us, 10.0 sy, 0.0 ni, 60.0 id, 5.0 wa, 0.0 hi, 0.0 si
KiB Mem:  16384000 total, 15000000 used, 1384000 free, 500000 buffers
```

- **us**（user）：用户态 CPU 使用
- **sy**（system）：内核态 CPU 使用
- **wa**（iowait）：等待 I/O 的 CPU 时间
- **id**（idle）：空闲 CPU

**判断标准**：
- us 高 → 应用本身 CPU 密集
- sy 高 → 系统调用频繁（可能是 I/O 密集）
- wa 高 → 磁盘 I/O 是瓶颈
- id 高 → CPU 不是瓶颈，问题在别处

```bash
# 按 CPU 使用排序
top -o %CPU

# 按内存使用排序
top -o %MEM

# 只看某个用户
top -u mysql

# htop 更好的交互
htop
```

## vmstat：内存和系统活动

```bash
# 每秒更新一次
vmstat 1
```

```
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 2  0  10240 500000 200000 800000    0    0    50   100  500 1000 25 10 60  5  0
```

关键列：
- **r**：运行队列长度（等待 CPU 的进程数）
- **b**：不可中断睡眠的进程数（通常在等 I/O）
- **si/so**：swap in/out（从 swap 读入/写入 swap 的内存量）
- **bi/bo**：块设备读入/写出（磁盘 I/O）
- **in**：中断次数
- **cs**：上下文切换次数
- **wa**：I/O 等待百分比

**判断标准**：
- r > CPU 核心数 → CPU 不够用
- b > 0 → 有进程在等 I/O
- si/so > 0 → 正在使用 swap（性能差）
- cs 突然增加 → 可能有进程在频繁切换

## iostat：磁盘 I/O

```bash
# 扩展统计，每秒更新
iostat -xz 1
```

```
Device  r/s    w/s   rMB/s  wMB/s  rrqm/s  wrqm/s  r_await  w_await  aqu-sz  %util
sda     100.0  50.0  1.5    0.8    20.0    10.0    5.0      2.0      0.5     80.0
```

关键指标：
- **r_await/w_await**：平均 I/O 延迟（ms）
- **aqu-sz**：平均队列长度
- **%util**：设备繁忙百分比

## strace：系统调用追踪

strace 是排查系统问题的瑞士军刀。它可以显示进程的每个系统调用、参数和返回值。

```bash
# 跟踪正在运行的进程
strace -p <pid>

# 跟踪新启动的程序
strace ./my_program

# 只跟踪特定系统调用
strace -e trace=open,read,write ./my_program

# 统计系统调用耗时
strace -c -p <pid>

# 显示每个调用的耗时
strace -T -p <pid>

# 跟踪子进程
strace -f ./my_program

# 输出到文件
strace -o trace.log ./my_program
```

**常见用途**：

1. **程序卡住**：
```bash
strace -p <pid>
# 看看卡在哪个系统调用上
```

2. **程序报错**：
```bash
strace -e trace=open,openat,access ./my_program 2>&1 | grep -i "no such\|permission"
```

3. **性能分析**：
```bash
strace -c ./my_program
# 看哪个系统调用耗时最多
```

## ltrace：库函数追踪

ltrace 追踪动态库函数调用，比 strace 更靠近用户态。

```bash
# 追踪库函数调用
ltrace ./my_program

# 统计库函数调用次数
ltrace -c ./my_program

# 只追踪特定函数
ltrace -e malloc+free ./my_program
```

ltrace 的局限：
- 只能跟踪动态链接的函数
- 静态链接的程序无法使用
- 某些函数可能被内联，无法追踪

## 综合排查流程

当系统变慢时，按这个顺序：

```bash
# 1. 整体状态
top           # CPU 和内存概况
vmstat 1      # 内存、I/O、上下文切换

# 2. 定位瓶颈
iostat -xz 1  # 磁盘 I/O
ss -s         # 网络连接统计

# 3. 找到问题进程
pidstat -d 1  # 进程 I/O 统计
pidstat -u 1  # 进程 CPU 统计

# 4. 深入分析
strace -p <pid>  # 系统调用
perf top -p <pid>  # CPU 热点
```

## 练习

### 练习一：用 vmstat 观察系统负载

```bash
# 终端 1：产生 CPU 负载
while true; do :; done &

# 终端 2：观察
vmstat 1

# 观察 r、us、id 的变化
```

### 练习二：用 strace 诊断"程序找不到配置文件"

```bash
# 假设程序报错 "config not found"
strace -e trace=open,openat,access ./my_program 2>&1 | grep -i "no such"
```

---

## 参考答案

### 练习一

**预期结果**：
- r 列增加（进程在等待 CPU）
- us 列接近 100%（CPU 被用户态进程占用）
- id 列接近 0%（CPU 空闲时间几乎为零）

### 练习二

**预期结果**：strace 会显示程序尝试打开的文件路径，包括成功和失败的。找到 "No such file or directory" 的行，就知道程序在找哪个文件了。

**关键教训**：程序报错"找不到文件"时，不要只看程序的错误信息。用 strace 看它实际尝试打开的路径，可能是路径写错了、权限不对、或者文件在不同的位置。

# 虚拟内存——页表、TLB、缺页中断的完整流程

## 为什么需要虚拟内存

直接让进程操作物理内存会出大问题：
- 进程 A 可以读写进程 B 的内存（安全问题）
- 进程需要知道自己被加载到物理内存的哪个位置（编程复杂）
- 物理内存不够时无法运行新进程（容量限制）

虚拟内存解决了这三个问题。每个进程看到的是一片连续的地址空间（比如 0 到 2^48-1），实际的物理页面可以分散在任意位置，甚至暂时不在内存中。

## 地址翻译的完整流程

当程序访问虚拟地址时，CPU 执行以下步骤：

1. 用虚拟地址的高位在 TLB（Translation Lookaside Buffer）中查找
2. 如果 TLB 命中，直接得到物理地址（1 个时钟周期）
3. 如果 TLB 未命中，查页表（多级页表，x86-64 是 4 级）
4. 页表中找到物理页帧号，拼上页内偏移得到物理地址
5. 更新 TLB

如果页表项标记为"不在内存"，触发缺页中断（Page Fault），内核介入处理。

```bash
# 查看页大小
getconf PAGESIZE

# 查看系统的 TLB 统计（需要 perf）
perf stat -e dTLB-load-misses,dTLB-store-misses,iTLB-load-misses ./my_program
```

## 多级页表的结构

x86-64 使用 4 级页表。一个 48 位虚拟地址被分成 5 部分：

```
虚拟地址 (48 bits):
| PML4 (9) | PDPT (9) | PD (9) | PT (9) | Offset (12) |
```

每一级都是一个 512 项的表，每项 8 字节。PML4 表的物理地址存在 CR3 寄存器中（每个进程有自己的 CR3 值，存在 `task_struct` 中）。

翻译过程：
1. CR3 → PML4 表
2. PML4[第 1 个 9 位索引] → PDPT 表地址
3. PDPT[第 2 个 9 位索引] → PD 表地址
4. PD[第 3 个 9 位索引] → PT 表地址
5. PT[第 4 个 9 位索引] → 物理页帧号
6. 物理页帧号 << 12 | 偏移 → 物理地址

每查一级需要一次内存访问，最坏情况 4 次内存访问才能完成一次地址翻译。这就是 TLB 存在的意义——缓存最近使用的翻译结果。

## 缺页中断的三种情况

### 1. 次要缺页（Minor Page Fault）

页面已经在内存中，只是页表项没有建立映射。常见场景：
- 进程刚启动，第一次访问代码段
- COW（写时复制）触发的页面复制
- mmap 映射的文件页面已经在 page cache 中

### 2. 主要缺页（Major Page Fault）

页面不在内存中，需要从磁盘读取。常见场景：
- 访问被 swap 出去的页面
- 访问 mmap 映射的文件，文件内容还没读入内存

### 3. 无效缺页

访问了未映射的地址，内核发送 SIGSEGV 信号（段错误）。

```bash
# 用 perf 统计缺页次数
perf stat -e page-faults,major-faults,minor-faults ./my_program

# 用 /proc 查看进程的缺页统计
cat /proc/<pid>/stat | awk '{print "minor:", $10, "major:", $12}'
```

## 验证缺页行为

写一个程序来观察缺页：

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>

int main() {
    size_t size = 100 * 1024 * 1024;  // 100MB

    // 分配但不使用（不会分配物理页面）
    char *buf = mmap(NULL, size, PROT_READ | PROT_WRITE,
                     MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

    printf("分配后 RSS: ");
    fflush(stdout);
    system("grep VmRSS /proc/self/status");

    // 第一次访问（触发缺页，逐页分配物理内存）
    memset(buf, 0, size);

    printf("写入后 RSS: ");
    fflush(stdout);
    system("grep VmRSS /proc/self/status");

    munmap(buf, size);
    return 0;
}
```

运行并观察：

```bash
gcc -o page_fault_demo page_fault_demo.c
perf stat -e page-faults ./page_fault_demo
```

你会看到大量 minor page fault——每次 `memset` 访问一个新的虚拟页面时，内核都分配一个物理页面。

## Huge Pages

标准 4KB 页面在某些场景下太小了。如果程序使用 1GB 内存，页表项就有 256K 个，TLB 也放不下。

Huge Pages 使用更大的页面（2MB 或 1GB），减少页表项数量，提高 TLB 命中率。

```bash
# 查看系统支持的大页大小
grep Hugepagesize /proc/meminfo

# 分配大页
echo 100 | sudo tee /proc/sys/vm/nr_hugepages

# 使用大页
mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
```

数据库（如 PostgreSQL、Redis）和虚拟机（如 KVM）经常使用 Huge Pages 来提升性能。

## /proc/<pid>/maps 和 smaps

这两个文件是理解进程内存布局的关键：

```bash
# 查看虚拟内存区域（VMA）
cat /proc/<pid>/maps
```

输出格式：

```
地址范围          权限  偏移    设备  inode  路径
00400000-00452000 r-xp 00000000 08:02 131074  /usr/bin/cat
00651000-00652000 r--p 00051000 08:02 131074  /usr/bin/cat
00652000-00653000 rw-p 00052000 08:02 131074  /usr/bin/cat
7f8a12345000-7f8a12567000 rw-p 00000000 00:00 0  [heap]
7fff12345000-7fff12367000 rw-p 00000000 00:00 0  [stack]
```

- `r-xp`：代码段，可读可执行
- `rw-p`：数据段，可读可写
- `[heap]`：堆内存（malloc 从这里分配）
- `[stack]`：主线程栈

```bash
# 查看详细的物理内存使用
cat /proc/<pid>/smaps

# 汇总
cat /proc/<pid>/smaps_rollup
```

smaps 包含每个 VMA 的 RSS、PSS、Shared/Private 等信息，是排查内存问题的重要工具。

## 练习

### 练习一：用 perf 观察缺页

写一个程序，分别用两种方式访问 100MB 内存：
1. 逐字节顺序访问
2. 以 4KB 为步长跳跃访问

用 `perf stat -e page-faults` 统计两者的缺页次数，解释差异。

### 练习二：分析进程的内存布局

```bash
# 启动一个程序
sleep 1000 &

# 分析它的内存布局
cat /proc/$!/maps

# 识别代码段、数据段、堆、栈、共享库的位置
# 计算虚拟地址空间的总大小
```

---

## 参考答案

### 练习一

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SIZE (100 * 1024 * 1024)

int main() {
    char *buf = malloc(SIZE);

    // 顺序访问
    for (size_t i = 0; i < SIZE; i++) {
        buf[i] = 1;
    }

    // 跳跃访问（重新分配）
    free(buf);
    buf = malloc(SIZE);
    for (size_t i = 0; i < SIZE; i += 4096) {
        buf[i] = 1;
    }

    free(buf);
    return 0;
}
```

**预期结果**：两种方式的缺页次数相近（约 25600 次，100MB / 4KB）。缺页发生在第一次访问每个新页面时，与访问顺序无关。

### 练习二

**关键观察**：
- 代码段（r-xp）通常在低地址，对应可执行文件
- 堆（[heap]）在代码段之上，向高地址增长
- 共享库在中间区域，地址随机化（ASLR）
- 栈（[stack]）在高地址，向低地址增长
- 堆和栈之间的巨大空洞是未映射的虚拟地址空间，不占用物理内存

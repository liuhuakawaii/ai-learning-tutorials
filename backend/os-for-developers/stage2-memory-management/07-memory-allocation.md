# 内存分配——brk/mmap、glibc malloc、jemalloc

## malloc 不是系统调用

很多开发者以为 `malloc` 是系统调用。实际上，`malloc` 是 glibc 提供的用户态函数，底层通过 `brk` 或 `mmap` 向内核申请内存。

这个区别很重要：`malloc` 分配的内存不一定立刻占用物理内存，`free` 释放的内存不一定立刻还给操作系统。

## brk 和 mmap

glibc 的 `malloc` 根据分配大小选择不同的系统调用：

- **小块内存**（默认 < 128KB）：通过 `brk()` 扩展堆顶
- **大块内存**（默认 >= 128KB）：通过 `mmap()` 创建新的内存映射

```bash
# 验证这个阈值
strace -e trace=brk,mmap ./malloc_demo
```

```c
// malloc_demo.c
#include <stdlib.h>
#include <string.h>

int main() {
    // 小块：brk
    char *small = malloc(1024);
    memset(small, 'a', 1024);

    // 大块：mmap
    char *large = malloc(256 * 1024);
    memset(large, 'b', 256 * 1024);

    free(small);
    free(large);
    return 0;
}
```

strace 输出：

```
brk(0x55a123456000)                     = 0x55a123456000
mmap(NULL, 266240, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f1234567000
munmap(0x7f1234567000, 266240)          = 0
```

## brk 的问题

`brk()` 只能连续扩展或收缩堆顶。如果程序的内存分配模式是：

```
分配 A (1KB) → 分配 B (1MB) → 分配 C (1KB) → free B
```

此时 B 的空间无法被操作系统回收，因为 C 在它上面。即使 B 被 free 了，进程的 RSS 也不会下降。这就是内存碎片。

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    char *a = malloc(1024);
    char *b = malloc(1024 * 1024);
    char *c = malloc(1024);

    memset(a, 'a', 1024);
    memset(b, 'b', 1024 * 1024);
    memset(c, 'c', 1024);

    free(b);  // B 的空间无法归还给操作系统

    printf("free B 后，查看 RSS:\n");
    system("grep VmRSS /proc/self/status");

    return 0;
}
```

## mmap 的优势

`mmap()` 分配的内存可以独立释放（`munmap`），不受堆顶限制。大块内存用 mmap 可以避免碎片问题。

```bash
# 查看进程的 mmap 区域
cat /proc/<pid>/maps | grep -v ".so" | grep "rw-p"
```

## glibc malloc 的实现

glibc 的 `malloc` 基于 ptmalloc2（Doug Lea's malloc 的改进版）。核心设计：

- **arena**：每个线程有自己的分配区域，减少锁竞争
- **bin**：按大小分类的空闲链表（small bins、large bins、unsorted bin）
- **chunk**：每次分配的内存块，包含大小和状态头部

```bash
# 用 gdb 观察 malloc 的内部结构
gdb ./malloc_demo
(gdb) break main
(gdb) run
(gdb) p (void*)malloc(16)
(gdb) x/16gx <返回地址> - 16  # 查看 chunk 头部
```

glibc malloc 的问题：
- 多线程下 arena 之间的内存不能跨用
- 小块分配的碎片率高
- `free` 后内存不一定归还给操作系统

## jemalloc 和 tcmalloc

因为 glibc malloc 的这些问题，很多高性能项目使用替代分配器：

**jemalloc**（Facebook、Redis 使用）：
- 基于 size class 的分配，减少碎片
- 线程本地缓存（thread-local cache）
- 主动归还内存给操作系统
- 内置内存分析工具

```bash
# 用 jemalloc 运行程序
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so ./my_program

# 分析内存使用
MALLOC_CONF=prof:true ./my_program
jeprof --svg ./my_program jeprof.*.heap > profile.svg
```

**tcmalloc**（Google 使用）：
- 线程本地缓存
- 小对象用 span 分配，大对象直接用 page heap
- 低锁竞争

```bash
# 用 tcmalloc 运行程序
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libtcmalloc.so.4 ./my_program
```

## 分配器的选择

| 场景 | 推荐分配器 |
|------|-----------|
| 一般应用 | glibc malloc（够用就行） |
| 多线程高并发 | jemalloc |
| 大量小对象 | tcmalloc |
| 需要内存分析 | jemalloc（内置 prof） |
| 容器环境 | jemalloc（主动归还内存） |

## 用 strace 观察内存分配行为

```bash
# 跟踪内存相关的系统调用
strace -e trace=brk,mmap,munmap,madvise -o mem_trace.log ./my_program

# 统计各系统调用的次数和耗时
strace -c -e trace=brk,mmap,munmap ./my_program
```

`madvise` 系统调用是分配器告诉内核如何管理内存页面的：
- `MADV_DONTNEED`：告诉内核这些页面不再需要，可以回收
- `MADV_FREE`：标记页面为可回收，但暂时不释放（延迟回收）
- `MADV_HUGEPAGE`：建议使用大页

## 练习

### 练习一：观察 malloc 的 brk/mmap 行为

写一个程序，分别分配 1KB、64KB、128KB、256KB、1MB 的内存，用 strace 观察每次分配使用的是 brk 还是 mmap。

```bash
strace -e trace=brk,mmap ./malloc_size_test
```

### 练习二：对比 glibc malloc 和 jemalloc 的内存碎片

```c
// 分配 10000 个 64 字节的对象
// 释放其中偶数索引的对象
// 观察 RSS 是否下降
```

分别用 glibc malloc 和 jemalloc 运行，对比 RSS。

```bash
# glibc
./fragmentation_test
grep VmRSS /proc/$!/status

# jemalloc
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so ./fragmentation_test
grep VmRSS /proc/$!/status
```

---

## 参考答案

### 练习一

**预期结果**：
- 1KB、64KB、128KB：使用 `brk()`
- 256KB、1MB：使用 `mmap()`

阈值由 `M_MMAP_THRESHOLD` 控制，默认 128KB。可以通过 `mallopt()` 调整：

```c
#include <malloc.h>
mallopt(M_MMAP_THRESHOLD, 64 * 1024);  // 改为 64KB
```

### 练习二

**预期结果**：
- glibc malloc：RSS 不会明显下降，因为空闲的 chunk 在 brk 区域中，被未释放的对象隔开
- jemalloc：RSS 会下降，因为 jemalloc 使用 mmap 分配大块内存，释放时可以独立归还

**关键教训**：长期运行的服务如果有大量分配/释放操作，使用 jemalloc 可以显著减少内存碎片导致的 RSS 增长。

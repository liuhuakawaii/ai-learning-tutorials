# 内存映射——mmap、共享内存、文件映射

## mmap 的多重身份

`mmap` 是 Linux 中最灵活的系统调用之一。它可以：
- 分配匿名内存（替代 `brk`）
- 映射文件到内存（文件 I/O 的另一种方式）
- 实现进程间共享内存
- 创建设备内存映射

```c
void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
```

参数的组合决定了 mmap 的行为：

| flags | 用途 |
|-------|------|
| MAP_PRIVATE + MAP_ANONYMOUS | 匿名私有内存（malloc 的底层） |
| MAP_SHARED + MAP_ANONYMOUS | 匿名共享内存（fork 后共享） |
| MAP_PRIVATE + fd | 文件私有映射（写时复制） |
| MAP_SHARED + fd | 文件共享映射（修改写回文件） |

## 文件映射的工作原理

当 mmap 映射一个文件时，内核并不立刻把文件内容读入内存。它只是在进程的页表中创建映射，指向文件的 page cache。

第一次访问某个页面时，触发缺页中断，内核从磁盘读取对应的文件块到 page cache，然后建立页表映射。

```c
#include <stdio.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

int main() {
    int fd = open("/etc/passwd", O_RDONLY);
    struct stat st;
    fstat(fd, &st);

    char *data = mmap(NULL, st.st_size, PROT_READ, MAP_PRIVATE, fd, 0);

    // 直接读取文件内容，不需要 read() 系统调用
    printf("文件大小: %ld\n", st.st_size);
    printf("前 100 字节:\n%.100s\n", data);

    munmap(data, st.st_size);
    close(fd);
    return 0;
}
```

用 strace 验证：

```bash
strace -e trace=mmap,open,read ./mmap_file
```

你会看到 `mmap` 和 `open`，但没有 `read`——数据是通过缺页中断从 page cache 直接映射到进程地址空间的。

## MAP_SHARED vs MAP_PRIVATE

这是两个容易混淆的选项：

**MAP_PRIVATE**（写时复制）：
- 修改不会写回文件
- 修改只对本进程可见
- fork 后子进程看到父进程的映射，但修改是独立的

**MAP_SHARED**：
- 修改会写回文件（通过 page cache 的 writeback 机制）
- 多个进程映射同一文件，修改互相可见
- 适合实现共享内存

```c
// 验证 MAP_SHARED 的写回行为
#include <stdio.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include <string.h>

int main() {
    int fd = open("/tmp/testfile", O_RDWR | O_CREAT, 0644);
    ftruncate(fd, 4096);

    char *data = mmap(NULL, 4096, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    strcpy(data, "hello from mmap");

    // 不需要 write()，数据在 page cache 中
    // msync 强制写回磁盘
    msync(data, 4096, MS_SYNC);

    printf("写入完成，检查 /tmp/testfile\n");
    munmap(data, 4096);
    close(fd);
    return 0;
}
```

```bash
# 运行后检查文件内容
cat /tmp/testfile
```

## page cache 与 writeback

mmap 的文件映射和 page cache 紧密相关：

1. 读文件时，数据先进入 page cache
2. 写文件时，数据修改 page cache 中的页面，标记为 dirty
3. 内核的 writeback 机制定期将 dirty 页面写回磁盘
4. `fsync()` 或 `msync(MS_SYNC)` 强制立即写回

```bash
# 查看系统的 dirty 页面
cat /proc/meminfo | grep -i dirty

# 查看 writeback 配置
cat /proc/sys/vm/dirty_ratio            # 脏页占内存百分比阈值
cat /proc/sys/vm/dirty_background_ratio # 后台 writeback 的阈值
cat /proc/sys/vm/dirty_writeback_centisecs # writeback 间隔（百分之一秒）
```

## 用 mmap 实现进程间通信

MAP_SHARED + MAP_ANONYMOUS 可以实现共享内存，fork 后父子进程共享同一块物理内存：

```c
#include <stdio.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>
#include <string.h>

int main() {
    void *shm = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                     MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    int *counter = (int *)shm;
    *counter = 0;

    if (fork() == 0) {
        for (int i = 0; i < 1000000; i++) {
            (*counter)++;
        }
        exit(0);
    }

    for (int i = 0; i < 1000000; i++) {
        (*counter)++;
    }
    wait(NULL);
    printf("最终计数: %d (期望 2000000)\n", *counter);

    munmap(shm, 4096);
    return 0;
}
```

**注意**：这个例子有竞态条件（race condition）。实际使用需要信号量或原子操作。

## mmap 的性能特征

mmap 在某些场景下比 read/write 快：
- 随机访问大文件（不需要 lseek + read）
- 多次读取同一文件（page cache 自动缓存）
- 进程间共享数据（零拷贝）

但 mmap 也有开销：
- 缺页中断的处理成本
- TLB 刷新（大量映射时）
- 页表占用内存

```bash
# 对比 mmap 和 read 的性能
# 用 strace 统计系统调用耗时
strace -c -e trace=read,mmap,munmap ./benchmark
```

## 练习

### 练习一：用 mmap 实现文件复制

用 mmap 实现一个文件复制程序，对比 `read/write` 的性能：

```bash
# 创建测试文件
dd if=/dev/zero of=/tmp/testfile bs=1M count=100

# 对比两种方式
time ./copy_readwrite /tmp/testfile /tmp/copy1
time ./copy_mmap /tmp/testfile /tmp/copy2
```

### 练习二：观察 mmap 的 page cache 行为

```bash
# 清除 page cache
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'

# 用 mmap 读取一个大文件
./mmap_read /tmp/bigfile &

# 观察 page cache 增长
watch -n 1 'grep -E "Buffers|Cached" /proc/meminfo'
```

---

## 参考答案

### 练习一

```c
// copy_mmap.c
#include <stdio.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int src = open(argv[1], O_RDONLY);
    int dst = open(argv[2], O_WRONLY | O_CREAT | O_TRUNC, 0644);
    struct stat st;
    fstat(src, &st);

    ftruncate(dst, st.st_size);

    char *src_map = mmap(NULL, st.st_size, PROT_READ, MAP_PRIVATE, src, 0);
    char *dst_map = mmap(NULL, st.st_size, PROT_READ | PROT_WRITE, MAP_SHARED, dst, 0);

    // 一次内存拷贝，不需要 read/write 系统调用
    memcpy(dst_map, src_map, st.st_size);

    msync(dst_map, st.st_size, MS_SYNC);
    munmap(src_map, st.st_size);
    munmap(dst_map, st.st_size);
    close(src);
    close(dst);
    return 0;
}
```

**预期结果**：mmap 方式在大文件复制时通常更快，因为减少了系统调用次数和内核/用户空间的数据拷贝。

### 练习二

**预期结果**：随着 mmap_read 的运行，`Cached` 值会持续增长，直到文件全部被缓存。文件关闭后，这些页面会被标记为可回收，在内存紧张时被释放。

# 文件 I/O——buffered I/O vs direct I/O、writeback

## 两种 I/O 模式

当程序调用 `write()` 写数据时，数据去了哪里？答案取决于 I/O 模式：

**Buffered I/O**（默认）：数据先进入内核的 page cache，`write()` 立即返回。内核在后台将脏页面写回磁盘（writeback）。

**Direct I/O**：数据绕过 page cache，直接写入磁盘。`write()` 在数据落盘后才返回。

```c
// Buffered I/O（默认）
int fd = open("/tmp/file", O_WRONLY | O_CREAT, 0644);
write(fd, data, len);  // 数据进入 page cache，立即返回

// Direct I/O
int fd = open("/tmp/file", O_WRONLY | O_CREAT | O_DIRECT, 0644);
write(fd, data, len);  // 数据直接写入磁盘，可能阻塞
```

## Buffered I/O 的工作流程

写操作：
1. 用户态 `write()` 将数据拷贝到内核的 page cache
2. 页面标记为 dirty
3. `write()` 返回（用户态继续执行）
4. 内核的 writeback 机制定期将脏页面写回磁盘

读操作：
1. 用户态 `read()` 在 page cache 中查找
2. 如果命中（cache hit），直接从 page cache 拷贝到用户缓冲区
3. 如果未命中（cache miss），从磁盘读取到 page cache，再拷贝到用户缓冲区

```bash
# 观察 page cache 使用
free -h
cat /proc/meminfo | grep -E "Buffers|Cached|Dirty"

# 清除 page cache（需要 root）
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
```

## writeback 的触发条件

内核什么时候把脏页面写回磁盘？

```bash
# 查看 writeback 配置
cat /proc/sys/vm/dirty_ratio              # 脏页占内存百分比（默认 20%）
cat /proc/sys/vm/dirty_background_ratio   # 后台 writeback 阈值（默认 10%）
cat /proc/sys/vm/dirty_writeback_centisecs # writeback 间隔（默认 500，即 5 秒）
cat /proc/sys/vm/dirty_expire_centisecs   # 脏页过期时间（默认 3000，即 30 秒）
```

触发条件：
1. **定期触发**：每 `dirty_writeback_centisecs` 毫秒，内核线程 `kworker` 扫描脏页面
2. **阈值触发**：脏页比例超过 `dirty_background_ratio`，后台 writeback 启动
3. **阻塞触发**：脏页比例超过 `dirty_ratio`，`write()` 会阻塞直到脏页减少
4. **显式触发**：`fsync()`、`fdatasync()`、`sync()`

## fsync 的代价

`fsync()` 强制将文件的所有脏页面写回磁盘，并等待完成。这是保证数据持久性的唯一可靠方式，但代价很高。

```c
// 写入数据
write(fd, data, len);
// 不调用 fsync：数据可能在 page cache 中，掉电会丢失
// 调用 fsync：数据保证落盘，但会阻塞
fsync(fd);
```

```bash
# 对比有无 fsync 的性能
# 用 strace 观察 fsync 的耗时
strace -T -e trace=write,fsync ./benchmark
```

数据库（如 SQLite、PostgreSQL）在事务提交时必须调用 `fsync`，这是 ACID 中 Durability 的保证。fsync 的性能直接影响数据库的写入吞吐量。

## Direct I/O 的使用场景

Direct I/O 适合以下场景：
- **数据库**：自己管理缓存，不需要内核 page cache（双重缓存浪费内存）
- **大文件顺序写入**：避免污染 page cache
- **日志系统**：需要保证数据落盘

```c
// Direct I/O 的限制
// 1. 缓冲区必须对齐（通常 512 字节或 4KB）
// 2. 读写大小必须是块大小的整数倍

#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>

int main() {
    // 分配对齐的缓冲区
    void *buf;
    posix_memalign(&buf, 4096, 4096);
    memset(buf, 'A', 4096);

    int fd = open("/tmp/direct_test", O_WRONLY | O_CREAT | O_DIRECT, 0644);
    write(fd, buf, 4096);  // 必须对齐、必须是整数倍
    fsync(fd);

    close(fd);
    free(buf);
    return 0;
}
```

## O_SYNC vs fsync

- `O_SYNC`：每次 `write()` 都等效于 `write()` + `fsync()`，保证每次写入都落盘
- `fsync()`：显式调用，只在需要时保证落盘

O_SYNC 性能极差，因为每次写入都要等磁盘。通常用 buffered I/O + 显式 fsync 更灵活。

```bash
# 对比 O_SYNC 和 buffered I/O + fsync
strace -T -e trace=write,fsync ./sync_vs_fsync
```

## 用 /proc 观察 I/O 统计

```bash
# 查看进程的 I/O 统计
cat /proc/<pid>/io
```

输出：

```
rchar: 1234567890    # read 系统调用请求的字节数（含缓存命中）
wchar: 987654321     # write 系统调用写入的字节数
read_bytes: 1234567  # 实际从磁盘读取的字节数
write_bytes: 987654  # 实际写入磁盘的字节数
cancelled_write_bytes: 12345  # 被取消的写入（如 truncate）
```

`rchar` 和 `read_bytes` 的差异反映了 page cache 的命中率。

## 练习

### 练习一：对比 Buffered I/O 和 Direct I/O 的性能

```bash
# 创建测试文件
dd if=/dev/zero of=/tmp/testfile bs=1M count=100

# 用 time 对比读取性能
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
time cat /tmp/testfile > /dev/null          # Buffered I/O

sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
time dd if=/tmp/testfile of=/dev/null iflag=direct  # Direct I/O
```

### 练习二：观察 writeback 行为

```bash
# 写入大量数据，观察 dirty 页面增长
dd if=/dev/zero of=/tmp/bigfile bs=1M count=500 &

# 在另一个终端观察
watch -n 1 'grep -E "Dirty|Writeback" /proc/meminfo'
```

---

## 参考答案

### 练习一

**预期结果**：
- Buffered I/O 第一次读取慢（需要从磁盘读），第二次快（page cache 命中）
- Direct I/O 每次都从磁盘读，速度稳定但较慢
- 对于随机读取，Buffered I/O 优势更明显

### 练习二

**预期结果**：
- `Dirty` 值随 dd 写入持续增长
- 当脏页比例接近 `dirty_background_ratio` 时，`Writeback` 开始增长
- 当脏页比例接近 `dirty_ratio` 时，dd 的写入速度会下降（被阻塞）
- dd 结束后，脏页逐渐被 writeback 清零

# 阶段实战：用 iostat 和 blktrace 分析磁盘 I/O 瓶颈

## 目标

当应用变慢时，如何判断瓶颈在磁盘 I/O？用 iostat 快速定位，用 blktrace 深入分析。

## 第一步：用 iostat 快速诊断

```bash
# 每秒更新，显示扩展统计
iostat -xz 1
```

看什么：

```
Device  r/s    w/s   rMB/s  wMB/s  r_await  w_await  aqu-sz  %util
sda     15000  200   58.6   10.0   0.05     2.50     0.75    95.0
```

**判断标准**：

1. **%util 接近 100%**：磁盘繁忙，但不一定是瓶颈（SSD 可以处理高并发）
2. **r_await/w_await 高**：I/O 延迟高，这才是真正的瓶颈
3. **aqu-sz 高**：I/O 请求排队，说明设备处理不过来

对于 SSD：
- r_await < 1ms 正常
- r_await > 5ms 可能有问题
- r_await > 20ms 肯定有问题

对于 HDD：
- r_await < 10ms 正常
- r_await > 50ms 可能有问题

## 第二步：区分 I/O 模式

```bash
# 终端 1：运行应用
./my_application

# 终端 2：观察 I/O 模式
iostat -xz 1
```

I/O 模式分析：

| 指标 | 顺序写（如日志） | 随机读（如数据库） | 混合 |
|------|-----------------|-------------------|------|
| w/s 或 r/s | 低 | 高 | 中 |
| wMB/s 或 rMB/s | 高 | 低 | 中 |
| wrqm/s | 高 | 低 | 中 |
| w_await | 低 | 高 | 中 |

## 第三步：用 pidstat 定位进程

```bash
# 查看每个进程的 I/O 统计
pidstat -d 1
```

输出：

```
PID   kB_rd/s  kB_wr/s  kB_ccwr/s  Command
1234  50000.0  10000.0  0.0        mysqld
5678  1000.0   50000.0  0.0        java
```

- **kB_rd/s**：每秒读取的 KB 数
- **kB_wr/s**：每秒写入的 KB 数
- **kB_ccwr/s**：每秒被取消的写入（如 truncate）

找出 I/O 最重的进程，然后深入分析。

## 第四步：用 blktrace 深入分析

blktrace 追踪块设备层的 I/O 请求：

```bash
# 记录 10 秒的 I/O 事件
sudo blktrace -d /dev/sda -o - | blkparse -i - -o trace.txt &

# 运行你的应用
./my_application

# 停止 blktrace
sudo killall blktrace
```

分析 trace.txt：

```bash
# 查看前 20 条记录
head -20 trace.txt

# 统计 I/O 类型
awk '{print $6}' trace.txt | sort | uniq -c | sort -rn

# 统计 I/O 大小分布
awk '$6 == "Q" {print $8}' trace.txt | sort | uniq -c | sort -rn
```

blktrace 的事件类型：

```
Q – 请求进入队列
G – 请求从队列取出（获得调度器许可）
I – 请求插入队列
D – 请求下发到驱动
C – 请求完成
```

关键延迟：
- **Q → D**：在调度器中的延迟（排队 + 合并 + 排序）
- **D → C**：设备处理延迟（磁盘实际读写）
- **Q → C**：总 I/O 延迟

## 第五步：用 btt 分析 I/O 延迟分布

```bash
# 生成 I/O 延迟统计
btt -i trace.txt -o analysis

# 查看结果
cat analysis_latency.dat
```

btt 输出包括：
- I/O 延迟的直方图
- 各阶段的延迟分布
- 吞吐量统计

## 第六步：综合诊断流程

当应用变慢时，按这个顺序排查：

```bash
# 1. 整体 I/O 状况
iostat -xz 1

# 2. 哪个进程在做 I/O
pidstat -d 1

# 3. I/O 延迟是否异常
# 如果 r_await/w_await 高，用 blktrace 深入分析

# 4. 是否是 page cache 问题
cat /proc/meminfo | grep -E "Cached|Dirty|Writeback"

# 5. 是否是文件系统问题
# 用 filefrag 查看文件碎片
filefrag -v /path/to/large/file
```

## 实战案例：排查数据库慢查询

场景：MySQL 查询变慢，iostat 显示：

```
Device  r/s    w/s   r_await  w_await  %util
sda     5000   100   15.0     3.0      99.0
```

分析：
1. %util 99%：磁盘繁忙
2. r_await 15ms：读延迟高
3. r/s 5000：大量随机读

可能原因：
- 索引缺失导致全表扫描
- buffer pool 太小，无法缓存热点数据
- 磁盘性能不足

验证：

```bash
# 检查 MySQL 的 buffer pool 命中率
mysql -e "SHOW STATUS LIKE 'Innodb_buffer_pool_read%'"

# 如果 Innodb_buffer_pool_reads 远大于 Innodb_buffer_pool_read_requests，说明 buffer pool 命中率低
```

## 练习

### 练习一：模拟 I/O 瓶颈并诊断

```bash
# 终端 1：用 fio 模拟高 I/O 负载
fio --name=randread --filename=/tmp/fiotest --direct=1 --bs=4k \
    --size=100M --numjobs=8 --rw=randread --runtime=60

# 终端 2：用 iostat 观察
iostat -xz 1

# 终端 3：用 blktrace 分析延迟分布
sudo blktrace -d /dev/sda -o - | blkparse -i - -o fio_trace.txt
```

### 练习二：对比 Direct I/O 和 Buffered I/O 的 I/O 模式

```bash
# Direct I/O
dd if=/dev/zero of=/tmp/directfile bs=4k count=100000 oflag=direct

# Buffered I/O
dd if=/dev/zero of=/tmp/bufferedfile bs=4k count=100000

# 分别用 iostat 观察，对比 I/O 模式
```

---

## 参考答案

### 练习一

**预期结果**：
- iostat 显示高 IOPS（数千到数万），%util 接近 100%
- r_await 取决于磁盘性能，SSD 通常 < 1ms，HDD 通常 > 5ms
- blktrace 显示大量小块随机 I/O

### 练习二

**预期结果**：
- Direct I/O：iostat 立即显示写入活动，w_await 反映真实磁盘延迟
- Buffered I/O：iostat 延迟显示写入活动（先进 page cache），writeback 时才出现 I/O
- Buffered I/O 的 I/O 合并率更高（内核在 page cache 中合并相邻写入）

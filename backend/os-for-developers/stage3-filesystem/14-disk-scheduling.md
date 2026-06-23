# 磁盘调度——I/O 调度器、SSD vs HDD 的差异

## 为什么需要 I/O 调度器

HDD（机械硬盘）的物理特性决定了它需要调度：磁头移动（seek）是耗时操作，把随机 I/O 重排为顺序 I/O 可以显著提高吞吐量。

SSD 没有机械部件，随机读写性能接近顺序读写。但内核仍然需要 I/O 调度器来合并请求、控制延迟。

## Linux 的 I/O 调度器

```bash
# 查看当前使用的调度器
cat /sys/block/sda/queue/scheduler

# 切换调度器
echo mq-deadline | sudo tee /sys/block/sda/queue/scheduler
```

### mq-deadline

为每个请求设置截止时间，保证请求不会无限延迟。默认读延迟 500ms，写延迟 5s。

```bash
# 查看 mq-deadline 参数
ls /sys/block/sda/queue/iosched/
cat /sys/block/sda/queue/iosched/read_expire
cat /sys/block/sda/queue/iosched/write_expire
```

适合大多数场景，兼顾吞吐量和延迟。

### none（noop）

不调度，直接下发。适合 SSD 和虚拟机中的虚拟磁盘（宿主机已经有调度器）。

```bash
echo none | sudo tee /sys/block/sda/queue/scheduler
```

### bfq（Budget Fair Queueing）

按进程公平分配 I/O 带宽。适合桌面系统，避免一个进程的 I/O 把其他进程卡住。

```bash
echo bfq | sudo tee /sys/block/sda/queue/scheduler

# 查看 bfq 参数
ls /sys/block/sda/queue/iosched/
```

### kyber

基于目标延迟的调度器。为读和写分别设置目标延迟，动态调整队列深度。适合高速 SSD。

```bash
echo kyber | sudo tee /sys/block/sda/queue/scheduler

# 查看 kyber 参数
cat /sys/block/sda/queue/iosched/read_lat_nsec
cat /sys/block/sda/queue/iosched/write_lat_nsec
```

## SSD vs HDD 的调度差异

| 特性 | HDD | SSD |
|------|-----|-----|
| 随机读延迟 | 5-10ms（寻道） | 0.1ms |
| 顺序读延迟 | 0.1ms | 0.1ms |
| IOPS | 100-200 | 10000-100000 |
| 需要排序优化 | 是 | 否 |
| 推荐调度器 | mq-deadline/bfq | none/kyber |

SSD 时代的调度策略：
- 减少合并和排序（收益小，增加延迟）
- 控制队列深度（避免设备过载）
- 优先保证延迟而不是吞吐量

## 用 iostat 观察 I/O 调度效果

```bash
# 每秒更新一次 I/O 统计
iostat -xz 1
```

关键指标：

```
Device  r/s    w/s   rMB/s  wMB/s  rrqm/s  wrqm/s  %rrqm  %wrqm  r_await  w_await  aqu-sz  %util
sda     100.0  50.0  1.5    0.8    20.0    10.0    16.7   16.7   5.0      2.0      0.5     80.0
```

- **r/s, w/s**：每秒读/写请求数
- **rrqm/s, wrqm/s**：每秒合并的请求数（调度器合并相邻请求）
- **r_await, w_await**：平均 I/O 延迟（毫秒）
- **aqu-sz**：平均队列长度
- **%util**：设备繁忙百分比

合并率高说明调度器在工作。对于 HDD，合并率高是好事；对于 SSD，合并率太高可能增加延迟。

## I/O 优先级

Linux 支持 I/O 优先级，让重要进程的 I/O 优先处理：

```bash
# 设置进程的 I/O 优先级（需要 ionice）
ionice -c 2 -n 0 -p <pid>   # 最高普通优先级
ionice -c 2 -n 7 -p <pid>   # 最低普通优先级
ionice -c 3 -p <pid>         # Idle 类（只在没有其他 I/O 时执行）

# 启动时设置 I/O 优先级
ionice -c 2 -n 0 ./my_program
```

I/O 调度类：
- **Realtime (1)**：最高优先级，可能饿死其他进程
- **Best-effort (2)**：默认，支持 8 个优先级（0-7）
- **Idle (3)**：只在磁盘空闲时执行

## 用 blktrace 分析 I/O 路径

blktrace 可以追踪块设备的 I/O 请求从提交到完成的全过程：

```bash
# 记录 I/O 事件（5 秒）
sudo blktrace -d /dev/sda -o - | blkparse -i - -o trace.blktrace

# 分析
blkparse -i trace.blktrace | head -50

# 统计 I/O 延迟分布
btt -i trace.blktrace
```

blktrace 输出的事件类型：
- **Q**：请求进入块层队列
- **G**：请求获得 I/O 调度器的许可
- **D**：请求下发到设备驱动
- **C**：请求完成

从 Q 到 C 的时间就是 I/O 延迟。

## 练习

### 练习一：对比不同调度器的性能

```bash
# 用 fio 测试随机读性能
for sched in none mq-deadline bfq kyber; do
    echo $sched | sudo tee /sys/block/sda/queue/scheduler
    echo "=== $sched ==="
    fio --name=randread --ioengine=libaio --direct=1 --bs=4k \
        --size=1G --numjobs=4 --rw=randread --runtime=10 --group_reporting
done
```

### 练习二：用 iostat 观察 I/O 模式

```bash
# 终端 1：产生顺序写
dd if=/dev/zero of=/tmp/seqwrite bs=1M count=1000

# 终端 2：产生随机读
fio --name=randread --filename=/tmp/randread --direct=1 --bs=4k \
    --size=100M --rw=randread --runtime=30

# 终端 3：观察
iostat -xz 1
```

观察并回答：
1. 顺序写和随机读的 IOPS 差异有多大
2. 合并率（rrqm/wrqm）分别是多少
3. 延迟（r_await/w_await）分别是多少

---

## 参考答案

### 练习一

**预期结果**：
- SSD 上 `none` 和 `kyber` 通常性能最好
- `bfq` 在多进程场景下更公平，但总吞吐量可能略低
- `mq-deadline` 表现稳定，适合大多数场景

### 练习二

**预期结果**：
- 顺序写的 IOPS 通常在几百到几千，带宽可达数百 MB/s
- 随机读的 IOPS 在 SSD 上可达数万，在 HDD 上只有 100-200
- 顺序写的合并率高于随机读
- 随机读的延迟通常高于顺序写

# 进程调度——CFS 调度器、优先级、nice 值、cgroup

## 一个常见的误解

很多人以为进程调度就是"优先级高的先执行"。实际上，Linux 的 CFS（Completely Fair Scheduler）调度器的核心思想是公平——每个进程都应该获得与其权重成比例的 CPU 时间。

## CFS 的核心思想：虚拟运行时间

CFS 不维护传统的时间片，而是追踪每个进程的虚拟运行时间（vruntime）。vruntime 越小，说明这个进程获得的 CPU 时间越少，越应该被调度。

```
vruntime += 实际运行时间 × NICE_0_LOAD / 进程权重
```

权重由 nice 值决定。nice 值越低（-20 到 19），权重越高，vruntime 增长越慢，获得的 CPU 时间越多。

```bash
# 查看进程的 nice 值
ps -o pid,ni,comm -p <pid>

# 修改进程的 nice 值（需要 root 或 CAP_SYS_NICE）
renice -n 10 -p <pid>

# 启动时设置 nice 值
nice -n 10 ./my_program
```

## 用 chrt 查看调度策略

Linux 支持多种调度策略：

| 策略 | 类型 | 说明 |
|------|------|------|
| SCHED_OTHER | 普通 | CFS 调度，大多数进程使用 |
| SCHED_BATCH | 普通 | 适合批处理任务，减少唤醒频率 |
| SCHED_IDLE | 普通 | 极低优先级，只在系统空闲时运行 |
| SCHED_FIFO | 实时 | 先来先服务，不会被同优先级抢占 |
| SCHED_RR | 实时 | 轮转调度，同优先级轮流执行 |
| SCHED_DEADLINE | 实时 | 基于截止时间的调度（3.14+） |

```bash
# 查看进程的调度策略
chrt -p <pid>

# 设置实时调度策略
chrt -f 50 ./my_realtime_program

# 设置 SCHED_DEADLINE
chrt -d --sched-runtime 1000000 --sched-deadline 2000000 --sched-period 3000000 0 ./my_program
```

实时进程的优先级范围是 1-99，数字越大优先级越高。实时进程总是优先于普通进程。

## cgroup：控制进程组的资源使用

cgroup（Control Groups）是 Linux 内核提供的资源限制机制。Docker 和 Kubernetes 底层都依赖 cgroup 来限制容器的资源使用。

cgroup v2 的 CPU 控制：

```bash
# 查看 cgroup 挂载点
mount | grep cgroup

# 创建一个 cgroup
mkdir /sys/fs/cgroup/mygroup

# 限制 CPU 使用率为 50%（100ms 周期内最多用 50ms）
echo "100000 200000" > /sys/fs/cgroup/mygroup/cpu.max

# 将进程加入 cgroup
echo <pid> > /sys/fs/cgroup/mygroup/cgroup.procs

# 查看 cgroup 的 CPU 使用情况
cat /sys/fs/cgroup/mygroup/cpu.stat
```

cgroup v1 和 v2 的接口不同。v2 是统一层级模型，v2 已经成为主流。

## 调度延迟与吞吐量的权衡

调度器面临一个基本矛盾：
- 频繁切换 → 响应快但上下文切换开销大
- 较少切换 → 吞吐量高但响应慢

CFS 通过 `sched_latency` 和 `sched_min_granularity` 两个参数控制这个平衡：

```bash
# 查看调度延迟（纳秒）
cat /proc/sys/kernel/sched_latency_ns

# 查看最小调度粒度（纳秒）
cat /proc/sys/kernel/sched_min_granularity_ns

# 查看唤醒延迟
cat /proc/sys/kernel/sched_wakeup_granularity_ns
```

- `sched_latency_ns`：目标调度延迟，所有可运行进程在这个时间内都应该被调度到
- `sched_min_granularity_ns`：进程最少运行多长时间才允许被抢占
- `sched_wakeup_granularity_ns`：唤醒抢占的粒度，越大越不容易抢占

对于交互式应用（如桌面、Web 服务器），可以减小这些值来降低延迟。对于批处理任务，可以增大这些值来提高吞吐量。

## NUMA 感知调度

在多 NUMA 节点的服务器上，调度器需要考虑内存访问的局部性。访问本地 NUMA 节点的内存比访问远程节点快 2-3 倍。

```bash
# 查看 NUMA 拓扑
numactl --hardware

# 查看进程的 NUMA 内存分布
numastat -p <pid>

# 绑定进程到特定 NUMA 节点
numactl --cpunodebind=0 --membind=0 ./my_program
```

调度器会尽量把进程调度到它之前运行的 CPU 上（CPU 亲和性），减少缓存失效。

## 用 /proc/schedstat 观察调度行为

```bash
# 查看调度统计
cat /proc/schedstat

# 查看特定进程的调度信息
cat /proc/<pid>/sched
```

进程的 sched 文件包含：
- `se.sum_exec_runtime`：总执行时间（纳秒）
- `nr_switches`：上下文切换次数
- `se.nr_migrations`：CPU 迁移次数

```bash
# 实时观察调度切换
perf sched record -- sleep 5
perf sched latency
perf sched map
```

## Docker 容器的 CPU 限制

Docker 的 `--cpus` 和 `--cpu-shares` 底层就是 cgroup：

```bash
# 限制容器最多使用 1.5 个 CPU
docker run --cpus=1.5 myimage

# 设置 CPU 权重（默认 1024）
docker run --cpu-shares=512 myimage

# 查看容器的 cgroup 配置
cat /sys/fs/cgroup/docker/<container-id>/cpu.max
```

`--cpus` 设置的是硬限制（cpu.max），`--cpu-shares` 设置的是相对权重（cpu.weight）。在 CPU 空闲时，shares 不起作用；CPU 争抢时，按 shares 比例分配。

## 练习

### 练习一：观察 nice 值对 CPU 分配的影响

写一个 CPU 密集型程序，同时运行两个实例，一个 nice=0，一个 nice=10。用 `top` 或 `pidstat` 观察它们的 CPU 使用比例。

```bash
# 终端 1
nice -n 0 ./cpu_hog &

# 终端 2
nice -n 10 ./cpu_hog &

# 终端 3：观察 CPU 分配
pidstat -p <pid1>,<pid2> 1
```

### 练习二：用 cgroup 限制进程的 CPU 使用

创建一个 cgroup，限制 CPU 使用率为 25%，然后运行一个死循环程序，验证它是否被限制。

```bash
# 创建 cgroup（需要 root）
sudo mkdir /sys/fs/cgroup/cputest
echo "25000 100000" | sudo tee /sys/fs/cgroup/cputest/cpu.max

# 运行死循环
sudo bash -c 'echo $$ > /sys/fs/cgroup/cputest/cgroup.procs; while true; do :; done &'

# 用 top 观察 CPU 使用率，应该接近 25%
top
```

### 练习三：用 perf sched 分析调度延迟

```bash
# 记录 5 秒的调度事件
sudo perf sched record -- sleep 5

# 查看调度延迟统计
sudo perf sched latency

# 查看 CPU 使用时间线
sudo perf sched map
```

回答：哪个进程的调度延迟最高？为什么？

---

## 参考答案

### 练习一

**预期结果**：nice=0 的进程获得约 75% 的 CPU，nice=10 的进程获得约 25%。

这是因为 CFS 的权重分配：nice 0 的权重是 1024，nice 10 的权重是 110。比例大约是 1024:110 ≈ 9:1。但实际上 CFS 会保证所有进程都能运行，所以比例不会完全按权重来。

### 练习二

**预期结果**：死循环程序的 CPU 使用率应该稳定在 25% 左右。

如果看到 100%，检查：
1. cgroup 是否正确创建
2. 进程是否正确加入 cgroup
3. 是否使用了 cgroup v2（`cat /proc/filesystems | grep cgroup`）

### 练习三

**预期结果**：`perf sched latency` 会显示每个进程的平均调度延迟和最大调度延迟。通常 I/O 密集型进程的延迟较高，因为它们频繁睡眠和唤醒。

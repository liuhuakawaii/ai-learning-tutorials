# OOM Killer——什么触发它、怎么查、怎么防

## 一个真实的故障

线上服务突然变慢，SSH 连上去执行命令报 `Cannot allocate memory`。查看 `dmesg` 发现：

```
[12345.678] Out of memory: Kill process 1234 (java) score 800 or sacrifice child
[12345.678] Killed process 1234 (java) total-vm:4096000kB, anon-rss:2048000kB
```

OOM Killer 杀掉了你的 Java 进程。但为什么？系统明明还有 swap 空间。

## OOM Killer 的触发条件

OOM Killer 不是在物理内存用完时触发，而是在内核无法分配内存时触发。具体来说：

1. 物理内存不足
2. swap 空间不足（或没有 swap）
3. 可回收的页面缓存（page cache）不足
4. 内核尝试回收内存失败

内核通过 `oom_score` 评估每个进程的"可杀程度"。分数越高，越可能被杀。

```bash
# 查看进程的 OOM 分数
cat /proc/<pid>/oom_score

# 查看 OOM 分数的计算依据
cat /proc/<pid>/oom_score_adj

# 设置 OOM 分数调整值（-1000 到 1000）
# -1000 表示永不被 OOM Killer 杀死
echo -1000 > /proc/<pid>/oom_score_adj
```

## oom_score 的计算

oom_score 基于以下因素：
- 进程的 RSS（常驻内存）大小
- 进程的 swap 使用量
- 子进程的内存使用
- 进程的运行时间（长期运行的进程分数较低）
- root 权限的进程有轻微折扣

分数范围是 0-1000。`oom_score_adj` 是用户设置的调整值，范围 -1000 到 1000。

```bash
# 列出所有进程的 OOM 分数，按分数排序
for pid in /proc/[0-9]*; do
    name=$(cat $pid/comm 2>/dev/null)
    score=$(cat $pid/oom_score 2>/dev/null)
    adj=$(cat $pid/oom_score_adj 2>/dev/null)
    echo "$score $adj $name $(basename $pid)"
done 2>/dev/null | sort -rn | head -20
```

## 用 dmesg 分析 OOM 事件

OOM 发生后，`dmesg` 中会记录详细的内存快照：

```bash
dmesg | grep -A 50 "Out of memory"
```

关键信息：

```
[12345.678] java invoked oom-killer: gfp_mask=0x201da, order=0, oom_score_adj=0
[12345.678] CPU: 2 PID: 1234 Comm: java Not tainted 5.4.0-100-generic
[12345.678] Mem-Info:
[12345.678] Active(anon):    2048000 kB  # 活跃的匿名页面
[12345.678] Inactive(anon):  1024000 kB  # 非活跃的匿名页面
[12345.678] Active(file):     512000 kB  # 活跃的文件页面（page cache）
[12345.678] Inactive(file):   256000 kB  # 非活跃的文件页面
[12345.678] Swap:                  0 kB  # swap 使用量
[12345.678] Free:              10240 kB  # 空闲内存
```

如果 `Swap` 为 0 且 `Free` 接近 0，说明系统没有 swap 或 swap 已满。

## /proc/meminfo 解读

```bash
cat /proc/meminfo
```

关键字段：

| 字段 | 含义 |
|------|------|
| MemTotal | 物理内存总量 |
| MemFree | 完全空闲的内存 |
| MemAvailable | 可用内存（含可回收的缓存） |
| Buffers | 块设备缓冲区 |
| Cached | 页面缓存 |
| SwapTotal | swap 总量 |
| SwapFree | swap 剩余 |
| Committed_AS | 已承诺的内存（所有进程的虚拟内存之和） |
| Dirty | 等待写回磁盘的脏页面 |

**注意**：`MemFree` 低不代表内存不足。Linux 会尽量用内存做缓存，`MemAvailable` 才是真正可用的内存。

```bash
# 一行查看内存概况
free -h

# 持续监控
vmstat 1
```

## 预防 OOM 的策略

### 1. 配置 swap

```bash
# 创建 swap 文件
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 调整 swappiness（0-100，越低越倾向用物理内存）
echo 10 | sudo tee /proc/sys/vm/swappiness
```

Swap 是安全网，但不是解决方案。使用 swap 会导致性能急剧下降（磁盘比内存慢 1000 倍）。

### 2. 限制进程内存使用

```bash
# 用 cgroup 限制内存
sudo mkdir /sys/fs/cgroup/memlimit
echo "512M" | sudo tee /sys/fs/cgroup/memlimit/memory.max
echo <pid> | sudo tee /sys/fs/cgroup/memlimit/cgroup.procs

# 用 ulimit 限制（shell 内）
ulimit -v 524288  # 限制虚拟内存为 512MB
```

### 3. 设置 oom_score_adj

保护关键进程不被 OOM Killer 杀死：

```bash
# 保护 SSHD（确保 OOM 后还能 SSH 登录排查）
echo -900 > /proc/$(pidof sshd)/oom_score_adj

# 保护数据库
echo -500 > /proc/$(pidof mysqld)/oom_score_adj
```

### 4. 监控内存使用

```bash
# 用 systemd-run 限制服务内存
systemd-run --scope -p MemoryMax=512M ./my_program

# 监控脚本
while true; do
    available=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    if [ $available -lt 1048576 ]; then  # 小于 1GB
        echo "WARNING: Available memory low: ${available}kB" | logger
    fi
    sleep 60
done
```

## 容器中的 OOM

Docker 容器有内存限制，超限会被 OOM 杀死：

```bash
# 限制容器内存为 256MB
docker run -m 256m myimage

# 查看容器的 OOM 事件
docker inspect --format='{{.State.OOMKilled}}' <container_id>

# 查看容器的内存使用
docker stats <container_id>
```

容器的 OOM 和系统的 OOM 是独立的。容器超限只杀容器内的进程，不影响宿主机。

## 练习

### 练习一：模拟 OOM 并观察

```bash
# 创建一个限制内存的 cgroup
sudo mkdir /sys/fs/cgroup/oomtest
echo "100M" | sudo tee /sys/fs/cgroup/oomtest/memory.max

# 在 cgroup 中运行一个吃内存的程序
sudo bash -c 'echo $$ > /sys/fs/cgroup/oomtest/cgroup.procs; python3 -c "x=bytearray(200*1024*1024)"'
```

观察：
1. 程序是否被杀
2. dmesg 中的 OOM 日志
3. 容器和宿主机的内存状态

### 练习二：写一个内存监控脚本

写一个 shell 脚本，每 10 秒检查一次内存状态，当 `MemAvailable` 低于阈值时：
1. 打印 Top 5 内存使用进程
2. 记录到日志
3. 可选：发送告警

---

## 参考答案

### 练习一

**预期结果**：
- 程序被 OOM Killer 杀死
- `dmesg` 显示 OOM 日志，包含被杀进程的 RSS 和 oom_score
- 容器内的 OOM 不影响宿主机

如果程序没被杀，检查 cgroup 是否正确配置：`cat /sys/fs/cgroup/oomtest/memory.current`。

### 练习二

```bash
#!/bin/bash
THRESHOLD_KB=1048576  # 1GB

while true; do
    available=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    if [ "$available" -lt "$THRESHOLD_KB" ]; then
        echo "=== WARNING: Available memory ${available}KB at $(date) ===" >> /var/log/mem_monitor.log
        ps aux --sort=-%mem | head -6 >> /var/log/mem_monitor.log
        echo "" >> /var/log/mem_monitor.log
    fi
    sleep 10
done
```

**关键点**：监控 `MemAvailable` 而不是 `MemFree`。`MemFree` 低是正常的（Linux 用空闲内存做缓存），`MemAvailable` 才反映真正可用的内存。

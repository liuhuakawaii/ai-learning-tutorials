# 阶段实战：排查三个真实生产环境的系统问题

## 场景一：Web 服务响应变慢

### 现象

Nginx + Node.js 的 Web 服务，P99 延迟从 100ms 飙升到 5s。CPU 使用率不高（30%），内存也够用。

### 排查过程

```bash
# 第一步：看整体状态
top
# CPU 30%，内存 60%，wa 5% → CPU 和内存不是瓶颈

# 第二步：看 I/O
iostat -xz 1
# %util 95%，r_await 50ms → 磁盘 I/O 是瓶颈

# 第三步：找到做 I/O 的进程
pidstat -d 1
# Node.js 进程 kB_rd/s 很高

# 第四步：用 strace 看 Node.js 在做什么
strace -T -p <node_pid> -e trace=read,write,openat
# 看到大量 read 调用，耗时 50ms+，读取的是日志文件

# 第五步：确认问题
# Node.js 在同步写日志，每次 write 都等 fsync
```

### 根因

Node.js 的日志模块配置了 `O_SYNC`，每次写日志都等 fsync。当磁盘 I/O 繁忙时，写日志阻塞了事件循环。

### 修复

```javascript
// 移除 O_SYNC，用 buffered I/O
const fs = require('fs');
const logStream = fs.createWriteStream('/var/log/app.log', { flags: 'a' });
// 不要使用 { flags: 'as' }  // 's' 是 O_SYNC
```

### 验证

```bash
# 修复后延迟恢复正常
# strace 不再看到长时间的 write 调用
```

## 场景二：容器频繁重启

### 现象

Kubernetes 中一个 Java 服务频繁重启，kubectl describe pod 显示 `OOMKilled`。

### 排查过程

```bash
# 第一步：确认是 OOM
kubectl logs <pod> --previous | tail -20
# 没有 Java 异常，进程直接消失

# 第二步：查看容器的资源限制
kubectl describe pod <pod> | grep -A 5 "Limits"
# memory limit: 512Mi

# 第三步：查看容器的内存使用
kubectl top pod <pod>
# 内存使用接近 512Mi

# 第四步：分析 Java 堆内存
# JVM 参数：-Xmx384m
# 但 JVM 除了堆还有：Metaspace、线程栈、CodeCache、DirectBuffer

# 第五步：估算实际内存
# 堆：384MB
# Metaspace：64MB
# 线程栈：200 线程 × 1MB = 200MB
# CodeCache：64MB
# DirectBuffer：64MB
# 总计：约 776MB → 超过 512Mi 限制
```

### 根因

JVM 的内存不仅包括堆。线程栈、Metaspace、CodeCache、DirectBuffer 都是额外开销。512Mi 的容器限制不够。

### 修复

```yaml
# 增加容器内存限制
resources:
  limits:
    memory: 1Gi
  requests:
    memory: 768Mi

# 同时减少线程数
# -XX:ThreadStackSize=512k（默认 1MB）
# -XX:MaxMetaspaceSize=128m
```

### 验证

```bash
# 修复后观察
kubectl top pod <pod>
# 内存使用稳定在 700Mi 左右
```

## 场景三：文件描述符耗尽

### 现象

一个代理服务报错 `Too many open files`，新连接被拒绝。

### 排查过程

```bash
# 第一步：确认 fd 耗尽
cat /proc/<pid>/limits | grep "open files"
# Max open files: 1024

ls /proc/<pid>/fd/ | wc -l
# 1021（接近 1024）

# 第二步：分析 fd 的组成
ls -la /proc/<pid>/fd/ | grep socket | wc -l
# 980 个 socket

# 第三步：查看 socket 状态
ss -tnp | grep <pid> | awk '{print $1}' | sort | uniq -c
# 500 ESTABLISHED
# 480 TIME_WAIT
# 大量 TIME_WAIT！

# 第四步：分析 TIME_WAIT 的来源
ss -tnp | grep <pid> | grep TIME_WAIT | head -5
# 都是连接到同一个后端服务

# 第五步：确认问题
# 代理服务频繁创建/关闭到后端的短连接
# 每个关闭的连接在 TIME_WAIT 状态占用一个 fd
```

### 根因

代理服务没有复用到后端的连接，每个请求都创建新连接。关闭后进入 TIME_WAIT 状态（默认 60 秒），fd 被占用。

### 修复

```bash
# 1. 启用连接池
# 在代理服务中配置 upstream 连接池

# 2. 提高 fd 限制
ulimit -n 65535

# 3. 调整内核参数（如果适用）
echo 1 | sudo tee /proc/sys/net/ipv4/tcp_tw_reuse
```

### 验证

```bash
# 修复后
ls /proc/<pid>/fd/ | wc -l
# 稳定在 200 左右

ss -tnp | grep <pid> | grep TIME_WAIT | wc -l
# 接近 0
```

## 练习

### 练习一：模拟并诊断一个复合问题

写一个程序，同时制造以下问题：
1. 内存泄漏（每秒分配 1MB 不释放）
2. fd 泄漏（每秒打开一个文件不关闭）

然后用学过的工具诊断：

```bash
# 持续监控
watch -n 1 'echo "=== $(date) ==="; cat /proc/<pid>/status | grep -E "VmRSS|FDSize"; ls /proc/<pid>/fd/ | wc -l'
```

### 练习二：写一个系统健康检查脚本

```bash
#!/bin/bash
# 系统健康检查

echo "=== CPU ==="
top -bn1 | head -5

echo "=== Memory ==="
free -h

echo "=== Disk ==="
df -h | head -5

echo "=== I/O ==="
iostat -x 1 1 | tail -5

echo "=== Top 5 by CPU ==="
ps aux --sort=-%cpu | head -6

echo "=== Top 5 by Memory ==="
ps aux --sort=-%mem | head -6

echo "=== Open files ==="
cat /proc/sys/fs/file-nr

echo "=== Zombie processes ==="
ps aux | awk '$8 == "Z"'

echo "=== D-state processes ==="
ps aux | awk '$8 ~ /D/'
```

---

## 参考答案

### 练习一

**预期结果**：
- RSS 持续增长（内存泄漏）
- fd 数量持续增长（fd 泄漏）
- 用 strace 可以看到 malloc/mmap 和 open 调用
- 用 pmap 可以看到匿名映射区域增长
- 用 /proc/<pid>/fd/ 可以看到未关闭的文件

### 练习二

**关键指标和阈值**：
- CPU idle < 20% → CPU 可能是瓶颈
- MemAvailable < 10% → 内存紧张
- Disk use% > 90% → 磁盘空间不足
- iowait > 10% → I/O 可能是瓶颈
- file-nr 接近 file-max → fd 可能耗尽
- 存在 D 状态进程 → 可能有 I/O 问题

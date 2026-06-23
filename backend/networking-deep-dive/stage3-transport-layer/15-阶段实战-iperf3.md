# 阶段实战：用 iperf3 测量 TCP/UDP 吞吐量并分析

## 任务目标

在这个实战中，你要用 iperf3 测量网络吞吐量，分析 TCP 和 UDP 的性能差异，并观察网络参数对吞吐量的影响。

## iperf3 简介

iperf3 是网络性能测试工具，可以测量：
- TCP/UDP 吞吐量
- 延迟抖动
- 丢包率

基本用法：
```bash
# 服务端
iperf3 -s

# 客户端
iperf3 -c <server_ip>
```

## 实验一：TCP 吞吐量测试

### 启动服务端

```bash
# 在服务端机器上
iperf3 -s -p 5201
```

### 运行客户端测试

```bash
# 基本测试
iperf3 -c <server_ip> -t 30

# 输出示例:
# [ ID] Interval           Transfer     Bitrate
# [  5]   0.00-30.00  sec  3.29 GBytes   941 Mbits/sec                  sender
# [  5]   0.00-30.00  sec  3.29 GBytes   941 Mbits/sec                  receiver
```

### 测试不同参数

```bash
# 并行连接
iperf3 -c <server_ip> -P 4 -t 30

# 指定窗口大小
iperf3 -c <server_ip> -w 256K -t 30

# 反向测试（服务端发送）
iperf3 -c <server_ip> -R -t 30

# 双向测试
iperf3 -c <server_ip> --bidir -t 30
```

## 实验二：UDP 吞吐量测试

### UDP 测试

```bash
# 测试 100 Mbps
iperf3 -c <server_ip> -u -b 100M -t 30

# 输出示例:
# [ ID] Interval           Transfer     Bitrate         Jitter    Lost/Total Datagrams
# [  5]   0.00-30.00  sec   358 MBytes   100 Mbits/sec  0.010 ms  0/254623 (0%)  sender
# [  5]   0.00-30.00  sec   358 MBytes   100 Mbits/sec  0.010 ms  0/254623 (0%)  receiver
```

### 测试不同带宽

```bash
# 测试 1 Mbps
iperf3 -c <server_ip> -u -b 1M -t 30

# 测试 1 Gbps
iperf3 -c <server_ip> -u -b 1G -t 30
```

## 实验三：网络参数对吞吐量的影响

### 添加延迟

```bash
# 在服务端添加 100ms 延迟
sudo tc qdisc add dev eth0 root netem delay 100ms

# 测试吞吐量
iperf3 -c <server_ip> -t 30

# 计算 BDP
# BDP = 带宽 × RTT = 1 Gbps × 0.2s = 200 Mbit = 25 MB

# 恢复网络
sudo tc qdisc del dev eth0 root
```

### 添加丢包

```bash
# 添加 1% 丢包
sudo tc qdisc add dev eth0 root netem loss 1%

# 测试 TCP 吞吐量
iperf3 -c <server_ip> -t 30

# 测试 UDP 吞吐量
iperf3 -c <server_ip> -u -b 100M -t 30

# 恢复网络
sudo tc qdisc del dev eth0 root
```

### 添加带宽限制

```bash
# 限制带宽为 10 Mbps
sudo tc qdisc add dev eth0 root tbf rate 10mbit burst 32kbit latency 400ms

# 测试吞吐量
iperf3 -c <server_ip> -t 30

# 恢复网络
sudo tc qdisc del dev eth0 root
```

## 实验四：用 Wireshark 分析 iperf3 流量

### 抓包分析

```bash
# 启动 iperf3 测试
iperf3 -c <server_ip> -t 30 &

# 抓包
sudo tcpdump -i eth0 -w iperf3.pcap host <server_ip>

# 在 Wireshark 中分析：
# 1. TCP 窗口大小变化
# 2. 重传事件
# 3. 拥塞控制行为
```

### 观察 TCP 窗口变化

在 Wireshark 中：
1. 过滤 `tcp.stream eq 0`
2. 统计 → 流量图表 → TCP 流图形
3. 观察窗口大小随时间的变化

### 观察重传

```bash
# 过滤重传
tcp.analysis.retransmission

# 统计重传率
# 统计 → TCP 流图形 → 重传
```

## 实验五：对比不同拥塞控制算法

```bash
# 测试 Cubic
sudo sysctl -w net.ipv4.tcp_congestion_control=cubic
iperf3 -c <server_ip> -t 30

# 测试 BBR
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
iperf3 -c <server_ip> -t 30

# 对比结果
```

## 结果分析

### TCP vs UDP

| 指标 | TCP | UDP |
|------|-----|-----|
| 可靠性 | 保证 | 不保证 |
| 顺序 | 保证 | 不保证 |
| 流控 | 有 | 无 |
| 拥塞控制 | 有 | 无 |
| 头部开销 | 20 字节 | 8 字节 |

### 网络参数影响

| 参数 | TCP 影响 | UDP 影响 |
|------|---------|---------|
| 延迟 | 吞吐量下降（BDP 限制） | 无影响 |
| 丢包 | 吞吐量大幅下降 | 按比例丢包 |
| 带宽限制 | 吞吐量受限 | 按限制丢包 |

## 练习

### 练习一：测量并对比

1. 在正常网络下测量 TCP 和 UDP 吞吐量
2. 添加 100ms 延迟后再次测量
3. 添加 1% 丢包后再次测量
4. 记录结果并分析

### 练习二：计算 BDP

给定测量结果：
- TCP 吞吐量：100 Mbps
- RTT：50 ms

计算 BDP，并解释为什么吞吐量只有 100 Mbps。

---

## 参考答案

### 练习一

典型结果：

| 条件 | TCP 吞吐量 | UDP 吞吐量 |
|------|-----------|-----------|
| 正常 | 941 Mbps | 100 Mbps（设定值） |
| 100ms 延迟 | 500 Mbps | 100 Mbps |
| 1% 丢包 | 200 Mbps | 99 Mbps（1% 丢包） |

**分析**：
- TCP 受延迟和丢包影响大
- UDP 按设定带宽发送，不受网络状况影响
- TCP 的拥塞控制机制会主动降低发送速率

### 练习二

BDP = 带宽 × RTT
BDP = 100 Mbps × 0.05 s = 5 Mbit = 625 KB

如果 TCP 窗口小于 625 KB，带宽利用不充分。如果窗口大于 625 KB，会导致排队延迟。

**常见错误**：以为吞吐量只取决于带宽。实际上延迟（BDP）和丢包率也严重影响 TCP 吞吐量。

**工程建议**：对于长距离连接，启用 TCP 窗口缩放（Window Scaling）和选择性确认（SACK）可以显著提高吞吐量。

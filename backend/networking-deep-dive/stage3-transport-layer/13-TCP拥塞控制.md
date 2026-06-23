# TCP 拥塞控制——慢启动、拥塞避免、快重传、BBR

## 为什么需要拥塞控制

如果发送方不控制发送速率，网络会过载。路由器缓冲区溢出，大量丢包，网络吞吐量急剧下降。

拥塞控制的目标：
1. 避免网络过载
2. 在网络容量允许的情况下尽量提高吞吐量
3. 公平地分配带宽

## 慢启动

连接刚建立时，发送方不知道网络状况，从很小的窗口开始，指数增长。

```
cwnd = 1 MSS (最大段大小)
发送 1 个段 → 收到 ACK → cwnd = 2
发送 2 个段 → 收到 ACK → cwnd = 4
发送 4 个段 → 收到 ACK → cwnd = 8
...
```

cwnd（拥塞窗口）是发送方维护的变量，表示可以发送多少未确认的数据。

慢启动的"慢"是相对的——初始窗口小，但增长很快（指数级）。

当 cwnd 达到慢启动阈值（ssthresh）时，进入拥塞避免阶段。

## 拥塞避免

cwnd 达到 ssthresh 后，改为线性增长：

```
每个 RTT，cwnd 增加 1 MSS
```

这样可以更谨慎地探测网络容量，避免突然导致拥塞。

## 拥塞检测与窗口调整

当检测到拥塞（丢包）时：

**超时重传**：
```
ssthresh = cwnd / 2
cwnd = 1 MSS
重新进入慢启动
```

**快速重传（3 个重复 ACK）**：
```
ssthresh = cwnd / 2
cwnd = ssthresh
进入快速恢复
```

快速恢复比超时重传温和得多——窗口减半而不是重置为 1。

## BBR：基于带宽的拥塞控制

传统的拥塞控制（如 Reno、Cubic）基于丢包来判断拥塞。但现代网络中，丢包不一定意味着拥塞（可能是链路质量问题），拥塞也不一定导致丢包（可能只是延迟增加）。

BBR（Bottleneck Bandwidth and Round-trip propagation time）是 Google 开发的拥塞控制算法，基于两个指标：

1. **BtlBw**（瓶颈带宽）：路径上的最小带宽
2. **RTprop**（最小 RTT）：路径上的最小延迟

BBR 的工作方式：
1. 持续测量 BtlBw 和 RTprop
2. 设置发送速率 = BtlBw
3. 设置 inflight 数据 = BtlBw × RTprop（BDP）

BBR 的优点：
- 不依赖丢包信号
- 在高延迟、低丢包的网络中表现更好
- 更好地利用带宽

BBR 的缺点：
- 可能与传统算法不公平
- 在某些场景下可能导致延迟增加

## 实验：观察拥塞控制行为

### 查看当前使用的拥塞控制算法

```bash
# Linux
sysctl net.ipv4.tcp_congestion_control
cat /proc/sys/net/ipv4/tcp_congestion_control

# 查看可用算法
sysctl net.ipv4.tcp_available_congestion_control
```

### 切换拥塞控制算法

```bash
# 使用 BBR
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr

# 使用 Cubic（默认）
sudo sysctl -w net.ipv4.tcp_congestion_control=cubic

# 永久生效
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sudo sysctl -p
```

### 用 iperf3 测量吞吐量

```bash
# 服务端
iperf3 -s

# 客户端
iperf3 -c <server_ip> -t 30

# 对比不同拥塞控制算法的吞吐量
```

### 用 Wireshark 观察窗口变化

```bash
# 下载大文件，抓包
curl -o /dev/null http://example.com/bigfile

# 在 Wireshark 中观察：
# 1. TCP 窗口大小变化
# 2. 重传事件
# 3. 拥塞窗口增长
```

## 实验：模拟网络拥塞

```bash
# 添加 100ms 延迟和 1% 丢包
sudo tc qdisc add dev eth0 root netem delay 100ms loss 1%

# 测量吞吐量
iperf3 -c <server_ip> -t 30

# 观察重传
# Wireshark 过滤: tcp.analysis.retransmission

# 恢复网络
sudo tc qdisc del dev eth0 root
```

## BDP（带宽延迟积）

BDP = 带宽 × RTT

BDP 表示在途数据的最大量，也就是"管道"的容量。

例如：
- 带宽 100 Mbps，RTT 100 ms
- BDP = 100 Mbps × 0.1 s = 10 Mbit = 1.25 MB

如果窗口小于 BDP，带宽利用不充分。如果窗口大于 BDP，会导致排队延迟。

## 练习

### 练习一：对比不同拥塞控制算法

1. 用 iperf3 测试 Cubic 和 BBR 的吞吐量
2. 在不同网络条件下测试（正常、高延迟、丢包）
3. 记录结果并对比

### 练习二：计算 BDP

给定以下网络参数，计算 BDP：
- 带宽：1 Gbps
- RTT：50 ms

---

## 参考答案

### 练习一

```bash
# 测试 Cubic
sudo sysctl -w net.ipv4.tcp_congestion_control=cubic
iperf3 -c <server_ip> -t 30

# 测试 BBR
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
iperf3 -c <server_ip> -t 30
```

典型结果：
- 正常网络：两者吞吐量相近
- 高延迟网络：BBR 吞吐量更高
- 丢包网络：BBR 吞吐量更高

**关键点**：BBR 在高延迟、低丢包的网络中表现更好，因为它不依赖丢包信号。

### 练习二

BDP = 带宽 × RTT
BDP = 1 Gbps × 0.05 s = 50 Mbit = 6.25 MB

**含义**：要充分利用 1 Gbps 带宽，TCP 窗口至少需要 6.25 MB。

**常见错误**：以为窗口越大越好。实际上窗口过大会导致路由器缓冲区溢出，增加延迟和丢包。

**工程建议**：对于长距离、高带宽的连接，需要启用 TCP 窗口缩放（Window Scaling）选项，允许窗口大于 64KB。

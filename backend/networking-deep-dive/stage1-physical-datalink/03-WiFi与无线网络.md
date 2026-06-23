# Wi-Fi 与无线网络——802.11 协议、信道、干扰

## 无线网络的本质问题

有线网络中，每个设备有独立的物理线路，可以同时发送数据。无线网络中，所有设备共享同一个无线电介质——空气。

这带来了三个核心问题：
1. **隐藏节点问题**：A 和 C 都能听到 B，但 A 和 C 互相听不到
2. **暴露节点问题**：B 正在发送，A 想发给 C 但被 B 的信号"堵住"了
3. **干扰**：微波炉、蓝牙、邻居的 Wi-Fi 都在同一频段

802.11 协议用 CSMA/CA（载波侦听多路访问/冲突避免）来解决共享介质问题。

## CSMA/CA：先听后说，说完等确认

与以太网的 CSMA/CD 不同，无线设备无法在发送的同时检测冲突（因为发送功率远大于接收功率）。

CSMA/CA 的流程：
1. 设备想发送数据前，先监听信道是否空闲
2. 如果空闲，等待一个随机时间（DIFS + 随机退避）
3. 如果期间信道变忙，重新计时
4. 发送数据
5. 等待接收方的 ACK
6. 如果没有 ACK，认为冲突，重传

这个"等待随机时间"是关键——它减少了两个设备同时开始发送的概率。

## 802.11 帧结构

802.11 帧比以太网帧复杂得多：

```
[Frame Control][Duration][Addr1][Addr2][Addr3][Seq][Addr4][Payload][FCS]
```

- Frame Control：帧类型（管理帧、控制帧、数据帧）
- Duration：信道占用时间（用于 NAV 机制）
- Addr1-4：最多 4 个地址（源、目的、AP、发送方）
- Seq：序列号（用于重传和重组）

为什么需要 4 个地址？因为无线帧可能需要经过 AP 中转：
- Addr1：接收方（AP）
- Addr2：发送方（你的电脑）
- Addr3：最终目的（网关）
- Addr4：原始源（用于 WDS 模式）

## 2.4GHz vs 5GHz vs 6GHz

Wi-Fi 使用三个频段：

**2.4GHz**（802.11b/g/n/ax）：
- 穿墙能力强
- 只有 3 个不重叠信道（1, 6, 11）
- 蓝牙、微波炉都在这个频段
- 非常拥挤

**5GHz**（802.11a/n/ac/ax）：
- 有 20 多个不重叠信道
- 穿墙能力弱
- 干扰少
- 支持更高的带宽（80/160MHz）

**6GHz**（802.11ax/be）：
- 全新频段，几乎无干扰
- 更多信道（最多 59 个 20MHz 信道）
- 只有 Wi-Fi 6E/7 设备支持

信道宽度决定单个设备的峰值速率：
- 20MHz：基础速率
- 40MHz：速率翻倍
- 80MHz/160MHz：速率继续翻倍

但信道越宽，干扰概率越高。

## 无线速率如何确定

802.11 使用 **自适应调制编码**（AMC），根据信号质量动态调整：

| 信号质量 | 调制方式 | 每符号比特数 | 说明 |
|---------|---------|------------|------|
| 很好 | 256-QAM | 8 | 峰值速率 |
| 好 | 64-QAM | 6 | 正常使用 |
| 一般 | 16-QAM | 4 | 距离较远 |
| 差 | QPSK | 2 | 穿墙后 |
| 很差 | BPSK | 1 | 最低速率 |

信号质量主要看两个指标：
- **RSSI**（接收信号强度）：-30dBm 很好，-70dBm 一般，-80dBm 很差
- **SNR**（信噪比）：>40dB 很好，20-40dB 一般，<20dB 差

## 实验：观察 Wi-Fi 行为

### 查看 Wi-Fi 信息

```bash
# Linux
iwconfig wlan0
iw dev wlan0 link
iw dev wlan0 scan | grep -E "SSID|freq|signal"

# Windows
netsh wlan show interfaces
netsh wlan show networks mode=bssid
```

### 用 Wireshark 抓取无线帧

无线帧抓取需要网卡支持监听模式（Monitor Mode）：

```bash
# Linux
sudo ip link set wlan0 down
sudo iw dev wlan0 set type monitor
sudo ip link set wlan0 up
sudo iw dev wlan0 set channel 6

# 然后用 Wireshark 抓包
```

在 Wireshark 中过滤：
- 管理帧：`wlan.fc.type == 0`
- 数据帧：`wlan.fc.type == 2`
- Beacon 帧：`wlan.fc.type_subtype == 0x08`

### 观察信道干扰

```bash
# Linux: 查看周围 AP 使用的信道
iw dev wlan0 scan | grep -E "SSID|primary channel"

# 或者用 wavemon
sudo apt install wavemon
wavemon
```

如果周围 AP 都在信道 6，你的 AP 也应该用信道 6 吗？不一定——用 1 或 11 可以减少同频干扰。

## 为什么 Wi-Fi 比有线慢那么多

理论速率和实际速率差距巨大的原因：

1. **半双工**：同一时刻只能收或发，不能同时
2. **重传**：无线环境丢包率高，每个帧可能重传多次
3. **退避等待**：CSMA/CA 的随机等待时间
4. **管理开销**：Beacon 帧、认证、关联等
5. **共享介质**：所有连接到同一 AP 的设备共享带宽

一个 Wi-Fi 6 AP 理论峰值 9.6Gbps，但实际环境中每个设备可能只有 100-500Mbps。

## 练习

### 练习一：查看你的 Wi-Fi 信息

运行以下命令，记录结果：
- 你连接的 SSID 是什么？
- 使用哪个频段和信道？
- 信号强度是多少？
- 协商速率是多少？

```bash
# Linux
iw dev wlan0 link

# Windows
netsh wlan show interfaces
```

### 练习二：信道规划

假设你管理一个办公室的 Wi-Fi，有 3 个 AP 覆盖不同区域。在 2.4GHz 频段，你会给每个 AP 分配哪个信道？为什么？

---

## 参考答案

### 练习一

典型输出（Linux）：
```
Connected to aa:bb:cc:dd:ee:ff (on wlan0)
SSID: MyNetwork
freq: 5180
RX: 123456 bytes (987 packets)
TX: 234567 packets (1234567 bytes)
signal: -58 dBm
tx bitrate: 866.7 MBit/s VHT-MCS 9 80MHz short GI
```

### 练习二

2.4GHz 只有 3 个不重叠信道：**1, 6, 11**。

正确做法：每个 AP 用不同的信道
- AP1: 信道 1
- AP2: 信道 6
- AP3: 信道 11

**常见错误**：让所有 AP 都用"自动"信道。自动信道选择算法不一定最优，而且可能在运行时切换信道导致短暂断连。

**核心原则**：相邻 AP 使用不重叠信道，减少同频干扰。

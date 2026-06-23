# TCP 连接管理——三次握手、四次挥手、TIME_WAIT

## 为什么需要三次握手

TCP 是面向连接的协议，通信前需要建立连接。但为什么是三次握手，不是两次或四次？

假设只有两次握手：
```
客户端 → SYN → 服务端
服务端 → SYN-ACK → 客户端
连接建立
```

问题：如果客户端的 SYN 延迟到达（旧的 SYN 包），服务端会以为是新连接，分配资源等待数据，但客户端永远不会发数据。这就是 SYN 洪泛攻击的基础。

三次握手的过程：
```
客户端 → SYN (seq=x) → 服务端
服务端 → SYN-ACK (seq=y, ack=x+1) → 客户端
客户端 → ACK (ack=y+1) → 服务端
连接建立
```

第三次握手的意义：客户端确认收到了服务端的 SYN，同时告诉服务端"我收到了你的确认"。这样双方都确认了对方的接收能力。

## 三次握手的状态转换

```
客户端                          服务端
CLOSED                         LISTEN
  |                               |
  |--- SYN (seq=x) ------------>|
  |                               |
SYN_SENT                       SYN_RCVD
  |                               |
  |<-- SYN-ACK (seq=y, ack=x+1) |
  |                               |
ESTABLISHED                    ESTABLISHED
  |--- ACK (ack=y+1) --------->|
```

## 四次挥手：为什么需要四次

TCP 是全双工的，每个方向需要单独关闭。

```
客户端 → FIN (seq=u) → 服务端
服务端 → ACK (ack=u+1) → 客户端
（服务端可能还有数据要发）
服务端 → FIN (seq=w) → 客户端
客户端 → ACK (ack=w+1) → 服务端
```

为什么不能三次？因为服务端收到 FIN 后，可能还有数据要发送给客户端，不能立即关闭。

## TIME_WAIT 状态

主动关闭方在发送最后一个 ACK 后进入 TIME_WAIT 状态，等待 2MSL（Maximum Segment Lifetime，通常 60 秒）。

TIME_WAIT 的两个作用：
1. **确保最后的 ACK 被对方收到**：如果 ACK 丢失，对方会重传 FIN
2. **防止旧连接的包干扰新连接**：等待足够时间让网络中的旧包消失

TIME_WAIT 的问题：
- 占用端口资源
- 服务器重启后无法立即绑定同一端口

解决方法：
- `SO_REUSEADDR` 套接字选项
- `SO_LINGER` 设置为 0（不推荐）
- 调整内核参数 `net.ipv4.tcp_tw_reuse`

## 实验：抓包观察三次握手

### 用 Wireshark 抓包

1. 启动 Wireshark 抓包
2. 访问一个 HTTP 网站：`curl http://example.com`
3. 在 Wireshark 中过滤 `tcp.flags.syn == 1`

你会看到三个包：
```
1. [SYN] Seq=0
2. [SYN, ACK] Seq=0, Ack=1
3. [ACK] Seq=1, Ack=1
```

### 用 tcpdump 抓包

```bash
# 抓取 TCP 握手
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn) != 0' -nn

# 抓取到 example.com:80 的流量
sudo tcpdump -i eth0 host example.com and port 80 -nn
```

### 观察 TCP 状态

```bash
# 查看当前 TCP 连接状态
ss -t state established
ss -t state time-wait

# 统计各状态的连接数
ss -t | awk '{print $1}' | sort | uniq -c | sort -rn
```

## TCP 状态机

```
CLOSED → LISTEN → SYN_RCVD → ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED
         (被动)   (被动)      (双方)        (主动关闭)   (主动关闭)   (主动关闭)

CLOSED → SYN_SENT → ESTABLISHED → CLOSE_WAIT → LAST_ACK → CLOSED
         (主动)     (双方)        (被动关闭)   (被动关闭)
```

## 实验：观察 TIME_WAIT

### 方法一：快速重启服务

```bash
# 启动一个 HTTP 服务器
python3 -m http.server 8080

# 用 curl 访问
curl http://localhost:8080

# 立即停止服务器，然后重启
# 如果没有 SO_REUSEADDR，会报 "Address already in use"
```

### 方法二：观察 TIME_WAIT 连接

```bash
# 持续发送请求，观察 TIME_WAIT
for i in {1..100}; do
  curl -s http://example.com > /dev/null
done

# 查看 TIME_WAIT 连接数
ss -t state time-wait | wc -l
```

## 练习

### 练习一：抓取并分析三次握手

1. 用 Wireshark 抓取到任意 HTTP 网站的 TCP 握手
2. 记录三个包的序列号和确认号
3. 计算握手的 RTT（从 SYN 到 SYN-ACK 的时间）

### 练习二：观察 TIME_WAIT

1. 连续访问 10 个不同的 HTTP 网站
2. 立即用 `ss -t state time-wait` 查看 TIME_WAIT 连接
3. 等待 60 秒后再查看，TIME_WAIT 连接是否消失？

---

## 参考答案

### 练习一

典型抓包结果：
```
1. [SYN]       Seq=0
2. [SYN, ACK]  Seq=0, Ack=1
3. [ACK]       Seq=1, Ack=1
```

RTT 计算：从第 1 个包到第 2 个包的时间差，通常 10-100ms（取决于网络距离）。

**关键点**：序列号是随机的初始值，不是从 0 开始。Wireshark 显示的是相对序列号，方便阅读。

### 练习二

TIME_WAIT 连接会持续 2MSL（通常 60 秒）。60 秒后查看，这些连接应该消失了。

**常见错误**：以为 TIME_WAIT 是连接泄漏。实际上 TIME_WAIT 是正常状态，等待 2MSL 后自动关闭。大量 TIME_WAIT 通常是因为客户端频繁创建短连接。

**工程建议**：服务器应该使用 `SO_REUSEADDR` 选项，允许绑定处于 TIME_WAIT 状态的端口。

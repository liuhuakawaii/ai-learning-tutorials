# 计算机网络深度课

> DNS 解析用了 200ms 还是 20ms，取决于你理解网络多深。

## 适合谁

- 做过 Web 开发，但对网络的理解停留在"HTTP 请求/响应"
- 遇到 DNS 解析慢、TCP 连接超时、TLS 握手失败时只能靠 Google
- 想从"会用 fetch"到"理解数据包如何穿越互联网"

## 学完能做什么

- 用 Wireshark 逐层抓包分析以太网帧、IP 包、TCP 段、HTTP 报文
- 理解 DNS 递归查询的完整链路并排查解析延迟
- 理解 TCP 拥塞控制算法（慢启动/快重传/BBR）对性能的影响
- 用 traceroute/mtr 定位网络路径中的瓶颈
- 理解子网划分、NAT、负载均衡的工程实现

## 学习路线

### 第一阶段：物理层与链路层

1. 数据包的旅程——从网卡到交换机的二进制世界
2. 以太网帧——MAC 地址、VLAN、ARP 协议
3. Wi-Fi 与无线网络——802.11 协议、信道、干扰
4. 实验：用 Wireshark 抓取以太网帧并逐字节解读
5. 阶段实战：搭建一个小型局域网并抓包分析

### 第二阶段：网络层

6. IP 协议——IPv4 头部、分片、TTL
7. 子网划分与 CIDR——从 /24 到 /16 的工程含义
8. 路由协议——静态路由、OSPF、BGP 的直觉理解
9. NAT 与防火墙——私有地址、端口映射、iptables
10. 阶段实战：用 traceroute/mtr 定位网络路径瓶颈

### 第三阶段：传输层

11. TCP 连接管理——三次握手、四次挥手、TIME_WAIT
12. TCP 可靠传输——序列号、确认号、重传机制
13. TCP 拥塞控制——慢启动、拥塞避免、快重传、BBR
14. UDP 与 QUIC——为什么 HTTP/3 要用 UDP
15. 阶段实战：用 iperf3 测量 TCP/UDP 吞吐量并分析

### 第四阶段：应用层

16. DNS 解析全流程——递归查询、权威服务器、缓存
17. DHCP 与自动配置——IP 地址分配、租约、续期
18. TLS/SSL 握手——证书验证、密钥交换、会话恢复
19. 负载均衡——L4/L7 区别、一致性哈希、健康检查
20. 阶段实战：配置 DNS 并抓包观察完整解析过程

### 第五阶段：实战排查

21. 网络排查工具链——ping/traceroute/mtr/ss/tcpdump/nc
22. DNS 排查——dig/nslookup、DNS 缓存、DNS 劫持
23. TCP 连接问题——超时、RST、半连接、端口耗尽
24. 网络性能分析——带宽 vs 延迟、BDP、窗口大小
25. 阶段实战：排查三个真实生产环境的网络问题

## 验收标准

- 能用 Wireshark 抓包并逐层解读以太网帧/IP 包/TCP 段
- 能画出 TCP 三次握手和四次挥手的状态转换图
- 能用 traceroute 定位网络路径中的延迟瓶颈
- 能解释 DNS 递归查询的完整过程
- 能排查 TCP 连接超时、端口耗尽等常见问题

## 参考文档

- RFC 791（IP）：https://tools.ietf.org/html/rfc791
- RFC 793（TCP）：https://tools.ietf.org/html/rfc793
- RFC 1035（DNS）：https://tools.ietf.org/html/rfc1035
- Computer Networking: A Top-Down Approach（Kurose & Ross）

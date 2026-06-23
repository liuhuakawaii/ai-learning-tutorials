# NAT 与防火墙——私有地址、端口映射、iptables

## 为什么需要 NAT

IPv4 地址只有 32 位，理论上最多 43 亿个地址。但实际可用的远少于此。NAT（网络地址转换）让多个设备共享一个公网 IP 地址。

最常见的是 NAPT（网络地址端口转换），也叫 IP 伪装：

```
内网设备 A (192.168.1.100:12345) → NAT 路由器 → 公网服务器 (8.8.8.8:80)
    源地址: 192.168.1.100:12345
    ↓ NAT 转换
    源地址: 203.0.113.1:54321
    ↓ 服务器回复
    目的地址: 203.0.113.1:54321
    ↓ NAT 反向转换
    目的地址: 192.168.1.100:12345
```

NAT 路由器维护一个转换表，记录每个连接的内网地址和公网地址的映射关系。

## NAT 的类型

### 静态 NAT（一对一）

一个内网地址永久映射到一个公网地址。常用于服务器。

```
192.168.1.100 ↔ 203.0.113.1
192.168.1.101 ↔ 203.0.113.2
```

### 动态 NAT（多对多）

从公网地址池中动态分配地址。

```
192.168.1.100 → 203.0.113.1（临时）
192.168.1.101 → 203.0.113.2（临时）
```

### NAPT（多对一）

多个内网地址共享一个公网地址，通过端口号区分。

```
192.168.1.100:12345 → 203.0.113.1:54321
192.168.1.101:12345 → 203.0.113.1:54322
```

## NAT 对应用的影响

NAT 破坏了 IP 端到端的特性。从外部看，内网设备是不可达的，因为：
1. 外部设备不知道内网设备的真实 IP
2. NAT 路由器没有映射条目时会丢弃入站包

这导致了以下问题：
- P2P 应用无法直接连接（需要打洞）
- 某些协议（如 FTP、SIP）的载荷中包含 IP 地址，NAT 无法正确转换
- 服务器无法主动连接内网设备

## 防火墙：网络安全的守门人

防火墙根据规则决定允许或拒绝哪些流量。

### 包过滤防火墙

检查每个包的头部信息（源 IP、目的 IP、端口、协议），根据规则决定是否允许。

```
允许: 192.168.1.0/24 → 8.8.8.8:80 (HTTP)
拒绝: 192.168.1.0/24 → 8.8.8.8:23 (Telnet)
允许: 任何 → 192.168.1.100:80 (Web 服务器)
拒绝: 其他所有
```

### 状态检测防火墙

跟踪连接状态，只允许已建立连接的回程流量。

```
允许: 内部发起的 HTTP 连接的回程流量
拒绝: 外部主动发起的连接
```

这比包过滤更安全，因为攻击者无法伪造回程包。

### 应用层防火墙（WAF）

检查应用层内容，识别和阻止攻击（如 SQL 注入、XSS）。

## iptables：Linux 的防火墙

iptables 是 Linux 内核的包过滤框架。

### 基本概念

- **表（table）**：filter（过滤）、nat（地址转换）、mangle（修改）
- **链（chain）**：INPUT（入站）、OUTPUT（出站）、FORWARD（转发）
- **规则（rule）**：匹配条件和动作（ACCEPT、DROP、REJECT）

### 常用命令

```bash
# 查看规则
iptables -L -n -v

# 允许 HTTP 流量
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# 允许 SSH 流量
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 拒绝其他入站流量
iptables -A INPUT -j DROP

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# NAT：内网设备共享公网 IP
iptables -t nat -A POSTROUTING -s 192.168.1.0/24 -o eth0 -j MASQUERADE

# 端口转发：把外部 8080 转发到内部 192.168.1.100:80
iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 192.168.1.100:80
```

### 保存和恢复规则

```bash
# 保存规则
iptables-save > /etc/iptables.rules

# 恢复规则
iptables-restore < /etc/iptables.rules
```

## 实验：配置 NAT 和防火墙

### 配置 NAT 路由器

假设你有一台 Linux 机器作为路由器：

```bash
# 开启 IP 转发
echo 1 > /proc/sys/net/ipv4/ip_forward

# 配置 NAT
iptables -t nat -A POSTROUTING -s 192.168.1.0/24 -o eth0 -j MASQUERADE

# 允许转发
iptables -A FORWARD -s 192.168.1.0/24 -j ACCEPT
iptables -A FORWARD -d 192.168.1.0/24 -j ACCEPT
```

### 配置防火墙规则

```bash
# 允许 SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 允许 HTTP
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 拒绝其他
iptables -A INPUT -j DROP
```

### 验证 NAT

```bash
# 从内网设备访问外部
curl ifconfig.me

# 在 NAT 路由器上抓包
tcpdump -i eth0 -nn host 8.8.8.8

# 应该看到源地址是公网 IP，不是内网 IP
```

## 练习

### 练习一：配置端口转发

配置 iptables 规则，把外部访问的 8080 端口转发到内网服务器 192.168.1.100 的 80 端口。

### 练习二：回答问题

1. NAT 为什么能提高安全性？
2. 为什么 P2P 应用需要 NAT 打洞？
3. 状态检测防火墙如何跟踪连接状态？

---

## 参考答案

### 练习一

```bash
# 开启转发
echo 1 > /proc/sys/net/ipv4/ip_forward

# 端口转发
iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 192.168.1.100:80

# 允许转发流量
iptables -A FORWARD -p tcp -d 192.168.1.100 --dport 80 -j ACCEPT
```

验证：从外部访问 `http://公网IP:8080`，应该看到内网服务器的响应。

### 练习二

1. **NAT 提高安全性**：内网设备对外部不可见，外部无法主动连接内网设备。攻击者必须先找到 NAT 路由器的公网 IP，然后通过端口映射才能到达内网。

2. **P2P 需要打洞**：两个都在 NAT 后面的设备无法直接连接。打洞的原理是：两个设备同时向对方的公网地址发送包，NAT 会创建映射条目，之后对方的包就能通过这个条目到达内网设备。

3. **状态检测**：防火墙维护一个连接表，记录每个连接的源/目的 IP、端口、状态（SYN、ESTABLISHED、FIN）。回程流量必须匹配已有的连接条目才能通过。

**常见错误**：以为 NAT 就是防火墙。NAT 只是地址转换，不是安全机制。但 NAT 确实提供了"隐式"的安全性，因为外部无法主动连接内网。

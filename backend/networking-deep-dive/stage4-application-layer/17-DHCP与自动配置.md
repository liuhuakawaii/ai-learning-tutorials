# DHCP 与自动配置——IP 地址分配、租约、续期

## 为什么需要 DHCP

手动配置每台设备的 IP 地址、子网掩码、网关、DNS 服务器，在大规模网络中不现实。

DHCP（动态主机配置协议）自动完成这些配置：
- 分配 IP 地址
- 提供子网掩码
- 提供默认网关
- 提供 DNS 服务器
- 提供其他配置（如 NTP 服务器）

## DHCP 的工作过程

DHCP 使用 UDP 协议，客户端端口 68，服务端端口 67。

### DORA 过程

```
客户端                              DHCP 服务器
  |                                     |
  | 1. DHCP Discover（广播）            |
  | -------------------------------->   |
  |                                     |
  | 2. DHCP Offer（单播/广播）          |
  | <--------------------------------   |
  |                                     |
  | 3. DHCP Request（广播）             |
  | -------------------------------->   |
  |                                     |
  | 4. DHCP ACK（单播/广播）            |
  | <--------------------------------   |
```

**Discover**：客户端广播"我需要 IP 地址"
**Offer**：服务器提供一个 IP 地址
**Request**：客户端选择并请求这个地址
**ACK**：服务器确认分配

### 为什么用广播

客户端在 Discover 和 Request 阶段用广播，因为它还没有 IP 地址，也不知道 DHCP 服务器的 IP。

服务器在 Offer 和 ACK 阶段可以用单播或广播，取决于客户端的支持。

## DHCP 租约

DHCP 分配的 IP 地址有租约时间，通常 1 小时到几天。

### 租约续期

客户端在租约过半时尝试续期：

```
T=0: 获得租约，租约时间 24 小时
T=12: 尝试续期（单播给原服务器）
T=13.5: 如果没收到响应，再次尝试
T=15: 如果还没响应，广播请求任意服务器
T=24: 租约过期，释放 IP 地址
```

### 为什么需要租约

1. **地址回收**：设备离开网络后，IP 地址可以重新分配
2. **网络变化**：网络配置变化时，客户端可以获取新配置
3. **冲突避免**：防止同一 IP 被分配给多个设备

## DHCP 选项

DHCP 不仅分配 IP 地址，还提供其他配置信息：

| 选项代码 | 名称 | 说明 |
|---------|------|------|
| 1 | 子网掩码 | 255.255.255.0 |
| 3 | 默认网关 | 192.168.1.1 |
| 6 | DNS 服务器 | 8.8.8.8 |
| 15 | 域名 | example.com |
| 51 | 租约时间 | 86400 秒 |
| 66 | TFTP 服务器 | 用于无盘工作站 |
| 67 | 启动文件名 | 用于 PXE 启动 |

## DHCP 中继

如果 DHCP 服务器不在同一子网，需要 DHCP 中继（Relay Agent）。

```
客户端 (192.168.1.0/24) → 路由器（中继）→ DHCP 服务器 (10.0.0.0/24)
```

中继代理把客户端的广播请求转发给指定的 DHCP 服务器，并在请求中添加自己的 IP 地址（GIADDR），让服务器知道客户端在哪个子网。

## 实验：抓包观察 DHCP 流程

### 用 Wireshark 抓包

1. 启动 Wireshark，过滤 `dhcp`
2. 断开并重新连接网络
3. 观察 DORA 过程

### 用 tcpdump 抓包

```bash
# 抓取 DHCP 流量
sudo tcpdump -i eth0 port 67 or port 68 -nn

# 断开并重新连接网络
```

### 查看 DHCP 租约

```bash
# Linux
cat /var/lib/dhcp/dhclient.leases

# 查看当前租约
dhclient -v eth0

# Windows
ipconfig /all
```

### 手动释放和续期

```bash
# Linux
sudo dhclient -r eth0  # 释放
sudo dhclient eth0     # 续期

# Windows
ipconfig /release
ipconfig /renew
```

## 实验：搭建 DHCP 服务器

### 安装 DHCP 服务器

```bash
# Linux
sudo apt install isc-dhcp-server  # Debian/Ubuntu
sudo yum install dhcp             # CentOS/RHEL
```

### 配置 DHCP 服务器

编辑 `/etc/dhcp/dhcpd.conf`：

```
subnet 192.168.1.0 netmask 255.255.255.0 {
    range 192.168.1.100 192.168.1.200;
    option routers 192.168.1.1;
    option domain-name-servers 8.8.8.8, 8.8.4.4;
    option domain-name "example.local";
    default-lease-time 86400;
    max-lease-time 172800;
}
```

### 启动 DHCP 服务器

```bash
# 启动服务
sudo systemctl start isc-dhcp-server

# 查看状态
sudo systemctl status isc-dhcp-server

# 查看分配的租约
cat /var/lib/dhcp/dhcpd.leases
```

## DHCP 安全问题

### DHCP 欺骗

攻击者搭建假的 DHCP 服务器，向客户端提供错误的网关和 DNS 服务器。

防御方法：
- DHCP Snooping（交换机功能）
- 端口安全
- 802.1X 认证

### DHCP 耗尽攻击

攻击者发送大量 DHCP 请求，耗尽 IP 地址池。

防御方法：
- 限制每端口的 DHCP 请求数
- DHCP Snooping

## 练习

### 练习一：抓取 DHCP 流程

1. 用 Wireshark 抓取 DHCP 流量
2. 记录 Discover、Offer、Request、ACK 四个包
3. 分析每个包的内容（IP 地址、租约时间、选项）

### 练习二：搭建 DHCP 服务器

1. 在虚拟机中搭建 DHCP 服务器
2. 配置地址池和选项
3. 让另一台虚拟机获取 IP 地址
4. 验证配置是否正确

---

## 参考答案

### 练习一

典型 DHCP 流程：
```
Discover: 客户端 MAC=aa:bb:cc:dd:ee:ff, 源IP=0.0.0.0, 目的IP=255.255.255.255
Offer:    服务器 MAC=11:22:33:44:55:66, 提供IP=192.168.1.100
Request:  客户端请求 IP=192.168.1.00
ACK:      服务器确认，租约时间=86400 秒
```

**关键点**：Discover 和 Request 是广播，Offer 和 ACK 可以是单播或广播。

### 练习二

配置示例：
```
subnet 192.168.1.0 netmask 255.255.255.0 {
    range 192.168.1.100 192.168.1.200;
    option routers 192.168.1.1;
    option domain-name-servers 8.8.8.8;
}
```

验证：
```bash
# 在客户端
dhclient -v eth0
# 应该看到 "DHCPACK from 192.168.1.x"
```

**常见错误**：忘记启动 DHCP 服务器服务，或者配置文件语法错误。用 `dhcpd -t` 测试配置文件语法。

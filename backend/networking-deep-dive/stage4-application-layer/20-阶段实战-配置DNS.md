# 阶段实战：配置 DNS 并抓包观察完整解析过程

## 任务目标

在这个实战中，你要搭建一个完整的 DNS 环境，配置权威 DNS 服务器，用 dig 工具观察递归查询过程，并用 Wireshark 抓包分析 DNS 协议。

## 实验环境

需要：
- 1 台 Linux 虚拟机作为 DNS 服务器
- 1 台 Linux 虚拟机作为客户端
- 或用 Docker 容器模拟

## 步骤一：安装 DNS 服务器

```bash
# 安装 BIND9
sudo apt update
sudo apt install bind9 bind9utils bind9-doc

# 验证安装
named -v
```

## 步骤二：配置权威 DNS 服务器

### 创建区域文件

编辑 `/etc/bind/named.conf.local`：

```
zone "example.local" {
    type master;
    file "/etc/bind/db.example.local";
};
```

创建区域文件 `/etc/bind/db.example.local`：

```
$TTL    604800
@       IN      SOA     ns1.example.local. admin.example.local. (
                        2024010101      ; Serial
                        604800          ; Refresh
                        86400           ; Retry
                        2419200         ; Expire
                        604800 )        ; Negative Cache TTL
;
@       IN      NS      ns1.example.local.
@       IN      A       192.168.1.10
ns1     IN      A       192.168.1.10
www     IN      A       192.168.1.100
mail    IN      A       192.168.1.200
@       IN      MX      10 mail.example.local.
```

### 检查配置

```bash
# 检查配置文件语法
sudo named-checkconf

# 检查区域文件
sudo named-checkzone example.local /etc/bind/db.example.local
```

### 启动 DNS 服务器

```bash
# 启动 BIND9
sudo systemctl start bind9

# 验证运行
sudo systemctl status bind9

# 查看监听端口
sudo ss -tlnp | grep named
```

## 步骤三：配置客户端

### 配置 DNS 服务器

```bash
# 临时配置
sudo echo "nameserver 192.168.1.10" > /etc/resolv.conf

# 或者用 systemd-resolved
sudo systemctl edit systemd-resolved
```

添加：
```
[Resolve]
DNS=192.168.1.10
```

### 测试解析

```bash
# 用 dig 查询
dig @192.168.1.10 www.example.local A

# 输出示例:
# ;; ANSWER SECTION:
# www.example.local.  604800  IN  A   192.168.1.100
```

## 步骤四：用 dig 追踪递归查询

### 查询根服务器

```bash
# 追踪从根服务器开始的完整解析
dig +trace www.example.local

# 输出示例:
# .                       518400  IN  NS  a.root-servers.net.
# local.                  172800  IN  NS  a.gtld-servers.net.
# example.local.          604800  IN  NS  ns1.example.local.
# www.example.local.      604800  IN  A   192.168.1.100
```

### 查询不同记录类型

```bash
# 查询 MX 记录
dig @192.168.1.10 example.local MX

# 查询 NS 记录
dig @192.168.1.10 example.local NS

# 查询所有记录
dig @192.168.1.10 example.local ANY
```

## 步骤五：用 Wireshark 抓包分析

### 抓取 DNS 流量

```bash
# 在客户端启动 Wireshark
# 过滤器: dns

# 在另一个终端执行查询
dig @192.168.1.10 www.example.local A
```

### 分析 DNS 包结构

在 Wireshark 中展开 DNS 层：

**查询部分（Question）**：
```
Name: www.example.local
Type: A (1)
Class: IN (1)
```

**回答部分（Answer）**：
```
Name: www.example.local
Type: A (1)
Class: IN (1)
TTL: 604800
Data: 192.168.1.100
```

**权威部分（Authority）**：
```
Name: example.local
Type: NS (2)
Data: ns1.example.local
```

### 观察 DNS 递归查询

用 Wireshark 抓取递归查询过程：

```bash
# 配置 BIND9 为递归解析器
# 编辑 /etc/bind/named.conf.options
# 添加: recursion yes;

# 重启 BIND9
sudo systemctl restart bind9

# 查询外部域名
dig @192.168.1.10 www.google.com

# 在 Wireshark 中观察递归查询
# 你会看到多个 DNS 查询和响应
```

## 步骤六：测试 DNS 缓存

### 查询同一域名多次

```bash
# 第一次查询（从权威服务器）
time dig @192.168.1.10 www.example.local

# 第二次查询（从缓存）
time dig @192.168.1.10 www.example.local

# 对比查询时间
```

### 查看缓存内容

```bash
# 查看 BIND9 缓存
sudo rndc dumpdb -cache
cat /var/cache/bind/named_dump.db
```

## 步骤七：配置反向 DNS

### 创建反向区域文件

编辑 `/etc/bind/named.conf.local`：

```
zone "1.168.192.in-addr.arpa" {
    type master;
    file "/etc/bind/db.192.168.1";
};
```

创建反向区域文件 `/etc/bind/db.192.168.1`：

```
$TTL    604800
@       IN      SOA     ns1.example.local. admin.example.local. (
                        2024010101      ; Serial
                        604800          ; Refresh
                        86400           ; Retry
                        2419200         ; Expire
                        604800 )        ; Negative Cache TTL
;
@       IN      NS      ns1.example.local.
10      IN      PTR     ns1.example.local.
100     IN      PTR     www.example.local.
200     IN      PTR     mail.example.local.
```

### 测试反向解析

```bash
# 反向查询
dig @192.168.1.10 -x 192.168.1.100

# 输出示例:
# ;; ANSWER SECTION:
# 100.1.168.192.in-addr.arpa. 604800 IN PTR www.example.local.
```

## 阶段总结

通过这个实战，你应该理解了：

1. **DNS 的层级结构**：根服务器、TLD 服务器、权威服务器
2. **递归查询过程**：客户端问递归解析器，递归解析器依次查询各级服务器
3. **DNS 记录类型**：A、AAAA、CNAME、MX、NS、PTR
4. **DNS 缓存机制**：TTL 控制缓存时间
5. **反向 DNS**：IP 地址到域名的映射

## 练习

### 练习一：完整 DNS 解析流程

1. 用 dig +trace 追踪 www.example.local 的完整解析
2. 用 Wireshark 抓取递归查询过程
3. 绘制 DNS 查询的序列图

### 练习二：回答问题

1. 为什么 DNS 使用 UDP 而不是 TCP？
2. DNS 缓存的作用是什么？
3. 什么是 DNS 劫持？如何防御？

---

## 参考答案

### 练习一

序列图：
```
客户端              递归解析器           根服务器           TLD服务器          权威服务器
  |                    |                   |                  |                  |
  | 1. 查询 www.example.local              |                  |                  |
  | -----------------> |                   |                  |                  |
  |                    | 2. 查询 .local    |                  |                  |
  |                    | ----------------> |                  |                  |
  |                    | 3. 返回 TLD 地址  |                  |                  |
  |                    | <---------------- |                  |                  |
  |                    |                   |                  |                  |
  |                    | 4. 查询 example.local                 |                  |
  |                    | ------------------------------------> |                  |
  |                    | 5. 返回权威地址   |                  |                  |
  |                    | <------------------------------------ |                  |
  |                    |                   |                  |                  |
  |                    | 6. 查询 www.example.local             |                  |
  |                    | ----------------------------------------------------> |
  |                    | 7. 返回 A 记录    |                  |                  |
  |                    | <---------------------------------------------------- |
  |                    |                   |                  |                  |
  | 8. 返回结果        |                   |                  |                  |
  | <----------------- |                   |                  |                  |
```

### 练习二

1. **DNS 用 UDP**：DNS 查询通常很小（< 512 字节），UDP 开销小。如果响应超过 512 字节，会使用 TCP。

2. **DNS 缓存**：减少查询次数，降低延迟，减轻 DNS 服务器负担。TTL 控制缓存时间。

3. **DNS 劫持**：攻击者篡改 DNS 响应，把域名指向恶意 IP。防御方法：使用 DNSSEC、加密 DNS（DoH/DoT）。

**常见错误**：以为 DNS 查询总是很快。实际上第一次查询可能需要几百毫秒，因为需要递归查询多级服务器。

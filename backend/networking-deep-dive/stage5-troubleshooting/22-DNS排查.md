# DNS 排查——dig/nslookup、DNS 缓存、DNS 劫持

## DNS 问题的常见症状

DNS 问题通常表现为：
- 域名无法解析（`nslookup` 失败）
- 解析到错误的 IP（DNS 劫持）
- 解析延迟高（DNS 慢）
- 间歇性解析失败

## dig：DNS 诊断利器

dig 是 DNS 诊断的标准工具。

### 基本查询

```bash
# 查询 A 记录
dig example.com

# 查询指定 DNS 服务器
dig @8.8.8.8 example.com

# 查询指定记录类型
dig example.com MX
dig example.com NS
dig example.com AAAA

# 简洁输出
dig +short example.com

# 追踪完整解析
dig +trace example.com
```

### 输出解读

```bash
dig example.com

;; ANSWER SECTION:
example.com.        86400   IN  A   93.184.216.34

;; Query time: 20 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; WHEN: Wed Jan  1 00:00:00 UTC 2024
;; MSG SIZE  rcvd: 56
```

关键信息：
- **ANSWER SECTION**：解析结果
- **Query time**：查询耗时
- **SERVER**：使用的 DNS 服务器

## nslookup：传统 DNS 工具

nslookup 是 Windows 和 Linux 都自带的 DNS 工具。

```bash
# 基本查询
nslookup example.com

# 查询指定 DNS 服务器
nslookup example.com 8.8.8.8

# 查询指定记录类型
nslookup -type=MX example.com
nslookup -type=NS example.com

# 交互模式
nslookup
> set type=MX
> example.com
> exit
```

## DNS 缓存问题

### 查看本地 DNS 缓存

```bash
# Windows
ipconfig /displaydns

# Linux (systemd-resolved)
resolvectl statistics

# 清除 DNS 缓存
# Windows
ipconfig /flushdns

# Linux
sudo systemd-resolve --flush-caches
```

### 查看浏览器 DNS 缓存

Chrome 浏览器：`chrome://net-internals/#dns`

### DNS 缓存的影响

DNS 缓存可以减少查询次数，但也会导致：
- 域名 IP 变更后，用户仍然访问旧 IP
- DNS 劫持的缓存会持续影响用户

## DNS 劫持检测

### 检测方法

对比不同 DNS 服务器的结果：

```bash
# 用不同 DNS 服务器查询
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com
dig @208.67.222.222 example.com

# 如果结果不一致，可能被劫持
```

### 常见劫持类型

**运营商 DNS 劫持**：ISP 篡改 DNS 响应，把域名指向自己的服务器。

**路由器 DNS 劫持**：攻击者入侵路由器，修改 DNS 设置。

**本地 DNS 劫持**：恶意软件修改本地 DNS 配置。

### 防御方法

**使用加密 DNS**：
```bash
# DNS over HTTPS (DoH)
# 配置浏览器使用 DoH

# DNS over TLS (DoT)
# 配置系统使用 DoT
```

**使用可信 DNS 服务器**：
```bash
# Google DNS
8.8.8.8
8.8.4.4

# Cloudflare DNS
1.1.1.1
1.0.0.1

# OpenDNS
208.67.222.222
208.67.220.220
```

## DNS 解析延迟排查

### 测量 DNS 延迟

```bash
# 用 dig 测量查询时间
dig example.com | grep "Query time"

# 用 time 测量总时间
time nslookup example.com

# 批量测试
for i in {1..10}; do
  dig @8.8.8.8 example.com | grep "Query time"
done
```

### DNS 延迟的原因

1. **DNS 服务器距离远**：选择离你近的 DNS 服务器
2. **DNS 服务器负载高**：换一个 DNS 服务器
3. **网络延迟高**：检查到 DNS 服务器的路径
4. **递归查询慢**：域名的权威服务器响应慢

### 优化 DNS 延迟

1. **使用本地 DNS 缓存**：如 systemd-resolved
2. **选择合适的 DNS 服务器**：离你近、负载低
3. **减少 DNS 查询次数**：合并请求、预解析
4. **使用 DNS 预取**：浏览器预解析域名

## 实验：DNS 问题排查

### 实验一：模拟 DNS 解析失败

```bash
# 配置错误的 DNS 服务器
sudo echo "nameserver 192.0.2.1" > /etc/resolv.conf

# 测试解析
dig example.com

# 应该超时失败

# 恢复 DNS 配置
sudo echo "nameserver 8.8.8.8" > /etc/resolv.conf
```

### 实验二：模拟 DNS 缓存问题

```bash
# 查询域名
dig example.com
# 记录 IP 地址

# 修改 /etc/hosts
sudo echo "93.184.216.99 example.com" >> /etc/hosts

# 再次查询
dig example.com
# 应该返回 93.184.216.34（从 DNS 服务器）

# 但 ping 应该返回 93.184.216.99（从 hosts 文件）
ping example.com
```

### 实验三：检测 DNS 劫持

```bash
# 用不同 DNS 服务器查询
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com
dig @208.67.222.222 example.com

# 对比结果
# 如果不一致，可能被劫持
```

## 练习

### 练习一：DNS 延迟测试

1. 用 dig 测试 5 个不同 DNS 服务器的响应时间
2. 记录每个服务器的平均响应时间
3. 找出最快的 DNS 服务器

### 练习二：DNS 劫持检测

1. 用 3 个不同的 DNS 服务器查询同一个域名
2. 对比结果是否一致
3. 如果不一致，分析可能的原因

---

## 参考答案

### 练习一

测试命令：
```bash
for dns in 8.8.8.8 1.1.1.1 208.67.222.222 114.114.114.114 223.5.5.5; do
  echo "DNS: $dns"
  for i in {1..5}; do
    dig @$dns example.com | grep "Query time"
  done
done
```

**关键点**：选择响应时间最短、最稳定的 DNS 服务器。

### 练习二

检测方法：
```bash
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com
dig @208.67.222.222 example.com
```

**常见错误**：只用一个 DNS 服务器测试。实际上不同服务器可能返回不同结果（如 CDN 调度），需要对比多个服务器。

**工程建议**：使用加密 DNS（DoH/DoT）可以防止 DNS 劫持，但可能会增加延迟。

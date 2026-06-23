# TCP 连接问题——超时、RST、半连接、端口耗尽

## TCP 连接问题的常见症状

TCP 连接问题通常表现为：
- 连接超时
- 连接被拒绝（RST）
- 连接挂起（半连接）
- 端口耗尽（Cannot assign requested address）

## 连接超时

### 原因分析

连接超时通常是以下原因之一：

1. **目标不可达**：网络路由问题
2. **防火墙丢包**：中间防火墙丢弃 SYN 包
3. **服务器过载**：服务器 SYN 队列满
4. **DNS 解析慢**：DNS 查询超时

### 排查方法

```bash
# 测试连通性
ping 8.8.8.8

# 测试端口
nc -zv 8.8.8.8 80

# 查看路径
traceroute 8.8.8.8

# 抓包分析
sudo tcpdump -i eth0 host 8.8.8.8 and port 80
```

### 抓包分析

如果看到 SYN 包但没有 SYN-ACK 响应：

```
1. SYN → 8.8.8.8:80
2. （无响应）
3. SYN 重传 → 8.8.8.8:80
4. （无响应）
5. SYN 重传 → 8.8.8.8:80
```

可能原因：
- 防火墙丢弃了 SYN 包
- 服务器没有监听 80 端口
- 路由问题

## 连接被拒绝（RST）

### 原因分析

收到 RST 包表示：
1. **端口未监听**：服务器没有进程监听该端口
2. **连接被拒绝**：服务器主动拒绝连接
3. **防火墙拒绝**：防火墙返回 RST

### 抓包分析

```
1. SYN → 8.8.8.8:80
2. RST ← 8.8.8.8:80
```

RST 包表示连接被立即拒绝。

### 排查方法

```bash
# 测试端口是否监听
nc -zv 8.8.8.8 80

# 查看服务器端口监听状态
ssh server "ss -tln | grep 80"

# 检查防火墙规则
ssh server "iptables -L -n | grep 80"
```

## 半连接（Half-Open）

### 原因分析

半连接是指 TCP 连接只完成了一半握手：

```
1. SYN → 服务器
2. SYN-ACK ← 服务器
3. （客户端没有发送 ACK）
```

可能原因：
- 客户端崩溃
- 网络中断
- 客户端 SYN 洪泛攻击

### 查看半连接

```bash
# 查看 SYN_RECV 状态的连接
ss -t state syn-recv

# 统计半连接数
ss -t state syn-recv | wc -l
```

### SYN 洪泛攻击

攻击者发送大量 SYN 包，但不完成握手，耗尽服务器的 SYN 队列。

防御方法：
- SYN Cookie
- 增大 SYN 队列
- 缩短 SYN 超时时间

```bash
# 启用 SYN Cookie
sudo sysctl -w net.ipv4.tcp_syncookies=1

# 增大 SYN 队列
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192

# 缩短 SYN 超时
sudo sysctl -w net.ipv4.tcp_synack_retries=2
```

## 端口耗尽

### 原因分析

客户端端口耗尽是指可用的临时端口用完了。

临时端口范围：
```bash
# Linux
cat /proc/sys/net/ipv4/ip_local_port_range
# 32768 60999

# Windows
netsh int ipv4 show dynamicport tcp
```

端口耗尽通常发生在：
- 大量短连接
- 连接没有正确关闭
- TIME_WAIT 状态过多

### 查看端口使用情况

```bash
# 查看各状态的连接数
ss -t | awk '{print $1}' | sort | uniq -c | sort -rn

# 查看 TIME_WAIT 连接数
ss -t state time-wait | wc -l

# 查看临时端口使用情况
ss -t | awk '{print $4}' | grep -oP ':\K[0-9]+' | sort -n | uniq -c | sort -rn
```

### 解决端口耗尽

**方法一：扩大临时端口范围**
```bash
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

**方法二：允许端口重用**
```bash
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
```

**方法三：缩短 TIME_WAIT 超时**
```bash
sudo sysctl -w net.ipv4.tcp_fin_timeout=30
```

**方法四：使用连接池**
```python
# 使用连接池复用连接
import requests
from requests.adapters import HTTPAdapter

session = requests.Session()
adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100)
session.mount('http://', adapter)
```

## 实验：模拟 TCP 连接问题

### 模拟连接超时

```bash
# 添加防火墙规则丢弃 SYN 包
sudo iptables -A INPUT -p tcp --dport 8080 --syn -j DROP

# 测试连接
nc -zv localhost 8080
# 应该超时

# 恢复
sudo iptables -D INPUT -p tcp --dport 8080 --syn -j DROP
```

### 模拟连接拒绝

```bash
# 启动一个监听 8080 的服务器
nc -l 8080

# 在另一个终端测试
nc -zv localhost 8080

# 停止服务器，再次测试
nc -zv localhost 8080
# 应该被拒绝
```

### 模拟端口耗尽

```bash
# 创建大量短连接
for i in {1..10000}; do
  nc -zv localhost 8080 &
done

# 查看端口使用情况
ss -t | awk '{print $1}' | sort | uniq -c | sort -rn
```

## 练习

### 练习一：排查连接超时

假设你无法连接到远程服务器的 80 端口，用工具链排查问题：
1. ping 测试连通性
2. nc 测试端口
3. tcpdump 抓包分析
4. 分析可能的原因

### 练习二：解决端口耗尽

假设你的应用出现 "Cannot assign requested address" 错误：
1. 查看当前端口使用情况
2. 分析端口耗尽的原因
3. 提出解决方案

---

## 参考答案

### 练习一

排查步骤：
```bash
# 1. ping 测试
ping server_ip
# 如果失败，检查网络连接

# 2. 测试端口
nc -zv server_ip 80
# 如果被拒绝，检查服务器监听状态

# 3. 抓包分析
sudo tcpdump -i eth0 host server_ip and port 80
# 观察是否有 SYN 包、SYN-ACK、RST
```

### 练习二

```bash
# 查看端口使用情况
ss -t | awk '{print $1}' | sort | uniq -c | sort -rn

# 查看 TIME_WAIT 连接
ss -t state time-wait | wc -l

# 解决方案
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
```

**常见错误**：以为端口耗尽是服务器问题。实际上端口耗尽通常发生在客户端，因为客户端需要大量临时端口。

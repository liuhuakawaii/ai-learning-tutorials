# DNS 解析全流程——递归查询、权威服务器、缓存

## DNS 是什么

DNS（域名系统）把人类可读的域名（如 example.com）转换成机器可读的 IP 地址（如 93.184.216.34）。

没有 DNS，你需要记住每个网站的 IP 地址。DNS 是互联网的"电话簿"。

## DNS 的层级结构

DNS 是一个分布式数据库，采用层级结构：

```
根域名（.）
├── 顶级域名（.com, .net, .org, .cn）
│   ├── 权威域名服务器（example.com）
│   │   └── 具体记录（www.example.com → 93.184.216.34）
│   └── ...
└── ...
```

### 根域名服务器

全球有 13 组根域名服务器（A-M），每组有多个实例。根服务器知道所有顶级域名服务器的地址。

### 顶级域名服务器（TLD）

管理特定顶级域名的所有记录。如：
- `.com` TLD 服务器管理所有 .com 域名
- `.cn` TLD 服务器管理所有 .cn 域名

### 权威域名服务器

管理特定域名的所有记录。如：
- `example.com` 的权威服务器知道 www.example.com、mail.example.com 等记录

## DNS 解析过程

当你在浏览器输入 `www.example.com`：

```
1. 浏览器缓存 → 有记录？直接返回
2. 操作系统缓存 → 有记录？直接返回
3. 本地 DNS 服务器（递归解析器）
   a. 查询根服务器 → 返回 .com TLD 服务器地址
   b. 查询 .com TLD 服务器 → 返回 example.com 权威服务器地址
   c. 查询 example.com 权威服务器 → 返回 www.example.com 的 IP
4. 返回给浏览器
```

### 递归查询 vs 迭代查询

**递归查询**：客户端只问一次，DNS 服务器负责找到最终答案。

**迭代查询**：DNS 服务器返回"我不知道，但你可以问这个服务器"，客户端继续问下一个服务器。

实际中，客户端到本地 DNS 服务器是递归查询，本地 DNS 服务器到其他服务器是迭代查询。

## DNS 记录类型

| 类型 | 用途 | 示例 |
|------|------|------|
| A | IPv4 地址 | example.com → 93.184.216.34 |
| AAAA | IPv6 地址 | example.com → 2606:2800:220:1:248:1893:25c8:1946 |
| CNAME | 别名 | www.example.com → example.com |
| MX | 邮件服务器 | example.com → mail.example.com |
| NS | 域名服务器 | example.com → ns1.example.com |
| TXT | 文本记录 | 用于验证、SPF 等 |
| SOA | 起始授权 | 域名的管理信息 |

## DNS 缓存

DNS 解析结果会被缓存，减少查询次数和延迟。

缓存位置：
1. **浏览器缓存**：Chrome 缓存约 1 分钟
2. **操作系统缓存**：Windows/Linux 都有 DNS 缓存
3. **本地 DNS 服务器缓存**：ISP 的 DNS 服务器
4. **中间 DNS 服务器缓存**

缓存时间由 TTL（Time To Live）决定，通常 5 分钟到 24 小时。

## 实验：用 dig 观察 DNS 解析

### 安装 dig

```bash
# Linux
sudo apt install dnsutils  # Debian/Ubuntu
sudo yum install bind-utils  # CentOS/RHEL

# Windows（dig 不是默认安装，用 nslookup 替代）
```

### 查询 A 记录

```bash
# 查询 example.com 的 A 记录
dig example.com A

# 输出示例:
# ;; ANSWER SECTION:
# example.com.        86400   IN  A   93.184.216.34
```

### 追踪完整解析过程

```bash
# 追踪从根服务器开始的完整解析
dig +trace example.com

# 输出示例:
# .                       518400  IN  NS  a.root-servers.net.
# com.                    172800  IN  NS  a.gtld-servers.net.
# example.com.            172800  IN  NS  a.iana-servers.net.
# example.com.            86400   IN  A   93.184.216.34
```

### 查询不同记录类型

```bash
# 查询 MX 记录
dig example.com MX

# 查询 NS 记录
dig example.com NS

# 查询所有记录
dig example.com ANY
```

### 查询指定 DNS 服务器

```bash
# 用 Google DNS 查询
dig @8.8.8.8 example.com

# 用 Cloudflare DNS 查询
dig @1.1.1.1 example.com

# 对比不同 DNS 服务器的结果
```

## 实验：用 Wireshark 抓取 DNS 流量

### 抓包

```bash
# 启动 Wireshark 抓包
# 过滤器: dns

# 在另一个终端
nslookup example.com
```

### 分析 DNS 包

DNS 包结构：
```
事务 ID: 0x1234
标志: 标准查询
问题: 1 个
回答: 1 个
```

问题部分：
```
Name: example.com
Type: A (1)
Class: IN (1)
```

回答部分：
```
Name: example.com
Type: A (1)
Class: IN (1)
TTL: 86400
Data: 93.184.216.34
```

## DNS 安全问题

### DNS 劫持

攻击者篡改 DNS 响应，把域名指向恶意 IP。

防御方法：
- 使用 DNSSEC（DNS 安全扩展）
- 使用加密 DNS（DoH/DoT）

### DNS 缓存投毒

攻击者向 DNS 缓存注入虚假记录。

防御方法：
- 使用随机源端口
- 使用 DNSSEC

### DNS 放大攻击

攻击者利用 DNS 响应比请求大的特点，进行 DDoS 攻击。

防御方法：
- 限制递归查询
- 使用响应速率限制（RRL）

## 练习

### 练习一：追踪 DNS 解析

1. 用 `dig +trace` 追踪 `www.baidu.com` 的完整解析过程
2. 记录每一级的 NS 记录
3. 测量总解析时间

### 练习二：对比 DNS 服务器

1. 用不同 DNS 服务器查询同一域名：
   - 本地 DNS（通常是 ISP 提供）
   - Google DNS（8.8.8.8）
   - Cloudflare DNS（1.1.1.1）
2. 记录响应时间和结果是否一致

---

## 参考答案

### 练习一

典型输出：
```
.                       518400  IN  NS  a.root-servers.net.
com.                    172800  IN  NS  a.gtld-servers.net.
baidu.com.              172800  IN  NS  dns.baidu.com.
www.baidu.com.          600     IN  CNAME   www.a.shifen.com.
www.a.shifen.com.       600     IN  A   110.242.68.3
```

解析过程：
1. 查询根服务器 → 返回 .com TLD 服务器
2. 查询 .com TLD → 返回 baidu.com 权威服务器
3. 查询 baidu.com 权威 → 返回 CNAME 记录
4. 查询 CNAME → 返回 A 记录

### 练习二

典型结果：
- 本地 DNS：50ms
- Google DNS：100ms
- Cloudflare DNS：80ms

**关键点**：不同 DNS 服务器可能返回不同的 IP（如 CDN 调度），响应时间也不同。选择离你近的 DNS 服务器可以减少延迟。

**常见错误**：以为 DNS 查询只发生一次。实际上浏览器、操作系统、ISP 都有缓存，真正到权威服务器的查询很少。

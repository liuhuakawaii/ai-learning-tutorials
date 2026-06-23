# 阶段实战：排查三个真实生产环境的 HTTP 问题

## 目标

这个阶段的实战任务是：模拟三个真实生产环境中的 HTTP 问题，用前面学到的工具和知识来排查和修复。

这三个问题覆盖了最常见的 HTTP 故障类型：CORS 问题、证书问题、性能问题。每个问题都有"现象 → 假设 → 排查 → 定位 → 修复"的完整过程。

## 问题一：前端请求被 CORS 阻断

### 现象

前端开发者报告："调用后端 API 时浏览器报 CORS 错误，但用 Postman 测试是正常的。"

### 排查过程

**第一步：确认是 CORS 问题**

打开浏览器控制台，看到错误：

```
Access to fetch at 'https://api.example.com/data' from origin 'https://app.example.com' 
has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header 
in the response must not be wildcard '*' when the credentials mode of the request is 'include'.
```

**第二步：用 curl 复现**

```bash
curl -v -H "Origin: https://app.example.com" https://api.example.com/data 2>&1 | grep -i "access-control"
```

输出：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

**第三步：定位根因**

服务器返回了 `Access-Control-Allow-Origin: *` 和 `Access-Control-Allow-Credentials: true`。但根据 CORS 规范，`*` 跟 `credentials: include` 不兼容。

前端代码中用了 `fetch(url, { credentials: 'include' })`，所以浏览器拒绝了响应。

**第四步：修复**

服务器端修改：

```js
// 错误的做法
res.setHeader('Access-Control-Allow-Origin', '*')
res.setHeader('Access-Control-Allow-Credentials', 'true')

// 正确的做法
const origin = req.headers.origin
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}
```

**第五步：验证**

```bash
curl -v -H "Origin: https://app.example.com" https://api.example.com/data 2>&1 | grep -i "access-control"
```

现在返回的是具体的 Origin 而不是 `*`。

## 问题二：HTTPS 证书验证失败

### 现象

运维报告："部分用户反馈网站打不开，浏览器显示'您的连接不是私密连接'。用 curl 测试也报错。"

### 排查过程

**第一步：用 curl 复现**

```bash
curl -vI https://example.com 2>&1 | grep -i "certificate\|ssl\|tls"
```

输出：
```
curl: (60) SSL certificate problem: certificate has expired
```

**第二步：检查证书详情**

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -dates -issuer -subject
```

输出：
```
notBefore=Jan  1 00:00:00 2024 GMT
notAfter=Mar 31 23:59:59 2024 GMT
issuer=C = US, O = Let's Encrypt, CN = R3
subject=CN = example.com
```

证书在 2024 年 3 月 31 日过期了。

**第三步：检查证书链**

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>&1 | grep -i "verify"
```

输出：
```
Verify return code: 10 (certificate has expired)
```

**第四步：检查为什么没有自动续期**

```bash
# 检查 certbot 定时任务
systemctl list-timers | grep certbot
crontab -l | grep certbot

# 检查 certbot 日志
journalctl -u certbot --since "2024-03-01"
```

发现 certbot 的定时任务被禁用了（可能是系统更新时被删除了）。

**第五步：修复**

```bash
# 手动续期证书
certbot renew

# 重启 Nginx
systemctl restart nginx

# 重新启用定时任务
systemctl enable --now certbot.timer
```

**第六步：验证**

```bash
# 检查新证书
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -dates

# 用 curl 测试
curl -vI https://example.com 2>&1 | grep -i "ssl\|tls"
```

## 问题三：API 响应缓慢

### 现象

用户反馈："页面加载很慢，特别是数据列表页面。"

### 排查过程

**第一步：用 curl 测量时间**

```bash
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://api.example.com/list
```

输出：
```
DNS: 0.012s
Connect: 0.045s
TLS: 0.120s
TTFB: 3.200s
Total: 3.450s
```

TTFB（首字节时间）是 3.2 秒，说明服务器处理请求花了很长时间。网络延迟只有 120ms。

**第二步：检查服务端日志**

```bash
tail -f /var/log/app/api.log
```

看到：

```
[2024-03-15 10:23:45] GET /list - 3200ms - DB query: 2800ms
```

数据库查询花了 2.8 秒。

**第三步：分析数据库查询**

```sql
EXPLAIN ANALYZE SELECT * FROM items WHERE category = 'electronics' ORDER BY created_at DESC LIMIT 20;
```

输出显示全表扫描，没有使用索引。

**第四步：修复**

```sql
CREATE INDEX idx_items_category_created ON items(category, created_at DESC);
```

**第五步：验证**

```bash
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://api.example.com/list
```

输出：
```
DNS: 0.010s
Connect: 0.042s
TLS: 0.115s
TTFB: 0.180s
Total: 0.250s
```

TTFB 从 3.2 秒降到 180ms。

## 用 Node.js 模拟这三个问题

```js
const http = require('http')

// 问题一：CORS 配置错误
const corsProblemServer = http.createServer((req, res) => {
  // 错误的 CORS 配置
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'data' }))
})

// 问题三：慢响应
const slowServer = http.createServer((req, res) => {
  if (req.url === '/list') {
    // 模拟慢数据库查询
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ items: Array.from({ length: 20 }, (_, i) => ({ id: i })) }))
    }, 3000)
  } else {
    res.writeHead(404)
    res.end()
  }
})

corsProblemServer.listen(3001, () => console.log('CORS 问题服务器 :3001'))
slowServer.listen(3002, () => console.log('慢响应服务器 :3002'))
```

## 排查清单

每个问题的排查都应该遵循这个流程：

1. **复现**：用 curl 或浏览器复现问题
2. **观察**：看状态码、响应头、错误信息
3. **假设**：基于观察提出可能的原因
4. **验证**：用工具验证假设
5. **修复**：解决问题
6. **确认**：验证修复有效

## 验收清单

- [ ] 能用 curl 排查 CORS 问题
- [ ] 能用 openssl 排查证书问题
- [ ] 能用 curl 的 `-w` 选项测量请求各阶段时间
- [ ] 能从 TTFB 判断是网络问题还是服务端问题
- [ ] 能用 Wireshark 抓包分析网络层行为
- [ ] 理解了"Postman 能用但浏览器不行"的原因（CORS）

## 常见问题

**Q: 为什么 Postman 不受 CORS 限制？**
A: CORS 是浏览器的安全策略，只在浏览器中生效。Postman、curl、后端服务之间的请求不受 CORS 限制。这是设计如此，不是 bug。

**Q: 证书过期后怎么快速恢复？**
A: 用 certbot 手动续期（`certbot renew`），然后重启 Web 服务器。如果 certbot 有问题，可以手动申请新证书。

**Q: TTFB 高一定是服务端问题吗？**
A: 不一定。高 TTFB 也可能是网络延迟高（比如跨洋请求）。但如果你在同一地区测试，TTFB 超过 500ms 通常是服务端处理慢。

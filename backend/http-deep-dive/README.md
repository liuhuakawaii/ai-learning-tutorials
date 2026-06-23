# HTTP 协议深度课

> 每天都在用 HTTP，但你真的懂它吗？

## 适合谁

- 有 Web 开发经验，但对 HTTP 协议的理解停留在"GET/POST/状态码"
- 遇到 CORS、缓存、HTTPS 问题时靠 Google 凑答案，不理解底层原理
- 想要从"能用"到"真正理解"的后端/全栈工程师

## 学完能做什么

- 用 Wireshark 抓包分析 HTTP 请求的每一层行为
- 理解 HTTP/1.1 → HTTP/2 → HTTP/3 的演进逻辑和工程取舍
- 设计合理的缓存策略（强缓存/协商缓存/CDN）
- 正确配置 CORS、CSP、HSTS 等安全头部
- 排查 HTTPS 证书、TLS 握手、连接超时等网络问题

## 技术栈

| 类别 | 工具 |
|------|------|
| 抓包分析 | Wireshark、Chrome DevTools Network |
| 服务器 | Node.js（手写 HTTP 服务器） |
| 测试 | curl、httpie、h2load |
| 证书 | OpenSSL、mkcert |
| 对比 | HTTP/1.1、HTTP/2、HTTP/3 |

## 学习路线

### 第一阶段：HTTP 基础与报文结构

1. HTTP 报文解剖——请求行、头部、正文的二进制真相
2. 连接管理——Keep-Alive、管线化、并发连接
3. 内容协商——Accept、Content-Encoding、Transfer-Encoding
4. Cookie 与 Session——状态保持的工程实现
5. 阶段实战：手写一个 HTTP/1.1 服务器并抓包验证

### 第二阶段：HTTP/2 与 HTTP/3

6. HTTP/2 为什么快——多路复用、头部压缩、服务器推送
7. 从抓包看 HTTP/2——帧格式、流优先级、RST_STREAM
8. HTTP/3 与 QUIC——为什么要在 UDP 上建可靠传输
9. 协议选型——什么时候用 HTTP/1.1、HTTP/2、HTTP/3
10. 阶段实战：同一应用的三种协议性能对比

### 第三阶段：缓存与性能

11. 浏览器缓存机制——Memory Cache、Disk Cache、Service Worker Cache
12. 强缓存 vs 协商缓存——Cache-Control、ETag、Last-Modified 的协作
13. CDN 缓存——回源、刷新、预热、多级缓存架构
14. 传输优化——gzip/brotli 压缩、分块传输、SSE
15. 阶段实战：设计一个静态资源的完整缓存策略

### 第四阶段：安全与认证

16. HTTPS 握手全流程——ClientHello → 证书验证 → 密钥交换
17. TLS 1.3 的改进——1-RTT 握手、0-RTT 恢复
18. CORS 深度课——简单请求、预检请求、Credentials 的完整规则
19. 安全头部——CSP、HSTS、X-Frame-Options、SameSite Cookie
20. 阶段实战：配置一个 A+ 评级的 HTTPS 站点

### 第五阶段：实战排查

21. 常见 HTTP 错误排查——CORS 报错、证书过期、连接超时
22. 抓包分析真实问题——用 Wireshark 定位"请求发了但没响应"
23. HTTP 调试工具链——curl 高级用法、httpie、Charles/Fiddler
24. 移动端 HTTP 特殊问题——弱网、连接切换、后台限制
25. 阶段实战：排查三个真实生产环境的 HTTP 问题

## 贯穿项目

每阶段的实战任务逐步构建一个可抓包分析的 HTTP 实验环境：

- 阶段一：手写 HTTP/1.1 服务器
- 阶段二：添加 HTTP/2 支持并对比
- 阶段三：加入缓存策略
- 阶段四：配置 HTTPS 和安全头部
- 阶段五：用这个环境排查真实问题

## 验收标准

- 能用 Wireshark 抓包并解读 HTTP/1.1、HTTP/2 的帧结构
- 能画出 HTTPS 握手的完整流程图
- 能正确配置 CORS（包括带 Cookie 的跨域请求）
- 能设计一个静态资源的缓存策略（强缓存 + 协商缓存 + CDN）
- 能排查至少 3 种常见的 HTTP 错误

## 参考文档

- RFC 9110（HTTP 语义）：https://httpwg.org/specs/rfc9110.html
- RFC 9113（HTTP/2）：https://httpwg.org/specs/rfc9113.html
- RFC 9114（HTTP/3）：https://httpwg.org/specs/rfc9114.html
- MDN HTTP 文档：https://developer.mozilla.org/en-US/docs/Web/HTTP

# 第四阶段：安全与认证

## 阶段目标

理解 HTTPS 握手全流程、TLS 1.3 改进、CORS 完整规则和安全头部配置，能配置一个获得 A+ 评级的 HTTPS 站点。

## 课时列表

1. [HTTPS 握手全流程——ClientHello → 证书验证 → 密钥交换](16-https-handshake.md)
2. [TLS 1.3 的改进——1-RTT 握手、0-RTT 恢复](17-tls13-improvements.md)
3. [CORS 深度课——简单请求、预检请求、Credentials 的完整规则](18-cors-deep-dive.md)
4. [安全头部——CSP、HSTS、X-Frame-Options、SameSite Cookie](19-security-headers.md)
5. [阶段实战：配置一个 A+ 评级的 HTTPS 站点](20-stage-project.md)

## 验收标准

- 能画出 HTTPS 握手的完整流程图（ClientHello → ServerHello → 密钥交换 → 加密通信）
- 能解释 TLS 1.3 相比 1.2 减少了几次往返以及 0-RTT 的安全权衡
- 能正确配置 CORS（包括带 Cookie 的跨域请求和预检缓存）
- 能配置 CSP、HSTS、X-Frame-Options 等安全头部并解释每个头部的防护目标

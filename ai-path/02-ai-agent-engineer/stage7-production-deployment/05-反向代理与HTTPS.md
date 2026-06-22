# 05 反向代理与 HTTPS

> 生产环境必须用 HTTPS——没有例外。

## 场景引入

你的 AI Agent 平台部署到服务器后，用户反馈浏览器地址栏显示"不安全"，SSE 流式对话也莫名其妙断连。更糟糕的是，有人用抓包工具直接截获了 API 请求中的 Token。没有反向代理和 HTTPS，你的服务就像在公路上裸奔——任何人都能看到传输内容，而且直接暴露后端端口带来严重的安全风险。

## 学习目标

- 配置 Nginx 反向代理
- 实现 HTTPS 和 WebSocket 支持
- 理解安全 Headers

## Nginx 配置

```nginx
# nginx/nginx.conf
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # 安全 Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # 前端
    location / {
        proxy_pass http://frontend;
    }
    
    # 后端 API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket (SSE 流式响应)
    location /api/v1/chat/sessions/.*/messages/stream {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

## Caddy 替代方案（更简单）

```
# Caddyfile
yourdomain.com {
    reverse_proxy /api/* backend:8000
    reverse_proxy /* frontend:80
    
    # HTTPS 自动配置！
}
```

## 练习

### 练习 1：Nginx 配置

配置 Nginx 反向代理：

1. HTTP → HTTPS 重定向
2. API 代理
3. WebSocket 代理

### 练习 2：HTTPS 配置

1. 用 Let's Encrypt 获取证书
2. 配置自动续期
3. 测试 SSL 评分

---

## 参考答案

### 练习 1

**思路**：Nginx 反向代理的核心是三个 location 块——前端静态资源、后端 API、SSE 流式响应。SSE 和 WebSocket 必须关闭缓冲（`proxy_buffering off`），否则客户端收不到实时数据块。HTTP 到 HTTPS 的 301 重定向要放在独立的 server 块中。

**答案**：

```nginx
# nginx/nginx.conf

# 后端上游
upstream backend {
    server backend:8000;
    keepalive 32;
}

# 前端上游
upstream frontend {
    server frontend:80;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name yourdomain.com;

    # Let's Encrypt 验证路径（申请证书时需要）
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 其他请求全部重定向
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # --- SSL 配置 ---
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # --- 安全 Headers ---
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --- 前端静态资源 ---
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            proxy_pass http://frontend;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # --- 后端 API ---
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # API 超时
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # 请求体大小限制
        client_max_body_size 50m;
    }

    # --- SSE 流式响应（关键！）---
    location ~ ^/api/v1/chat/.*/stream$ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 关闭缓冲——SSE 必须
        proxy_buffering off;
        proxy_cache off;

        # 长超时——流式对话可能持续几分钟
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        # 关闭 gzip（SSE 数据块不能压缩）
        gzip off;
    }

    # --- WebSocket ---
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

**要点**：
- SSE 流式响应必须关闭 `proxy_buffering` 和 `proxy_cache`——否则 Nginx 会缓冲整个响应后才发给客户端，实时性完全丧失
- SSE location 用正则匹配 `/stream` 路径，避免对普通 API 也关闭缓冲
- 常见错误：把 SSE 配置放在 `/api/` location 里——所有 API 响应都被关闭缓冲，静态资源也无法缓存

### 练习 2

**思路**：HTTPS 证书用 Let's Encrypt 免费获取，配合 certbot 自动续期。证书申请需要验证域名所有权，推荐用 HTTP 验证方式（在 Nginx 的 `.well-known/acme-challenge/` 路径放验证文件）。续期用 cron 定时执行 `certbot renew`。

**答案**：

```bash
#!/bin/bash
# scripts/setup-ssl.sh —— HTTPS 证书配置脚本

set -euo pipefail

DOMAIN="${1:?用法: $0 <域名>}"
EMAIL="${2:?用法: $0 <域名> <邮箱>}"

echo "=== 为 $DOMAIN 配置 HTTPS ==="

# 1. 安装 certbot
if ! command -v certbot &> /dev/null; then
    echo "安装 certbot..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
fi

# 2. 创建验证目录
mkdir -p /var/www/certbot

# 3. 申请证书（使用 Nginx 插件）
certbot certonly \
    --nginx \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

# 4. 验证证书
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "证书申请成功！"
    echo "证书路径: /etc/letsencrypt/live/$DOMAIN/"
else
    echo "证书申请失败"
    exit 1
fi

# 5. 配置自动续期 cron
echo "配置自动续期..."
cat > /etc/cron.d/certbot-renew << EOF
# 每天凌晨 2 点检查证书是否需要续期
0 2 * * * root certbot renew --quiet --deploy-hook "docker compose -f /app/docker-compose.yml exec nginx nginx -s reload"
EOF

echo "=== 配置完成 ==="
```

Nginx 证书配置更新：

```nginx
# 更新 nginx.conf 中的证书路径
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

Docker Compose 中挂载证书：

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    ports:
      - "80:80"
      - "443:443"
```

验证 SSL 配置：

```bash
# 测试 Nginx 配置
nginx -t

# 重新加载 Nginx
nginx -s reload

# 测试 SSL 评分（在线工具）
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

# 本地测试
curl -vI https://yourdomain.com 2>&1 | grep -E "SSL|HTTP|certificate"

# 测试 HTTPS 重定向
curl -I http://yourdomain.com 2>&1 | grep "301"

# 测试 HSTS
curl -I https://yourdomain.com 2>&1 | grep "Strict-Transport"
```

**要点**：
- Let's Encrypt 证书有效期 90 天，必须配置自动续期——人工遗忘会导致证书过期、网站不可访问
- `certbot renew --deploy-hook` 在续期成功后自动重载 Nginx，新证书才会生效
- 常见错误：续期 cron 里没有 `--deploy-hook`——证书续期了但 Nginx 还在用旧证书，等于没续期

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| SSE 不工作 | Nginx 缓冲了响应 | 配置 proxy_buffering off |
| WebSocket 断连 | 超时太短 | 增加 proxy_read_timeout |
| 证书过期 | 没自动续期 | 配置 certbot 自动续期 |

## 工程建议

SSE 流式响应在 Nginx 下必须关闭缓冲（`proxy_buffering off`），否则客户端收不到实时数据块。HTTPS 证书推荐使用 Let's Encrypt 配合 certbot 自动续期，避免人工遗忘导致证书过期。如果团队 Nginx 经验不足，优先考虑 Caddy——它自动管理 HTTPS 证书，配置量只有 Nginx 的三分之一。

## 本节要点

- Nginx 是最流行的反向代理
- HTTPS 是生产环境的必需
- WebSocket/SSE 需要特殊配置
- Caddy 比 Nginx 更简单（自动 HTTPS）

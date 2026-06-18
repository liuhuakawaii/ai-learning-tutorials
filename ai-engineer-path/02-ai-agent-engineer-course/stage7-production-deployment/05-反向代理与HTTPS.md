# 05 反向代理与 HTTPS

> 生产环境必须用 HTTPS——没有例外。

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

## 本节要点

- Nginx 是最流行的反向代理
- HTTPS 是生产环境的必需
- WebSocket/SSE 需要特殊配置
- Caddy 比 Nginx 更简单（自动 HTTPS）

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| SSE 不工作 | Nginx 缓冲了响应 | 配置 proxy_buffering off |
| WebSocket 断连 | 超时太短 | 增加 proxy_read_timeout |
| 证书过期 | 没自动续期 | 配置 certbot 自动续期 |

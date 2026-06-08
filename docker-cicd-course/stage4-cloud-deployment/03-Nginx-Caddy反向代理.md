# 第三课：Nginx / Caddy 反向代理

> **课程定位**：学会配置反向代理，让外部访问容器服务
> **前置知识**：VPS 基础、Docker（第 1-2 课）
> **预计时长**：35 分钟

---

## 学习目标

1. 理解反向代理的作用
2. 使用 Nginx 配置反向代理
3. 了解 Caddy 的自动 HTTPS
4. 在 Docker Compose 中集成反向代理

---

## 一、什么是反向代理

```
没有反向代理：

  用户 → 直接访问 → App:3000

  问题：
  - 端口暴露不安全
  - 无法处理 HTTPS
  - 无法负载均衡

有反向代理：

  用户 → Nginx:80/443 → App:3000

  优势：
  - 只暴露 80/443 端口
  - 处理 HTTPS/SSL
  - 可以路由到多个服务
  - 可以做负载均衡
```

---

## 二、Nginx 配置

### 2.1 基本反向代理

```nginx
# /etc/nginx/sites-available/my-app
server {
    listen 80;
    server_name my-app.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/my-app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 2.2 多服务路由

```nginx
server {
    listen 80;
    server_name my-app.com;

    # 前端
    location / {
        proxy_pass http://localhost:3001;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
    }
}
```

### 2.3 Docker Compose 集成

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build: .
    # 不暴露端口到宿主机，只在内部网络
    expose:
      - "3000"
    restart: unless-stopped
```

---

## 三、Caddy 配置

### 3.1 为什么选择 Caddy

```
Caddy 的优势：

  ✅ 自动 HTTPS：自动申请和续期证书
  ✅ 配置简单：一个 Caddyfile 搞定
  ✅ 性能好：Go 语言编写
```

### 3.2 Caddyfile

```caddyfile
# Caddyfile
my-app.com {
    reverse_proxy app:3000
}
```

### 3.3 Docker Compose 集成

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped

  app:
    build: .
    expose:
      - "3000"
    restart: unless-stopped

volumes:
  caddy-data:
  caddy-config:
```

---

## 四、HTTPS 配置

### 4.1 Nginx + Let's Encrypt

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d my-app.com

# 自动续期
certbot renew --dry-run
```

### 4.2 Caddy 自动 HTTPS

```caddyfile
# Caddy 自动申请证书，无需配置
my-app.com {
    reverse_proxy app:3000
}
```

---

## 五、动手练习

### 练习一：Nginx 反向代理

```bash
# 1. 在本地创建 nginx 配置
mkdir -p nginx/conf.d
cat > nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# 2. 更新 docker-compose.yml 添加 nginx 服务
# 3. docker compose up -d
# 4. 访问 http://localhost
```

### 练习二：Caddy 自动 HTTPS

```bash
# 使用 Caddy 替代 Nginx，体验自动 HTTPS
```

---

## 小结

1. **反向代理**：隐藏后端服务，处理 HTTPS，路由请求
2. **Nginx**：功能强大，配置灵活，需要手动配置 HTTPS
3. **Caddy**：配置简单，自动 HTTPS，适合快速部署
4. **Docker 集成**：Nginx/Caddy 作为容器运行

---

## 下一课预告

下一课我们将学习 HTTPS 和域名配置。

# 第三课：Nginx / Caddy 反向代理

> **课程定位**：学会配置反向代理，让外部访问容器服务
> **前置知识**：VPS 基础、Docker（第 1-2 课）
> **预计时长**：35 分钟

---

## 场景引入

你的应用部署在 VPS 上，通过 `http://服务器IP:3000` 能访问。但你不想让用户看到 IP 地址和端口号，你想用域名访问，还想加上 HTTPS。而且你可能有多个服务：前端一个、API 一个、管理后台一个，都希望通过同一个域名的不同路径访问。这就是反向代理要解决的问题。

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

## 常见误区

- **"反向代理只是转发请求"**：反向代理还负责 SSL 终止、负载均衡、静态文件托管、请求限流、缓存等。它是生产环境架构中的关键组件。
- **"Nginx 和 Caddy 差不多"**：Nginx 功能更强大、配置更灵活，但 HTTPS 需要手动配置。Caddy 自动 HTTPS、配置极简，适合快速部署。根据需求选择。
- **"反向代理和应用放在同一个容器里"**：反向代理应该是独立的容器，通过 Docker 网络访问应用容器。职责分离，独立扩展，独立更新。
- **"所有端口都要暴露到宿主机"**：只有反向代理需要暴露 80/443，应用容器只需要 `expose` 内部端口，不映射到宿主机。这样更安全。

---

## 工程建议

- **新项目优先考虑 Caddy**：自动 HTTPS、配置极简，5 分钟搞定反向代理 + HTTPS。除非需要 Nginx 的高级功能（如复杂的负载均衡规则）。
- **Nginx 配置用 conf.d 目录管理**：每个服务一个配置文件，比把所有配置写在一个文件里更清晰。
- **用 Docker Compose 集成反向代理**：Nginx/Caddy 作为 compose.yml 中的一个服务，通过 Docker 网络访问应用容器。
- **生产环境只暴露 80 和 443**：数据库、Redis 等内部服务的端口不应该映射到宿主机，只通过容器网络访问。

---

## 小结

1. **反向代理**：隐藏后端服务，处理 HTTPS，路由请求
2. **Nginx**：功能强大，配置灵活，需要手动配置 HTTPS
3. **Caddy**：配置简单，自动 HTTPS，适合快速部署
4. **Docker 集成**：Nginx/Caddy 作为容器运行

---

## 下一课预告

下一课我们将学习 HTTPS 和域名配置。

---

## 参考答案

### 练习一

**思路**：在 Docker Compose 中添加 Nginx 作为反向代理服务，通过 Docker 内部网络将请求转发到应用容器。关键点是 Nginx 配置中使用服务名（如 `app`）而不是 `localhost` 来访问应用。

**答案**：

nginx 配置文件 `nginx/conf.d/default.conf`：

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

docker-compose.yml：

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build: .
    expose:
      - "3000"
    restart: unless-stopped
```

操作步骤：
1. `mkdir -p nginx/conf.d`
2. 创建 `nginx/conf.d/default.conf`（内容如上）
3. 更新 `docker-compose.yml`（内容如上）
4. `docker compose up -d`
5. 访问 `http://localhost`，请求会被转发到 app:3000

**要点**：
- 在 Docker Compose 网络中，Nginx 可以直接使用服务名 `app` 作为主机名访问应用容器
- 应用容器使用 `expose` 而不是 `ports`，端口只在内部网络可见，不暴露到宿主机
- `proxy_set_header` 传递真实的客户端信息，否则应用看到的 IP 都是 Nginx 的
- `depends_on` 确保 Nginx 在应用启动后才启动，但不保证应用已就绪

### 练习二

**思路**：用 Caddy 替代 Nginx，体验自动 HTTPS 的便利。Caddy 只需要一个极简的 Caddyfile 就能完成反向代理 + 自动申请和续期 SSL 证书。在本地测试时 Caddy 会使用自签名证书。

**答案**：

Caddyfile：

```caddyfile
# 本地测试时使用 localhost
localhost {
    reverse_proxy app:3000
}

# 生产环境替换为真实域名
# my-app.com {
#     reverse_proxy app:3000
# }
```

docker-compose.yml：

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

操作步骤：
1. 创建 `Caddyfile`（内容如上）
2. 更新 `docker-compose.yml`（内容如上）
3. `docker compose up -d`
4. 访问 `https://localhost`，Caddy 自动使用自签名证书

**要点**：
- Caddy 自动为配置的域名申请 Let's Encrypt 证书，无需手动安装 certbot
- `caddy-data` 和 `caddy-config` 卷用于持久化证书和配置，避免每次重启都重新申请
- 本地测试时使用 `localhost` 作为域名，Caddy 会使用自签名证书
- 生产环境只需将 `localhost` 替换为真实域名，Caddy 会自动完成 DNS 验证和证书申请
- 与 Nginx 相比，Caddy 配置极简，但 Nginx 在高级功能（复杂负载均衡、缓存策略）上更灵活

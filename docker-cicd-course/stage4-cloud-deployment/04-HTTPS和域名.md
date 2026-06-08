# 第四课：HTTPS 和域名

> **课程定位**：配置域名和 HTTPS，让应用可以通过域名安全访问
> **前置知识**：Nginx/Caddy 反向代理（第三课）
> **预计时长**：30 分钟

---

## 学习目标

1. 了解域名购买和 DNS 配置
2. 配置 HTTPS 证书
3. 理解证书自动续期
4. 掌握常见的 HTTPS 问题排查

---

## 一、域名配置

### 1.1 购买域名

```
常见域名注册商：

  国际：Namecheap、Google Domains、Cloudflare
  国内：阿里云、腾讯云

  建议：
  - 使用 Cloudflare 管理 DNS（免费、功能强）
  - 国内服务器需要备案
```

### 1.2 DNS 配置

```
在域名注册商或 Cloudflare 添加 DNS 记录：

  类型    名称    值              TTL
  A       @      服务器IP        Auto
  A       www    服务器IP        Auto
  CNAME   api    my-app.com      Auto

  结果：
  my-app.com     → 服务器IP
  www.my-app.com → 服务器IP
  api.my-app.com → my-app.com → 服务器IP
```

---

## 二、HTTPS 证书

### 2.1 Let's Encrypt（免费）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d my-app.com -d www.my-app.com

# 测试自动续期
certbot renew --dry-run

# 设置自动续期（通常自动配置）
systemctl enable certbot.timer
```

### 2.2 Caddy 自动 HTTPS

```caddyfile
# Caddy 自动申请和续期证书
my-app.com {
    reverse_proxy app:3000
}
```

### 2.3 证书文件位置

```
Let's Encrypt 证书位置：

  /etc/letsencrypt/live/my-app.com/
  ├── fullchain.pem    # 完整证书链
  ├── privkey.pem      # 私钥
  ├── cert.pem         # 证书
  └── chain.pem        # 中间证书
```

---

## 三、Nginx HTTPS 配置

```nginx
server {
    listen 80;
    server_name my-app.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name my-app.com;

    ssl_certificate /etc/letsencrypt/live/my-app.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my-app.com/privkey.pem;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 四、验证 HTTPS

```bash
# 测试 HTTPS 是否工作
curl -I https://my-app.com

# 检查证书信息
curl -vI https://my-app.com 2>&1 | grep -i "ssl\|certificate"

# 在线检测
# https://www.ssllabs.com/ssltest/
```

---

## 五、常见问题

```
问题一：证书申请失败
  原因：DNS 未生效或端口未开放
  解决：检查 DNS 解析、确保 80 端口开放

问题二：证书过期
  原因：自动续期失败
  解决：手动续期 certbot renew

问题三：混合内容警告
  原因：页面中加载了 HTTP 资源
  解决：确保所有资源使用 HTTPS
```

---

## 六、动手练习

```bash
# 1. 申请一个免费域名（如 freenom.com）或使用已有域名
# 2. 配置 DNS 指向服务器
# 3. 安装 Certbot 并申请证书
# 4. 配置 Nginx HTTPS
# 5. 验证 HTTPS 工作
```

---

## 小结

1. **域名**：购买域名，配置 DNS A 记录指向服务器
2. **HTTPS**：使用 Let's Encrypt 免费证书
3. **Certbot**：自动申请和续期证书
4. **Caddy**：自动 HTTPS，零配置

---

## 下一课预告

下一课我们将学习数据库迁移——如何安全地更新数据库结构。

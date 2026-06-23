# 阶段实战：VPS 部署全栈项目

> 前置知识：VPS、Nginx、HTTPS、数据库迁移、备份（第 1-6 课）

## 你的任务

把一个全栈项目部署到 VPS 上，要求：

- 域名 + HTTPS
- Nginx 反向代理
- Docker Compose 编排所有服务
- 数据库自动备份
- CI/CD 自动部署

这不是 demo——这是你在真实项目里交给运维团队的东西。

## 服务器准备

```bash
# 连接服务器
ssh root@your-server-ip

# 创建部署用户
adduser deploy
usermod -aG docker deploy

# 创建项目目录
mkdir -p /opt/myapp
chown deploy:deploy /opt/myapp
```

## docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot-etc:/etc/letsencrypt:ro
      - certbot-var:/var/lib/letsencrypt
    depends_on:
      - api
      - frontend
    restart: unless-stopped

  frontend:
    image: ghcr.io/your-org/your-repo-frontend:${TAG:-latest}
    restart: unless-stopped

  api:
    image: ghcr.io/your-org/your-repo-api:${TAG:-latest}
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD}@db:5432/myapp
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      retries: 3

  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do sleep 12h & wait $${!}; certbot renew; done'"

volumes:
  pgdata:
  redis-data:
  certbot-etc:
  certbot-var:
```

## Nginx 配置

```nginx
# nginx/conf.d/default.conf
server {
    listen 80;
    server_name yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## HTTPS 证书

```bash
# 首次申请证书
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/lib/letsencrypt \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com

# 重启 nginx 加载证书
docker compose restart nginx
```

证书 90 天过期。certbot 容器会自动每 12 小时检查一次，过期前 30 天自动续期。

## 数据库备份脚本

```bash
#!/bin/bash
# scripts/backup-db.sh

BACKUP_DIR="/opt/myapp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

docker compose exec -T db pg_dump -U postgres myapp | gzip > $BACKUP_FILE

# 保留最近 7 天的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# 添加定时任务
crontab -e
# 每天凌晨 3 点备份
0 3 * * * /opt/myapp/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

## 恢复数据库

```bash
# 从备份恢复
gunzip < /opt/myapp/backups/db_20240101_030000.sql.gz | \
  docker compose exec -T db psql -U postgres myapp
```

## 自动部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

TAG=${1:-latest}

echo "Deploying version: $TAG"

# 拉取新镜像
TAG=$TAG docker compose pull

# 滚动更新
TAG=$TAG docker compose up -d --remove-orphans

# 等待健康检查通过
echo "Waiting for services to be healthy..."
sleep 10

# 验证
curl -f http://localhost/api/health || {
  echo "Health check failed, rolling back..."
  docker compose rollback  # 需要 docker compose v2.20+
  exit 1
}

echo "Deploy completed successfully"
```

## 验收清单

```bash
# 1. 域名解析
dig yourdomain.com          # 指向服务器 IP

# 2. HTTPS
curl -I https://yourdomain.com  # 200 OK

# 3. API 健康检查
curl https://yourdomain.com/api/health  # {"status":"ok"}

# 4. 数据库
docker compose exec db psql -U postgres myapp -c "\dt"  # 有表

# 5. 备份
/opt/myapp/scripts/backup-db.sh
ls /opt/myapp/backups/  # 有备份文件

# 6. 自动重启
docker compose kill api
docker compose ps  # api 自动重启
```

## 练习

### 练习一：日志收集

配置 Docker 的日志驱动，把所有容器的日志写入 `/var/log/myapp/` 目录。配置 logrotate 每天轮转，保留 7 天。

### 练习二：监控脚本

写一个 `scripts/monitor.sh`，每 5 分钟检查一次所有服务的健康状态。如果有服务不健康，发送通知（可以用 curl 调用 Slack Webhook 或企业微信机器人）。

### 练习三：零停机部署

修改部署脚本，实现零停机部署：先启动新版本容器，验证健康检查通过后，再停止旧版本容器。提示：用 Docker Compose 的 `--no-deps` 和 `--scale`。

---

## 参考答案

### 练习一

在 docker-compose.yml 中配置日志驱动：

```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

logrotate 配置 `/etc/logrotate.d/myapp`：

```
/var/log/myapp/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 root root
}
```

### 练习二

```bash
#!/bin/bash
# scripts/monitor.sh

SERVICES=("api" "frontend" "db" "redis")
WEBHOOK_URL="https://hooks.slack.com/services/..."

for service in "${SERVICES[@]}"; do
  status=$(docker compose ps --format json $service | jq -r '.State')
  if [ "$status" != "running" ]; then
    curl -X POST $WEBHOOK_URL \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"⚠️ Service $service is $status on $(hostname)\"}"
  fi
done
```

### 练习三

```bash
#!/bin/bash
# scripts/deploy-zero-downtime.sh

set -e
TAG=${1:-latest}

# 拉取新镜像
TAG=$TAG docker compose pull api

# 启动新版本（不停旧版本）
TAG=$TAG docker compose up -d --no-deps --scale api=2 api

# 等待新容器健康
sleep 15
NEW_CONTAINER=$(docker compose ps api --format json | jq -s 'sort_by(.CreatedAt) | last | .Name')

# 停止旧容器
docker compose up -d --no-deps --scale api=1 api

echo "Zero-downtime deploy completed"
```

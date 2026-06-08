# 第七课：阶段实战——VPS 部署全栈项目

> **课程定位**：综合运用第四阶段所有知识，完成 VPS 部署
> **前置知识**：VPS、Nginx、HTTPS、数据库（第 1-6 课）
> **预计时长**：90 分钟

---

## 学习目标

完成本课后，你将拥有一个部署在 VPS 上的全栈项目，具备：

1. 域名和 HTTPS
2. Nginx 反向代理
3. 数据库自动备份
4. 完整的部署文档

---

## 一、服务器准备

```bash
# 1. 连接服务器
ssh deploy@your-server-ip

# 2. 创建项目目录
sudo mkdir -p /opt/my-app
sudo chown deploy:deploy /opt/my-app

# 3. 克隆代码
cd /opt/my-app
git clone https://github.com/yourusername/yourrepo.git .

# 4. 配置环境变量
cp .env.example .env
vim .env  # 填入实际配置
```

---

## 二、docker-compose.prod.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

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
    networks:
      - app-network

  backup:
    image: alpine
    command: >
      sh -c "
        apk add --no-cache docker-cli gzip &&
        echo '0 2 * * * /scripts/backup-db.sh' > /etc/crontabs/root &&
        crond -f -l 8
      "
    volumes:
      - ./scripts:/scripts
      - /opt/backups:/backups
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  pgdata:
  redis-data:
```

---

## 三、Nginx 配置

```nginx
# nginx/conf.d/default.conf
upstream app {
    server app:3000;
}

server {
    listen 80;
    server_name my-app.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name my-app.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 四、部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "Starting deployment..."

# 拉取最新代码
git pull origin main

# 构建镜像
docker compose -f docker-compose.prod.yml build

# 运行迁移
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 重启服务
docker compose -f docker-compose.prod.yml up -d

# 健康检查
echo "Waiting for health check..."
sleep 10
curl -f https://my-app.com/health || exit 1

echo "Deployment completed!"
```

---

## 五、CI/CD 集成

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/my-app
            bash scripts/deploy.sh
```

---

## 六、验收清单

```
阶段四验收标准：

  ✅ 域名可访问
     https://my-app.com 可以正常访问

  ✅ HTTPS 正常
     浏览器显示安全锁图标

  ✅ API 健康检查通过
     curl https://my-app.com/health

  ✅ 数据库可备份和恢复
     运行备份脚本，测试恢复
```

---

## 七、部署文档

```markdown
# 部署文档

## 服务器信息
- IP: xxx.xxx.xxx.xxx
- OS: Ubuntu 22.04
- 用户: deploy

## 部署步骤
1. SSH 连接服务器
2. cd /opt/my-app
3. bash scripts/deploy.sh

## 回滚步骤
1. bash scripts/rollback.sh <version>

## 备份
- 自动备份：每天凌晨 2 点
- 备份位置：/opt/backups/postgres/
- 保留时间：7 天

## 故障排查
- 查看日志：docker compose logs -f
- 检查状态：docker compose ps
- 重启服务：docker compose restart
```

---

## 小结

本课综合运用了第四阶段的所有知识：

1. **VPS 配置**：系统初始化、Docker 安装、安全配置
2. **Nginx 反向代理**：HTTPS、多服务路由
3. **域名和证书**：DNS 配置、Let's Encrypt 证书
4. **数据库**：迁移、备份、恢复
5. **部署脚本**：自动化部署流程
6. **CI/CD 集成**：GitHub Actions 自动部署

你现在已经拥有一个部署在 VPS 上的全栈项目。下一阶段我们将学习生产稳定性——健康检查、监控、回滚等。

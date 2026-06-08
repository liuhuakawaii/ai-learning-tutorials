# 第6课：Docker 化部署

> **课程定位**：使用 Docker 容器化部署数据产品
> **前置知识**：第5课（权限和公开分享）
> **预计时长**：50 分钟

---

## 学习目标

1. 编写 Dockerfile
2. 使用 docker-compose 编排服务
3. 部署到生产环境

---

## 一、Dockerfile

### 1.1 API 服务

```dockerfile
# api/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 1.2 前端服务

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 二、Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: jobs_data
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # API 服务
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/jobs_data
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  # 前端
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 三、部署命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f api

# 停止服务
docker-compose down

# 备份数据库
docker exec db pg_dump -U postgres jobs_data > backup.sql
```

---

## 四、生产环境配置

### 4.1 环境变量

```yaml
# .env
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://host:6379
SECRET_KEY=your-secret-key
DEBUG=false
```

### 4.2 Nginx 配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 动手练习

### 练习一

为项目编写 Dockerfile。

### 练习二

编写 docker-compose.yml 编排所有服务。

---

## 小结

1. **Dockerfile**：构建镜像
2. **docker-compose**：编排多服务
3. **生产配置**：环境变量、Nginx

---

## 下一课预告

下一课是阶段实战，我们将实现**自动化数据产品上线**。

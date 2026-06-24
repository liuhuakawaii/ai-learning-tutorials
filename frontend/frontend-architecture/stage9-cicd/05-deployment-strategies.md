# 05. 部署策略

> 部署策略不是"把代码放到服务器上"，而是"如何安全、可靠地将变更交付给用户"

## 本课目标

- 理解不同部署策略的原理和适用场景
- 掌握蓝绿部署、金丝雀发布、滚动更新的实现
- 学会设计部署流程和回滚机制
- 了解容器化部署的基础知识

## 从一个真实场景说起

假设你在维护一个高流量的电商网站，遇到了这些问题：

1. **部署风险高**：每次部署都担心出问题，影响用户体验
2. **回滚困难**：出问题后，回滚要花很长时间
3. **停机时间长**：部署时需要停机，影响业务
4. **验证不足**：新功能上线后才发现问题

部署策略就是解决这些问题的方案。

## 部署策略对比

| 策略 | 停机时间 | 风险 | 成本 | 复杂度 | 适用场景 |
|------|----------|------|------|--------|----------|
| 直接部署 | 高 | 高 | 低 | 低 | 开发环境 |
| 蓝绿部署 | 无 | 低 | 高 | 中 | 生产环境 |
| 金丝雀发布 | 无 | 低 | 中 | 高 | 高流量应用 |
| 滚动更新 | 无 | 中 | 中 | 中 | Kubernetes |

## 直接部署

### 最简单的部署方式

```yaml
# 直接部署到服务器
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy to Server
        run: |
          rsync -avz dist/ user@server:/var/www/app/
          ssh user@server "cd /var/www/app && npm install && pm2 restart app"
```

### 优点和缺点

**优点**：
- 简单易懂
- 成本低
- 适合小项目

**缺点**：
- 有停机时间
- 风险高
- 回滚困难

## 蓝绿部署

### 原理

蓝绿部署维护两套完全相同的环境：
- **蓝色环境**：当前生产环境
- **绿色环境**：新版本环境

部署时，先将新版本部署到绿色环境，验证通过后，将流量切换到绿色环境。

### 实现

```yaml
# 蓝绿部署
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy to Green
        run: |
          # 部署到绿色环境
          rsync -avz dist/ user@server-green:/var/www/app/

      - name: Test Green Environment
        run: |
          # 测试绿色环境
          curl -f http://server-green/health || exit 1

      - name: Switch Traffic
        run: |
          # 切换流量到绿色环境
          ssh user@server-loadbalancer "nginx -s reload"

      - name: Update Blue Environment
        run: |
          # 更新蓝色环境（为下次部署准备）
          rsync -avz dist/ user@server-blue:/var/www/app/
```

### Nginx 配置

```nginx
# /etc/nginx/nginx.conf
http {
    upstream app {
        # 蓝色环境
        server server-blue:3000;
        # 绿色环境（当前激活）
        server server-green:3000;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://app;
        }
    }
}
```

### 切换脚本

```bash
#!/bin/bash
# switch.sh

# 当前激活的环境
CURRENT_ENV=$(cat /etc/nginx/current-env)

# 切换到另一个环境
if [ "$CURRENT_ENV" = "blue" ]; then
    NEW_ENV="green"
else
    NEW_ENV="blue"
fi

# 更新 Nginx 配置
sed -i "s/server server-$CURRENT_ENV/server server-$NEW_ENV/" /etc/nginx/nginx.conf

# 重载 Nginx
nginx -s reload

# 记录当前环境
echo "$NEW_ENV" > /etc/nginx/current-env

echo "Switched from $CURRENT_ENV to $NEW_ENV"
```

## 金丝雀发布

### 原理

金丝雀发布是将新版本逐步推送给少量用户，观察没有问题后再扩大范围。

### 实现

```yaml
# 金丝雀发布
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy Canary (10%)
        run: |
          # 部署到金丝雀环境
          rsync -avz dist/ user@server-canary:/var/www/app/

      - name: Configure Traffic Split
        run: |
          # 配置 10% 流量到金丝雀
          curl -X POST http://server-loadbalancer/api/split \
            -d '{"canary": 10, "stable": 90}'

      - name: Monitor Metrics
        run: |
          # 监控指标
          sleep 300  # 等待 5 分钟
          
          # 检查错误率
          ERROR_RATE=$(curl -s http://metrics-server/api/error-rate)
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate too high: $ERROR_RATE"
            exit 1
          fi

      - name: Increase Traffic
        run: |
          # 逐步增加流量
          for PERCENT in 25 50 75 100; do
            curl -X POST http://server-loadbalancer/api/split \
              -d "{\"canary\": $PERCENT, \"stable\": $((100 - PERCENT))}"
            sleep 60
          done
```

### Nginx 流量分割

```nginx
# /etc/nginx/nginx.conf
http {
    upstream stable {
        server server-stable:3000;
    }

    upstream canary {
        server server-canary:3000;
    }

    split_clients "${remote_addr}" $variant {
        10%    canary;
        *      stable;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://$variant;
        }
    }
}
```

### 流量分割 API

```javascript
// server.js
const express = require('express');
const fs = require('fs');
const app = express();

app.post('/api/split', (req, res) => {
  const { canary, stable } = req.body;
  
  // 更新 Nginx 配置
  const config = `
    split_clients "${'{remote_addr}'}" $variant {
      ${canary}%    canary;
      *      stable;
    }
  `;
  
  fs.writeFileSync('/etc/nginx/conf.d/split.conf', config);
  
  // 重载 Nginx
  require('child_process').exec('nginx -s reload');
  
  res.json({ success: true, canary, stable });
});

app.listen(3001);
```

## 滚动更新

### Kubernetes 滚动更新

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多多出 1 个 Pod
      maxUnavailable: 0  # 不允许不可用
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: my-app:latest
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### 更新命令

```bash
# 更新镜像
kubectl set image deployment/my-app my-app=my-app:v2

# 查看更新状态
kubectl rollout status deployment/my-app

# 查看历史
kubectl rollout history deployment/my-app

# 回滚
kubectl rollout undo deployment/my-app
```

### GitHub Actions 集成

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker Image
        run: |
          docker build -t my-app:${{ github.sha }} .
          
      - name: Push to Registry
        run: |
          docker push my-app:${{ github.sha }}
          
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/my-app my-app=my-app:${{ github.sha }}
          
      - name: Wait for Rollout
        run: |
          kubectl rollout status deployment/my-app --timeout=300s
```

## 容器化部署

### Docker 部署

```yaml
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

### 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Building Docker image..."
docker build -t my-app:${1:-latest} .

echo "Stopping old container..."
docker stop my-app || true
docker rm my-app || true

echo "Starting new container..."
docker run -d \
  --name my-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  my-app:${1:-latest}

echo "Waiting for health check..."
sleep 10

if curl -f http://localhost:3000/health; then
  echo "Deployment successful!"
else
  echo "Deployment failed!"
  docker logs my-app
  exit 1
fi
```

## 回滚机制

### 自动回滚

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy
        id: deploy
        run: |
          # 部署新版本
          rsync -avz dist/ user@server:/var/www/app/
          
          # 等待健康检查
          sleep 10
          
          # 检查健康状态
          if ! curl -f http://server/health; then
            echo "Health check failed, rolling back..."
            # 回滚到上一个版本
            rsync -avz backup/ user@server:/var/www/app/
            exit 1
          fi

      - name: Backup Current Version
        if: success()
        run: |
          # 备份当前版本
          ssh user@server "cp -r /var/www/app /var/www/backup"
```

### 手动回滚

```bash
#!/bin/bash
# rollback.sh

# 获取上一个版本
PREVIOUS_VERSION=$(git log --oneline -2 | tail -1 | cut -d' ' -f1)

echo "Rolling back to $PREVIOUS_VERSION..."

# 切换到上一个版本
git checkout $PREVIOUS_VERSION

# 重新部署
npm ci
npm run build
rsync -avz dist/ user@server:/var/www/app/

echo "Rollback complete!"
```

### Kubernetes 回滚

```bash
# 查看历史
kubectl rollout history deployment/my-app

# 回滚到上一个版本
kubectl rollout undo deployment/my-app

# 回滚到指定版本
kubectl rollout undo deployment/my-app --to-revision=2
```

## 部署监控

### 健康检查

```yaml
# 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION,
    uptime: process.uptime()
  });
});
```

### 部署状态追踪

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy
        run: |
          # 记录部署开始
          curl -X POST http://api-server/deployments \
            -d '{"status": "starting", "version": "${{ github.sha }}"}'
          
          # 执行部署
          npm run deploy
          
          # 记录部署成功
          curl -X POST http://api-server/deployments \
            -d '{"status": "success", "version": "${{ github.sha }}"}'
      
      - name: Notify on Failure
        if: failure()
        run: |
          curl -X POST http://api-server/deployments \
            -d '{"status": "failed", "version": "${{ github.sha }}"}'
```

## 本课小结

本课我们学习了部署策略：

1. **直接部署**：简单但有风险
2. **蓝绿部署**：零停机，低风险
3. **金丝雀发布**：逐步验证，最小风险
4. **滚动更新**：Kubernetes 原生支持
5. **容器化部署**：Docker + Docker Compose
6. **回滚机制**：自动回滚和手动回滚

## 练习

### 练习一：设计蓝绿部署

为你的项目设计一个蓝绿部署方案：
- 两套环境配置
- 流量切换脚本
- 健康检查机制

### 练习二：实现金丝雀发布

为你的项目实现金丝雀发布：
- 流量分割配置
- 监控指标收集
- 自动回滚机制

## 参考答案

### 练习一

```yaml
# 蓝绿部署工作流
name: Blue-Green Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy to environment'
        required: true
        default: 'green'
        type: choice
        options:
          - green
          - blue

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy to ${{ github.event.inputs.environment }}
        run: |
          TARGET=${{ github.event.inputs.environment }}
          rsync -avz dist/ user@server-$TARGET:/var/www/app/

      - name: Health Check
        run: |
          TARGET=${{ github.event.inputs.environment }}
          for i in {1..30}; do
            if curl -f http://server-$TARGET/health; then
              echo "Health check passed!"
              break
            fi
            echo "Waiting for health check... ($i/30)"
            sleep 2
          done

      - name: Switch Traffic
        run: |
          TARGET=${{ github.event.inputs.environment }}
          ssh user@loadbalancer "sed -i 's/server-blue/server-$TARGET/' /etc/nginx/nginx.conf && nginx -s reload"
```

### 练习二

```yaml
# 金丝雀发布工作流
name: Canary Deployment

on:
  workflow_dispatch:
    inputs:
      canary_percent:
        description: 'Canary percentage'
        required: true
        default: '10'
        type: choice
        options:
          - 10
          - 25
          - 50
          - 100

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      - name: Deploy Canary
        run: |
          rsync -avz dist/ user@server-canary:/var/www/app/

      - name: Configure Traffic Split
        run: |
          PERCENT=${{ github.event.inputs.canary_percent }}
          curl -X POST http://server-loadbalancer/api/split \
            -d "{\"canary\": $PERCENT, \"stable\": $((100 - PERCENT))}"

      - name: Monitor
        run: |
          PERCENT=${{ github.event.inputs.canary_percent }}
          
          if [ "$PERCENT" -eq "100" ]; then
            echo "Full deployment, skipping monitoring"
            exit 0
          fi
          
          # 监控 5 分钟
          for i in {1..10}; do
            ERROR_RATE=$(curl -s http://metrics-server/api/error-rate)
            echo "Error rate: $ERROR_RATE (check $i/10)"
            
            if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
              echo "Error rate too high, rolling back..."
              curl -X POST http://server-loadbalancer/api/split \
                -d '{"canary": 0, "stable": 100}'
              exit 1
            fi
            
            sleep 30
          done
```

## 下一步

完成本课后，继续学习 [06. 灰度发布实现](./06-canary-release-implementation.md)。
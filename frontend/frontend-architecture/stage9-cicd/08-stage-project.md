# 08. 阶段项目：搭建完整的 CI/CD 流水线

> 把前面学到的所有知识整合起来，搭建一个可投入生产使用的完整 CI/CD 流水线

## 本课目标

- 综合运用前 7 课的知识
- 搭建一个完整的企业级 CI/CD 流水线
- 实现代码质量检查、自动化测试、多环境部署
- 建立监控、通知、回滚机制

## 项目概述

### 项目目标

搭建一个完整的 CI/CD 流水线，支持：
- 代码提交触发自动构建和测试
- 多环境部署（开发、测试、生产）
- 灰度发布支持
- 自动化版本管理
- 构建产物缓存
- 部署状态通知

### 技术栈

- **CI/CD 平台**：GitHub Actions
- **代码质量**：ESLint、TypeScript、Prettier
- **测试框架**：Jest、Playwright
- **部署方式**：Docker + Kubernetes
- **监控**：Prometheus + Grafana
- **通知**：Slack、邮件

## 项目结构

```
my-project/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd.yml
│       ├── release.yml
│       └── rollback.yml
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── scripts/
│   ├── deploy.sh
│   ├── rollback.sh
│   └── generate-changelog.js
├── src/
├── tests/
├── package.json
└── README.md
```

## 实现步骤

### 第一步：CI 工作流

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # 代码质量检查
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run type-check

      - name: Format Check
        run: npx prettier --check .

  # 单元测试
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Run Unit Tests
        run: npm run test:unit -- --coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests

  # E2E 测试
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Build
        run: npm run build

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E Tests
        run: npm run test:e2e

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  # 安全扫描
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Run Security Audit
        run: npm audit --audit-level=high

  # 构建
  build:
    needs: [quality, unit-test, e2e-test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Build
        run: npm run build

      - name: Upload Build Artifact
        uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: dist/
          retention-days: 7
```

### 第二步：CD 工作流

```yaml
# .github/workflows/cd.yml
name: CD

on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed
    branches:
      - main
      - develop

jobs:
  # 部署到开发环境
  deploy-dev:
    if: ${{ github.event.workflow_run.conclusion == 'success' && github.ref == 'refs/heads/develop' }}
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v3

      - name: Download Build Artifact
        uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/

      - name: Build Docker Image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker tag my-app:${{ github.sha }} my-app:dev

      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push my-app:dev

      - name: Deploy to Dev
        run: |
          kubectl set image deployment/my-app my-app=my-app:dev --namespace=dev
          kubectl rollout status deployment/my-app --namespace=dev --timeout=300s

  # 部署到测试环境
  deploy-staging:
    if: ${{ github.event.workflow_run.conclusion == 'success' && github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3

      - name: Download Build Artifact
        uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/

      - name: Build Docker Image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker tag my-app:${{ github.sha }} my-app:staging

      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push my-app:staging

      - name: Deploy to Staging
        run: |
          kubectl set image deployment/my-app my-app=my-app:staging --namespace=staging
          kubectl rollout status deployment/my-app --namespace=staging --timeout=300s

      - name: Run Smoke Tests
        run: |
          # 运行冒烟测试
          npm run test:smoke -- --base-url=https://staging.example.com

  # 部署到生产环境
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Download Build Artifact
        uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/

      - name: Build Docker Image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker tag my-app:${{ github.sha }} my-app:production
          docker tag my-app:${{ github.sha }} my-app:latest

      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push my-app:production
          docker push my-app:latest

      - name: Deploy to Production (Canary)
        run: |
          # 金丝雀部署：10% 流量
          kubectl set image deployment/my-app-canary my-app=my-app:production --namespace=production
          kubectl rollout status deployment/my-app-canary --namespace=production --timeout=300s

      - name: Monitor Canary
        run: |
          # 监控 5 分钟
          for i in {1..10}; do
            ERROR_RATE=$(curl -s http://metrics-server/api/error-rate)
            echo "Error rate: $ERROR_RATE (check $i/10)"
            
            if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
              echo "Error rate too high, rolling back..."
              kubectl rollout undo deployment/my-app-canary --namespace=production
              exit 1
            fi
            
            sleep 30
          done

      - name: Full Deployment
        run: |
          # 全量部署
          kubectl set image deployment/my-app my-app=my-app:production --namespace=production
          kubectl rollout status deployment/my-app --namespace=production --timeout=300s

      - name: Notify
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Production deployment ${{ job.status }}!
            Version: ${{ github.sha }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 第三步：发布工作流

```yaml
# .github/workflows/release.yml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Version
        id: version
        run: |
          npm version ${{ github.event.inputs.version }}
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Generate Changelog
        id: changelog
        run: |
          CHANGELOG=$(node scripts/generate-changelog.js)
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGELOG" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Push
        run: |
          git push
          git push --tags

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ steps.version.outputs.version }}
          release_name: Release v${{ steps.version.outputs.version }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: false

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Notify
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Release v${{ steps.version.outputs.version }} published!
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 第四步：回滚工作流

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options:
          - dev
          - staging
          - production
      version:
        description: 'Version to rollback to (leave empty for previous)'
        required: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v3

      - name: Rollback
        run: |
          ENV=${{ github.event.inputs.environment }}
          VERSION=${{ github.event.inputs.version }}
          
          if [ -z "$VERSION" ]; then
            # 回滚到上一个版本
            kubectl rollout undo deployment/my-app --namespace=$ENV
          else
            # 回滚到指定版本
            kubectl rollout undo deployment/my-app --to-revision=$VERSION --namespace=$ENV
          fi
          
          kubectl rollout status deployment/my-app --namespace=$ENV --timeout=300s

      - name: Verify Rollback
        run: |
          ENV=${{ github.event.inputs.environment }}
          
          # 等待服务就绪
          sleep 30
          
          # 健康检查
          if [ "$ENV" = "production" ]; then
            URL="https://example.com/health"
          else
            URL="https://${ENV}.example.com/health"
          fi
          
          if ! curl -f $URL; then
            echo "Health check failed after rollback!"
            exit 1
          fi

      - name: Notify
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Rollback to ${{ github.event.inputs.version || 'previous' }} in ${{ github.event.inputs.environment }} completed!
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 第五步：Docker 配置

```dockerfile
# docker/Dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

### 第六步：Kubernetes 配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app
            port:
              number: 80
```

### 第七步：监控配置

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'my-app'
    static_configs:
      - targets: ['my-app:3000']
    metrics_path: /metrics
```

```yaml
# grafana/dashboards/my-app.json
{
  "dashboard": {
    "title": "My App Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

## 验收标准

### 功能验收

- [ ] 代码提交后 5 分钟内完成构建和测试
- [ ] 构建失败时能快速定位问题
- [ ] 支持多环境部署（dev/staging/production）
- [ ] 支持金丝雀发布
- [ ] 支持一键回滚
- [ ] 有完整的发布文档

### 质量验收

- [ ] 所有测试通过
- [ ] 代码质量检查通过
- [ ] 安全扫描通过
- [ ] 有监控和告警
- [ ] 有通知机制

## 下一步

完成本项目后，继续学习 [stage10：安全与合规](../stage10-security/README.md)。
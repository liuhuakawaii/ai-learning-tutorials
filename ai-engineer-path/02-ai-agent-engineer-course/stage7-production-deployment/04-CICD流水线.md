# 04 CI/CD 流水线

> 代码提交后自动测试、构建、部署——CI/CD 是团队效率的倍增器。

## 场景引入

团队三个人同时往 main 分支推代码，有人忘了跑测试就合并了，结果线上 API 直接 500。回滚时发现没有自动构建镜像，只能手动 SSH 到服务器用旧代码重新部署，折腾了一个小时。CI/CD 流水线的核心价值是：每一次代码变更都必须经过自动测试和构建，部署过程可重复、可追溯、可回滚。

## 学习目标

- 配置 GitHub Actions CI/CD
- 实现自动测试、构建、部署
- 管理多环境部署

## GitHub Actions 配置

```yaml
# .github/workflows/deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
        run: |
          cd backend
          pytest tests/ -v

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push Docker images
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker build -t myrepo/backend:${{ github.sha }} ./backend
          docker push myrepo/backend:${{ github.sha }}
          docker build -t myrepo/frontend:${{ github.sha }} ./frontend
          docker push myrepo/frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /app
            docker compose pull
            docker compose up -d
```

## 练习

### 练习 1：CI 流水线

配置 GitHub Actions：

1. 代码提交自动运行测试
2. 测试通过自动构建镜像
3. PR 自动检查

### 练习 2：CD 流水线

配置自动部署：

1. main 分支合并自动部署到生产
2. 环境变量和密钥管理
3. 部署回滚机制

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 测试环境和生产不一致 | 配置不同 | 用 Docker 统一环境 |
| 密钥泄露 | 提交到了代码 | 用 GitHub Secrets |
| 部署失败没有回滚 | 没有回滚机制 | 保留上一版本镜像 |

## 工程建议

CI 和 CD 应该分开配置——CI 在 PR 阶段运行，CD 仅在 main 分支合并后触发，避免未审核的代码直接部署。每次构建的 Docker 镜像用 Git SHA 打标签，方便精确回滚到任意版本。密钥轮换时同步更新 GitHub Secrets，切勿在 workflow 文件或日志中打印敏感信息。

## 本节要点

- CI = 代码提交后自动测试
- CD = 测试通过后自动部署
- GitHub Actions 是最流行的 CI/CD 平台
- 密钥要用 Secrets 管理，不要硬编码

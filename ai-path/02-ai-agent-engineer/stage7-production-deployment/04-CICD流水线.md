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

---

## 参考答案

### 练习 1

**思路**：CI 流水线的核心是"每次 PR 都必须通过自动测试"。用 GitHub Actions 配置测试 job，PR 阶段运行测试和 lint，main 分支合并后触发构建。测试环境用 Docker services 启动 PostgreSQL 和 Redis，和生产环境保持一致。

**答案**：

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install lint tools
        run: pip install ruff mypy

      - name: Run ruff
        run: ruff check backend/app/

      - name: Run mypy
        run: mypy backend/app/ --ignore-missing-imports

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-secret-key
        run: |
          cd backend
          pytest tests/ -v --cov=app --cov-report=xml --cov-report=term-missing

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/backend:${{ github.sha }}
            ${{ secrets.DOCKER_USERNAME }}/backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/frontend:${{ github.sha }}
            ${{ secrets.DOCKER_USERNAME }}/frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**要点**：
- CI 分三个 job（lint → test → build），lint 失败不会浪费测试时间
- PR 阶段只运行 lint + test，build 只在 main 分支 push 时触发——避免未审核的代码构建镜像
- 常见错误：测试 job 不配 healthcheck——PostgreSQL 还没初始化完成就开始跑测试，全部失败

### 练习 2

**思路**：CD 流水线的核心是"构建 → 部署 → 验证 → 回滚"。每次构建的镜像用 Git SHA 打标签，方便精确回滚。部署后自动验证健康检查，失败时自动回滚到上一版本。密钥通过 GitHub Secrets 管理，不写在代码里。

**答案**：

```yaml
# .github/workflows/cd.yml
name: CD Pipeline

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            set -e
            cd /app

            # 记录当前版本（用于回滚）
            CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' $(docker ps -q --filter name=backend) 2>/dev/null || echo "none")
            echo "$CURRENT_IMAGE" > /tmp/previous_image

            # 拉取新镜像
            export IMAGE_TAG=${{ github.sha }}
            docker compose pull backend frontend

            # 执行数据库迁移
            docker compose run --rm backend alembic upgrade head

            # 滚动更新
            docker compose up -d --no-deps --wait backend
            docker compose up -d --no-deps --wait frontend

            # 验证健康检查
            sleep 10
            for i in $(seq 1 5); do
              if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
                echo "健康检查通过"
                break
              fi
              echo "等待服务就绪... ($i/5)"
              sleep 5
            done

            # 最终验证
            if ! curl -sf http://localhost:8000/health > /dev/null 2>&1; then
              echo "健康检查失败，执行回滚"
              PREVIOUS=$(cat /tmp/previous_image)
              docker compose up -d --no-deps backend frontend
              exit 1
            fi

            # 清理旧镜像
            docker image prune -f

      - name: Notify success
        if: success()
        run: |
          curl -X POST "${{ secrets.WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d '{"text": "✅ 部署成功: ${{ github.sha }}"}'

      - name: Notify failure
        if: failure()
        run: |
          curl -X POST "${{ secrets.WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d '{"text": "❌ 部署失败并已回滚: ${{ github.sha }}"}'
```

```bash
# 手动回滚脚本（紧急情况用）
#!/bin/bash
# scripts/rollback.sh

if [ -z "${1:-}" ]; then
    echo "用法: $0 <镜像标签>"
    echo "可用版本:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | head -10
    exit 1
fi

TAG="$1"
cd /app

echo "回滚到版本: $TAG"
export IMAGE_TAG="$TAG"
docker compose pull backend frontend
docker compose up -d --no-deps backend frontend

sleep 10
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "回滚成功，服务正常"
else
    echo "回滚后服务异常，请人工介入"
fi
```

GitHub Secrets 配置清单：

| Secret 名称 | 说明 |
|---|---|
| DOCKER_USERNAME | Docker Hub 用户名 |
| DOCKER_PASSWORD | Docker Hub 密码 |
| SERVER_HOST | 服务器 IP |
| SERVER_USER | SSH 用户名 |
| SSH_KEY | SSH 私钥 |
| WEBHOOK_URL | 通知 Webhook（企业微信/钉钉） |

**要点**：
- 镜像用 Git SHA 打标签（不是 `latest`），回滚时指定具体 SHA 即可精确恢复
- 部署后必须验证健康检查——如果只 `docker compose up -d` 就认为成功，服务可能启动失败但 CI 显示成功
- 常见错误：部署前不记录当前版本——回滚时不知道该回滚到哪个镜像。必须在部署前保存当前版本号

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

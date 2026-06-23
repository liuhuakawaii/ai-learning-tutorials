# 阶段实战：Monorepo 完整 CI/CD 方案

> 把前四课的内容整合起来，为一个真实的 Monorepo 项目设计完整的 CI/CD 方案。覆盖路径过滤、增量构建、Docker 构建、多环境部署和监控。

## 项目结构

```
my-platform/
├── apps/
│   ├── web/                  # React 前端
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   ├── api/                  # Node.js API
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   └── worker/               # 后台任务处理
│       ├── Dockerfile
│       ├── package.json
│       └── src/
├── packages/
│   ├── ui/                   # 共享 UI 组件
│   ├── utils/                # 共享工具函数
│   ├── db/                   # 数据库 schema 和迁移
│   └── config/               # 共享配置
├── turbo.json
├── package.json
└── .github/
    └── workflows/
        ├── ci.yml            # 主 CI workflow
        ├── deploy.yml        # 部署 workflow
        └── reusable/
            ├── docker-build.yml
            └── deploy-service.yml
```

## 设计目标

1. 只改了某个 app 的代码，只跑那个 app 的 CI
2. 改了共享包，所有依赖它的 app 都要跑 CI
3. Docker 构建使用 BuildKit 缓存
4. Staging 自动部署，Production 审批后部署
5. 构建失败自动创建 Issue

## 主 CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: write
  issues: write

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ==================== 检测变化 ====================
  changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      api: ${{ steps.filter.outputs.api }}
      worker: ${{ steps.filter.outputs.worker }}
      packages-ui: ${{ steps.filter.outputs.packages-ui }}
      packages-utils: ${{ steps.filter.outputs.packages-utils }}
      packages-db: ${{ steps.filter.outputs.packages-db }}
      packages-config: ${{ steps.filter.outputs.packages-config }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
            api:
              - 'apps/api/**'
            worker:
              - 'apps/worker/**'
            packages-ui:
              - 'packages/ui/**'
            packages-utils:
              - 'packages/utils/**'
            packages-db:
              - 'packages/db/**'
            packages-config:
              - 'packages/config/**'

  # ==================== 共享检查 ====================
  shared-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run lint --filter='packages/*'
      - run: npx turbo run typecheck --filter='packages/*'

  # ==================== Web CI ====================
  web:
    needs: changes
    if: >-
      needs.changes.outputs.web == 'true' ||
      needs.changes.outputs.packages-ui == 'true' ||
      needs.changes.outputs.packages-utils == 'true' ||
      needs.changes.outputs.packages-config == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run lint test build --filter=apps/web...

  # ==================== API CI ====================
  api:
    needs: changes
    if: >-
      needs.changes.outputs.api == 'true' ||
      needs.changes.outputs.packages-utils == 'true' ||
      needs.changes.outputs.packages-db == 'true' ||
      needs.changes.outputs.packages-config == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run lint test build --filter=apps/api...

  # ==================== Worker CI ====================
  worker:
    needs: changes
    if: >-
      needs.changes.outputs.worker == 'true' ||
      needs.changes.outputs.packages-utils == 'true' ||
      needs.changes.outputs.packages-db == 'true' ||
      needs.changes.outputs.packages-config == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run lint test build --filter=apps/worker...
```

## 可重用 Docker 构建 Workflow

```yaml
# .github/workflows/reusable/docker-build.yml
name: Reusable Docker Build

on:
  workflow_call:
    inputs:
      service:
        type: string
        required: true
      push:
        type: boolean
        default: false
    outputs:
      image-tag:
        value: ${{ jobs.build.outputs.tag }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        if: inputs.push
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ inputs.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/${{ inputs.service }}/Dockerfile
          push: ${{ inputs.push }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ inputs.service }}
          cache-to: type=gha,scope=${{ inputs.service }},mode=max
```

## 可重用部署 Workflow

```yaml
# .github/workflows/reusable/deploy-service.yml
name: Reusable Deploy Service

on:
  workflow_call:
    inputs:
      service:
        type: string
        required: true
      environment:
        type: string
        required: true
      image-tag:
        type: string
        required: true
    secrets:
      kubeconfig:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.kubeconfig }}" | base64 -d > ~/.kube/config

      - name: Deploy
        run: |
          kubectl set image deployment/${{ inputs.service }} \
            app=${{ inputs.image-tag }} \
            -n ${{ inputs.environment }}
          kubectl rollout status deployment/${{ inputs.service }} \
            -n ${{ inputs.environment }} \
            --timeout=300s

      - name: Health check
        run: |
          SERVICE_URL=$(kubectl get svc ${{ inputs.service }} \
            -n ${{ inputs.environment }} \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          for i in $(seq 1 10); do
            if curl -sf "http://$SERVICE_URL/health"; then
              echo "Health check passed"
              exit 0
            fi
            sleep 10
          done
          echo "Health check failed"
          exit 1
```

## 部署 Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to deploy'
        type: choice
        options: [web, api, worker, all]
        default: all
      environment:
        description: 'Target environment'
        type: choice
        options: [staging, production]
        default: staging

concurrency:
  group: deploy-${{ github.event.inputs.environment || 'staging' }}
  cancel-in-progress: false

jobs:
  # ==================== 检测需要部署的服务 ====================
  detect:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.detect.outputs.services }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: detect
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            if [ "${{ github.event.inputs.service }}" = "all" ]; then
              echo 'services=["web","api","worker"]' >> "$GITHUB_OUTPUT"
            else
              echo 'services=["${{ github.event.inputs.service }}"]' >> "$GITHUB_OUTPUT"
            fi
          else
            CHANGED=$(git diff --name-only HEAD~1 | grep "^apps/" | cut -d/ -f2 | sort -u)
            SERVICES=$(echo "$CHANGED" | jq -R -s -c 'split("\n") | map(select(. != ""))')
            echo "services=$SERVICES" >> "$GITHUB_OUTPUT"
          fi

  # ==================== Docker 构建 ====================
  build-web:
    needs: detect
    if: contains(fromJSON(needs.detect.outputs.services), 'web')
    uses: ./.github/workflows/reusable/docker-build.yml
    with:
      service: web
      push: true

  build-api:
    needs: detect
    if: contains(fromJSON(needs.detect.outputs.services), 'api')
    uses: ./.github/workflows/reusable/docker-build.yml
    with:
      service: api
      push: true

  build-worker:
    needs: detect
    if: contains(fromJSON(needs.detect.outputs.services), 'worker')
    uses: ./.github/workflows/reusable/docker-build.yml
    with:
      service: worker
      push: true

  # ==================== Staging 部署 ====================
  deploy-staging-web:
    needs: [detect, build-web]
    if: contains(fromJSON(needs.detect.outputs.services), 'web')
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: web
      environment: staging
      image-tag: ${{ needs.build-web.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}

  deploy-staging-api:
    needs: [detect, build-api]
    if: contains(fromJSON(needs.detect.outputs.services), 'api')
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: api
      environment: staging
      image-tag: ${{ needs.build-api.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}

  deploy-staging-worker:
    needs: [detect, build-worker]
    if: contains(fromJSON(needs.detect.outputs.services), 'worker')
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: worker
      environment: staging
      image-tag: ${{ needs.build-worker.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}

  # ==================== Production 部署 ====================
  deploy-production-web:
    needs: [deploy-staging-web, build-web]
    if: github.event.inputs.environment == 'production'
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: web
      environment: production
      image-tag: ${{ needs.build-web.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.PRODUCTION_KUBECONFIG }}

  deploy-production-api:
    needs: [deploy-staging-api, build-api]
    if: github.event.inputs.environment == 'production'
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: api
      environment: production
      image-tag: ${{ needs.build-api.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.PRODUCTION_KUBECONFIG }}

  deploy-production-worker:
    needs: [deploy-staging-worker, build-worker]
    if: github.event.inputs.environment == 'production'
    uses: ./.github/workflows/reusable/deploy-service.yml
    with:
      service: worker
      environment: production
      image-tag: ${{ needs.build-worker.outputs.image-tag }}
    secrets:
      kubeconfig: ${{ secrets.PRODUCTION_KUBECONFIG }}
```

## 设计决策复盘

### 决策一：路径过滤 + Turborepo

路径过滤决定"要不要跑 CI"，Turborepo 决定"跑哪些包"。两者配合：
- 路径过滤在 GitHub 层面减少不必要的 workflow 触发
- Turborepo 在构建层面跳过没有变化的包

### 决策二：Docker 构建独立成可重用 Workflow

Docker 构建逻辑集中在一处，改缓存策略、标签策略时只改一个文件。每个服务的构建通过 `service` 参数区分。

### 决策三：Staging 先于 Production

Production 部署 `needs` Staging 部署。即使手动触发 production，也必须先过 staging。这避免了"直接部署到生产"的风险。

### 决策四：concurrency 不取消部署

部署的 `cancel-in-progress: false`。部署不能取消——取消可能导致部署不完整，处于中间状态。

## 练习

### 练习一：添加数据库迁移

在上面的方案基础上，添加数据库迁移步骤：
1. `packages/db` 有变化时，运行迁移
2. 迁移在部署前执行
3. 迁移失败时阻止部署
4. Production 迁移需要额外审批

---

## 参考答案

```yaml
  # 在 deploy workflow 中添加
  migrate-staging:
    needs: detect
    if: contains(fromJSON(needs.detect.outputs.services), 'api') || contains(fromJSON(needs.detect.outputs.services), 'worker')
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
        run: npx turbo run migrate --filter=packages/db

  migrate-production:
    needs: [migrate-staging]
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment: production  # 需要审批
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
        run: npx turbo run migrate --filter=packages/db

  # 修改 production 部署，依赖迁移完成
  deploy-production-api:
    needs: [migrate-production, build-api]
    # ...
```

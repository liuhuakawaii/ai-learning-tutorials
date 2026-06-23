# 阶段实战：跨仓库可重用 CI/CD 流水线

> 前面四课讲了矩阵、条件、可重用 Workflow 和复合 Action。现在把它们组合起来，为一个组织设计一套可复用的 CI/CD 基础设施。

## 场景

你在一个有 5 个 Node.js 微服务的组织里。每个仓库的 CI 几乎一样：lint → test → build → deploy。区别只在于：
- Node.js 版本可能不同
- 部署环境不同
- 有些需要 Docker 构建，有些不需要

目标：在 `shared-workflows` 仓库里维护一套可重用 workflow，各个服务仓库只需要一个很薄的调用文件。

## 共享仓库结构

```
shared-workflows/
├── .github/
│   └── workflows/
│       ├── ci.yml            # 可重用 CI workflow
│       ├── cd.yml            # 可重用 CD workflow
│       └── docker-build.yml  # 可重用 Docker 构建 workflow
└── actions/
    └── setup-project/
        └── action.yml        # 复合 Action：项目初始化
```

## 复合 Action：项目初始化

```yaml
# actions/setup-project/action.yml
name: 'Setup Project'
description: 'Checkout, setup Node.js, install dependencies, restore cache'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'
  package-manager:
    description: 'Package manager (npm/pnpm/yarn)'
    required: false
    default: 'npm'

runs:
  using: 'composite'
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: ${{ inputs.package-manager }}

    - name: Install dependencies
      shell: bash
      run: |
        case "${{ inputs.package-manager }}" in
          npm) npm ci ;;
          pnpm) pnpm install --frozen-lockfile ;;
          yarn) yarn install --frozen-lockfile ;;
        esac
```

## 可重用 CI Workflow

```yaml
# .github/workflows/ci.yml
name: Reusable CI

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
      package-manager:
        type: string
        default: 'npm'
      working-directory:
        type: string
        default: '.'
      run-docker-build:
        type: boolean
        default: false
      docker-image-name:
        type: string
        default: ''
    secrets:
      npm-token:
        required: false
    outputs:
      docker-image:
        description: 'Built Docker image tag'
        value: ${{ jobs.build.outputs.docker-image }}

jobs:
  lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    steps:
      - uses: actions/checkout@v4
      - uses: my-org/shared-workflows/actions/setup-project@v1
        with:
          node-version: ${{ inputs.node-version }}
          package-manager: ${{ inputs.package-manager }}
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    steps:
      - uses: actions/checkout@v4
      - uses: my-org/shared-workflows/actions/setup-project@v1
        with:
          node-version: ${{ inputs.node-version }}
          package-manager: ${{ inputs.package-manager }}
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    outputs:
      docker-image: ${{ steps.docker.outputs.image }}
    steps:
      - uses: actions/checkout@v4
      - uses: my-org/shared-workflows/actions/setup-project@v1
        with:
          node-version: ${{ inputs.node-version }}
          package-manager: ${{ inputs.package-manager }}
      - run: npm run build

      - name: Docker build
        id: docker
        if: inputs.run-docker-build
        run: |
          IMAGE="ghcr.io/${{ github.repository }}:${{ github.sha }}"
          docker build -t "$IMAGE" .
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"
```

## 可重用 CD Workflow

```yaml
# .github/workflows/cd.yml
name: Reusable CD

on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      docker-image:
        type: string
        required: false
      replicas:
        type: number
        default: 1
    secrets:
      deploy-key:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        env:
          DEPLOY_KEY: ${{ secrets.deploy-key }}
        run: |
          echo "Deploying to ${{ inputs.environment }}"
          echo "Image: ${{ inputs.docker-image }}"
          echo "Replicas: ${{ inputs.replicas }}"
          # 实际部署命令
          # kubectl set image deployment/app app=${{ inputs.docker-image }}
          # kubectl scale deployment/app --replicas=${{ inputs.replicas }}

      - name: Health check
        run: |
          echo "Checking health..."
          # curl -f https://${{ inputs.environment }}.example.com/health
```

## 服务仓库的调用文件

每个服务仓库只需要一个很薄的 workflow 文件：

```yaml
# services/api/.github/workflows/ci-cd.yml
name: API CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'services/api/**'
  pull_request:
    branches: [main]
    paths:
      - 'services/api/**'

jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/ci.yml@v1
    with:
      node-version: '20'
      working-directory: services/api
      run-docker-build: true
      docker-image-name: api
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}

  deploy-staging:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: ci
    uses: my-org/shared-workflows/.github/workflows/ci.yml@v1
    with:
      environment: staging
      docker-image: ${{ needs.ci.outputs.docker-image }}
      replicas: 1
    secrets:
      deploy-key: ${{ secrets.STAGING_DEPLOY_KEY }}

  deploy-production:
    if: github.event_name == 'workflow_dispatch'
    needs: ci
    uses: my-org/shared-workflows/.github/workflows/cd.yml@v1
    with:
      environment: production
      docker-image: ${{ needs.ci.outputs.docker-image }}
      replicas: 3
    secrets:
      deploy-key: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
```

## 设计决策复盘

### 决策一：为什么把 CI 和 CD 分开？

如果合在一个 workflow 里，每次代码改动都会触发部署。分开后，调用方可以自由决定什么时候部署——PR 时只跑 CI，push 到 main 时才跑 CD。

### 决策二：为什么用复合 Action 封装项目初始化？

每个 Job 都需要 checkout + setup node + install deps。这三步在 5 个服务 × 3 个 Job = 15 个地方重复。封装成复合 Action 后，改一处就行。

### 决策三：为什么用路径过滤？

Monorepo 里，改了 api 代码不应该触发 web 的 CI。`paths` 过滤避免不必要的构建。

### 决策四：为什么 secrets 不用 inherit？

`secrets: inherit` 方便但不安全。被调用的 workflow 能访问所有 secrets，即使它只需要一个。显式传递更清晰，也更容易审计。

## 你可能遇到的问题

### 问题：共享 workflow 更新后，服务仓库没有生效

因为调用方引用的是 `@v1` tag。你需要更新 tag 指向新的 commit：

```bash
git tag -f v1
git push -f origin v1
```

或者让每个服务仓库更新引用的 SHA/tag。

### 问题：跨仓库调用时报错 "workflow not found"

被调用的仓库必须是公开的，或者调用方有读权限。组织内部仓库需要确保 GitHub App 或 PAT 有权限访问。

### 问题：可重用 workflow 的输入太多，调用方很臃肿

把常用的输入组合封装成"预设"——不同的可重用 workflow 文件，内部调用同一个核心 workflow：

```yaml
# ci-node20.yml
uses: ./ci.yml
with:
  node-version: '20'

# ci-node18.yml
uses: ./ci.yml
with:
  node-version: '18'
```

## 练习

### 练习一：扩展可重用 Workflow

在上面的基础上，给 `ci.yml` 添加以下功能：
1. 支持矩阵测试（可选的 `test-matrix` 输入，格式为 JSON 字符串）
2. 如果提供了 `test-matrix`，用矩阵构建运行测试
3. 支持 `slack-webhook` secret，构建失败时发送 Slack 通知

---

## 参考答案

```yaml
# ci.yml 扩展部分
on:
  workflow_call:
    inputs:
      # ... 原有输入 ...
      test-matrix:
        type: string
        default: ''
    secrets:
      # ... 原有 secrets ...
      slack-webhook:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    strategy:
      matrix: ${{ fromJSON(inputs.test-matrix || '{"node-version":["20"]}') }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: my-org/shared-workflows/actions/setup-project@v1
        with:
          node-version: ${{ matrix.node-version }}
          package-manager: ${{ inputs.package-manager }}
      - run: npm test

  notify-failure:
    if: failure()
    needs: [lint, test, build]
    runs-on: ubuntu-latest
    steps:
      - name: Slack notification
        if: secrets.slack-webhook != ''
        run: |
          curl -s -X POST "${{ secrets.slack-webhook }}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"CI failed for ${{ github.repository }} on ${{ github.ref }}\"}"
```

调用方使用矩阵：

```yaml
ci:
  uses: my-org/shared-workflows/.github/workflows/ci.yml@v1
  with:
    test-matrix: '{"node-version":["18","20","22"]}'
  secrets:
    slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
```

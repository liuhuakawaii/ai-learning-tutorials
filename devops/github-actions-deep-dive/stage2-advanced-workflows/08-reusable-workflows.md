# 可重用 Workflow

> 你有 10 个微服务仓库，每个都要配置几乎相同的 CI 流水线。复制粘贴 10 份？改一个地方要改 10 次？可重用 Workflow 就是为了消灭这种重复。

## 可重用 Workflow 的基本结构

可重用 Workflow 通过 `workflow_call` 触发器暴露接口：

```yaml
# .github/workflows/reusable-ci.yml
name: Reusable CI

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: '20'
      runs-on:
        required: false
        type: string
        default: 'ubuntu-latest'
    secrets:
      deploy-key:
        required: false
    outputs:
      build-path:
        description: 'Build output path'
        value: ${{ jobs.build.outputs.path }}

jobs:
  test:
    runs-on: ${{ inputs.runs-on }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ${{ inputs.runs-on }}
    outputs:
      path: ${{ steps.build.outputs.path }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci && npm run build
      - id: build
        run: echo "path=dist" >> "$GITHUB_OUTPUT"
```

### 调用可重用 Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: owner/repo/.github/workflows/reusable-ci.yml@main
    with:
      node-version: '20'
    secrets:
      deploy-key: ${{ secrets.DEPLOY_KEY }}
```

注意：`uses` 引用的是完整的仓库路径 + 文件路径 + ref。同一个仓库内可以省略 `owner/repo`：

```yaml
uses: ./.github/workflows/reusable-ci.yml
```

## 输入参数

### 类型

支持的类型：`boolean`、`number`、`string`。没有数组或对象类型。

```yaml
inputs:
  environment:
    type: choice
    options:
      - staging
      - production
    default: staging
```

`choice` 类型在 `workflow_dispatch` 里提供下拉菜单，在 `workflow_call` 里当作 string 处理。

### 默认值

```yaml
inputs:
  node-version:
    required: false
    type: string
    default: '20'
```

调用方不传这个参数时，使用默认值。如果 `required: true` 且调用方没传，workflow 会报错。

## Secrets 传递

### 显式传递

```yaml
# 调用方
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    secrets:
      deploy-key: ${{ secrets.DEPLOY_KEY }}
```

### 透传所有 secrets

```yaml
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    secrets: inherit
```

`secrets: inherit` 把调用方的所有 secrets 传递给被调用的 workflow。方便但不够精确——被调用的 workflow 能访问所有 secrets，即使它只需要一两个。

## 输出

```yaml
# 被调用方
on:
  workflow_call:
    outputs:
      version:
        description: 'App version'
        value: ${{ jobs.prepare.outputs.version }}

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.get-version.outputs.version }}
    steps:
      - id: get-version
        run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"
```

```yaml
# 调用方
jobs:
  build:
    uses: ./.github/workflows/reusable-ci.yml

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
```

输出的传递链：Step 输出 → Job 输出 → workflow 输出 → 调用方引用。

## 跨仓库调用

```yaml
uses: my-org/shared-workflows/.github/workflows/node-ci.yml@v1
```

被调用的仓库必须是公开的，或者调用方有访问权限。`@v1` 是 Git tag 或分支名。

### 组织级共享 Workflow

把共享 workflow 放在组织的一个专用仓库里（比如 `my-org/shared-workflows`），所有仓库都引用它。更新 tag 就能全组织生效。

## 可重用 Workflow 的限制

1. **嵌套深度**：最多 4 层。A 调用 B 调用 C 调用 D 是可以的，但不能再深了
2. **不能调用自己**：不允许递归
3. **最多 20 个调用**：一个 workflow 最多调用 20 个可重用 workflow
4. **没有 workflow_dispatch**：可重用 workflow 不能同时有 `workflow_dispatch` 和 `workflow_call` 触发器（但可以用两个文件解决）
5. **环境变量不共享**：调用方的 `env` 不会传递给被调用方

## 组合模式

### 模式一：统一 CI

```yaml
# shared-workflows/.github/workflows/ci.yml
on:
  workflow_call:
    inputs:
      language:
        type: string
        required: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        if: inputs.language == 'node'
        with:
          node-version: '20'
      - uses: actions/setup-python@v5
        if: inputs.language == 'python'
        with:
          python-version: '3.12'
      - run: |
          if [ "${{ inputs.language }}" = "node" ]; then
            npm ci && npm test
          elif [ "${{ inputs.language }}" = "python" ]; then
            pip install -r requirements.txt && pytest
          fi
```

### 模式二：CI + CD 分离

```yaml
# CI workflow：测试和构建
uses: ./.github/workflows/reusable-ci.yml

# CD workflow：部署
uses: ./.github/workflows/reusable-cd.yml
with:
  environment: production
  artifact-name: build-output
```

CI 和 CD 各自是独立的可重用 workflow，调用方可以自由组合。

### 模式三：矩阵 + 可重用

```yaml
jobs:
  ci:
    strategy:
      matrix:
        service: [api, web, worker]
    uses: ./.github/workflows/reusable-ci.yml
    with:
      working-directory: services/${{ matrix.service }}
```

一个可重用 workflow，在 monorepo 的多个服务上分别执行。

## 练习

### 练习一：设计一个可重用的部署 Workflow

设计一个可重用 workflow `reusable-deploy.yml`，要求：
1. 接受 `environment`（staging/production）、`artifact-name`、`replicas` 三个输入
2. 接受一个 `deploy-key` secret
3. 从调用方下载指定的 artifact
4. 执行部署（可以是模拟的 echo 命令）
5. 输出 `deploy-url`

然后写一个调用方 workflow，在 push 到 main 时部署到 staging，手动触发时可选择部署到 production。

---

## 参考答案

### 可重用 Workflow

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      artifact-name:
        type: string
        required: true
      replicas:
        type: number
        required: false
        default: 1
    secrets:
      deploy-key:
        required: true
    outputs:
      deploy-url:
        description: 'Deployed app URL'
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: ${{ inputs.artifact-name }}
          path: dist/

      - id: deploy
        env:
          DEPLOY_KEY: ${{ secrets.deploy-key }}
        run: |
          echo "Deploying to ${{ inputs.environment }}"
          echo "Replicas: ${{ inputs.replicas }}"
          echo "Artifact: ${{ inputs.artifact-name }}"
          echo "Files:"
          ls -la dist/
          URL="https://${{ inputs.environment }}.example.com"
          echo "url=$URL" >> "$GITHUB_OUTPUT"
```

### 调用方

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      deploy-env:
        description: 'Deploy to'
        type: choice
        options: [staging, production]
        default: staging

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact: build-output
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  deploy-staging:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: build
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      artifact-name: ${{ needs.build.outputs.artifact }}
      replicas: 1
    secrets:
      deploy-key: ${{ secrets.STAGING_DEPLOY_KEY }}

  deploy-production:
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.deploy-env == 'production'
    needs: build
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      artifact-name: ${{ needs.build.outputs.artifact }}
      replicas: 3
    secrets:
      deploy-key: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
```

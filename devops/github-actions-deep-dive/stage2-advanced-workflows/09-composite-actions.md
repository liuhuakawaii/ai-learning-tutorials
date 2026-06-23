# 复合 Action

> 可重用 Workflow 是 Job 级别的复用。但有时候你想复用的是一组 Step——比如"安装 Node.js + 缓存 + 安装依赖"这个组合。复合 Action 就是 Step 级别的可重用单元。

## 复合 Action vs 可重用 Workflow

| | 复合 Action | 可重用 Workflow |
|---|---|---|
| 复用级别 | Step（步骤） | Job（作业） |
| 定义文件 | `action.yml` | `.github/workflows/*.yml` |
| 触发方式 | `uses: ./path/to/action` | `uses: ./.github/workflows/*.yml` |
| 能否有 `runs-on` | 否（继承调用者的 Runner） | 是 |
| 能否并行 | 否（是 Step 序列） | 是（多个 Job） |
| 适合场景 | 封装一组常用步骤 | 封装完整的 CI/CD 流程 |

## 基本结构

```yaml
# actions/setup-and-install/action.yml
name: 'Setup and Install'
description: 'Checkout, setup Node.js, and install dependencies'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'
  package-manager:
    description: 'Package manager'
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
        if [ "${{ inputs.package-manager }}" = "npm" ]; then
          npm ci
        elif [ "${{ inputs.package-manager }}" = "pnpm" ]; then
          pnpm install --frozen-lockfile
        fi
```

### 使用

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/setup-and-install
        with:
          node-version: '20'
      - run: npm test
```

注意：复合 Action 里的 `shell` 是必须的。因为复合 Action 在调用者的 shell 环境里执行，必须指定用哪个 shell。

## 复合 Action 的能力

### 条件执行

```yaml
runs:
  using: 'composite'
  steps:
    - name: Cache Docker layers
      if: inputs.use-docker-cache == 'true'
      shell: bash
      run: echo "Setting up Docker cache"
```

### 设置环境变量

```yaml
steps:
  - name: Set env
    shell: bash
    run: echo "MY_VAR=hello" >> "$GITHUB_ENV"
```

复合 Action 设置的环境变量在后续 Step 中可用（包括调用者的后续 Step）。

### 设置输出

```yaml
outputs:
  version:
    description: 'Detected version'
    value: ${{ steps.detect.outputs.version }}

runs:
  using: 'composite'
  steps:
    - id: detect
      shell: bash
      run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"
```

### 后置步骤（post）

```yaml
runs:
  using: 'composite'
  steps:
    - name: Setup
      shell: bash
      run: echo "Setting up..."

    - name: Cleanup
      if: always()
      shell: bash
      run: echo "Cleaning up..."
```

`if: always()` 让清理步骤无论如何都执行。但复合 Action 没有原生的 post-step 机制（JavaScript Action 有 `post` 字段），需要手动用 `if: always()` 实现。

## 实际场景：统一代码检查

```yaml
# actions/lint-check/action.yml
name: 'Lint Check'
description: 'Run linting with configurable rules'

inputs:
  eslint-config:
    description: 'ESLint config file'
    required: false
    default: '.eslintrc.js'
  fail-on-warning:
    description: 'Fail on warnings'
    required: false
    default: 'false'

runs:
  using: 'composite'
  steps:
    - name: Run ESLint
      shell: bash
      run: |
        ARGS="--config ${{ inputs.eslint-config }}"
        if [ "${{ inputs.fail-on-warning }}" = "true" ]; then
          ARGS="$ARGS --max-warnings 0"
        fi
        npx eslint src/ $ARGS

    - name: Run Prettier check
      shell: bash
      run: npx prettier --check src/
```

调用方：

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./actions/setup-and-install
  - uses: ./actions/lint-check
    with:
      fail-on-warning: 'true'
```

## 实际场景：Docker 构建封装

```yaml
# actions/docker-build/action.yml
name: 'Docker Build'
description: 'Build and optionally push Docker image'

inputs:
  image-name:
    description: 'Docker image name'
    required: true
  push:
    description: 'Push to registry'
    required: false
    default: 'false'
  registry:
    description: 'Container registry'
    required: false
    default: 'ghcr.io'

runs:
  using: 'composite'
  steps:
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to registry
      if: inputs.push == 'true'
      uses: docker/login-action@v3
      with:
        registry: ${{ inputs.registry }}
        username: ${{ github.actor }}
        password: ${{ github.token }}

    - name: Build image
      shell: bash
      run: |
        TAG="${{ inputs.registry }}/${{ inputs.image-name }}:${{ github.sha }}"
        docker build -t "$TAG" .
        if [ "${{ inputs.push }}" = "true" ]; then
          docker push "$TAG"
        fi
```

## 复合 Action 的限制

1. **不能用 `uses` 调用 Docker Action**：复合 Action 里的 `uses` 只能调用 JavaScript Action 或另一个复合 Action
2. **没有原生 post-step**：需要手动用 `if: always()` 模拟
3. **不能设置 `runs-on`**：复合 Action 在调用者的 Runner 上执行
4. **shell 必须指定**：每个 `run` Step 都必须有 `shell` 字段
5. **路径是相对于仓库根目录**：`uses: ./actions/my-action` 是相对于仓库根目录的路径

## 版本管理

复合 Action 和普通 Action 一样，可以用 Git tag 管理版本：

```yaml
uses: my-org/shared-actions/setup-and-install@v1
```

在组织内部共享时，推荐：
- 用语义化版本 tag（`v1`, `v1.1`, `v1.1.1`）
- 主版本 tag（`v1`）指向最新的兼容版本
- 调用方引用主版本 tag，自动获取兼容更新

## 练习

### 练习一：创建一个通知复合 Action

创建一个复合 Action `actions/notify`，功能：
1. 接受 `channel`（slack/email/webhook）、`message`、`webhook-url` 输入
2. 根据 channel 类型发送通知
3. 如果发送失败，输出错误但不阻塞 workflow（用 `continue-on-error`）
4. 输出 `sent`（true/false）表示是否发送成功

---

## 参考答案

```yaml
# actions/notify/action.yml
name: 'Notify'
description: 'Send notification to various channels'

inputs:
  channel:
    description: 'Notification channel: slack, email, webhook'
    required: true
  message:
    description: 'Notification message'
    required: true
  webhook-url:
    description: 'Webhook URL for slack/webhook channels'
    required: false
  email-to:
    description: 'Email recipient'
    required: false

outputs:
  sent:
    description: 'Whether notification was sent'
    value: ${{ steps.send.outputs.sent }}

runs:
  using: 'composite'
  steps:
    - id: send
      continue-on-error: true
      shell: bash
      run: |
        SENT="false"

        case "${{ inputs.channel }}" in
          slack)
            if [ -z "${{ inputs.webhook-url }}" ]; then
              echo "::error::webhook-url is required for slack channel"
              exit 1
            fi
            curl -s -X POST "${{ inputs.webhook-url }}" \
              -H 'Content-Type: application/json' \
              -d "{\"text\": \"${{ inputs.message }}\"}"
            SENT="true"
            ;;
          webhook)
            if [ -z "${{ inputs.webhook-url }}" ]; then
              echo "::error::webhook-url is required for webhook channel"
              exit 1
            fi
            curl -s -X POST "${{ inputs.webhook-url }}" \
              -H 'Content-Type: application/json' \
              -d "{\"message\": \"${{ inputs.message }}\"}"
            SENT="true"
            ;;
          email)
            echo "Sending email to ${{ inputs.email-to }}"
            echo "Subject: CI Notification"
            echo "Body: ${{ inputs.message }}"
            SENT="true"
            ;;
          *)
            echo "::error::Unknown channel: ${{ inputs.channel }}"
            exit 1
            ;;
        esac

        echo "sent=$SENT" >> "$GITHUB_OUTPUT"
```

使用示例：

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh

      - name: Notify success
        uses: ./actions/notify
        with:
          channel: slack
          message: "Deploy to production succeeded!"
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Notify failure
        if: failure()
        uses: ./actions/notify
        with:
          channel: webhook
          message: "Deploy failed!"
          webhook-url: ${{ secrets.ALERT_WEBHOOK }}
```

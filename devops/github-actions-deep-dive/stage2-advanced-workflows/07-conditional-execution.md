# 条件执行

> 不是每个 Step 都应该每次都跑。PR 时跑测试，合并后才部署；只在 main 分支上发 Docker 镜像；标签推送时才发布到 npm。条件执行让你精确控制"什么时候做什么"。

## if 表达式

### 基础条件

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main'
  run: ./deploy.sh
```

`if` 表达式求值为 `true` 时执行 Step，否则跳过。注意：跳过的 Step 在 UI 里显示为灰色，不算失败。

### 事件类型判断

```yaml
if: github.event_name == 'push'
if: github.event_name == 'pull_request'
if: github.event_name == 'schedule'
```

最常见的用法：PR 时只检查，push 到 main 时才部署。

### 组合条件

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
if: github.event_name == 'pull_request' || github.event_name == 'push'
if: !(github.event_name == 'schedule')
```

逻辑运算符：`&&`（与）、`||`（或）、`!`（非）。

### 函数

`contains()`：
```yaml
if: contains(github.event.head_commit.message, '[skip ci]')
```

`startsWith()`：
```yaml
if: startsWith(github.ref, 'refs/tags/v')
```

`success()`（默认值）、`failure()`、`always()`、`cancelled()`：

```yaml
# 前面的 Step 失败时才执行
if: failure()

# 无论如何都执行
if: always()

# 只有前面成功时才执行（默认行为，通常不需要写）
if: success()
```

### 检查文件变化

```yaml
- id: check-changes
  uses: dorny/paths-filter@v3
  with:
    filters: |
      frontend:
        - 'apps/frontend/**'
      backend:
        - 'apps/backend/**'

- if: steps.check-changes.outputs.frontend == 'true'
  run: echo "Frontend changed"

- if: steps.check-changes.outputs.backend == 'true'
  run: echo "Backend changed"
```

`dorny/paths-filter` 是一个社区 Action，专门用来检测哪些目录有变化。在 monorepo 里特别有用。

## continue-on-error

```yaml
- name: Lint
  continue-on-error: true
  run: npm run lint

- name: Test
  run: npm test
```

`continue-on-error: true` 让 Step 失败时不阻塞后续 Step 和整个 Job。在 UI 里，这个 Step 会显示为黄色警告而不是红色失败。

### Job 级别的 continue-on-error

```yaml
jobs:
  experimental:
    continue-on-error: true
    runs-on: ubuntu-latest
    steps: [...]
```

整个 Job 失败了也不影响 workflow 的最终结果。适合"试一试"类型的检查。

### 矩阵中的 continue-on-error

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    include:
      - node-version: 22
        experimental: true
```

配合 Job 级别的条件：

```yaml
continue-on-error: ${{ matrix.experimental == true }}
```

这样 Node 22 失败了不会影响整体结果，但 18 和 20 失败了会。

## fail-fast

在矩阵构建中（第 6 课），`fail-fast` 控制一个 Job 失败时是否取消其他 Job：

```yaml
strategy:
  fail-fast: true   # 默认值
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```

如果 Ubuntu 上的测试失败了，Windows 和 macOS 的 Job 会被取消。

设为 `false` 时，所有 Job 都会跑完，不管其他 Job 的结果。在你想要"看到所有失败"的场景下有用。

## 条件执行的组合模式

### 模式一：PR 检查 + main 部署

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
```

### 模式二：标签推送发布

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 模式三：安全扫描失败但不阻塞

```yaml
jobs:
  security:
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - run: npm audit --audit-level=high

  build:
    needs: [test, security]
    if: always() && needs.test.result == 'success'
    runs-on: ubuntu-latest
    steps: [...]
```

`always()` 确保 `build` 无论如何都会被评估（否则 `needs` 中有失败的 Job 时，整个 Job 会被跳过）。然后用 `needs.test.result == 'success'` 确保测试通过了。

## 一个真实的条件问题

某团队的部署 workflow 在 PR 时也会触发，导致部署到 staging 环境。他们的条件写的是：

```yaml
if: github.ref == 'refs/heads/main'
```

问题在于：`pull_request` 事件的 `github.ref` 是 `refs/pull/<number>/merge`，不是目标分支。所以这个条件在 PR 时是 `false`，但他们的 deploy Job 仍然执行了。

原因是：deploy Job 没有 `if` 条件，`if` 只加在了 Step 上。Job 级别没有条件，Job 会启动，只是 Step 被跳过。如果 Job 里没有任何 Step 执行（全部被 `if` 跳过），Job 仍然算成功。

解决方案：把 `if` 放在 Job 级别：

```yaml
deploy:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps: [...]
```

## 练习

### 练习一：设计一个多条件部署

设计一个 workflow，满足以下条件：
1. PR 时：运行 lint 和 test
2. push 到 main 时：运行 lint、test，然后部署到 staging
3. 手动触发（workflow_dispatch）时：可以选择部署到 staging 或 production
4. 标签推送（v*）时：运行 test，然后发布到 npm

---

## 参考答案

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      deploy-target:
        description: 'Deploy target'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  deploy-staging:
    if: >-
      (github.ref == 'refs/heads/main' && github.event_name == 'push') ||
      (github.event_name == 'workflow_dispatch' && github.event.inputs.deploy-target == 'staging')
    needs: [lint, test]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh staging

  deploy-production:
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.deploy-target == 'production'
    needs: [lint, test]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh production

  publish:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci && npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**要点**：
- `>-` 是 YAML 的多行字符串折叠语法，把多行合并成一行
- `workflow_dispatch` 的输入通过 `github.event.inputs.*` 访问
- `environment` 关键字关联 GitHub 的环境保护规则
- `needs` 确保部署前测试通过

# Workflow 语法深度

> 你大概已经写过不少 `.github/workflows/*.yml`，但有没有想过：为什么有时候 `on: push` 不触发？为什么 Job 之间的顺序和你写的不一样？为什么 Step 里的 `run` 和 `uses` 行为差异那么大？

## 一个真实的困惑

新人最常见的问题："我 push 了代码，但 Actions 没跑。" 排查半小时后发现，push 到的是 `main` 分支，但 workflow 里写的是 `branches: [master]`。

这个问题的本质不是粗心，而是没有理解触发条件的完整语义。

## 触发条件的完整语义

`on` 字段不只是"什么时候跑"，它决定了整个 workflow 的执行上下文。

### push vs pull_request

这两个是最常用的触发器，但它们的行为差异很大：

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

`push` 触发时，`github.sha` 是推送的 commit，`github.ref` 是目标分支。`pull_request` 触发时，`github.sha` 是 PR 的合并 commit（merge commit），`github.ref` 是 `refs/pull/<number>/merge`。

这意味着同一个 commit，在两种触发器下看到的代码快照可能不同。`pull_request` 看到的是"如果合并后的代码"，而不是 PR 分支的最新 commit。

### 事件过滤的粒度

触发器可以精确到分支、路径、标签：

```yaml
on:
  push:
    branches:
      - main
      - 'release/**'
    paths:
      - 'src/**'
      - '!src/**/*.test.ts'
    tags:
      - 'v*'
```

`paths` 过滤用的是 glob 模式。注意 `!` 前缀表示排除。但这里有个坑：如果一次 push 里既有 `src/app.ts` 的改动，又有 `docs/README.md` 的改动，`paths: ['src/**']` 仍然会触发，因为只要有任何一个文件匹配就行。

### workflow_dispatch 和 workflow_call

手动触发和被其他 workflow 调用，这两个触发器经常被忽略，但它们在实际项目中非常有用：

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: '部署环境'
        required: true
        type: choice
        options:
          - staging
          - production
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
    secrets:
      deploy-key:
        required: true
```

`workflow_dispatch` 让你在 GitHub 界面上手动触发，适合部署、数据迁移等操作类任务。`workflow_call` 让一个 workflow 被另一个 workflow 调用，这是实现可重用 workflow 的基础（第 8 课会深入）。

## Job 的执行模型

Job 是 workflow 的调度单元。理解 Job 的执行模型，才能控制流水线的并行度和依赖关系。

### 默认行为：并行

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
  build:
    runs-on: ubuntu-latest
    steps: [...]
```

这三个 Job 默认会同时开始执行。如果你的 build 依赖 test 通过，lint 和 test 可以并行，需要显式声明依赖：

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps: [...]
```

`needs` 表示"等这些 Job 都成功了再开始"。注意是"都成功"——如果 lint 失败，build 不会执行，即使 test 通过了。

### Job 之间的数据传递

Job 运行在不同的 Runner 上，它们之间不能直接共享文件。传递数据有两种方式：

1. **Artifacts**：上传/下载文件（第 4 课详细讲）
2. **Outputs**：传递文本数据

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.get-version.outputs.version }}
    steps:
      - id: get-version
        run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"
  deploy:
    needs: prepare
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying version ${{ needs.prepare.outputs.version }}"
```

`$GITHUB_OUTPUT` 是 GitHub Actions 的输出机制。每个 Step 可以通过它向后续 Step 或 Job 传递键值对。

## Step 的两种形态

Step 里有两种写法：`run` 和 `uses`。它们不只是语法不同，执行机制也不同。

### run：Shell 执行

```yaml
- run: npm test
  working-directory: ./packages/app
  env:
    NODE_ENV: test
```

`run` 会在 Shell 里执行命令。默认 Shell 在 Ubuntu/macOS 上是 `bash`，在 Windows 上是 `PowerShell`。你可以显式指定：

```yaml
- run: npm test
  shell: bash
```

每个 `run` Step 都是一个独立的 Shell 进程。这意味着上一个 Step 里 `cd` 到的目录、`export` 的环境变量，不会带到下一个 Step。要跨 Step 共享数据，用 `$GITHUB_ENV` 和 `$GITHUB_OUTPUT`。

### uses：Action 执行

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
```

`uses` 调用一个 Action。Action 可以是 JavaScript Action、Docker Action 或 Composite Action。`with` 是传给 Action 的输入参数。

Action 的版本用 Git tag 或 SHA 引用。用 tag（如 `@v4`）方便但有安全风险——tag 可以被重新指向不同的 commit。在安全敏感的场景下，应该用完整的 SHA：

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
```

### Step 的生命周期钩子

每个 Step 可以有 `if` 条件和 `continue-on-error`：

```yaml
- name: Upload coverage
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/
```

`if: always()` 表示无论前面的 Step 成功还是失败都执行。这在上传测试报告、清理资源时很有用。

## 一个常见的调试场景

Workflow 跑完了，但结果不是你预期的。这时候你需要理解的是：每一步到底执行了什么、环境变量是什么、工作目录在哪里。

GitHub Actions 提供了 [step debug logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)，通过设置 secret `ACTIONS_STEP_DEBUG` 为 `true` 来开启。开启后，每个 Step 的详细执行日志会显示在 workflow run 页面。

## 练习

### 练习一：修复一个有问题的 Workflow

下面这个 workflow 有几个问题，找出它们并修复：

```yaml
name: Broken CI
on:
  push:
    branches: main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test

  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ github.sha }}"
      - run: ./deploy.sh
```

提示：至少有 3 个问题。

---

## 参考答案

### 练习一

**问题 1**：`test` Job 没有 `actions/checkout`。没有 checkout，Runner 上没有代码，`npm install` 和 `npm test` 会失败。

**问题 2**：`deploy` Job 没有 `needs: test`。两个 Job 会并行执行，deploy 不会等 test 通过。

**问题 3**：`deploy` Job 也没有 `actions/checkout`，`deploy.sh` 不存在于 Runner 上。

**修复后的 workflow**：

```yaml
name: Fixed CI
on:
  push:
    branches: main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploying ${{ github.sha }}"
      - run: ./deploy.sh
```

**常见错误**：只加 `needs` 不加 checkout，或者把 `npm install` 改成 `npm ci` 但没注意 `package-lock.json` 是否存在。

# 02. GitHub Actions 基础

> GitHub Actions 不只是"CI/CD 工具"，而是"GitHub 生态的自动化引擎"

## 本课目标

- 掌握 GitHub Actions 的核心概念
- 学会编写 Workflow 配置文件
- 理解 Job、Step、Action 的关系
- 掌握触发器和环境变量的使用

## 从一个真实场景说起

假设你在 GitHub 上维护一个开源项目，遇到了这些问题：

1. **代码质量参差不齐**：有人提交的代码没有通过 lint
2. **测试覆盖不足**：有些功能没有测试
3. **发布流程混乱**：每次发布都要手动操作
4. **贡献者体验差**：新人不知道如何参与

GitHub Actions 可以解决这些问题。

## 核心概念

### Workflow（工作流）

Workflow 是一个自动化流程，由一个或多个 Job 组成。

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
```

**关键点**：
- 一个仓库可以有多个 Workflow
- 每个 Workflow 由一个 YAML 文件定义
- 文件放在 `.github/workflows/` 目录下

### Job（任务）

Job 是 Workflow 中的一个独立执行单元。

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test
```

**关键点**：
- 默认情况下，多个 Job 并行执行
- 可以使用 `needs` 定义依赖关系
- 每个 Job 运行在独立的虚拟机上

### Step（步骤）

Step 是 Job 中的一个执行步骤。

```yaml
steps:
  - uses: actions/checkout@v3
  - run: npm ci
  - run: npm test
```

**关键点**：
- Step 有两种类型：`run`（执行命令）和 `uses`（使用 Action）
- 同一个 Job 中的 Step 共享环境
- Step 按顺序执行

### Action（动作）

Action 是可重用的工作流组件。

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v3
    with:
      node-version: '18'
  - run: npm ci
```

**关键点**：
- Action 可以从 GitHub Marketplace 获取
- 可以使用官方 Action 或社区 Action
- 可以创建自己的 Action

## 触发器（Triggers）

### 常用触发器

```yaml
# 推送触发
on: push

# 拉取请求触发
on: pull_request

# 定时触发
on:
  schedule:
    - cron: '0 0 * * *'  # 每天午夜

# 手动触发
on:
  workflow_dispatch:
    inputs:
      environment:
        description: '部署环境'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
```

### 条件触发

```yaml
# 只在特定分支推送时触发
on:
  push:
    branches:
      - main
      - develop

# 只在特定路径文件变更时触发
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'

# 排除特定路径
on:
  push:
    paths-ignore:
      - 'docs/**'
      - '*.md'
```

### 多事件触发

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # 每周一
```

## 环境变量

### 内置环境变量

```yaml
steps:
  - run: echo "提交者：$GITHUB_ACTOR"
  - run: echo "分支：$GITHUB_REF"
  - run: echo "仓库：$GITHUB_REPOSITORY"
  - run: echo "SHA：$GITHUB_SHA"
```

### 自定义环境变量

```yaml
env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      APP_NAME: my-app
    steps:
      - run: echo "构建 $APP_NAME"
      - run: echo "Node 版本 $NODE_VERSION"
```

### Secrets

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo "部署到 ${{ secrets.DEPLOY_TOKEN }}"
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

## 运行器（Runners）

### GitHub 托管运行器

```yaml
jobs:
  build:
    runs-on: ubuntu-latest  # Ubuntu 最新版
    # runs-on: ubuntu-22.04  # 指定版本
    # runs-on: windows-latest  # Windows
    # runs-on: macos-latest  # macOS
```

**可用运行器**：
- `ubuntu-latest` / `ubuntu-22.04` / `ubuntu-20.04`
- `windows-latest` / `windows-2022` / `windows-2019`
- `macos-latest` / `macos-13` / `macos-12`

### 自托管运行器

```yaml
jobs:
  build:
    runs-on: self-hosted  # 自托管运行器
```

**适用场景**：
- 需要特殊硬件（GPU、大内存）
- 需要访问内部网络
- 需要自定义环境

## 缓存

### npm 缓存

```yaml
steps:
  - uses: actions/setup-node@v3
    with:
      node-version: '18'
      cache: 'npm'

  - run: npm ci
```

### 手动缓存

```yaml
steps:
  - uses: actions/cache@v3
    with:
      path: ~/.npm
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      restore-keys: |
        ${{ runner.os }}-node-

  - run: npm ci
```

### 多层缓存

```yaml
steps:
  - uses: actions/cache@v3
    with:
      path: |
        ~/.npm
        node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

## 矩阵策略（Matrix）

### 基础用法

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [14, 16, 18]
    steps:
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### 多维度矩阵

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [16, 18]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### 排除特定组合

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [16, 18]
    exclude:
      - os: windows-latest
        node-version: 16
```

## 作业依赖

### 顺序执行

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    needs: lint  # 依赖 lint 任务
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  build:
    needs: test  # 依赖 test 任务
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

### 并行执行

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  build:
    needs: [lint, test]  # 等待 lint 和 test 都完成
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

## 实战示例

### Node.js 项目 CI

```yaml
name: Node.js CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16, 18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - run: npm ci

      - run: npm run lint

      - run: npm run type-check

      - run: npm test

      - run: npm run build
```

### 多环境部署

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build
          path: dist/
      - run: npm run deploy:staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build
          path: dist/
      - run: npm run deploy:production
```

## 调试技巧

### 启用调试日志

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### 查看环境变量

```yaml
steps:
  - run: env
  - run: echo "${{ toJson(github) }}"
```

### 条件执行

```yaml
steps:
  - run: echo "这是生产环境"
    if: github.ref == 'refs/heads/main'
```

## 本课小结

本课我们学习了 GitHub Actions 的基础知识：

1. **核心概念**：Workflow、Job、Step、Action
2. **触发器**：push、pull_request、schedule、workflow_dispatch
3. **环境变量**：内置变量、自定义变量、Secrets
4. **运行器**：GitHub 托管、自托管
5. **缓存**：npm 缓存、手动缓存
6. **矩阵策略**：多版本、多平台测试

## 练习

### 练习一：编写基础 CI

为你当前项目编写一个基础的 CI 流水线：
- 代码 lint 检查
- 单元测试
- 构建验证

### 练习二：添加缓存

为你的 CI 流水线添加缓存支持：
- npm 依赖缓存
- 构建产物缓存

## 参考答案

### 练习一

```yaml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

### 练习二

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - uses: actions/cache@v3
        id: cache-build
        with:
          path: dist
          key: build-${{ hashFiles('src/**', 'package-lock.json') }}

      - run: npm run build
        if: steps.cache-build.outputs.cache-hit != 'true'

      - uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: dist/
```

## 下一步

完成本课后，继续学习 [03. 构建流水线设计](./03-build-pipeline-design.md)。
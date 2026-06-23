# 阶段实战：为 Node.js 项目设计完整 CI 流水线

> 前四课讲了语法、环境、上下文和缓存。现在把它们组合起来，为一个真实的 Node.js 项目设计 CI。这个项目有 lint、测试、构建和部署四个阶段，你需要决定它们怎么串、怎么并行、怎么缓存。

## 项目假设

假设你有一个 Node.js 项目，结构如下：

```
my-app/
├── package.json          # 有 lint, test, build 脚本
├── package-lock.json
├── tsconfig.json
├── src/
│   └── ...
├── tests/
│   └── ...
└── dist/                 # 构建产物
```

`package.json` 里的脚本：
```json
{
  "scripts": {
    "lint": "eslint src/",
    "test": "jest",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## 设计决策

### 决策一：哪些 Job 可以并行？

lint 和 test 互不依赖，可以并行。build 依赖 lint 和 test 都通过（代码有问题不应该构建）。deploy 依赖 build。

```
lint ──┐
       ├──> build ──> deploy
test ──┘
```

### 决策二：缓存什么？

- `node_modules`：不缓存。`npm ci` 会删除并重建 `node_modules`，缓存它反而可能引入不一致
- npm 全局缓存（`~/.npm`）：缓存。这是 `setup-node` 内置缓存做的事
- 构建产物（`dist/`）：用 artifact 传递给 deploy Job

### 决策三：什么时候触发？

- PR 到 `main`：跑 lint + test + build
- push 到 `main`：跑完整的 lint + test + build + deploy
- PR 只改了 `docs/`：不需要跑 CI

## 完整 Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

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
      - run: npm test -- --coverage
      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 1

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/
      - name: Deploy
        run: |
          echo "Deploying to production..."
          # 实际部署命令
```

## 逐段解析

### 触发条件

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
```

`paths-ignore` 让只改文档的 PR 不触发 CI，节省分钟数。但要注意：如果你的 PR 同时改了代码和文档，CI 仍然会触发，因为 `paths-ignore` 是"所有改动的文件都匹配才跳过"。

### 并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

这解决了一个常见问题：你快速 push 了两次到同一个 PR，两次 CI 都会跑。第二次的其实是浪费，因为第一次的结果已经没意义了。

`cancel-in-progress: true` 会在新 push 到来时取消正在运行的旧 workflow。`group` 用 workflow 名 + ref 作为分组 key，确保不同 PR 之间不会互相取消。

### lint 和 test 并行

两个 Job 没有 `needs`，所以会并行执行。这是合理的——lint 检查代码风格，test 运行测试，它们互不依赖。

### build 等待 lint 和 test

```yaml
needs: [lint, test]
```

只有两者都通过，build 才会开始。如果 lint 失败，build 不会执行，节省时间。

### deploy 只在 main 分支执行

```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

PR 只跑到 build，不部署。只有 push 到 main 才部署。`environment: production` 配合 GitHub 的环境保护规则，可以要求人工审批后才部署。

### deploy 不重新构建

deploy Job 直接下载 build Job 上传的 artifact，不重新 `npm ci` 和 `npm run build`。这确保部署的代码和测试过的代码完全一致。

## 你可能遇到的问题

### 问题：npm ci 很慢

即使有缓存，`npm ci` 仍然需要解压包。如果依赖很多，可以考虑：

1. 确认 `setup-node` 的缓存确实命中了（看日志里有没有 `Cache restored`）
2. 检查 `package-lock.json` 是否频繁变化（比如 dependabot 每天都在更新）
3. 考虑用 `pnpm` 代替 npm，pnpm 的安装速度通常更快

### 问题：测试在 CI 里失败但本地通过

常见原因：
1. **环境变量缺失**：测试依赖 `.env` 文件，但 CI 里没有
2. **时区差异**：Runner 默认是 UTC，你的机器可能不是
3. **文件路径**：Windows 上路径分隔符是 `\`，Linux 上是 `/`
4. **异步测试超时**：CI 机器比你本地慢，默认超时不够

### 问题：artifact 下载后目录结构不对

`upload-artifact` 的 `path` 是相对于 `$GITHUB_WORKSPACE` 的。如果上传时写 `path: dist/`，下载时写 `path: output/`，文件会在 `output/` 目录下，而不是 `output/dist/`。

## 练习

### 练习一：添加安全扫描

在上面的 workflow 基础上，添加一个 `security` Job：
1. 运行 `npm audit --audit-level=high` 检查已知漏洞
2. 这个 Job 应该和 lint、test 并行
3. 如果发现高危漏洞，`npm audit` 会返回非零退出码，Job 失败
4. 但 build Job 不应该因为安全扫描失败而阻塞——用 `continue-on-error` 让安全扫描的结果不影响后续流程

### 练习二：矩阵测试

修改 `test` Job，让它在 Node.js 18 和 20 两个版本上都运行测试。用矩阵构建实现。

---

## 参考答案

### 练习一

```yaml
security:
  runs-on: ubuntu-latest
  continue-on-error: true
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm audit --audit-level=high
```

`continue-on-error: true` 让这个 Job 即使失败也不会阻塞 `build`。但 `build` 的 `needs` 不需要包含 `security`，因为安全扫描是独立的。

如果你想让 build 等安全扫描完成但不关心结果：

```yaml
build:
  needs: [lint, test, security]
  if: always() && (needs.lint.result == 'success' && needs.test.result == 'success')
```

### 练习二

```yaml
test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      node-version: [18, 20]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm test
```

矩阵构建会在两个 Runner 上分别运行测试，一个用 Node.js 18，一个用 Node.js 20。第 6 课会深入讲矩阵构建的更多用法。

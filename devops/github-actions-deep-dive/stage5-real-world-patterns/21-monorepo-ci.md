# Monorepo CI

> Monorepo 里改了一行文档，整个仓库的 CI 都跑了？5 个服务各自独立构建，其实只有 1 个改了？路径过滤和增量构建解决这个问题。

## Monorepo CI 的核心问题

单仓库（Monorepo）的 CI 面临两个矛盾：
1. **触发粒度**：改了 `apps/web` 的代码，`apps/api` 的测试要不要跑？
2. **构建效率**：5 个服务各自独立 `npm ci` + `npm run build`，能不能只构建改了的服务？

## 路径过滤

### 基本用法

```yaml
on:
  push:
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
```

只在 `apps/api` 或 `packages/shared` 有变化时触发。

### 按服务拆分 Workflow

```yaml
# .github/workflows/api.yml
name: API CI
on:
  push:
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - 'package.json'
      - 'package-lock.json'
  pull_request:
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - 'package.json'
      - 'package-lock.json'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test --workspace=apps/api
```

```yaml
# .github/workflows/web.yml
name: Web CI
on:
  push:
    paths:
      - 'apps/web/**'
      - 'packages/shared/**'
      - 'package.json'
      - 'package-lock.json'
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/shared/**'
      - 'package.json'
      - 'package-lock.json'
```

**注意**：`packages/shared` 变了，所有依赖它的服务都要跑 CI。

### 使用 dorny/paths-filter

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
      shared: ${{ steps.filter.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
            web:
              - 'apps/web/**'
            shared:
              - 'packages/shared/**'

  api:
    needs: changes
    if: needs.changes.outputs.api == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps: [...]

  web:
    needs: changes
    if: needs.changes.outputs.web == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps: [...]
```

这种方式把路径检测集中在一个 Job 里，后续 Job 根据它的输出决定是否执行。

## 增量构建

### Turborepo

Turborepo 是 monorepo 的构建工具，它能分析依赖图，只构建受影响的包。

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

在 CI 里使用：

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm ci

- name: Build affected
  run: npx turbo run build --filter=...[origin/main]

- name: Test affected
  run: npx turbo run test --filter=...[origin/main]
```

`--filter=...[origin/main]` 表示只构建相对于 main 分支有变化的包及其依赖者。

### Turborepo 远程缓存

```yaml
- run: npx turbo run build --filter=...[origin/main]
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: my-team
```

Turborepo 的远程缓存让不同 CI run 之间共享构建结果。第一次构建后，相同输入的后续构建会直接命中缓存。

### Nx

Nx 是另一个流行的 monorepo 工具：

```yaml
- run: npx nx affected -t test --base=origin/main --head=HEAD
- run: npx nx affected -t build --base=origin/main --head=HEAD
```

`affected` 命令只运行受代码变化影响的目标。

## 共享依赖的处理

### 共享包的版本管理

```yaml
# packages/shared/package.json
{
  "name": "@my-org/shared",
  "version": "0.0.0"  // 使用 workspace 协议，不独立发版
}
```

在 monorepo 内部，用 `workspace:*` 或 `workspace:^` 引用共享包，不需要独立版本号。

### 共享包变化的级联

当 `packages/shared` 变化时，所有依赖它的服务都需要重新测试和构建。Turborepo 的 `dependsOn: ["^build"]` 自动处理这个级联。

## Job 之间的数据共享

Monorepo CI 里，不同服务的构建产物需要传递给部署 Job：

```yaml
jobs:
  build-api:
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ steps.check.outputs.changed }}
    steps:
      - uses: actions/checkout@v4
      - id: check
        run: |
          if git diff --name-only origin/main | grep -q "^apps/api/"; then
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.check.outputs.changed == 'true'
        run: npm ci && npm run build --workspace=apps/api
      - if: steps.check.outputs.changed == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: api-build
          path: apps/api/dist/

  deploy-api:
    needs: build-api
    if: needs.build-api.outputs.changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: api-build
          path: dist/
      - run: ./deploy.sh api
```

## 大型 Monorepo 的策略

### 问题：checkout 太慢

10000 个文件的仓库，checkout 可能要 30 秒。

```yaml
- uses: actions/checkout@v4
  with:
    sparse-checkout: |
      apps/api
      packages/shared
    sparse-checkout-cone-mode: false
```

`sparse-checkout` 只检出需要的目录，大幅减少 checkout 时间。

### 问题：npm ci 太慢

Monorepo 的 `node_modules` 可能很大。

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: |
      package-lock.json
      apps/api/package.json
```

`cache-dependency-path` 让缓存 key 只基于相关文件的变化，而不是整个 lockfile。

### 问题：CI 配置太多

50 个包，每个一个 workflow 文件？用可重用 workflow + 动态矩阵：

```yaml
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.detect.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: detect
        run: |
          CHANGED=$(git diff --name-only origin/main | grep "^apps/" | cut -d/ -f2 | sort -u)
          MATRIX=$(echo "$CHANGED" | jq -R -s -c 'split("\n") | map(select(. != ""))')
          echo "matrix={\"service\":$MATRIX}" >> "$GITHUB_OUTPUT"

  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.matrix != '{"service":[]}'
    strategy:
      matrix: ${{ fromJSON(needs.detect-changes.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build --workspace=apps/${{ matrix.service }}
```

## 练习

### 练习一：设计 Monorepo CI

为以下 monorepo 设计 CI 方案：

```
my-monorepo/
├── apps/
│   ├── web/           # React 前端
│   ├── api/           # Node.js API
│   └── worker/        # 后台任务
├── packages/
│   ├── ui/            # 共享 UI 组件
│   ├── utils/         # 共享工具函数
│   └── config/        # 共享配置（ESLint, TSConfig）
└── package.json
```

要求：
1. 改了 `packages/ui`，`apps/web` 要重跑 CI
2. 改了 `packages/utils`，所有 app 都要重跑 CI
3. 改了 `packages/config`，所有 app 都要重跑 CI
4. 只改了 `apps/api` 的测试文件，只跑 API 的测试
5. 使用 Turborepo 做增量构建

---

## 参考答案

```yaml
name: Monorepo CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
      worker: ${{ steps.filter.outputs.worker }}
      shared: ${{ steps.filter.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
            web:
              - 'apps/web/**'
              - 'packages/ui/**'
            worker:
              - 'apps/worker/**'
            shared:
              - 'packages/utils/**'
              - 'packages/config/**'
              - 'package.json'
              - 'package-lock.json'

  api:
    needs: changes
    if: needs.changes.outputs.api == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run build test --filter=apps/api

  web:
    needs: changes
    if: needs.changes.outputs.web == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run build test --filter=apps/web

  worker:
    needs: changes
    if: needs.changes.outputs.worker == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run build test --filter=apps/worker
```

**要点**：
- `packages/ui` 变化只影响 `web`，不影响 `api` 和 `worker`
- `packages/utils` 和 `packages/config` 变化影响所有 app
- `fetch-depth: 0` 让 `dorny/paths-filter` 能对比分支差异
- Turborepo 的 `--filter` 只构建指定包

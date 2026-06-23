# CI 性能优化

> CI 跑 10 分钟还是 3 分钟，差距不只是 7 分钟。开发者等 CI 的时间、PR 合并的速度、反馈循环的长度——CI 性能直接影响开发效率。

## 性能瓶颈分析

先搞清楚时间花在哪里。一个典型的 CI 流程：

```
checkout (10s)
  → install deps (60s)
  → lint (30s)
  → test (120s)
  → build (90s)
  → upload artifact (20s)
总时间：~5 分钟
```

最大的优化空间通常在：
1. **依赖安装**：每次都重新下载
2. **测试运行**：测试太多或太慢
3. **构建过程**：重复编译

## 缓存优化

### 命中率是关键

缓存不是加了就有效。关键是命中率。

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
```

如果 `package-lock.json` 频繁变化（比如 dependabot 每天更新），缓存命中率会很低。

优化方案：
```yaml
key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ github.run_id }}
restore-keys: |
  npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
  npm-${{ runner.os }}-
```

`restore-keys` 允许使用近似匹配的缓存。即使精确 key 不匹配，也能用上一次的缓存作为基础。

### 缓存什么

| 内容 | 是否缓存 | 原因 |
|---|---|---|
| `~/.npm` | 是 | npm 全局缓存 |
| `node_modules` | 否 | `npm ci` 会删除重建 |
| `~/.cache/pip` | 是 | pip 下载缓存 |
| Docker 层 | 是 | 构建缓存 |
| 测试覆盖率数据库 | 视情况 | 增量测试需要 |

### 跨 Job 缓存

缓存是仓库级的，同一 workflow run 的不同 Job 可以共享缓存。但要注意：
- 缓存写入在 Job 结束时发生
- 后续 Job 可以读取同一 run 中之前 Job 写入的缓存

## 并行优化

### lint 和 test 并行

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
    steps: [...]
```

lint 和 test 互不依赖，可以并行。总时间 = max(lint, test) + build，而不是 lint + test + build。

### 测试分片

如果测试很多，可以把它们分到多个 Job 并行运行：

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx jest --shard=${{ matrix.shard }}/4
```

Jest 的 `--shard` 参数把测试分成 4 份，每个 Job 只运行 1/4 的测试。总时间 ≈ 单个 shard 的时间。

### 增量测试

只运行受影响的测试：

```yaml
- id: changed-files
  uses: tj-actions/changed-files@v44
  with:
    files: src/**

- if: steps.changed-files.outputs.any_changed == 'true'
  run: npx jest --findRelatedTests ${{ steps.changed-files.outputs.all_changed_files }}
```

`--findRelatedTests` 让 Jest 只运行与改动文件相关的测试。

## Docker 构建优化

### BuildKit 缓存

```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha` 使用 GitHub Actions 缓存后端存储 Docker 层。`mode=max` 缓存所有层，不只是最终镜像的层。

### 多阶段构建优化

```dockerfile
# 先安装依赖（缓存层）
FROM node:20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 再复制源码（依赖没变时跳过）
FROM deps AS build
COPY src/ ./src/
RUN npm run build
```

把不常变的层（依赖安装）放在前面，常变的层（源码复制）放在后面。

## GitHub Actions 特定优化

### 最小化 checkout

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1  # 只 clone 最新 commit，不带历史
    sparse-checkout: |
      src/
      package.json
```

`fetch-depth: 1` 减少 clone 时间。`sparse-checkout` 只检出需要的目录，在 monorepo 里特别有用。

### 条件跳过

```yaml
on:
  push:
    paths:
      - 'src/**'
      - '!**/*.md'
```

文档改动不触发 CI。

### 合并 Job

如果几个 Job 的 checkout + install 时间一样，考虑合并：

```yaml
# 不好：3 个 Job 都要 checkout + install
jobs:
  lint: ...
  test: ...
  typecheck: ...

# 好：合并成一个 Job
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run typecheck
```

权衡：合并后不能并行，但省去了重复的 checkout + install 时间。

## 性能度量

### 记录构建时间

```yaml
- name: Build with timing
  run: |
    START=$(date +%s)
    npm run build
    END=$(date +%s)
    echo "Build took $((END - START)) seconds"
    echo "build_time=$((END - START))" >> "$GITHUB_OUTPUT"
```

### 对比优化效果

每次优化后，对比 workflow run 的时间：

```
仓库 → Actions → 选择 workflow → 查看历史 run 时间
```

或者用 API：

```bash
gh api repos/owner/repo/actions/workflows/WORKFLOW_ID/runs \
  --jq '.workflow_runs[:10] | .[] | "\(.created_at) \(.run_duration_ms)"'
```

## 练习

### 练习一：优化一个慢 CI

以下 workflow 总耗时 15 分钟，找出可以优化的地方：

```yaml
name: Slow CI
on: push

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run lint

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:unit

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:e2e

  build:
    needs: [lint, test-unit, test-e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
```

---

## 参考答案

**问题 1**：每个 Job 都重复 checkout + setup-node + npm install（~2 分钟 × 4 = 8 分钟浪费）

**问题 2**：`npm install` 而不是 `npm ci`，且没有缓存

**问题 3**：lint、test-unit、test-e2e 可以并行，但每个都重复安装

**优化后**：

```yaml
name: Optimized CI
on:
  push:
    paths-ignore: ['**/*.md', 'docs/**']

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e

  build:
    needs: [checks, test-e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

**优化点**：
1. lint + test-unit 合并为一个 Job，省一次 checkout + install
2. 添加 `cache: 'npm'`，依赖安装从 60s 降到 10s
3. `fetch-depth: 1` 减少 clone 时间
4. `paths-ignore` 避免文档改动触发 CI
5. `cancel-in-progress` 避免重复运行

**预期效果**：从 15 分钟降到 ~5 分钟

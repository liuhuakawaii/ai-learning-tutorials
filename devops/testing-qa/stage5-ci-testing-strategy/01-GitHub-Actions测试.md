# GitHub Actions 测试

## 场景引入

你在本地跑测试一切正常，push 到远程后同事说"我这跑不过"。CI 的核心价值就是：**把"在我电脑上能跑"变成"在任何地方都能跑"**。

## 学习目标

1. 理解 GitHub Actions 的核心概念：workflow、job、step
2. 掌握在 CI 中运行 Vitest 和 Playwright
3. 学会配置依赖缓存、环境变量、测试报告上传

## 核心概念

一个 **workflow** 定义在 `.github/workflows/` 下的 YAML 文件中。每个 workflow 包含多个 **job**（默认并行），每个 job 包含多个 **step**（顺序执行）。

```
workflow: ci.yml
├── job: lint          (并行)
├── job: unit-test     (并行)
└── job: e2e-test      (并行)
```

**job 运行在独立的虚拟机上**，彼此不共享文件系统。

### 触发条件

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

## 在 CI 中运行 Vitest

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: node_modules
          key: deps-${{ runner.os }}-node${{ matrix.node-version }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            deps-${{ runner.os }}-node${{ matrix.node-version }}-

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npx vitest run --reporter=json --outputFile=test-results.json

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-node${{ matrix.node-version }}
          path: test-results.json
          retention-days: 7
```

`npm ci` 比 `npm install` 更快且更可靠——它严格按照 `package-lock.json` 安装。

## 在 CI 中运行 Playwright

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --retries=2 --reporter=html
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## 环境变量和 Secrets 管理

```yaml
env:
  NODE_ENV: test
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}
```

在测试代码中通过 `process.env` 访问：

```typescript
// src/config.ts
const config = {
  databaseUrl: process.env.DATABASE_URL || 'sqlite::memory:',
  apiKey: process.env.API_KEY || 'test-key',
}
export default config
```

## 测试报告上传

统一用 `if: always()` 上传，测试失败时才有排查依据：

```yaml
- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: vitest-report
    path: results/
```

## 失败重试策略

### Vitest 重试

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    retry: 2,
    reporters: ['default', 'junit'],
    outputFile: { junit: './results/junit.xml' },
  },
})
```

### Playwright 重试

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['junit']] : 'list',
})
```

`process.env.CI` 是 GitHub Actions 自动设置的环境变量，用它区分本地和 CI 环境。

## 完整 CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: 20

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run lint

  unit-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx vitest run --reporter=default --reporter=junit --outputFile=results/junit.xml
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-results
          path: results/

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: [lint, unit-test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --retries=2
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

`concurrency` 确保同一分支多次 push 只保留最新 CI 运行。

## 常见误区

1. **用 `npm install` 而非 `npm ci`**：`npm install` 可能修改 `package-lock.json`
2. **没有缓存 Playwright 浏览器**：浏览器下载是 E2E CI 中最大的时间开销
3. **Secrets 未配置导致测试静默通过**：代码中给了 fallback 值
4. **上传报告时忘记 `if: always()`**：测试失败时报告不会上传
5. **过度依赖重试**：需要重试 3 次才通过的测试很可能是 flaky test

## 工程建议

1. **先跑快的，再跑慢的**：lint → 单元测试 → 集成测试 → E2E
2. **用 `setup-node` 的 `cache: npm`**：比手动 `actions/cache` 更简洁
3. **Playwright 只安装需要的浏览器**：`npx playwright install chromium`
4. **给 job 设 `timeout-minutes`**：防止测试挂起

## 小结

- GitHub Actions 的 workflow/job/step 三层结构对应"流程/任务/步骤"
- 缓存 `node_modules` 和 Playwright 浏览器能节省 1-2 分钟
- Secrets 管理敏感信息，环境变量管理非敏感配置
- 测试报告用 `if: always()` 上传
- 重试是权宜之计，不是 flaky test 的解药

## 练习

### 练习一：编写基础 CI Workflow

为一个使用 Vitest 的 Node.js 项目编写 GitHub Actions workflow，要求：在 push 和 PR 时触发，在 Node 18 和 20 两个版本上运行测试，缓存 node_modules，上传测试报告。

### 练习二：Playwright CI 配置

为一个 Next.js 项目配置 Playwright E2E 测试的 CI workflow，要求：在单元测试通过后才运行，缓存 Playwright 浏览器，测试失败时重试 2 次，上传 HTML 报告。

---

## 参考答案

### 练习一

**答案**：使用 matrix strategy 在多版本 Node 上运行，`actions/setup-node` 的 `cache: npm` 自动处理缓存。

```yaml
name: Unit Tests
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
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
          cache: npm
      - run: npm ci
      - run: npx vitest run --reporter=junit --outputFile=test-results.xml
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-node${{ matrix.node-version }}
          path: test-results.xml
```

### 练习二

**答案**：
```yaml
name: E2E
on:
  pull_request: { branches: [main] }
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --retries=2 --reporter=html
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

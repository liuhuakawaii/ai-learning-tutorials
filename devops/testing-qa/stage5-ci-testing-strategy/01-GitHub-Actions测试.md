# GitHub Actions 测试

## "在我电脑上能跑"

你本地跑测试一切正常，push 到远程后同事说"我这跑不过"。CI 的核心价值：把"在我电脑上能跑"变成"在任何地方都能跑"。

## 核心概念

一个 **workflow** 定义在 `.github/workflows/` 下的 YAML 文件中。每个 workflow 包含多个 **job**（默认并行），每个 job 包含多个 **step**（顺序执行）。

```
workflow: ci.yml
├── job: lint          (并行)
├── job: unit-test     (并行)
└── job: e2e-test      (并行)
```

**job 运行在独立的虚拟机上**，彼此不共享文件系统。

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
          cache: npm

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

`npm ci` 比 `npm install` 更快更可靠——严格按照 `package-lock.json` 安装。`setup-node` 的 `cache: npm` 自动缓存依赖。

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

Playwright 浏览器下载是 E2E CI 中最大的时间开销，必须缓存。

## 环境变量和 Secrets

```yaml
env:
  NODE_ENV: test
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}
```

Secrets 在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置。不要把敏感信息硬编码在 YAML 中。

## 失败重试策略

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 2,
    reporters: ['default', 'junit'],
    outputFile: { junit: './results/junit.xml' },
  },
})

// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
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

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint

  unit-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vitest run --reporter=default --reporter=junit --outputFile=results/junit.xml
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: unit-test-results, path: results/ }

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: [lint, unit-test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --retries=2
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
```

`concurrency` 确保同一分支多次 push 只保留最新 CI 运行。`needs` 让 e2e 在 lint 和 unit-test 通过后才运行。

## 练习

### 练习一：编写基础 CI Workflow

为 Vitest 项目编写 GitHub Actions workflow：push 和 PR 时触发，Node 18 和 20 两个版本运行，缓存依赖，上传测试报告。

### 练习二：Playwright CI 配置

为 Next.js 项目配置 Playwright E2E 的 CI：单元测试通过后才运行，缓存浏览器，失败重试 2 次，上传 HTML 报告。

---

## 参考答案

### 练习一

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
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-node${{ matrix.node-version }}
          path: test-results.xml
```

### 练习二

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
        with: { name: playwright-report, path: playwright-report/ }
```

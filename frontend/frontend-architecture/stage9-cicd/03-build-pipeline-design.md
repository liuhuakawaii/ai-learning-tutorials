# 03. 构建流水线设计

> 构建流水线不只是"运行命令"，而是"定义代码从提交到部署的质量门禁"

## 本课目标

- 掌握构建流水线的设计原则
- 学会设计 Lint、测试、构建的完整流程
- 理解构建产物管理和缓存策略
- 实现高效的构建流水线

## 从一个真实场景说起

假设你在维护一个大型前端项目，遇到了这些问题：

1. **构建时间长**：每次构建要 10 分钟，开发体验差
2. **缓存命中率低**：明明依赖没变，还是要重新安装
3. **构建失败难定位**：不知道是哪个环节出了问题
4. **产物管理混乱**：不知道哪个版本对应哪个构建

这些问题的根源是**构建流水线设计不合理**。

## 流水线设计原则

### 原则一：快速反馈

```yaml
# 不推荐：所有检查串行执行
jobs:
  check:
    steps:
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

# 推荐：并行执行独立检查
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test

  build:
    needs: [lint, type-check, test]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

### 原则二：尽早失败

```yaml
jobs:
  # 第一层：快速检查（1-2 分钟）
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: npm run type-check

  # 第二层：单元测试（3-5 分钟）
  unit-test:
    needs: [lint, type-check]
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  # 第三层：集成测试（5-10 分钟）
  integration-test:
    needs: unit-test
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:integration

  # 第四层：构建（5-10 分钟）
  build:
    needs: integration-test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

### 原则三：最大化并行

```yaml
jobs:
  # 所有独立检查并行执行
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: npm run type-check

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit

  # 等待所有检查完成后再构建
  build:
    needs: [lint, type-check, unit-test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

## Lint 检查

### ESLint

```yaml
jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run ESLint
        run: |
          npm run lint
        env:
          ESLINT_FORMAT: stylish

      - name: Run ESLint with Fix
        if: failure()
        run: |
          npm run lint -- --fix
          git diff
```

### TypeScript 类型检查

```yaml
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run TypeScript Check
        run: |
          npx tsc --noEmit
```

### 格式检查

```yaml
jobs:
  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Check Prettier
        run: |
          npx prettier --check .

      - name: Check Stylelint
        run: |
          npx stylelint "src/**/*.{css,scss}"
```

## 测试自动化

### 单元测试

```yaml
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Unit Tests
        run: |
          npm run test:unit -- --coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
```

### 集成测试

```yaml
jobs:
  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Integration Tests
        run: |
          npm run test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
```

### E2E 测试

```yaml
jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Build Application
        run: npm run build

      - name: Run E2E Tests
        run: |
          npx playwright install
          npm run test:e2e

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 构建管理

### 构建命令

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

      - name: Build
        run: |
          npm run build
        env:
          NODE_ENV: production

      - name: Verify Build
        run: |
          ls -la dist/
          du -sh dist/
```

### 构建产物上传

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
      - run: npm run build

      - name: Upload Build Artifact
        uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: dist/
          retention-days: 7

      - name: Upload Source Maps
        uses: actions/upload-artifact@v3
        with:
          name: source-maps
          path: dist/**/*.map
          retention-days: 30
```

### 构建产物下载

```yaml
jobs:
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download Build Artifact
        uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/

      - name: Deploy
        run: |
          ls -la dist/
          npm run deploy
```

## 缓存策略

### npm 缓存

```yaml
steps:
  - uses: actions/setup-node@v3
    with:
      node-version: '18'
      cache: 'npm'

  - run: npm ci
```

### 自定义缓存

```yaml
steps:
  - uses: actions/cache@v3
    with:
      path: |
        ~/.npm
        node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      restore-keys: |
        ${{ runner.os }}-node-

  - run: npm ci
```

### 多层缓存

```yaml
steps:
  - name: Cache npm
    uses: actions/cache@v3
    with:
      path: ~/.npm
      key: npm-${{ hashFiles('package-lock.json') }}

  - name: Cache node_modules
    uses: actions/cache@v3
    with:
      path: node_modules
      key: modules-${{ hashFiles('package-lock.json') }}

  - run: npm ci
```

### 构建缓存

```yaml
steps:
  - uses: actions/cache@v3
    with:
      path: |
        .next/cache
        dist
      key: build-${{ hashFiles('src/**', 'package-lock.json') }}
      restore-keys: |
        build-

  - run: npm run build
```

## 并行构建

### Monorepo 并行构建

```yaml
jobs:
  build-packages:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [ui, utils, app]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=@my-project/${{ matrix.package }}
      - uses: actions/upload-artifact@v3
        with:
          name: build-${{ matrix.package }}
          path: packages/${{ matrix.package }}/dist/

  build-app:
    needs: build-packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Download All Build Artifacts
        uses: actions/download-artifact@v3
        with:
          path: packages/

      - run: npm run build --workspace=@my-project/app
```

### 分片构建

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Build Shard ${{ matrix.shard }}
        run: |
          npm run build -- --shard=${{ matrix.shard }}/4

      - uses: actions/upload-artifact@v3
        with:
          name: build-shard-${{ matrix.shard }}
          path: dist/
```

## 构建优化

### 减少安装时间

```yaml
steps:
  - uses: actions/setup-node@v3
    with:
      node-version: '18'
      cache: 'npm'

  # 使用 ci 而不是 install
  - run: npm ci

  # 或者只安装生产依赖
  - run: npm ci --omit=dev
```

### 减少构建时间

```yaml
steps:
  - run: npm run build
    env:
      # 并行构建
      NODE_OPTIONS: '--max-old-space-size=4096'
      # 使用缓存
      TURBO_CACHE: read
```

### 并行上传

```yaml
steps:
  - name: Upload Multiple Artifacts
    uses: actions/upload-artifact@v3
    with:
      name: build-output
      path: |
        dist/
        build/
        coverage/
```

## 流水线模板

### 基础模板

```yaml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  build:
    needs: [quality, test]
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
          name: build-output
          path: dist/
```

### 完整模板

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

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

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  build:
    needs: [lint, type-check, test]
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
          name: build-output
          path: dist/
```

## 本课小结

本课我们学习了构建流水线设计：

1. **设计原则**：快速反馈、尽早失败、最大化并行
2. **Lint 检查**：ESLint、TypeScript、格式检查
3. **测试自动化**：单元测试、集成测试、E2E 测试
4. **构建管理**：构建命令、产物上传/下载
5. **缓存策略**：npm 缓存、自定义缓存、多层缓存
6. **并行构建**：Monorepo 并行、分片构建

## 练习

### 练习一：设计完整流水线

为你当前项目设计一个完整的构建流水线：
- 代码质量检查
- 多种测试
- 构建和产物管理

### 练习二：优化构建时间

分析并优化你的构建流水线：
- 识别瓶颈
- 添加缓存
- 并行化

## 参考答案

### 练习一

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  # 代码质量
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
      - run: npm run type-check

  # 单元测试
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  # 集成测试
  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  # E2E 测试
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx playwright install
      - run: npm run test:e2e

  # 构建
  build:
    needs: [lint, unit-test, integration-test, e2e-test]
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
          name: build-output
          path: dist/
```

### 练习二

```yaml
# 优化后的流水线
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      # 使用缓存
      - uses: actions/cache@v3
        with:
          path: |
            .eslintcache
            .tsbuildinfo
          key: quality-${{ hashFiles('src/**') }}

      - run: npm run lint --cache
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      # 并行运行测试
      - run: npm run test:unit -- --shard=1/2 &
      - run: npm run test:unit -- --shard=2/2 &
      - wait

  build:
    needs: [quality, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      # 使用构建缓存
      - uses: actions/cache@v3
        with:
          path: |
            .next/cache
            dist
          key: build-${{ hashFiles('src/**') }}

      - run: npm run build
```

## 下一步

完成本课后，继续学习 [04. 测试自动化](./04-test-automation.md)。
# 第四课：lint、test、build

> **课程定位**：在 CI 中运行代码检查、测试和构建
> **前置知识**：workflow/job/step、缓存（第 2-3 课）
> **预计时长**：30 分钟

---

## 场景引入

你提交了一个 PR，CI 跑了 5 分钟才告诉你有一个 ESLint 错误。你修了错误再提交，又等了 5 分钟——这次测试挂了。你开始想：能不能让 lint 和测试并行跑？能不能先跑 lint，lint 不过就不跑测试，节省时间和资源？

---

## 学习目标

1. 在 CI 中配置 ESLint 代码检查
2. 在 CI 中运行单元测试并生成报告
3. 在 CI 中验证构建成功
4. 理解 CI 检查的最佳实践

---

## 一、完整的 CI 流程

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Code Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm run lint

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm run build
```

---

## 二、代码检查（Lint）

### 2.1 ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  env: { node: true, es2022: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022 },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
};
```

```json
// package.json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

### 2.2 Prettier 检查

```yaml
# 单独的格式检查 job
format:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: npm
    - run: npm ci
    - run: npx prettier --check "src/**/*.{js,ts,json}"
```

---

## 三、单元测试

### 3.1 运行测试

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: npm
    - run: npm ci
    - run: npm test
```

### 3.2 生成测试报告

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: npm
    - run: npm ci
    
    # 运行测试并生成覆盖率报告
    - run: npm test -- --coverage
    
    # 上传覆盖率报告
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: coverage
        path: coverage/
```

### 3.3 数据库测试

```yaml
test:
  runs-on: ubuntu-latest
  
  services:
    postgres:
      image: postgres:14
      env:
        POSTGRES_DB: testdb
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: testpass
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: npm
    - run: npm ci
    - run: npm test
      env:
        DATABASE_URL: postgres://postgres:testpass@localhost:5432/testdb
```

---

## 四、构建验证

```yaml
build:
  runs-on: ubuntu-latest
  needs: [lint, test]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: npm
    - run: npm ci
    - run: npm run build
    
    # 验证构建产物存在
    - run: test -d dist || exit 1
    
    # 上传构建产物
    - uses: actions/upload-artifact@v3
      with:
        name: build-output
        path: dist/
```

---

## 五、最佳实践

```
CI 检查的最佳实践：

  ✅ 并行执行：lint 和 test 可以同时运行
  ✅ 快速失败：lint 失败就不需要跑 test
  ✅ 缓存依赖：使用 setup-node 的缓存
  ✅ 固定版本：锁定 Node.js 和依赖版本
  ✅ 环境隔离：使用 services 运行数据库
  ✅ 产物保存：构建产物可以下载或用于部署
```

---

## 六、动手练习

```yaml
name: CI

on: [push, pull_request]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

---

## 常见误区

- **"CI 只需要跑测试就够了"**：测试验证逻辑正确性，但不检查代码风格和潜在问题。Lint 能发现未使用的变量、不安全的类型转换等测试覆盖不到的问题。
- **"测试在本地跑过了就不需要 CI"**：本地环境可能和 CI 不同（Node 版本、操作系统、依赖版本），CI 提供了一个干净、一致的验证环境。
- **"构建失败不影响部署"**：构建是部署的前置条件。如果代码都编译不过，部署上去也是白费。所以 build 应该依赖 lint 和 test。
- **"数据库测试太复杂，CI 里跑不了"**：GitHub Actions 的 `services` 可以启动 PostgreSQL、Redis 等服务容器，和本地 docker-compose 类似。

---

## 工程建议

- **lint 和 test 并行，build 等它们完成后再跑**：`needs: [lint, test]` 让 build 只在两者都通过后执行，既快又安全。
- **测试生成覆盖率报告**：`npm test -- --coverage` 生成覆盖率，用 `upload-artifact` 上传，方便 review 时查看。
- **数据库测试用 `services` 启动容器**：`services.postgres` 在 Job 级别启动，所有 Step 共享，测试完成后自动清理。
- **构建产物用 `upload-artifact` 保存**：后续的部署 Job 可以下载产物，不需要重新构建。

---

## 小结

1. **Lint**：代码风格和质量检查
2. **Test**：单元测试，可以生成覆盖率报告
3. **Build**：验证构建成功，产物可以用于部署
4. **并行和依赖**：lint/test 并行，build 依赖它们

---

## 下一课预告

下一课我们将学习如何在 CI 中构建 Docker 镜像。

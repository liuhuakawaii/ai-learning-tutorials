# 第四课：lint、test、build

> **课程定位**：在 CI 中运行代码检查、测试和构建
> **前置知识**：workflow/job/step、缓存（第 2-3 课）
> **预计时长**：30 分钟

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

## 小结

1. **Lint**：代码风格和质量检查
2. **Test**：单元测试，可以生成覆盖率报告
3. **Build**：验证构建成功，产物可以用于部署
4. **并行和依赖**：lint/test 并行，build 依赖它们

---

## 下一课预告

下一课我们将学习如何在 CI 中构建 Docker 镜像。

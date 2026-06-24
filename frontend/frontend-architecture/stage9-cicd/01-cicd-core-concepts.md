# 01. CI/CD 核心概念

> CI/CD 不是"配置文件"，而是"团队协作的自动化契约"

## 本课目标

- 理解持续集成、持续交付、持续部署的区别
- 掌握 CI/CD 的核心价值和适用场景
- 建立 CI/CD 的思维模型

## 从一个真实场景说起

假设你在这样的团队工作：

1. **代码集成困难**：每个人都在自己的分支开发，合并时冲突不断
2. **测试靠手动**：每次发布前都要手动跑测试，经常漏掉
3. **部署靠人肉**：打包、上传、重启，每次都要 30 分钟
4. **问题难排查**：线上出问题，不知道是哪个提交引入的

这些问题的根源是**缺少自动化流程**。

CI/CD 就是解决这些问题的方案。

## 核心概念

### 持续集成（Continuous Integration, CI）

**定义**：频繁地将代码集成到主干，通过自动化测试验证。

**关键点**：
- **频繁集成**：每天至少集成一次，最好多次
- **自动化测试**：每次集成都触发测试
- **快速反馈**：测试失败时立即通知

**流程**：
```
代码提交 → 自动构建 → 自动测试 → 反馈结果
```

**价值**：
- 尽早发现问题
- 减少集成风险
- 提高代码质量

### 持续交付（Continuous Delivery, CD）

**定义**：让代码随时可以部署到生产环境。

**关键点**：
- **可部署状态**：代码始终处于可部署状态
- **自动化流程**：构建、测试、部署全流程自动化
- **人工确认**：生产环境部署需要人工确认

**流程**：
```
代码提交 → 自动构建 → 自动测试 → 自动部署到测试环境 → 人工确认 → 部署到生产环境
```

**价值**：
- 降低发布风险
- 提高发布频率
- 快速响应市场

### 持续部署（Continuous Deployment）

**定义**：自动将通过验证的代码部署到生产环境。

**关键点**：
- **完全自动化**：无需人工干预
- **快速迭代**：代码合并后立即部署
- **可靠回滚**：出问题时能快速回滚

**流程**：
```
代码提交 → 自动构建 → 自动测试 → 自动部署到生产环境
```

**价值**：
- 最快的反馈循环
- 最小的发布风险
- 最高的交付效率

## 三者对比

| 特性 | 持续集成 | 持续交付 | 持续部署 |
|------|----------|----------|----------|
| 目标 | 频繁集成 | 随时可部署 | 自动部署 |
| 测试 | 自动测试 | 自动测试 | 自动测试 |
| 部署 | 手动部署 | 人工确认部署 | 自动部署 |
| 反馈速度 | 快 | 中 | 最快 |
| 适用场景 | 所有团队 | 成熟团队 | 高成熟度团队 |

## CI/CD 的核心价值

### 1. 提高代码质量

```yaml
# 每次提交都触发测试
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

### 2. 降低发布风险

```yaml
# 多环境部署
jobs:
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: npm run deploy:staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy:production
```

### 3. 提高开发效率

```yaml
# 自动化重复工作
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm version patch
      - run: git push --follow-tags
      - run: npm publish
```

### 4. 增强团队协作

```yaml
# 统一的开发流程
on: pull_request:
  types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
```

## CI/CD 流水线设计

### 基本流水线

```yaml
# .github/workflows/ci.yml
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
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
```

### 完整流水线

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # 代码质量检查
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
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

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

  # 部署到测试环境
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/
      - run: npm run deploy:staging

  # 部署到生产环境
  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build-output
          path: dist/
      - run: npm run deploy:production
```

## CI/CD 工具对比

### GitHub Actions

**优点**：
- 与 GitHub 集成紧密
- 配置简单
- 免费额度充足
- 社区 Action 丰富

**缺点**：
- 只适用于 GitHub
- 复杂场景配置复杂
- 调试困难

### Jenkins

**优点**：
- 功能强大
- 插件丰富
- 可扩展性强
- 支持多种 SCM

**缺点**：
- 需要自己维护服务器
- 配置复杂
- 学习曲线陡峭

### GitLab CI

**优点**：
- 与 GitLab 集成紧密
- 功能完整
- 支持自托管
- 配置简单

**缺点**：
- 只适用于 GitLab
- 社区相对较小

### 选择建议

- **GitHub 项目**：GitHub Actions
- **GitLab 项目**：GitLab CI
- **私有化部署**：Jenkins 或 GitLab CI
- **小型团队**：GitHub Actions
- **大型企业**：Jenkins 或 GitLab CI

## 常见误区

### 误区一：CI/CD 就是自动部署

**正确理解**：CI/CD 是完整的自动化流程，包括构建、测试、部署等多个环节。自动部署只是其中一部分。

### 误区二：CI/CD 会降低开发效率

**正确理解**：CI/CD 的前期投入会带来长期收益。它减少了手动工作，降低了错误率，提高了团队协作效率。

### 误区三：小团队不需要 CI/CD

**正确理解**：CI/CD 的价值与团队规模无关。即使是个人项目，CI/CD 也能帮助你保持代码质量。

### 误区四：CI/CD 配置好就不用管了

**正确理解**：CI/CD 流水线需要持续维护和优化。随着项目发展，流水线也需要相应调整。

## 本课小结

本课我们学习了 CI/CD 的核心概念：

1. **持续集成**：频繁集成，自动化测试
2. **持续交付**：随时可部署，人工确认
3. **持续部署**：完全自动化，快速迭代
4. **核心价值**：提高质量、降低风险、提高效率

## 练习

### 练习一：分析现有流程

分析你当前项目的部署流程：
- 有哪些手动步骤？
- 有哪些重复工作？
- 有哪些容易出错的环节？

### 练习二：设计流水线

为你当前项目设计一个 CI/CD 流水线：
- 需要哪些检查？
- 需要哪些测试？
- 需要哪些部署步骤？

## 参考答案

### 练习一

**示例分析**：

手动步骤：
1. 本地运行 lint 和测试
2. 手动打包
3. 手动上传到服务器
4. 手动重启服务
5. 手动验证部署结果

重复工作：
- 每次发布都要重复以上步骤
- 多人协作时，每个人都要做同样的事

容易出错的环节：
- 忘记运行测试
- 打包配置错误
- 上传路径错误
- 重启服务失败

### 练习二

**流水线设计**：

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test

  build:
    needs: [quality, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy
```

## 下一步

完成本课后，继续学习 [02. GitHub Actions 基础](./02-github-actions-basics.md)。
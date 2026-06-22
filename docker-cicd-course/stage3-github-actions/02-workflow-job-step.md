# 第二课：workflow、job、step

> **课程定位**：深入理解 GitHub Actions 的配置语法
> **前置知识**：CI/CD 基础概念（第一课）
> **预计时长**：35 分钟

---

## 场景引入

你写了一个最简单的 CI 流水线，只会跑 `echo "hello"`。现在你想让它真正做点事：PR 时跑 lint 和测试，合并到 main 后构建镜像，打标签时自动部署。你还需要在不同 Node.js 版本上测试，确保代码兼容。这些需求该怎么用 YAML 表达？

---

## 学习目标

1. 掌握 workflow 文件的完整结构
2. 理解 job 和 step 的配置选项
3. 学会使用矩阵策略测试多个版本
4. 掌握 workflow 的触发条件

---

## 一、Workflow 完整结构

```yaml
# .github/workflows/ci.yml

# 名称
name: CI Pipeline

# 触发条件
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # 每周一 UTC 0 点

# 环境变量（所有 job 共享）
env:
  NODE_ENV: test

# 权限
permissions:
  contents: read

# 任务
jobs:
  lint:
    # job 配置...
  
  test:
    # job 配置...
  
  build:
    # job 配置...
```

---

## 二、触发条件（on）

```yaml
on:
  # push 事件
  push:
    branches: [main]           # 只在 main 分支触发
    paths: ['src/**']          # 只在 src 目录变化时触发
    tags: ['v*']               # 推送标签时触发

  # PR 事件
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  # 定时触发
  schedule:
    - cron: '0 0 * * 1'       # 每周一 UTC 0 点

  # 手动触发
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
```

---

## 三、Job 配置

### 3.1 基本配置

```yaml
jobs:
  test:
    name: Run Tests              # 显示名称
    runs-on: ubuntu-latest       # 运行环境
    
    # 超时时间
    timeout-minutes: 10
    
    # 环境变量
    env:
      DATABASE_URL: postgres://...
    
    # 权限
    permissions:
      contents: read
    
    # 步骤
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

### 3.2 Job 依赖

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  build:
    needs: [lint, test]          # 等 lint 和 test 都完成后才运行
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
```

```
依赖关系图：

  lint ──┐
         ├──→ build
  test ──┘

  lint 和 test 并行执行
  build 等两者都完成后执行
```

### 3.3 矩阵策略

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
        os: [ubuntu-latest, windows-latest]
      fail-fast: false           # 一个失败不影响其他
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

```
矩阵展开：

  会创建 6 个并行任务：
  ├── Node 16 + Ubuntu
  ├── Node 16 + Windows
  ├── Node 18 + Ubuntu
  ├── Node 18 + Windows
  ├── Node 20 + Ubuntu
  └── Node 20 + Windows
```

---

## 四、Step 配置

### 4.1 使用 Action

```yaml
steps:
  # 使用市场上的 Action
  - uses: actions/checkout@v4
  
  - uses: actions/setup-node@v4
    with:
      node-version: 18
      cache: npm
  
  # 使用带条件的 Action
  - uses: actions/cache@v3
    if: github.event_name == 'push'
    with:
      path: node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 4.2 运行命令

```yaml
steps:
  # 单行命令
  - run: npm ci
  
  # 多行命令
  - run: |
      npm ci
      npm run lint
      npm test
  
  # 带环境变量
  - run: echo "Hello $NAME"
    env:
      NAME: World
  
  # 带条件
  - run: npm run build
    if: github.ref == 'refs/heads/main'
```

### 4.3 Step 之间传递数据

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # 设置输出
      - id: version
        run: echo "version=$(node -p 'require(\"./package.json\").version')" >> $GITHUB_OUTPUT
      
      # 使用输出
      - run: echo "Version is ${{ steps.version.outputs.version }}"
```

---

## 五、常用 Workflow 模式

### 5.1 PR 检查 + 主分支部署

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # PR 时只跑检查
  check:
    if: github.event_name == 'pull_request'
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

  # 主分支推送时构建和部署
  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t my-app .
      - run: docker push my-app
```

---

## 六、动手练习

### 练习一：矩阵测试

```yaml
name: Matrix Test

on: [push, pull_request]

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
      - run: npm test
```

### 练习二：Job 依赖

```yaml
name: Pipeline

on: [push]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
```

---

## 常见误区

- **"Job 之间默认是串行的"**：Job 默认并行执行，只有用 `needs` 显式声明依赖才会串行。如果你希望某个 Job 等另一个完成后再运行，必须写 `needs`。
- **"矩阵策略会增加 CI 费用"**：矩阵确实会创建多个并行任务，但 GitHub Actions 按总分钟数计费。合理控制矩阵维度（如只测 Node 18 和 20，不测 16）可以控制成本。
- **"on: push 会监听所有分支"**：默认确实如此，但可以用 `branches` 过滤。建议只监听 `main` 和 `develop`，避免每个 feature 分支都触发 CI。
- **"Step 之间不能传递数据"**：可以通过 `$GITHUB_OUTPUT` 在 Step 之间传递变量，比如获取 package.json 的版本号供后续步骤使用。

---

## 工程建议

- **用 `needs` 控制执行顺序**：lint 和 test 并行，build 等两者都通过后再执行。这样既快又安全。
- **给 Job 设置 `timeout-minutes`**：防止 CI 因为死循环或网络问题无限等待，默认 360 分钟太长了。
- **用 `if` 条件控制 Job 执行**：PR 时只跑检查，main 分支推送时才构建和部署，避免不必要的资源消耗。
- **矩阵策略用于兼容性测试**：至少测试当前 LTS 版本和下一个主要版本，确保代码不会在升级 Node.js 时出问题。

---

## 小结

1. **Workflow**：一个 YAML 文件，由事件触发
2. **Job**：独立的任务单元，可以并行或依赖执行
3. **Step**：Job 中的具体步骤，可以是 Action 或命令
4. **矩阵策略**：同时测试多个版本/平台
5. **触发条件**：push、PR、定时、手动

---

## 下一课预告

下一课我们将学习如何在 CI 中缓存依赖，加速构建。

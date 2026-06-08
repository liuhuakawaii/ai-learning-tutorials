# 第二课：workflow、job、step

> **课程定位**：深入理解 GitHub Actions 的配置语法
> **前置知识**：CI/CD 基础概念（第一课）
> **预计时长**：35 分钟

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

## 小结

1. **Workflow**：一个 YAML 文件，由事件触发
2. **Job**：独立的任务单元，可以并行或依赖执行
3. **Step**：Job 中的具体步骤，可以是 Action 或命令
4. **矩阵策略**：同时测试多个版本/平台
5. **触发条件**：push、PR、定时、手动

---

## 下一课预告

下一课我们将学习如何在 CI 中缓存依赖，加速构建。

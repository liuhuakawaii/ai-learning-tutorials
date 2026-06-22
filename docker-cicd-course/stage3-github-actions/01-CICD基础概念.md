# 第一课：CI/CD 基础概念

> **课程定位**：理解 CI/CD 的核心思想，建立全局认知
> **前置知识**：Docker 和 Compose 基础（前两个阶段）
> **预计时长**：30 分钟

---

## 场景引入

你和三个同事一起开发一个项目，每次合并代码都要花半天时间手动测试、手动部署。有一次，同事提交的代码把测试环境搞挂了，你花了两小时才回滚成功。你开始想：有没有一种方式，每次有人提交代码就自动跑测试，测试过了就自动部署，出问题了能一键回滚？

---

## 学习目标

1. 理解 CI 和 CD 的区别
2. 知道为什么需要 CI/CD
3. 了解 GitHub Actions 的基本概念
4. 理解 CI/CD 在开发生命周期中的位置

---

## 一、什么是 CI/CD

### 1.1 CI：持续集成

```
CI = Continuous Integration（持续集成）

  核心思想：每次提交代码后，自动运行检查和测试

  ┌─────────────────────────────────────────┐
  │           持续集成流程                    │
  │                                          │
  │  开发者提交代码                           │
  │       │                                  │
  │       ▼                                  │
  │  ┌──────────┐                           │
  │  │ 自动触发  │                           │
  │  │ CI 流水线 │                           │
  │  └────┬─────┘                           │
  │       │                                  │
  │       ├──→ 安装依赖                      │
  │       ├──→ 代码检查（lint）               │
  │       ├──→ 单元测试                      │
  │       ├──→ 构建                          │
  │       └──→ 报告结果                      │
  │                                          │
  │  问题在合并前就被发现                      │
  └─────────────────────────────────────────┘
```

### 1.2 CD：持续部署/交付

```
CD = Continuous Deployment / Continuous Delivery

  持续交付：代码通过所有检查后，随时可以部署
  持续部署：代码通过所有检查后，自动部署到生产环境

  ┌─────────────────────────────────────────┐
  │           持续部署流程                    │
  │                                          │
  │  代码合并到 main                         │
  │       │                                  │
  │       ▼                                  │
  │  ┌──────────┐                           │
  │  │ CI 检查   │                           │
  │  └────┬─────┘                           │
  │       │                                  │
  │       ▼                                  │
  │  ┌──────────┐                           │
  │  │ 构建镜像  │                           │
  │  └────┬─────┘                           │
  │       │                                  │
  │       ▼                                  │
  │  ┌──────────┐                           │
  │  │ 推送到    │                           │
  │  │ Registry │                           │
  │  └────┬─────┘                           │
  │       │                                  │
  │       ▼                                  │
  │  ┌──────────┐                           │
  │  │ 自动部署  │                           │
  │  └──────────┘                           │
  └─────────────────────────────────────────┘
```

### 1.3 完整的 CI/CD 流程

```
┌─────────────────────────────────────────────────────────────┐
│                    完整 CI/CD 流程                           │
│                                                              │
│  开发 → 提交 → PR → CI 检查 → 合并 → 构建 → 部署            │
│   │       │     │      │       │      │      │              │
│   │       │     │      │       │      │      │              │
│  写代码  git   代码   lint    review  Docker  生产           │
│         push  审查   test    approve build   环境            │
│                       build                                  │
│                                                              │
│  每一步都是自动的，减少人工干预                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、为什么需要 CI/CD

### 2.1 没有 CI/CD 的问题

```
手动部署的痛点：

  1. 人工操作容易出错
     → 忘记跑测试、忘记构建、部署了错误版本

  2. 反馈周期长
     → 代码写完几天后才发现有问题

  3. 部署过程不可重复
     → "在我机器上能部署"和"在我电脑上能跑"一样

  4. 回滚困难
     → 出问题后不知道上一个正常版本是什么

  5. 团队协作低效
     → 每个人的本地环境不同，集成时冲突多
```

### 2.2 CI/CD 的价值

```
CI/CD 解决的问题：

  ✅ 自动化：减少人工操作，降低出错概率
  ✅ 快速反馈：提交后几分钟内知道结果
  ✅ 可重复：每次构建和部署流程完全一致
  ✅ 可追溯：每次部署都有记录，方便回滚
  ✅ 质量保障：代码检查和测试自动执行
```

---

## 三、GitHub Actions 简介

### 3.1 为什么选择 GitHub Actions

```
CI/CD 工具对比：

  ┌──────────────────┬────────────────────────────────────┐
  │  工具             │  特点                              │
  ├──────────────────┼────────────────────────────────────┤
  │  GitHub Actions  │  GitHub 原生，免费额度充足，生态丰富 │
  │  GitLab CI       │  GitLab 原生，功能强大              │
  │  Jenkins         │  自托管，配置复杂                   │
  │  CircleCI        │  云服务，配置简单                   │
  │  Travis CI       │  开源项目免费                       │
  └──────────────────┴────────────────────────────────────┘

  选择 GitHub Actions 的理由：
  - 代码在 GitHub 上，天然集成
  - 公开仓库免费，私有仓库有免费额度
  - 市场上有大量现成的 Action
  - 配置用 YAML，学习成本低
```

### 3.2 核心概念

```
GitHub Actions 核心概念：

  ┌─────────────────────────────────────────────────────┐
  │  Workflow（工作流）                                  │
  │  ├── 一个 YAML 文件定义一个自动化流程                 │
  │  ├── 存放在 .github/workflows/ 目录                  │
  │  └── 由事件触发（push、PR、定时等）                   │
  │                                                      │
  │  Job（任务）                                         │
  │  ├── Workflow 中的一个独立任务                        │
  │  ├── 运行在独立的 Runner（虚拟机）上                  │
  │  └── 多个 Job 默认并行执行                            │
  │                                                      │
  │  Step（步骤）                                        │
  │  ├── Job 中的一个步骤                                │
  │  ├── 可以是 shell 命令或 Action                      │
  │  └── 按顺序执行                                      │
  │                                                      │
  │  Action（动作）                                      │
  │  ├── 可复用的步骤                                    │
  │  ├── 市场上有大量现成的                               │
  │  └── 也可以自己编写                                   │
  └─────────────────────────────────────────────────────┘
```

### 3.3 一个简单的 Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

---

## 四、CI/CD 在项目中的位置

```
开发流程中的 CI/CD：

  ┌─────────────────────────────────────────────────────┐
  │                                                      │
  │  本地开发                                             │
  │  ├── 写代码                                          │
  │  ├── 本地测试                                        │
  │  └── git push                                        │
  │       │                                              │
  │       ▼                                              │
  │  CI（GitHub Actions）                                │
  │  ├── 代码检查（ESLint）                              │
  │  ├── 单元测试（Vitest）                              │
  │  ├── 构建验证                                        │
  │  └── 构建 Docker 镜像                                │
  │       │                                              │
  │       ▼                                              │
  │  CD（自动部署）                                       │
  │  ├── 推送镜像到 Registry                             │
  │  ├── 部署到测试环境                                   │
  │  └── 部署到生产环境（可选）                            │
  │                                                      │
  └─────────────────────────────────────────────────────┘
```

---

## 五、动手练习

### 练习一：创建第一个 Workflow

```bash
# 1. 在项目中创建目录
mkdir -p .github/workflows

# 2. 创建 ci.yml
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - name: Say Hello
        run: echo "Hello from GitHub Actions!"
      
      - name: Show Environment
        run: |
          echo "OS: $(uname -a)"
          echo "Node: $(node -v 2>/dev/null || echo 'not installed')"
          echo "Docker: $(docker -v 2>/dev/null || echo 'not installed')"
EOF

# 3. 提交并推送到 GitHub
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
git push

# 4. 在 GitHub 仓库的 Actions 标签页查看运行结果
```

### 练习二：添加实际检查

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

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
```

---

## 常见误区

- **"CI/CD 只有大项目才需要"**：哪怕一个人开发，CI 也能帮你自动跑测试、自动构建，避免"本地能跑、线上挂了"的问题。项目越小，手动操作出错的概率越高。
- **"CI 就是跑测试，CD 就是部署"**：CI 的核心是"持续集成"——频繁合并代码并验证；CD 的核心是"持续交付/部署"——让代码随时处于可发布状态。不只是技术动作，更是开发流程的变革。
- **"配了 CI/CD 就不用写测试了"**：CI/CD 只是自动执行你写好的检查。没有测试的 CI 流水线只是自动化的空壳，不会提升代码质量。
- **"GitHub Actions 免费额度不够用"**：公开仓库完全免费，私有仓库每月有 2000 分钟免费额度。对于中小型项目绰绰有余。

---

## 工程建议

- **从最小的 CI 开始**：先只跑 `npm test`，验证流水线跑通，再逐步添加 lint、build、部署等步骤。不要一开始就搭复杂的流水线。
- **PR 检查是第一道防线**：在 PR 阶段就跑 lint 和测试，问题在合并前就被发现，比合并后再修复成本低得多。
- **用 `workflow_dispatch` 支持手动触发**：有些操作（如部署到生产环境）不适合自动触发，手动触发更安全可控。
- **把 CI 配置文件纳入版本控制**：`.github/workflows/` 目录应该和代码一起维护，CI 配置变更也需要 review。

---

## 小结

1. **CI**：持续集成，每次提交自动检查
2. **CD**：持续部署，代码通过检查后自动部署
3. **GitHub Actions**：GitHub 原生 CI/CD，配置简单，生态丰富
4. **核心概念**：Workflow → Job → Step → Action

---

## 下一课预告

下一课我们将深入学习 GitHub Actions 的 workflow、job、step 语法。

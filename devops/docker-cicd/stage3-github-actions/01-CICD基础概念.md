# CI/CD 基础概念

> 前置知识：Docker 和 Compose 基础（前两个阶段）

## 一个真实的周五下午

你和三个同事开发一个项目。周五下午，小王提交了一个 PR，改了用户认证模块。你 review 了代码，觉得没问题，合并了。

周一早上，客户报告"登录不了"。你排查发现：小王的改动引入了一个边界条件 bug，只在 token 过期时触发。本地测试没覆盖这个场景，测试环境的 token 永不过期（被 mock 了），所以直到生产才暴露。

你花了两小时回滚，又花了一小时写 hotfix。

事后复盘，问题链是这样的：**代码 review 了但没跑自动化测试 → 合并到 main 后没有自动构建 → 部署是手动的所以没法快速回滚 → 没有生产环境的监控所以客户先发现。**

CI/CD 就是来打断这条问题链的。

## CI：每次提交都跑一遍

CI（Continuous Integration，持续集成）的核心思想很简单：**每次有人提交代码，自动跑一遍构建和测试。**

```
开发者提交 PR
    ↓
┌──────────────────────────────┐
│  自动化流水线                  │
│  1. 安装依赖                  │
│  2. Lint 检查                 │
│  3. 单元测试                  │
│  4. 构建                      │
└──────────────────────────────┘
    ↓
全部通过 → 可以合并
有失败   → 阻止合并，修复后再来
```

CI 的价值不是"自动化"，而是**把问题拦在合并之前**。上面那个 token 过期的 bug，如果有自动化测试覆盖，PR 阶段就能发现。

## CD：合并之后自动部署

CD 有两个含义：

- **Continuous Delivery（持续交付）**：代码合并后自动构建、自动测试、自动准备好部署，但部署动作需要人工确认
- **Continuous Deployment（持续部署）**：代码合并后自动构建、自动测试、自动部署到生产环境

大多数团队用 Continuous Delivery——自动构建，手动部署。全自动部署需要很强的测试覆盖和监控体系作为前提。

```
PR 合并到 main
    ↓
┌──────────────────────────────┐
│  CI 流水线                    │
│  lint → test → build         │
└──────────────────────────────┘
    ↓
构建 Docker 镜像
    ↓
推送到镜像仓库
    ↓
┌──────────────────────────────┐
│  CD 流水线                    │
│  部署到 staging → 验证        │
│  → 部署到 production（手动）  │
└──────────────────────────────┘
```

## GitHub Actions 是什么

GitHub Actions 是 GitHub 内置的 CI/CD 平台。核心概念：

**Workflow**：一个自动化流程，定义在 `.github/workflows/*.yml` 文件里。

**Trigger**：什么事件触发这个 workflow。最常见的是 `push`（代码推送）和 `pull_request`。

**Job**：workflow 中的一个执行单元，运行在一台虚拟机（runner）上。

**Step**：job 中的一个步骤，可以是运行命令，也可以是调用一个 action。

**Action**：可复用的步骤，比如 `actions/checkout`（拉代码）、`actions/setup-node`（安装 Node.js）。

```yaml
# .github/workflows/ci.yml
name: CI

on:
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
      - run: npm run build
```

这个 workflow 在每次 PR 提交到 main 分支时触发，依次执行：拉代码 → 安装 Node 18 → 安装依赖 → lint → 测试 → 构建。任何一步失败，workflow 标记为红色，PR 上会显示一个红色的叉。

## CI/CD 在开发流程中的位置

```
开发者写代码（本地）
    ↓
提交 PR
    ↓
CI 自动跑：lint + test + build     ← 拦截问题的第一道防线
    ↓
Code Review                        ← 人工审查
    ↓
合并到 main
    ↓
CI 再跑一遍 + 构建 Docker 镜像
    ↓
推送到镜像仓库
    ↓
CD 部署到 staging                  ← 自动化部署
    ↓
验证通过 → 手动批准 → 部署到生产
```

每一步都是一个问题拦截点。CI/CD 的价值不是"让机器干活"，而是**让每个拦截点都有明确的通过标准和失败反馈**。

## 没有 CI/CD 的代价

| 问题 | 没有 CI/CD | 有 CI/CD |
|------|-----------|----------|
| 代码质量问题 | 合并后才发现 | PR 阶段就拦住 |
| 构建失败 | "在我电脑上能跑啊" | Runner 环境一致 |
| 部署出错 | 手动操作，回滚慢 | 自动化，一键回滚 |
| 新人上手 | 不知道部署流程 | 看 workflow 文件就知道 |
| 排查问题 | 不知道哪个 commit 引入 | 每个 commit 都有 CI 记录 |

## 练习

### 练习一：识别 CI/CD 阶段

以下场景分别属于 CI 还是 CD？

- A：PR 提交后自动跑单元测试
- B：main 分支合并后自动构建 Docker 镜像
- C：手动点击"Deploy"按钮部署到生产
- D：代码推送后自动部署到测试环境
- E：自动扫描依赖的安全漏洞

### 练习二：画你项目的 CI/CD 流程

画出你当前项目的代码从提交到上线的完整流程。标注哪些步骤是自动化的，哪些是手动的。如果有 CI/CD，画出当前的 workflow；如果没有，画出你希望的 workflow。

### 练习三：分析一个 workflow

阅读以下 GitHub Actions workflow，回答问题：

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp:${{ github.sha }} .
      - run: docker push myapp:${{ github.sha }}
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: ssh deploy@server "docker pull myapp:${{ github.sha }} && docker-compose up -d"
```

1. 这个 workflow 什么时候触发？
2. build 和 deploy 两个 job 的执行顺序是什么？
3. 这个 workflow 有什么安全隐患？

---

## 参考答案

### 练习一

| 场景 | 阶段 | 理由 |
|------|------|------|
| A：PR 自动测试 | CI | 代码集成前的质量检查 |
| B：自动构建镜像 | CI/CD 边界 | 构建是 CI 的最后一步，也是 CD 的第一步 |
| C：手动部署 | CD | 部署动作，虽然不是"持续"的 |
| D：自动部署测试环境 | CD | 自动化部署到特定环境 |
| E：安全扫描 | CI | 代码集成前的安全检查 |

### 练习二

没有标准答案。关键是识别出当前流程中的"手动环节"和"自动化环节"，以及缺失的拦截点。

### 练习三

1. **触发时机**：push 到 main 分支时（不包括 PR）。
2. **执行顺序**：`deploy` 的 `needs: build` 表示 deploy 必须等 build 成功后才执行。
3. **安全隐患**：
   - `ssh deploy@server` 的凭据没有使用 secrets 管理，直接写在 workflow 里
   - `$GITHUB_SHA` 没有过滤，理论上可以注入（虽然 GitHub 做了基本的安全处理）
   - 没有测试步骤——直接构建就部署了
   - 没有回滚机制——如果新版本有问题，没有自动回滚

# 07. 依赖安全审计与漏洞修复

> npm audit、Snyk、Dependabot、许可证合规——守护项目的供应链安全

## 本课目标

- 理解前端项目依赖安全的风险和攻击方式
- 掌握 npm audit 的使用和漏洞修复策略
- 配置 Dependabot 实现自动化的依赖更新
- 了解 Snyk 等专业安全工具的使用
- 进行许可证合规检查

## 依赖安全为什么重要

一个典型的前端项目可能有几百到上千个依赖。每个依赖都可能引入安全风险：

```
你的项目
├── react (你选择的)
├── axios (你选择的)
├── lodash (你选择的)
│   └── 12 个间接依赖
├── webpack (你选择的)
│   └── 200+ 个间接依赖
└── ... 总共 500-2000 个依赖
```

你选择的直接依赖可能经过了审查，但那些间接依赖呢？你甚至不知道它们的存在。

### 供应链攻击案例

**event-stream 事件（2018）**：一个流行的 npm 包 `event-stream` 的维护者权限被转让给恶意攻击者。攻击者添加了一个依赖 `flatmap-stream`，其中包含窃取比特币钱包的代码。这个恶意代码在被发现前存在了两个月，被数百万项目间接使用。

**ua-parser-js 事件（2021）**：`ua-parser-js` 每周下载量超过 700 万次。攻击者劫持了维护者的 npm 账号，发布了包含加密货币挖矿和密码窃取代码的恶意版本。

这些案例说明：**依赖安全不是可选的，而是必须的**。

## npm audit

npm audit 是最基础的依赖安全检查工具，内置于 npm/pnpm/yarn 中。

### 基本用法

```bash
# 检查漏洞
pnpm audit

# 输出示例
# ┌───────────────┬──────────────────────────────────────┐
# │ high          │ Prototype Pollution in lodash         │
# ├───────────────┼──────────────────────────────────────┤
# │ Package       │ lodash                                │
# │ Dependency of │ your-project                          │
# │ Path          │ your-project > lodash                 │
# │ More info     │ https://github.com/advisories/...     │
# └───────────────┴──────────────────────────────────────┘
```

### 漏洞级别

| 级别 | 含义 | 处理策略 |
|------|------|----------|
| critical | 可远程执行代码、数据泄露 | 立即修复 |
| high | 严重影响安全 | 24 小时内修复 |
| moderate | 中等影响 | 一周内修复 |
| low | 低影响 | 计划修复 |
| info | 信息性 | 评估是否需要处理 |

### 修复策略

```bash
# 自动修复（升级到安全版本）
pnpm audit fix

# 只修复不包含 breaking change 的
pnpm audit fix

# 强制修复（可能包含 breaking change）
pnpm audit fix --force

# 查看详细信息
pnpm audit --json
```

### 手动修复

当自动修复不可用时，需要手动处理：

```bash
# 查看具体漏洞信息
pnpm audit

# 手动升级依赖
pnpm update lodash

# 如果需要指定版本
pnpm add lodash@^4.17.21
```

### 忽略特定漏洞

有些漏洞可能不适用于你的使用场景：

```json
// package.json
{
  "pnpm": {
    "auditConfig": {
      "ignoreCves": [
        "CVE-2023-XXXXX"
      ]
    }
  }
}
```

**但要谨慎使用**：只有在确认漏洞不影响你的项目时才忽略。最好在忽略的同时添加注释说明原因。

## Dependabot

Dependabot 是 GitHub 内置的依赖更新工具。它会自动检测依赖更新，并创建 PR。

### 配置文件

```yaml
# .github/dependabot.yml
version: 2
updates:
  # npm 依赖
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
      timezone: Asia/Shanghai
    open-pull-requests-limit: 10
    reviewers:
      - frontend-team
    labels:
      - dependencies
    commit-message:
      prefix: "chore(deps)"
    groups:
      # 将开发依赖的更新分组到一个 PR
      dev-dependencies:
        dependency-type: development
        update-types:
          - minor
          - patch
      # 将生产依赖的小版本更新分组
      production-minor:
        dependency-type: production
        update-types:
          - minor

  # GitHub Actions
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    labels:
      - ci
      - dependencies
```

### 配置说明

- `schedule.interval`：检查频率。daily、weekly、monthly
- `open-pull-requests-limit`：同时打开的 PR 数量限制
- `reviewers`：自动指定审查者
- `labels`：自动打标签
- `groups`：将多个更新合并到一个 PR

### 安全更新

Dependabot 会自动为已知安全漏洞创建 PR：

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: daily  # 安全更新建议每天检查
    reviewers:
      - security-team
    labels:
      - security
      - dependencies
```

### Monorepo 中的 Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  # 根目录
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly

  # 前端应用
  - package-ecosystem: npm
    directory: /packages/web
    schedule:
      interval: weekly

  # 后端服务
  - package-ecosystem: npm
    directory: /packages/api
    schedule:
      interval: weekly
```

## Snyk

Snyk 是专业的安全平台，提供比 npm audit 更全面的安全检查。

### 基本用法

```bash
# 安装 Snyk CLI
pnpm add -D snyk

# 认证
npx snyk auth

# 测试项目
npx snyk test

# 监控项目（上传到 Snyk 控制台）
npx snyk monitor
```

### Snyk vs npm audit

| 特性 | npm audit | Snyk |
|------|-----------|------|
| 漏洞数据库 | npm Advisory | Snyk Vulnerability DB（更全面） |
| 修复建议 | 基础 | 详细的修复步骤 |
| 自动修复 PR | 需要 Dependabot | 内置 |
| 代码扫描 | 不支持 | 支持 |
| 容器扫描 | 不支持 | 支持 |
| CI 集成 | 基础 | 丰富的集成 |
| 免费额度 | 无限 | 有限制 |

### GitHub Actions 集成

```yaml
# .github/workflows/security.yml
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1' # 每周一早上 8 点

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### CI 中的安全门禁

```yaml
# 只报告高危和严重漏洞
- uses: snyk/actions/node@master
  with:
    args: --severity-threshold=high

# 如果有高危漏洞则失败
- uses: snyk/actions/node@master
  with:
    args: --fail-on=high
```

## 许可证合规

依赖不仅可能引入安全漏洞，还可能引入许可证风险。

### 常见许可证类型

| 许可证 | 类型 | 风险 |
|--------|------|------|
| MIT | 宽松 | 低，可以商用 |
| Apache-2.0 | 宽松 | 低，需要保留声明 |
| BSD-2-Clause | 宽松 | 低，类似 MIT |
| BSD-3-Clause | 宽松 | 低，多了非背书条款 |
| ISC | 宽松 | 低，类似 MIT |
| LGPL-2.1 | 弱 Copyleft | 中，动态链接通常安全 |
| GPL-2.0 | Copyleft | 高，衍生作品必须开源 |
| GPL-3.0 | Copyleft | 高，比 GPL-2.0 更严格 |
| AGPL-3.0 | 网络 Copyleft | 很高，网络使用也受约束 |

### license-checker

```bash
pnpm add -D license-checker
```

```bash
# 列出所有依赖的许可证
npx license-checker

# 只列出有问题的许可证
npx license-checker --failOn "GPL-3.0;AGPL-3.0"

# 输出为 JSON
npx license-checker --json > licenses.json

# 自定义允许的许可证
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"
```

### 在 CI 中检查许可证

```yaml
# .github/workflows/license.yml
name: License Check

on:
  pull_request:
    branches: [main]

jobs:
  license:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

### Snyk 的许可证检查

```bash
# 检查许可证风险
npx snyk test --license
```

## 锁文件的重要性

锁文件（pnpm-lock.yaml、package-lock.json、yarn.lock）不仅是确保一致性的工具，也是安全工具。

### 为什么锁文件与安全相关

```json
// package.json
{
  "dependencies": {
    "lodash": "^4.17.0"
  }
}
```

`^4.17.0` 意味着可以安装 4.17.0 到 4.x.x 的任何版本。如果没有锁文件，不同时间安装可能得到不同版本，包括可能包含漏洞的版本。

锁文件锁定了确切的版本和完整性哈希，确保：
1. 所有人安装的版本一致
2. 安装的包没有被篡改

### 锁文件安全实践

```bash
# 在 CI 中使用 --frozen-lockfile
pnpm install --frozen-lockfile

# 确保锁文件提交到仓库
git add pnpm-lock.yaml
```

## 依赖审查流程

建立一个完整的依赖审查流程：

### 引入新依赖的检查清单

```markdown
## 新依赖审查清单

### 基本信息
- [ ] 包名和版本
- [ ] 许可证类型
- [ ] 最近更新时间
- [ ] 维护状态（活跃/维护中/已废弃）

### 安全检查
- [ ] npm audit 无高危漏洞
- [ ] Snyk test 通过
- [ ] 无已知供应链攻击历史

### 质量检查
- [ ] GitHub stars > 100（参考指标，不是决定因素）
- [ ] 有活跃的 issue 和 PR
- [ ] 有测试覆盖
- [ ] 有 TypeScript 类型（或 @types 包）

### 必要性检查
- [ ] 是否真的需要这个依赖
- [ ] 能否用更少的代码实现
- [ ] 是否有更轻量的替代方案
```

### 定期审计

```json
// package.json
{
  "scripts": {
    "audit": "pnpm audit",
    "audit:fix": "pnpm audit fix",
    "license:check": "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'",
    "security:check": "snyk test"
  }
}
```

在 CI 中定期运行安全检查：

```yaml
# .github/workflows/security-schedule.yml
name: Security Schedule

on:
  schedule:
    - cron: '0 8 * * 1' # 每周一

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

## 常见误区

### 误区一：开源软件是安全的

**错误理解**：开源意味着代码被很多人审查过，所以是安全的

**正确理解**：开源只意味着代码是可见的，不意味着被审查过。很多流行包的核心维护者只有 1-2 人，代码审查有限。供应链攻击证明开源软件同样存在安全风险。

### 误区二：npm audit 报告太多，不用管

**错误理解**：npm audit 总是报告大量漏洞，很多都是误报

**正确理解**：npm audit 的报告确实可能包含不适用于你项目的漏洞（比如开发依赖中的漏洞）。但应该区分处理：critical 和 high 级别的必须评估，low 和 info 的可以评估后决定是否忽略。不要因为噪音多就全部忽略。

### 误区三：锁文件不需要提交

**错误理解**：锁文件自动生成的，不需要提交到 Git

**正确理解**：锁文件必须提交。它确保所有开发者和 CI 使用相同的依赖版本。没有锁文件，不同环境安装的版本可能不同，导致"在我电脑上是好的"这类问题。

### 误区四：依赖越少越好

**错误理解**：减少依赖数量就能减少安全风险

**正确理解**：减少不必要的依赖是好的，但不应该为了"零依赖"而重复造轮子。一个经过充分测试、广泛使用的依赖，通常比自己写的代码更安全。关键是**管理**依赖，而不是**消除**依赖。

## 本课小结

1. **供应链风险**：每个依赖都可能引入安全漏洞或恶意代码
2. **npm audit**：基础安全检查，区分级别处理
3. **Dependabot**：自动检测依赖更新和安全漏洞
4. **Snyk**：专业安全平台，更全面的漏洞数据库
5. **许可证合规**：检查依赖的许可证，避免法律风险
6. **锁文件**：确保一致性和完整性，必须提交

## 练习

### 练习一：审计你的项目

对你的项目运行安全审计：
- 运行 `pnpm audit`，记录所有高危和严重漏洞
- 运行 `npx license-checker`，找出所有非宽松许可证
- 评估每个漏洞是否适用于你的项目

### 练习二：配置 Dependabot

为项目配置 Dependabot，要求：
- 每周检查 npm 依赖更新
- 每天检查安全更新
- 将开发依赖的小版本更新分组到一个 PR

### 练习三：设计依赖审查流程

为你的团队设计一个依赖审查流程，包括：
- 引入新依赖的检查清单
- 定期审计的频率和工具
- 安全漏洞的响应流程

## 参考答案

### 练习一

```bash
# 运行安全审计
pnpm audit

# 输出示例：
# # npm audit report
# lodash  <4.17.21
# Severity: high
# Prototype Pollution - https://github.com/advisories/GHSA-jf85-cpcp-j695
# fix available via `pnpm audit fix`
#
# 1 high | 0 moderate | 0 low

# 运行许可证检查
npx license-checker --summary

# 输出示例：
# licenses: 425 (MIT: 380, Apache-2.0: 25, BSD-2-Clause: 10, ISC: 8, GPL-3.0: 2)

# 评估：
# - lodash 的 Prototype Pollution 漏洞：升级到 4.17.21 即可修复
# - GPL-3.0 依赖：需要评估是否影响项目（通常前端项目不受影响）
```

### 练习二

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
    reviewers:
      - frontend-team
    labels:
      - dependencies
    groups:
      dev-dependencies:
        dependency-type: development
        update-types: [minor, patch]
    commit-message:
      prefix: "chore(deps)"

  - package-ecosystem: npm
    directory: /
    schedule:
      interval: daily
    open-pull-requests-limit: 5
    labels:
      - security
      - dependencies
    commit-message:
      prefix: "fix(security)"
```

### 练习三

```markdown
## 依赖审查流程

### 新依赖引入
1. 在 PR 中说明引入原因
2. 运行 `pnpm audit` 和 `license-checker`
3. 检查包的维护状态和最近更新时间
4. 至少一位审查者确认

### 定期审计
- 每周一：Dependabot 自动检查安全更新
- 每月第一周：运行全量 `pnpm audit` 和 `license-checker`
- 每季度：审查所有依赖，移除不再使用的

### 安全漏洞响应
- Critical/High：24 小时内评估，48 小时内修复
- Moderate：一周内评估和修复
- Low：下次发版时处理
```

## 下一步

完成本课后，继续学习 [08. 阶段项目：搭建完整的代码质量门禁](./08-stage-project.md)。

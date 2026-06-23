# 05. 代码审查流程与自动化

> PR Review 规范、CODEOWNERS、自动化检查——让代码审查从"走过场"变成"真有用"

## 本课目标

- 建立有效的代码审查流程和规范
- 配置 CODEOWNERS 自动分配审查人
- 搭建自动化检查流水线
- 理解代码审查中的人际沟通问题

## 代码审查到底在审查什么

很多人把代码审查理解为"找 bug"或者"检查代码风格"。这两件事应该交给自动化工具。代码审查真正需要人判断的是：

1. **设计合理性**：这个方案是不是解决这个问题的正确方式
2. **可维护性**：半年后另一个人能看懂这段代码吗
3. **边界情况**：极端输入、并发、错误路径有没有处理
4. **架构一致性**：新代码是否符合项目的架构约定
5. **测试充分性**：测试是否覆盖了关键路径

一个常见的误区是审查者把时间花在"这里应该用 const 而不是 let"这类风格问题上。如果这些可以自动化检查，就应该自动化。

## PR Review 规范

### PR 的粒度

一个好的 PR 应该满足：

```
一个 PR 解决一个问题
├── 问题可以是一个 bug
├── 问题可以是一个功能
├── 问题可以是一个重构
└── 但不能同时是 bug 修复 + 新功能 + 重构
```

**错误做法**：一个 PR 包含 3000 行改动，涉及 50 个文件，涵盖了功能开发、bug 修复、代码重构。

**正确做法**：拆成 3-4 个 PR，每个 PR 聚焦一个目标。

为什么：大 PR 的审查质量会急剧下降。审查者面对 3000 行代码，很难集中注意力发现设计问题。而小 PR（200-500 行）能让审查者深入理解每处改动的意图。

### PR 描述模板

```markdown
## 改动说明

简要描述这个 PR 做了什么、为什么要做。

## 改动类型

- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 文档
- [ ] 其他

## 关联 Issue

Closes #123

## 测试说明

- [ ] 已添加/更新单元测试
- [ ] 已进行手动测试
- [ ] 已添加/更新 E2E 测试

## 截图（如适用）

## 注意事项

需要审查者特别关注的地方。
```

### 审查清单

每个团队应该有自己的审查清单。以下是一个基础版本：

**设计**
- [ ] 方案是否合理，有没有更简单的替代方案
- [ ] 是否引入了不必要的抽象
- [ ] 模块边界是否清晰

**代码质量**
- [ ] 命名是否清晰、一致
- [ ] 是否有重复代码可以提取
- [ ] 错误处理是否充分
- [ ] 是否有性能隐患

**测试**
- [ ] 测试是否覆盖了关键路径
- [ ] 测试是否可读、可维护
- [ ] 是否测试了边界情况

**安全**
- [ ] 是否有 SQL 注入、XSS 等安全风险
- [ ] 敏感信息是否暴露
- [ ] 依赖是否有已知漏洞

**文档**
- [ ] 是否需要更新 README
- [ ] API 变更是否需要文档
- [ ] 是否有注释解释复杂逻辑

## CODEOWNERS

### 什么是 CODEOWNERS

CODEOWNERS 是 GitHub/GitLab 的功能，用于定义哪些人对哪些文件负责。当 PR 修改了某个文件时，对应的 CODEOWNERS 会自动被添加为审查人。

### 配置方式

在仓库根目录创建 `.github/CODEOWNERS` 文件：

```gitignore
# 全局所有者（默认审查人）
*                       @team-lead

# 前端代码
/src/components/        @frontend-team
/src/hooks/             @frontend-team
/src/utils/             @frontend-team

# 构建配置
vite.config.ts          @build-team
webpack.config.js       @build-team
package.json            @build-team
pnpm-lock.yaml          @build-team

# CI/CD
.github/                @devops-team
Dockerfile              @devops-team

# 文档
*.md                    @docs-team

# 特定文件的专家
/src/core/auth/         @security-team
/src/core/payment/      @backend-team @security-team
```

### 匹配规则

```
# 按文件扩展名
*.css                   @css-team

# 按目录
/src/api/               @api-team

# 按具体文件
src/config/production.ts @devops-team

# 通配符
**/*.test.ts            @qa-team

# 排除特定文件（用 ! 前缀，但注意 CODEOWNERS 不支持否定模式）
# 需要通过更具体的规则来覆盖
```

### Monorepo 中的 CODEOWNERS

```
# 根目录配置
*                       @tech-lead

# 前端包
/packages/app/          @frontend-team
/packages/shared/       @frontend-team @backend-team

# 后端包
/packages/api/          @backend-team
/packages/database/     @backend-team

# 工具包
/packages/eslint-config/ @tooling-team
/packages/tsconfig/     @tooling-team

# 特定文件
/packages/shared/src/auth/ @security-team
```

## 自动化检查流水线

### GitHub Actions 配置

```yaml
# .github/workflows/pr-check.yml
name: PR Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 保护分支规则

在 GitHub 的 Settings → Branches → Branch protection rules 中配置：

```
Branch name pattern: main

✅ Require a pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale PR approvals when new commits are pushed
  ✅ Require review from Code Owners

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  Required status checks:
    - Lint
    - Type Check
    - Test
    - Build

✅ Require conversation resolution before merging
✅ Require linear history
```

### PR 自动标签

使用 GitHub Actions 自动给 PR 打标签：

```yaml
# .github/workflows/pr-label.yml
name: PR Label

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v4
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# .github/labeler.yml
frontend:
  - changed-files:
    - any-glob-to-any-file:
      - 'packages/app/**'
      - 'packages/shared/**'

backend:
  - changed-files:
    - any-glob-to-any-file:
      - 'packages/api/**'
      - 'packages/database/**'

ci:
  - changed-files:
    - any-glob-to-any-file:
      - '.github/**'
      - 'Dockerfile'
```

## PR 尺寸检查

自动检测 PR 的大小，给过大的 PR 打标签：

```yaml
# .github/workflows/pr-size.yml
name: PR Size

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pascalgn/size-label-action@v0.5.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          sizes: >
            {
              "xs": 50,
              "s": 200,
              "m": 500,
              "l": 1000,
              "xl": 2000
            }
```

## 代码审查的沟通

代码审查不仅是技术活动，也是人际沟通。几个原则：

### 1. 对事不对人

```markdown
❌ "你这段代码写得不好"
✅ "这里用 Map 替代 Object 可以避免原型链污染的问题"
```

### 2. 提问而不是命令

```markdown
❌ "改成用 const"
✅ "这里用 const 是否更合适？因为这个变量不会被重新赋值"
```

### 3. 区分必须修改和建议

```markdown
❌ (没有区分，审查者不确定哪些是阻塞项)

✅ **[必须修复]** 这里没有处理 null，会导致运行时错误
💡 **[建议]** 这里可以考虑用 Map 替代 Object，但不阻塞合并
```

### 4. 给出原因

```markdown
❌ "不要这样写"
✅ "不建议这样写，因为当数组长度超过 1000 时，concat 的性能会明显下降"
```

### 5. 认可好的设计

```markdown
❌ (只提问题，不提优点)

✅ "这个错误处理的设计很清晰，每种错误类型都有明确的处理路径。"
```

## 本地预提交检查

在 PR 之前就发现问题，减少审查来回：

### Husky + lint-staged

```json
// package.json
{
  "devDependencies": {
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  },
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

### commit-msg 检查

```json
// package.json
{
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0"
  }
}
```

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
};
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

## 常见误区

### 误区一：代码审查就是找 bug

**错误理解**：审查者的任务是找出所有 bug

**正确理解**：自动化工具负责找 bug（ESLint、TypeScript、测试）。审查者负责判断设计合理性、可维护性、架构一致性。

### 误区二：所有代码都需要两个人审查

**错误理解**：每行代码都需要审查者批准

**正确理解**：不同类型的改动需要不同的审查深度。配置文件修改、文档更新可能只需要快速确认；核心逻辑变更需要深入审查。CODEOWNERS 可以自动分配正确的审查者。

### 误区三：审查意见必须全部采纳

**错误理解**：审查者说的都对，必须改

**正确理解**：代码审查是讨论，不是指令。如果作者有更好的理由，可以讨论后决定不采纳。关键是达成共识，而不是服从。

### 误区四：自动化检查够了，不需要人工审查

**错误理解**：CI 跑通了，代码就没问题了

**正确理解**：自动化检查只能发现它被配置来检查的问题。设计问题、业务逻辑问题、用户体验问题——这些需要人来判断。自动化检查是第一道防线，人工审查是第二道。

## 本课小结

1. **审查重点**：设计、可维护性、边界、架构一致性、测试充分性
2. **PR 规范**：小粒度、清晰描述、审查清单
3. **CODEOWNERS**：自动分配审查人，明确代码责任
4. **CI 检查**：lint、typecheck、test、build，全部通过才能合并
5. **沟通原则**：对事不对人、提问不命令、区分必须和建议

## 练习

### 练习一：配置 CODEOWNERS

为一个 Monorepo 项目配置 CODEOWNERS，项目结构如下：

```
packages/
├── web/          # 前端应用
├── api/          # 后端服务
├── shared/       # 共享工具库
└── mobile/       # 移动端应用
.github/
docs/
scripts/
```

### 练习二：设计审查清单

为你的团队设计一份代码审查清单，包含至少 10 个检查项，覆盖设计、代码质量、测试、安全四个维度。

### 练习三：配置 PR 检查

编写一个 GitHub Actions 工作流，在 PR 创建时自动运行 ESLint、TypeScript 类型检查和单元测试。

## 参考答案

### 练习一

```gitignore
# .github/CODEOWNERS

# 全局
*                       @tech-lead

# 前端
/packages/web/          @frontend-team
/packages/web/src/core/ @frontend-team @security-team

# 后端
/packages/api/          @backend-team
/packages/api/src/db/   @backend-team @dba-team

# 共享库
/packages/shared/       @frontend-team @backend-team

# 移动端
/packages/mobile/       @mobile-team

# CI/CD
.github/                @devops-team
/scripts/               @devops-team

# 文档
/docs/                  @docs-team
*.md                    @docs-team

# 构建和依赖
package.json            @tech-lead
pnpm-lock.yaml          @tech-lead
tsconfig.json           @tech-lead
```

### 练习二

```markdown
## 代码审查清单

### 设计
1. 方案是否合理，有没有更简单的替代方案
2. 是否引入了不必要的抽象或过度设计
3. 新代码是否符合项目的架构约定
4. 模块边界是否清晰，职责是否单一

### 代码质量
5. 命名是否清晰、语义准确
6. 是否有重复代码可以复用已有函数
7. 错误处理是否充分，是否有未处理的错误路径
8. 是否有性能隐患（如不必要的重渲染、大列表未分页）

### 测试
9. 测试是否覆盖了关键路径
10. 是否测试了边界情况和错误路径
11. 测试是否可读，是否在验证行为而非实现细节

### 安全
12. 是否有注入风险（SQL、XSS、命令注入）
13. 敏感信息是否暴露在代码或日志中
14. 依赖是否有已知高危漏洞
```

### 练习三

```yaml
name: PR Check

on:
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: ESLint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Unit Tests
        run: pnpm test -- --coverage --ci

      - name: Upload Coverage
        if: always()
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

## 下一步

完成本课后，继续学习 [06. 提交信息规范与版本管理](./06-commit-version.md)。

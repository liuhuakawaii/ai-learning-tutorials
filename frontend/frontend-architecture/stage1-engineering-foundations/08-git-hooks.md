# 08. Git Hooks 与提交规范

> husky、commitlint、lint-staged，建立代码质量门禁

## 本课目标

- 理解 Git Hooks 的作用和类型
- 掌握 husky 配置 Git Hooks
- 学会使用 commitlint 规范提交信息
- 建立 lint-staged 代码检查流程

## 什么是 Git Hooks

### Git Hooks 概念

Git Hooks 是 Git 提供的**钩子机制**，用于在特定事件发生时执行自定义脚本。

**常见 Hooks**：
- `pre-commit`：提交前执行
- `commit-msg`：提交信息编辑后执行
- `pre-push`：推送前执行
- `pre-rebase`：变基前执行

### Hooks 的作用

1. **代码检查**：提交前检查代码风格
2. **测试运行**：提交前运行测试
3. **提交规范**：检查提交信息格式
4. **自动化**：自动执行某些操作

### Hooks 的问题

**手动配置的 Hooks**：
```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run lint
```

**问题**：
1. 不在版本控制中
2. 每个开发者需要手动配置
3. 容易忘记配置

## husky

### 什么是 husky

husky 是一个**Git Hooks 管理工具**，用于：
1. 在版本控制中管理 Git Hooks
2. 自动配置 Git Hooks
3. 跨平台支持

### 安装和配置

```bash
# 安装 husky
pnpm add -D husky

# 初始化 husky
npx husky install
```

**package.json 配置**：
```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

### 添加 Hook

```bash
# 添加 pre-commit hook
npx husky add .husky/pre-commit "pnpm lint"

# 添加 commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

**生成的文件**：
```
.husky/
├── pre-commit
└── commit-msg
```

### Hook 文件

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint
```

```bash
# .husky/commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx --no -- commitlint --edit "$1"
```

### 常用命令

```bash
# 安装 husky
npx husky install

# 添加 hook
npx husky add .husky/pre-commit "pnpm lint"

# 删除 hook
npx husky remove .husky/pre-commit

# 列出所有 hook
npx husky list
```

## commitlint

### 什么是 commitlint

commitlint 是一个**提交信息检查工具**，用于：
1. 检查提交信息格式
2. 强制使用约定式提交
3. 自动生成变更日志

### 约定式提交

**格式**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例**：
```
feat(auth): add login functionality

- Add login form
- Add login API
- Add login tests

Closes #123
```

**类型**：
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码风格修改
- `refactor`：重构
- `test`：测试相关
- `chore`：构建/工具相关

### 安装和配置

```bash
# 安装 commitlint
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

**配置文件**：
```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 bug
        'docs',     // 文档更新
        'style',    // 代码风格修改
        'refactor', // 重构
        'test',     // 测试相关
        'chore',    // 构建/工具相关
        'perf',     // 性能优化
        'ci',       // CI/CD 相关
        'revert',   // 回滚
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
```

### 使用示例

```bash
# 检查提交信息
echo "feat: add login functionality" | npx commitlint

# 输出：
# ✔ Found 0 problems, 0 warnings

# 检查错误的提交信息
echo "add login functionality" | npx commitlint

# 输出：
# ✖ subject may not be empty
# ✖ type may not be empty
```

## lint-staged

### 什么是 lint-staged

lint-staged 是一个**代码检查工具**，用于：
1. 只检查暂存区的文件
2. 自动修复可修复的问题
3. 提交前自动格式化

### 安装和配置

```bash
# 安装 lint-staged
pnpm add -D lint-staged
```

**package.json 配置**：
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

**配置文件**：
```javascript
// lint-staged.config.js
module.exports = {
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
  ],
};
```

### 使用示例

```bash
# 手动运行
npx lint-staged

# 输出：
# ✔ Running tasks for staged files...
# ✔ Applying modifications from tasks...
# ✔ Cleaning up temporary files...
```

## 完整配置

### 项目结构

```
my-monorepo/
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── commitlint.config.js
├── lint-staged.config.js
├── package.json
└── ...
```

### package.json

```json
{
  "name": "@myorg/monorepo",
  "private": true,
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@commitlint/cli": "^17.0.0",
    "@commitlint/config-conventional": "^17.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^13.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### commitlint.config.js

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'revert',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
```

### .husky/pre-commit

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

### .husky/commit-msg

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx --no -- commitlint --edit "$1"
```

## 工作流程

### 开发流程

```bash
# 1. 修改代码
vim src/index.ts

# 2. 暂存文件
git add src/index.ts

# 3. 提交代码
git commit -m "feat: add new feature"

# 自动执行：
# - lint-staged 检查代码
# - commitlint 检查提交信息
```

### 检查流程

```bash
# 提交前检查
git commit -m "add new feature"

# 输出：
# ✖ subject may not be empty
# ✖ type may not be empty

# 修正提交信息
git commit -m "feat: add new feature"

# 输出：
# ✔ Running tasks for staged files...
# ✔ Applying modifications from tasks...
# ✔ Cleaning up temporary files...
# [main abc1234] feat: add new feature
```

## 实战：配置 Git Hooks

### 项目结构

```
my-monorepo/
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── commitlint.config.js
├── package.json
└── ...
```

### 配置步骤

```bash
# 1. 安装依赖
pnpm add -D husky @commitlint/cli @commitlint/config-conventional lint-staged

# 2. 初始化 husky
npx husky install

# 3. 添加 pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# 4. 添加 commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'

# 5. 配置 package.json
# 添加 prepare 脚本和 lint-staged 配置

# 6. 配置 commitlint
# 创建 commitlint.config.js

# 7. 提交配置
git add .
git commit -m "chore: configure git hooks"
```

### 使用示例

```bash
# 修改代码
vim src/index.ts

# 暂存文件
git add src/index.ts

# 提交代码
git commit -m "feat: add new feature"

# 输出：
# ✔ Running tasks for staged files...
# ✔ Applying modifications from tasks...
# ✔ Cleaning up temporary files...
# [main abc1234] feat: add new feature
```

## 最佳实践

### 1. 统一配置

所有项目使用相同的 Git Hooks 配置：
- husky
- commitlint
- lint-staged

### 2. 提交配置

将所有配置文件提交到仓库：
```bash
git add .husky commitlint.config.js package.json
git commit -m "chore: configure git hooks"
```

### 3. 文档说明

在 README 中说明提交规范：
```markdown
## 提交规范

使用约定式提交：

```
<type>(<scope>): <subject>
```

类型：
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码风格修改
- `refactor`：重构
- `test`：测试相关
- `chore`：构建/工具相关
```

### 4. 自动化

配置 CI/CD 检查提交信息：
```yaml
# .github/workflows/ci.yml
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }}
```

## 常见问题

### Q: 如何跳过 Git Hooks？

A: 使用 `--no-verify` 参数：`git commit --no-verify -m "message"`。

### Q: 如何修改提交信息？

A: 使用 `git commit --amend -m "new message"`。

### Q: 如何查看 Git Hooks？

A: 查看 `.husky` 目录。

### Q: 如何禁用 Git Hooks？

A: 删除 `.husky` 目录或重命名 hook 文件。

## 本课小结

本课我们掌握了 Git Hooks 与提交规范的核心能力：

1. **Git Hooks**：钩子机制，提交前检查
2. **husky**：Git Hooks 管理工具
3. **commitlint**：提交信息检查工具
4. **lint-staged**：代码检查工具
5. **约定式提交**：统一提交信息格式

## 练习

### 练习一：配置 Git Hooks

为一个项目配置 Git Hooks：
- 安装 husky
- 配置 commitlint
- 配置 lint-staged
- 测试提交流程

### 练习二：使用约定式提交

使用约定式提交格式提交代码：
- 新功能：`feat: add login functionality`
- 修复 bug：`fix: resolve login error`
- 文档更新：`docs: update README`

## 参考答案

### 练习一

**配置步骤**：
```bash
# 1. 安装依赖
pnpm add -D husky @commitlint/cli @commitlint/config-conventional lint-staged

# 2. 初始化 husky
npx husky install

# 3. 添加 pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# 4. 添加 commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'

# 5. 配置 package.json
# 添加 prepare 脚本和 lint-staged 配置

# 6. 配置 commitlint
# 创建 commitlint.config.js

# 7. 提交配置
git add .
git commit -m "chore: configure git hooks"
```

### 练习二

**提交示例**：
```bash
# 新功能
git commit -m "feat: add login functionality"

# 修复 bug
git commit -m "fix: resolve login error"

# 文档更新
git commit -m "docs: update README"
```

## 下一步

完成本课后，继续学习 [09. Monorepo 常见坑与解决方案](./09-monorepo-pitfalls.md)。

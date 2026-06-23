# 08. 阶段项目：搭建完整的代码质量门禁

> ESLint + Prettier + Husky + lint-staged + CI 集成——把前 7 课的知识串成一个完整的工程方案

## 本课目标

- 将前 7 课学到的工具和流程整合成一个完整的代码质量门禁
- 从零搭建一个可落地到真实项目的质量保障体系
- 理解每个组件的作用和它们之间的协作关系

## 项目目标

为一个 TypeScript + React 的 Monorepo 项目搭建完整的代码质量门禁，覆盖代码从编写到合并的全链路：

```
编写代码
    │
    ├── 编辑器实时检查（ESLint + Prettier 插件）
    │
    ▼
保存文件
    │
    ├── 自动格式化（Prettier）
    │
    ▼
Git 提交
    │
    ├── lint-staged（只检查暂存文件）
    ├── commitlint（检查提交信息）
    │
    ▼
创建 PR
    │
    ├── CI 流水线（ESLint + TypeScript + 测试 + 构建）
    ├── CODEOWNERS 自动分配审查
    ├── Dependabot 安全检查
    │
    ▼
合并到 main
    │
    ├── 自动发布（semantic-release）
    └── 自动更新 CHANGELOG
```

## 项目结构

```
my-monorepo/
├── .github/
│   ├── workflows/
│   │   ├── pr-check.yml        # PR 检查
│   │   └── release.yml         # 自动发布
│   ├── CODEOWNERS              # 代码责任人
│   └── dependabot.yml          # 依赖更新
├── .husky/
│   ├── pre-commit              # 提交前检查
│   └── commit-msg              # 提交信息检查
├── packages/
│   ├── app/                    # 前端应用
│   │   ├── src/
│   │   ├── eslint.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/                 # 共享库
│       ├── src/
│       ├── eslint.config.js
│       ├── tsconfig.json
│       └── package.json
├── eslint.config.js            # 根 ESLint 配置
├── tsconfig.json               # 根 TypeScript 配置
├── prettier.config.js          # Prettier 配置
├── commitlint.config.js        # commitlint 配置
├── .releaserc.js               # semantic-release 配置
├── .editorconfig               # 编辑器配置
├── package.json
└── pnpm-workspace.yaml
```

## 第一步：初始化项目

```bash
# 创建项目目录
mkdir my-monorepo && cd my-monorepo

# 初始化 pnpm workspace
pnpm init
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// package.json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "prepare": "husky"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "pnpm@9.0.0"
}
```

## 第二步：配置编辑器基础

```ini
# .editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

## 第三步：配置 Prettier

```bash
pnpm add -D prettier
```

```javascript
// prettier.config.js
export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
};
```

```
# .prettierignore
dist
build
coverage
node_modules
pnpm-lock.yaml
CHANGELOG.md
```

## 第四步：配置 ESLint

```bash
pnpm add -D eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks
```

```javascript
// eslint.config.js
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  // 全局忽略
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
  },

  // 基础配置
  js.configs.recommended,

  // TypeScript 配置
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // React 配置
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // 通用规则
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // 测试文件放宽规则
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Prettier 放在最后
  prettierConfig,
];
```

## 第五步：配置 TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```json
// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## 第六步：配置 Husky + lint-staged

```bash
pnpm add -D husky lint-staged
```

```bash
# 初始化 Husky
npx husky init
```

```json
// package.json（添加 lint-staged 配置）
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --no-warn-ignored",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml,css,scss}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

## 第七步：配置 commitlint

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [1, 'always', 100],
  },
};
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

## 第八步：配置 CODEOWNERS

```gitignore
# .github/CODEOWNERS

# 全局
*                       @tech-lead

# 前端应用
/packages/app/          @frontend-team
/packages/app/src/core/ @frontend-team @security-team

# 共享库
/packages/shared/       @frontend-team @backend-team

# 配置文件
eslint.config.js        @tooling-team
tsconfig.json           @tooling-team
package.json            @tech-lead
.github/                @devops-team
```

## 第九步：配置 Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    reviewers:
      - tech-lead
    labels:
      - dependencies
    groups:
      dev-dependencies:
        dependency-type: development
        update-types: [minor, patch]
    commit-message:
      prefix: "chore(deps)"

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    labels:
      - ci
      - dependencies
```

## 第十步：配置 CI 流水线

```yaml
# .github/workflows/pr-check.yml
name: PR Check

on:
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Format
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
          cache: pnpm
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
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

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
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

## 第十一步：配置 semantic-release

```bash
pnpm add -D semantic-release @semantic-release/changelog @semantic-release/git
```

```javascript
// .releaserc.js
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
```

## 第十二步：配置分支保护

在 GitHub Settings → Branches → Branch protection rules 中配置 main 分支：

```
✅ Require a pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale PR approvals when new commits are pushed
  ✅ Require review from Code Owners

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  Required status checks:
    - Lint & Format
    - Type Check
    - Test
    - Build

✅ Require conversation resolution before merging
```

## 验证门禁是否工作

### 测试编辑器检查

1. 在 VS Code 中打开项目
2. 安装 ESLint 和 Prettier 扩展
3. 写一段不规范的代码（如 `var x = 1`）
4. 观察 ESLint 是否实时报错
5. 保存文件，观察 Prettier 是否自动格式化

### 测试 Git 提交检查

```bash
# 故意写一段不规范的代码
echo 'var x = 1;console.log(x)' > test.ts
git add test.ts
git commit -m "test"

# 应该被 lint-staged 拦截（ESLint 报错）

# 修复后
git commit -m "fix: 修复测试代码"

# 应该被 commitlint 拦截（scope 不在允许范围内）

# 正确提交
git commit -m "chore: 添加测试代码"
```

### 测试 CI 检查

```bash
# 创建分支并推送
git checkout -b feat/test
# ... 做一些修改
git push origin feat/test

# 在 GitHub 上创建 PR，观察 CI 是否自动运行
```

## 常见问题排查

### ESLint 和 Prettier 冲突

**症状**：ESLint 报格式错误，Prettier 又改回去了

**解决**：确保 `eslint-config-prettier` 在 ESLint 配置的最后位置

### lint-staged 不工作

**症状**：提交时 lint-staged 没有运行

**检查**：
```bash
# 确认 Husky 已初始化
ls .husky/pre-commit

# 确认 lint-staged 配置在 package.json 中
cat package.json | grep lint-staged

# 手动运行测试
npx lint-staged
```

### CI 中 pnpm install 失败

**症状**：CI 报 `ERR_PNPM_FROZEN_LOCKFILE`

**解决**：确保 pnpm-lock.yaml 已提交且与 package.json 一致

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: 更新 lockfile"
```

### commitlint 不识别自定义 scope

**症状**：提交时 commitlint 报 `scope must be one of [xxx]`

**检查**：确认 commitlint.config.js 中的 scope-enum 配置正确

## 常见误区

### 误区一：一步到位配置所有工具

**错误理解**：一开始就配置最严格的规则

**正确理解**：渐进式启用。先让基础检查跑起来（ESLint + Prettier），再添加提交检查（Husky + lint-staged），最后添加 CI 检查。每一步都确保团队能适应。

### 误区二：配置好了就不管了

**错误理解**：质量门禁是一次性工作

**正确理解**：工具会更新、规则会变化、团队需求会演进。定期审查和更新配置是必要的。建议每季度审查一次 ESLint 规则、Dependabot 配置和 CI 流水线。

### 误区三：自动化能替代人工审查

**错误理解**：CI 跑通了就不需要人审查了

**正确理解**：自动化检查覆盖的是可以形式化的问题。设计合理性、业务逻辑正确性、可维护性——这些需要人来判断。自动化是第一道防线，人工审查是第二道。

## 本课小结

1. **全链路覆盖**：编辑器 → 保存 → 提交 → PR → 合并，每个环节都有检查
2. **工具协作**：ESLint（质量）+ Prettier（风格）+ TypeScript（类型）+ 测试（行为）
3. **自动化优先**：能自动化的都自动化，减少人工检查的负担
4. **渐进式启用**：先跑起来，再逐步收紧
5. **持续维护**：质量门禁不是一次性工作，需要定期审查和更新

## 练习

### 练习一：从零搭建质量门禁

按照本课的步骤，为一个新项目搭建完整的代码质量门禁。验证每个环节是否正常工作。

### 练习二：迁移已有项目

选择一个已有的项目（没有质量门禁或只有部分配置），逐步添加缺失的环节。记录每一步遇到的问题和解决方案。

### 练习三：设计团队规范文档

为你的团队编写一份代码质量规范文档，包含：
- 工具配置说明
- 提交规范
- PR 流程
- 代码审查清单
- 安全审计流程

## 参考答案

### 练习一

按照本课的 12 个步骤逐步执行。关键验证点：

```bash
# 1. ESLint 检查
pnpm lint  # 应该通过

# 2. Prettier 检查
pnpm format:check  # 应该通过

# 3. TypeScript 检查
pnpm typecheck  # 应该通过

# 4. Git 提交检查
git add . && git commit -m "test"  # 应该被 lint-staged 和 commitlint 拦截

# 5. 正确提交
git commit -m "chore: 初始化项目"  # 应该通过
```

### 练习二

迁移步骤：

1. 添加 .editorconfig
2. 添加 Prettier 配置，运行 `prettier --write .` 格式化所有文件
3. 添加 ESLint 配置，运行 `eslint .` 查看报告
4. 逐步修复 ESLint 报告的问题
5. 添加 Husky + lint-staged
6. 添加 commitlint
7. 添加 CI 流水线
8. 配置分支保护

常见问题：
- 大量 ESLint 错误：先关闭严格规则，逐个启用
- 格式化导致大量文件变更：单独一个 PR 处理格式化
- 已有的不规范提交信息：不影响，新提交开始遵守规范

### 练习三

```markdown
# 代码质量规范

## 工具链
- ESLint 9 + flat config
- Prettier
- TypeScript strict mode
- Husky + lint-staged
- commitlint

## 提交规范
- 使用 Conventional Commits
- type: feat, fix, docs, refactor, perf, test, chore
- scope: auth, api, ui, shared
- subject: 不超过 50 字符

## PR 流程
1. 从 main 创建分支
2. 开发并提交
3. 创建 PR，填写描述模板
4. CI 自动检查
5. 至少一位审查者批准
6. 合并到 main

## 代码审查清单
- [ ] 设计合理性
- [ ] 命名清晰
- [ ] 错误处理充分
- [ ] 测试覆盖
- [ ] 无安全风险

## 安全审计
- 每周一 Dependabot 检查
- 每月全量 npm audit
- 新依赖必须审查许可证
```

## 下一步

完成本阶段后，继续学习 [stage5：前端监控体系](../stage5-monitoring/README.md)。

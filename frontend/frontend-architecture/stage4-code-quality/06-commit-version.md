# 06. 提交信息规范与版本管理

> Conventional Commits、semantic-release、自动生成 Changelog——让发布流程自动化

## 本课目标

- 理解为什么提交信息需要规范
- 掌握 Conventional Commits 规范和 commitlint 配置
- 使用 semantic-release 实现自动化版本管理
- 自动生成 CHANGELOG

## 提交信息的混乱

打开一个项目的 git log，你可能会看到这样的提交历史：

```
fix bug
update
修改
done
wip
asdf
临时提交
final
final2
真的final
```

这些提交信息在当时可能有上下文，但一周后、一个月后、换一个人来看，完全无法理解每次提交做了什么。

当需要回溯问题时（"这个 bug 是哪个提交引入的"），混乱的提交信息会让 `git bisect` 和 `git log` 失去价值。

## Conventional Commits

Conventional Commits 是目前最广泛使用的提交信息规范。它的格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### type 类型

| type | 含义 | 示例 |
|------|------|------|
| feat | 新功能 | `feat(auth): 添加微信登录` |
| fix | Bug 修复 | `fix(api): 修复分页参数解析错误` |
| docs | 文档 | `docs: 更新 README 安装说明` |
| style | 格式（不影响逻辑） | `style: 修复缩进` |
| refactor | 重构 | `refactor(hooks): 抽取 useAuth 逻辑` |
| perf | 性能优化 | `perf(list): 虚拟滚动优化` |
| test | 测试 | `test(auth): 添加登录失败测试` |
| build | 构建工具 | `build: 升级 Vite 到 v5` |
| ci | CI 配置 | `ci: 添加缓存到 GitHub Actions` |
| chore | 杂项 | `chore: 清理无用依赖` |
| revert | 回退 | `revert: 回退 feat(auth)` |

### scope 范围

scope 是可选的，用于说明改动影响的范围：

```
feat(auth): 添加 OAuth2 登录
fix(api): 修复超时问题
refactor(shared): 重构工具函数
```

scope 通常是项目中的模块名、组件名或功能区域。

### description 描述

- 使用祈使句（"add" 而不是 "added"）
- 首字母小写
- 不加句号
- 不超过 50 个字符

```
✅ feat(auth): 添加微信登录
❌ feat(auth): 添加了微信登录。
❌ feat(auth): Add WeChat login
```

### body 和 footer

```
fix(auth): 修复 token 刷新时的竞态条件

当多个请求同时触发 token 刷新时，之前的实现会导致多个刷新请求同时发出。
现在通过锁机制确保只有一个刷新请求在进行。

Closes #123
Fixes #456
```

### Breaking Change

破坏性变更必须在 footer 中标注：

```
feat(api): 修改用户接口返回格式

BREAKING CHANGE: 用户接口的 data 字段从数组改为对象

Closes #789
```

或者在 type 后加 `!`：

```
feat(api)!: 修改用户接口返回格式
```

## commitlint

commitlint 用于在提交时自动检查提交信息是否符合规范。

### 安装配置

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
      [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert',
      ],
    ],
    'scope-enum': [
      1, // warn，不是 error
      'always',
      ['auth', 'api', 'shared', 'web', 'mobile', 'build', 'ci'],
    ],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [1, 'always', 100],
  },
};
```

### 集成到 Husky

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

现在每次 `git commit` 时，commitlint 会检查提交信息。不符合规范的提交会被拒绝：

```bash
$ git commit -m "fix bug"
⧗   input: fix bug
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]

✖   found 2 problems, 0 warnings
```

## semantic-release

semantic-release 实现了完全自动化的版本管理和发布流程。它根据提交信息自动决定版本号、生成 Changelog、创建 Git Tag、发布到 npm。

### 工作原理

```
git commit → semantic-release 分析提交 → 决定版本号 → 生成 Changelog → 创建 Tag → 发布
```

版本号的决定规则：
- `fix` 类型提交 → patch 版本（1.0.0 → 1.0.1）
- `feat` 类型提交 → minor 版本（1.0.0 → 1.1.0）
- 包含 `BREAKING CHANGE` 的提交 → major 版本（1.0.0 → 2.0.0）

### 安装配置

```bash
pnpm add -D semantic-release
```

```javascript
// .releaserc.js
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
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

### 插件说明

| 插件 | 作用 |
|------|------|
| commit-analyzer | 分析提交信息，决定版本号 |
| release-notes-generator | 生成发布说明 |
| changelog | 写入 CHANGELOG.md |
| npm | 发布到 npm |
| github | 创建 GitHub Release |
| git | 将变更推回仓库 |

### GitHub Actions 集成

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
  id-token: write

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

### 关键配置

`fetch-depth: 0` 是必须的——semantic-release 需要完整的 git 历史来分析提交。

`persist-credentials: false` 让 semantic-release 使用 GITHUB_TOKEN 而不是 git 凭据。

## 自动生成 CHANGELOG

semantic-release 的 changelog 插件会自动生成 CHANGELOG.md：

```markdown
# [2.1.0](https://github.com/org/repo/compare/v2.0.0...v2.1.0) (2024-01-15)

### Features

* **auth:** 添加微信登录 ([#123](https://github.com/org/repo/pull/123)) ([abc1234](https://github.com/org/repo/commit/abc1234))
* **api:** 添加批量查询接口 ([#124](https://github.com/org/repo/pull/124)) ([def5678](https://github.com/org/repo/commit/def5678))

### Bug Fixes

* **auth:** 修复 token 刷新竞态 ([#125](https://github.com/org/repo/pull/125)) ([ghi9012](https://github.com/org/repo/commit/ghi9012))
```

### 自定义 Changelog 格式

```javascript
// .releaserc.js
export default {
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance' },
            { type: 'docs', section: 'Documentation' },
            { type: 'refactor', section: 'Refactoring', hidden: true },
            { type: 'style', section: 'Styles', hidden: true },
            { type: 'test', section: 'Tests', hidden: true },
            { type: 'changelog', section: 'Changelog', hidden: true },
          ],
        },
      },
    ],
    // ... 其他插件
  ],
};
```

## Monorepo 中的版本管理

Monorepo 中每个包可能需要独立版本。几种方案：

### 方案一：fixed 版本（所有包同一版本）

```javascript
// 根目录 .releaserc.js
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    '@semantic-release/github',
    '@semantic-release/git',
  ],
};
```

所有包共享同一个版本号。适合紧密耦合的包。

### 方案二：independent 版本（各包独立版本）

使用 `semantic-release-monorepo` 或类似插件：

```javascript
// packages/app/.releaserc.js
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/npm', { pkgRoot: '.' }],
    ['@semantic-release/github', { assets: [] }],
  ],
};
```

每个包有自己的 `.releaserc.js`，通过 CI 中的 matrix 策略分别发布。

### Changesets

对于 Monorepo，changesets 是另一个流行的选择：

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

```bash
# 添加 changeset
pnpm changeset
# 选择包 → 选择版本类型 → 输入描述

# 发布
pnpm changeset version  # 更新版本号和 CHANGELOG
pnpm changeset publish  # 发布到 npm
```

changesets 的优势是手动控制版本，不需要严格遵守 Conventional Commits。

## 提交信息的工具链

### commitizen

交互式提交工具，帮助写规范的提交信息：

```bash
pnpm add -D commitizen cz-conventional-changelog
```

```json
// package.json
{
  "config": {
    "commitizen": {
      "path": "cz-conventional-changelog"
    }
  }
}
```

```bash
# 使用 cz 代替 git commit
npx cz
```

cz 会交互式地问你 type、scope、description，然后自动生成规范的提交信息。

### gitmoji

在提交信息前加 emoji，让提交类型一目了然：

```
✨ feat(auth): 添加微信登录
🐛 fix(api): 修复分页错误
📝 docs: 更新 README
♻️ refactor(hooks): 重构 useAuth
```

需要团队达成共识，不是所有人都喜欢这种方式。

## 常见误区

### 误区一：提交信息不重要

**错误理解**：代码才是关键，提交信息随便写

**正确理解**：提交信息是代码变更的文档。当需要回溯问题、理解设计决策、生成 Changelog 时，规范的提交信息是关键依据。

### 误区二：Conventional Commits 太严格

**错误理解**：每次提交都要写 type、scope，太麻烦了

**正确理解**：commitlint 自动检查，commitizen 交互式引导。养成习惯后，写规范的提交信息只需要几秒钟。而且自动化带来的收益（Changelog、版本管理）远超投入。

### 误区三：semantic-release 适合所有项目

**错误理解**：所有项目都应该用 semantic-release

**正确理解**：semantic-release 适合持续发布的项目（npm 包、SaaS 应用）。对于版本发布节奏较慢的项目（如年度大版本），手动管理版本可能更合适。

### 误区四：Breaking Change 就是改 API

**错误理解**：只要改了接口就是 Breaking Change

**正确理解**：Breaking Change 是指使用者必须修改代码才能继续正常工作。添加新参数（有默认值）、添加新返回字段、添加新配置项——这些通常不是 Breaking Change。删除接口、改变行为、修改必需参数——这些才是。

## 本课小结

1. **Conventional Commits**：type(scope): description，自动化版本管理的基础
2. **commitlint**：提交时自动检查，不合规的提交被拒绝
3. **semantic-release**：根据提交信息自动决定版本号、生成 Changelog、发布
4. **CHANGELOG**：自动生成，按类型分组，关联 PR 和 commit
5. **Monorepo 策略**：fixed 版本、independent 版本、changesets

## 练习

### 练习一：配置 commitlint

为项目配置 commitlint，要求：
- 使用 Conventional Commits 规范
- scope 限定为项目的模块名
- subject 最大长度 50 字符
- 集成到 Husky 的 commit-msg hook

### 练习二：分析提交历史

找一个开源项目（如 React、Vue、Next.js），分析它的提交历史：
- 使用了什么提交规范
- 提交信息的质量如何
- 是否自动生成了 CHANGELOG

### 练习三：配置 semantic-release

为一个 npm 包配置 semantic-release，要求：
- 合并到 main 分支时自动发布
- 自动生成 CHANGELOG.md
- 创建 GitHub Release

## 参考答案

### 练习一

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional husky
```

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['core', 'auth', 'api', 'ui', 'shared', 'build', 'ci'],
    ],
    'subject-max-length': [2, 'always', 50],
  },
};
```

```bash
npx husky init
echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg
```

### 练习二

以 React 为例：

```
提交规范：类 Conventional Commits（但不完全严格）
类型：feat, fix, refactor, docs, test, chore
提交信息质量：较高，大部分有清晰的描述
CHANGELOG：使用 GitHub Release Notes，不维护单独的 CHANGELOG.md

示例提交：
- Fix: SSR rendering of `useSyncExternalStore` (#27252)
- Add `useFormStatus` hook (#27188)
- Refactor: split HostRoot Fiber (#27179)
```

### 练习三

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
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
};
```

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 下一步

完成本课后，继续学习 [07. 依赖安全审计与漏洞修复](./07-dependency-security.md)。

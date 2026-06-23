# 06. changesets 版本管理与发布流程

> 版本号、变更日志、自动发布，掌握 changesets 的核心能力

## 本课目标

- 理解 changesets 的核心概念和优势
- 掌握版本号管理和变更日志生成
- 学会配置自动发布流程
- 建立版本管理的最佳实践

## 为什么需要 changesets

### 版本管理的问题

**场景一：手动版本管理**
```bash
# 修改代码
git commit -m "feat: add new feature"

# 手动修改版本号
# package.json: "version": "1.0.0" → "1.1.0"

# 手动生成变更日志
# CHANGELOG.md: 添加新版本记录

# 发布
npm publish
```

**问题**：
1. 容易忘记修改版本号
2. 变更日志不完整
3. 多包项目管理复杂
4. 容易出错

**场景二：使用 changesets**
```bash
# 修改代码
git commit -m "feat: add new feature"

# 添加 changeset
pnpm changeset

# 发布
pnpm changeset publish
```

**优势**：
1. 自动计算版本号
2. 自动生成变更日志
3. 多包项目统一管理
4. 不容易出错

## changesets 核心概念

### 什么是 changeset

changeset 是一个**版本管理工具**，用于：
1. 记录代码变更
2. 计算版本号
3. 生成变更日志
4. 发布包

### changeset 文件

```markdown
# .changeset/cool-fox.md
---
"@myorg/utils": minor
"@myorg/ui": patch
---

Added new utility function for date formatting
```

**文件说明**：
- `---` 之间：版本变更信息
  - 包名：要发布的包
  - 版本类型：major、minor、patch
- `---` 之后：变更描述

### 版本类型

| 类型 | 说明 | 示例 |
|------|------|------|
| major | 不兼容的 API 修改 | 1.0.0 → 2.0.0 |
| minor | 向下兼容的功能性新增 | 1.0.0 → 1.1.0 |
| patch | 向下兼容的问题修正 | 1.0.0 → 1.0.1 |

## 配置 changesets

### 安装

```bash
pnpm add -D @changesets/cli
```

### 初始化

```bash
pnpm changeset init
```

**生成的文件**：
```
.changeset/
├── config.json
└── README.md
```

### 配置文件

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**配置说明**：
- `changelog`：变更日志生成器
- `commit`：是否自动提交
- `fixed`：固定版本的包
- `linked`：关联版本的包
- `access`：发布访问权限
- `baseBranch`：基础分支
- `updateInternalDependencies`：内部依赖更新策略
- `ignore`：忽略的包

## 使用 changesets

### 添加 changeset

```bash
# 交互式添加
pnpm changeset

# 添加空 changeset（用于依赖更新等）
pnpm changeset --empty
```

**交互式流程**：
```bash
🦋  Which packages would you like to include? ...
  ◯ @myorg/utils
  ◯ @myorg/ui
  ◯ @myorg/web

🦋  Which packages should have a major bump? ...
  ◯ @myorg/utils
  ◯ @myorg/ui
  ◯ @myorg/web

🦋  Which packages should have a minor bump? ...
  ◯ @myorg/utils
  ◯ @myorg/ui
  ◯ @myorg/web

🦋  Please enter a summary for this change ...
  Added new utility function for date formatting
```

### 查看 changesets

```bash
# 查看所有 changeset
pnpm changeset status
```

### 版本更新

```bash
# 应用 changeset，更新版本号
pnpm changeset version
```

**执行的操作**：
1. 读取所有 changeset 文件
2. 计算新版本号
3. 更新 package.json
4. 生成变更日志
5. 删除 changeset 文件

### 发布

```bash
# 发布所有变更的包
pnpm changeset publish
```

**执行的操作**：
1. 检查哪些包有变更
2. 发布到 npm
3. 创建 git tag

## 变更日志

### 默认变更日志

```markdown
# @myorg/utils

## 1.1.0

### Minor Changes

- Added new utility function for date formatting

### Patch Changes

- Updated dependencies
  - @myorg/utils@1.1.0
```

### 自定义变更日志

```json
// .changeset/config.json
{
  "changelog": [
    "@changesets/cli/changelog",
    {
      "repo": "myorg/monorepo"
    }
  ]
}
```

### 变更日志生成器

```javascript
// .changeset/changelog-generator.js
const { getInfo } = require("@changesets/get-github-info");

const getReleaseLine = async (changeset, type) => {
  const { pull, links } = await getInfo({
    repo: "myorg/monorepo",
    commit: changeset.commit,
  });
  
  return `- ${changeset.summary} ${links.pull}`;
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";
  
  const updatedDependencies = dependenciesUpdated
    .map((dep) => `  - ${dep.name}@${dep.newVersion}`)
    .join("\n");
  
  return `### Updated Dependencies\n\n${updatedDependencies}`;
};

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
```

## 自动发布

### GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm changeset publish
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 发布流程

1. **开发者提交代码**
   ```bash
   git commit -m "feat: add new feature"
   git push
   ```

2. **添加 changeset**
   ```bash
   pnpm changeset
   git add .
   git commit -m "docs: add changeset"
   git push
   ```

3. **自动创建 PR**
   - GitHub Actions 检测到 changeset
   - 自动创建 "Version Packages" PR
   - PR 包含版本号更新和变更日志

4. **合并 PR**
   - 合并 PR 后，自动发布到 npm
   - 自动创建 git tag

## 实战：配置 changesets

### 项目结构

```
my-monorepo/
├── package.json
├── .changeset/
│   ├── config.json
│   └── README.md
├── .github/
│   └── workflows/
│       └── release.yml
├── packages/
│   ├── utils/
│   │   ├── package.json
│   │   └── src/
│   └── ui/
│       ├── package.json
│       └── src/
└── apps/
    └── web/
        ├── package.json
        └── src/
```

### 配置文件

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/web"]
}
```

```json
// 根目录 package.json
{
  "name": "@myorg/monorepo",
  "private": true,
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.26.0"
  }
}
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm changeset publish
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 使用示例

```bash
# 添加 changeset
pnpm changeset

# 查看 changeset 状态
pnpm changeset status

# 应用 changeset，更新版本号
pnpm changeset version

# 发布到 npm
pnpm changeset publish
```

## 最佳实践

### 1. 每次变更都添加 changeset

```bash
# 修改代码
git commit -m "feat: add new feature"

# 添加 changeset
pnpm changeset

# 提交 changeset
git add .
git commit -m "docs: add changeset"
```

### 2. 使用有意义的变更描述

```markdown
---
"@myorg/utils": minor
---

Added new utility function for date formatting

- Support multiple date formats
- Handle timezone conversion
- Add unit tests
```

### 3. 定期发布

```bash
# 每周发布一次
pnpm changeset version
pnpm changeset publish
```

### 4. 使用自动发布

配置 GitHub Actions 自动发布，减少手动操作。

### 5. 忽略不需要发布的包

```json
{
  "ignore": ["@myorg/web", "@myorg/docs"]
}
```

## 常见问题

### Q: 如何添加 changeset？

A: 使用 `pnpm changeset` 命令，交互式选择要发布的包和版本类型。

### Q: 如何查看 changeset 状态？

A: 使用 `pnpm changeset status` 命令。

### Q: 如何发布包？

A: 使用 `pnpm changeset publish` 命令。

### Q: 如何配置自动发布？

A: 配置 GitHub Actions，使用 changesets/action 自动发布。

## 本课小结

本课我们掌握了 changesets 的核心能力：

1. **changeset 概念**：记录变更、计算版本、生成日志
2. **版本管理**：major、minor、patch
3. **变更日志**：自动生成、自定义格式
4. **自动发布**：GitHub Actions、发布流程
5. **最佳实践**：每次变更都添加 changeset、使用有意义的描述

## 练习

### 练习一：配置 changesets

为一个 Monorepo 项目配置 changesets：
- 初始化 changesets
- 配置发布权限
- 配置变更日志生成器

### 练习二：使用 changesets 发布

模拟一个发布流程：
- 添加 changeset
- 更新版本号
- 生成变更日志
- 发布到 npm

## 参考答案

### 练习一

**初始化 changesets**：
```bash
pnpm changeset init
```

**配置文件**：
```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### 练习二

**发布流程**：
```bash
# 添加 changeset
pnpm changeset

# 查看 changeset 状态
pnpm changeset status

# 应用 changeset，更新版本号
pnpm changeset version

# 发布到 npm
pnpm changeset publish
```

## 下一步

完成本课后，继续学习 [07. 开发环境标准化](./07-dev-environment.md)。

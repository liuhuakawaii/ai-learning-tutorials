# 07. 开发环境标准化

> .editorconfig、.nvmrc、engines，建立统一的开发环境

## 本课目标

- 理解开发环境标准化的重要性
- 掌握 .editorconfig 配置
- 学会使用 .nvmrc 管理 Node.js 版本
- 建立开发环境的最佳实践

## 为什么需要开发环境标准化

### 问题场景

**场景一：代码风格不一致**
```javascript
// 开发者 A
function hello() {
  console.log('hello');
}

// 开发者 B
function hello() {
    console.log('hello');
}

// 开发者 C
function hello() {
	console.log('hello');
}
```

**问题**：
- 有人用 2 空格缩进，有人用 4 空格，有人用 Tab
- 有人用单引号，有人用双引号
- 有人用分号，有人不用分号

**场景二：Node.js 版本不一致**
```bash
# 开发者 A
$ node --version
v16.0.0

# 开发者 B
$ node --version
v18.0.0

# 开发者 C
$ node --version
v20.0.0
```

**问题**：
- 不同 Node.js 版本可能有不同的 API
- 某些依赖可能在特定版本才能正常工作
- 构建结果可能不一致

**场景三：包管理器不一致**
```bash
# 开发者 A
$ npm install

# 开发者 B
$ yarn install

# 开发者 C
$ pnpm install
```

**问题**：
- 不同包管理器的依赖解析可能不同
- lock 文件格式不兼容
- 依赖安装结果可能不一致

## .editorconfig

### 什么是 .editorconfig

EditorConfig 是一个**编辑器配置标准**，用于：
1. 定义代码风格规则
2. 跨编辑器统一配置
3. 自动应用配置

### 配置文件

```ini
# .editorconfig
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{js,jsx,ts,tsx}]
indent_size = 2

[*.json]
indent_size = 2

[*.yml]
indent_size = 2

[Makefile]
indent_style = tab
```

**配置说明**：
- `root = true`：根配置文件
- `charset`：字符编码
- `indent_style`：缩进风格（space 或 tab）
- `indent_size`：缩进大小
- `end_of_line`：换行符（lf 或 crlf）
- `insert_final_newline`：文件末尾插入空行
- `trim_trailing_whitespace`：删除行尾空格

### 编辑器支持

**VS Code**：
```json
// settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

**WebStorm**：
- 自动支持 .editorconfig
- 无需额外配置

**Sublime Text**：
- 安装 EditorConfig 插件
- 自动应用配置

### 最佳实践

1. **统一配置**：所有项目使用相同的 .editorconfig
2. **提交配置**：将 .editorconfig 提交到仓库
3. **编辑器支持**：确保团队使用支持 .editorconfig 的编辑器

## .nvmrc

### 什么是 .nvmrc

.nvmrc 是一个**Node.js 版本管理文件**，用于：
1. 指定项目使用的 Node.js 版本
2. 自动切换 Node.js 版本
3. 确保团队使用相同版本

### 配置文件

```
# .nvmrc
18.17.0
```

### 使用 nvm

```bash
# 安装指定版本
nvm install

# 使用指定版本
nvm use

# 查看当前版本
nvm current

# 查看已安装版本
nvm list
```

### 自动切换

```bash
# 在项目目录下创建 .nvmrc
echo "18.17.0" > .nvmrc

# 进入项目目录时自动切换
cd my-project
nvm use
# Now using node v18.17.0 (npm v9.6.7)
```

### 最佳实践

1. **指定版本**：明确指定 Node.js 版本，不要使用 latest
2. **提交配置**：将 .nvmrc 提交到仓库
3. **文档说明**：在 README 中说明 Node.js 版本要求

## engines

### 什么是 engines

engines 是 package.json 中的**引擎配置**，用于：
1. 指定 Node.js 版本范围
2. 指定包管理器版本
3. 在安装时检查版本

### 配置示例

```json
{
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 版本检查

```bash
# 安装时检查版本
pnpm install
# 如果 Node.js 版本不符合要求，会显示警告

# 强制检查
pnpm install --engine-strict=true
```

### .npmrc 配置

```ini
# .npmrc
engine-strict=true
```

### 最佳实践

1. **明确版本范围**：使用语义化版本范围
2. **提交配置**：将 engines 配置提交到仓库
3. **文档说明**：在 README 中说明版本要求

## 包管理器版本管理

### corepack

corepack 是 Node.js 内置的**包管理器管理工具**，用于：
1. 管理包管理器版本
2. 确保团队使用相同版本
3. 自动切换包管理器

### 配置文件

```json
{
  "packageManager": "pnpm@8.6.0"
}
```

### 使用 corepack

```bash
# 启用 corepack
corepack enable

# 安装指定版本
corepack prepare pnpm@8.6.0 --activate

# 查看当前版本
corepack -v
```

### 最佳实践

1. **指定版本**：明确指定包管理器版本
2. **提交配置**：将 packageManager 配置提交到仓库
3. **启用 corepack**：在 CI/CD 中启用 corepack

## 开发环境检查

### 检查脚本

```json
{
  "scripts": {
    "check-env": "node scripts/check-env.js"
  }
}
```

```javascript
// scripts/check-env.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查 Node.js 版本
function checkNodeVersion() {
  const required = fs.readFileSync('.nvmrc', 'utf-8').trim();
  const current = execSync('node --version').toString().trim();
  
  if (!current.startsWith(`v${required}`)) {
    console.error(`Node.js version mismatch: required ${required}, current ${current}`);
    process.exit(1);
  }
  
  console.log(`✓ Node.js version: ${current}`);
}

// 检查 pnpm 版本
function checkPnpmVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const required = packageJson.packageManager.split('@')[1];
  const current = execSync('pnpm --version').toString().trim();
  
  if (current !== required) {
    console.error(`pnpm version mismatch: required ${required}, current ${current}`);
    process.exit(1);
  }
  
  console.log(`✓ pnpm version: ${current}`);
}

// 检查 .editorconfig
function checkEditorConfig() {
  if (!fs.existsSync('.editorconfig')) {
    console.error('.editorconfig not found');
    process.exit(1);
  }
  
  console.log('✓ .editorconfig exists');
}

// 运行检查
checkNodeVersion();
checkPnpmVersion();
checkEditorConfig();
console.log('\n✓ All checks passed!');
```

### Pre-commit 检查

```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

node scripts/check-env.js
```

## 实战：配置开发环境标准化

### 项目结构

```
my-monorepo/
├── .editorconfig
├── .nvmrc
├── .npmrc
├── package.json
└── scripts/
    └── check-env.js
```

### 配置文件

```ini
# .editorconfig
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{js,jsx,ts,tsx}]
indent_size = 2

[*.json]
indent_size = 2

[*.yml]
indent_size = 2

[Makefile]
indent_style = tab
```

```
# .nvmrc
18.17.0
```

```ini
# .npmrc
engine-strict=true
```

```json
{
  "name": "@myorg/monorepo",
  "private": true,
  "packageManager": "pnpm@8.6.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "check-env": "node scripts/check-env.js"
  }
}
```

### 使用示例

```bash
# 检查开发环境
pnpm check-env

# 输出：
# ✓ Node.js version: v18.17.0
# ✓ pnpm version: 8.6.0
# ✓ .editorconfig exists
# 
# ✓ All checks passed!
```

## 最佳实践

### 1. 统一配置

所有项目使用相同的开发环境配置：
- .editorconfig
- .nvmrc
- .npmrc
- packageManager

### 2. 提交配置

将所有配置文件提交到仓库：
```bash
git add .editorconfig .nvmrc .npmrc
git commit -m "chore: add development environment config"
```

### 3. 文档说明

在 README 中说明开发环境要求：
```markdown
## 开发环境

- Node.js: 18.17.0
- pnpm: 8.6.0
- 编辑器: VS Code (推荐)

### 安装

```bash
nvm use
corepack enable
pnpm install
```
```

### 4. 自动检查

配置 pre-commit hook，自动检查开发环境：
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

node scripts/check-env.js
```

### 5. CI/CD 检查

在 CI/CD 中检查开发环境：
```yaml
# .github/workflows/ci.yml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version-file: '.nvmrc'
      - run: corepack enable
      - run: pnpm install
      - run: pnpm check-env
```

## 常见问题

### Q: 如何安装指定版本的 Node.js？

A: 使用 nvm 安装：`nvm install 18.17.0`。

### Q: 如何切换 Node.js 版本？

A: 使用 nvm 切换：`nvm use`。

### Q: 如何检查开发环境？

A: 运行 `pnpm check-env` 命令。

### Q: 如何配置 pre-commit hook？

A: 使用 husky 配置：`npx husky install`。

## 本课小结

本课我们掌握了开发环境标准化的核心能力：

1. **.editorconfig**：统一代码风格
2. **.nvmrc**：管理 Node.js 版本
3. **engines**：指定版本范围
4. **corepack**：管理包管理器版本
5. **开发环境检查**：自动检查环境配置

## 练习

### 练习一：配置开发环境

为一个项目配置开发环境标准化：
- 创建 .editorconfig
- 创建 .nvmrc
- 配置 engines
- 配置 packageManager

### 练习二：编写检查脚本

编写一个检查脚本，检查以下内容：
- Node.js 版本
- pnpm 版本
- .editorconfig 是否存在
- .nvmrc 是否存在

## 参考答案

### 练习一

**配置文件**：
```ini
# .editorconfig
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

```
# .nvmrc
18.17.0
```

```json
{
  "packageManager": "pnpm@8.6.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 练习二

**检查脚本**：
```javascript
// scripts/check-env.js
const { execSync } = require('child_process');
const fs = require('fs');

function checkNodeVersion() {
  const required = fs.readFileSync('.nvmrc', 'utf-8').trim();
  const current = execSync('node --version').toString().trim();
  
  if (!current.startsWith(`v${required}`)) {
    console.error(`Node.js version mismatch: required ${required}, current ${current}`);
    process.exit(1);
  }
  
  console.log(`✓ Node.js version: ${current}`);
}

function checkPnpmVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const required = packageJson.packageManager.split('@')[1];
  const current = execSync('pnpm --version').toString().trim();
  
  if (current !== required) {
    console.error(`pnpm version mismatch: required ${required}, current ${current}`);
    process.exit(1);
  }
  
  console.log(`✓ pnpm version: ${current}`);
}

function checkEditorConfig() {
  if (!fs.existsSync('.editorconfig')) {
    console.error('.editorconfig not found');
    process.exit(1);
  }
  
  console.log('✓ .editorconfig exists');
}

function checkNvmrc() {
  if (!fs.existsSync('.nvmrc')) {
    console.error('.nvmrc not found');
    process.exit(1);
  }
  
  console.log('✓ .nvmrc exists');
}

checkNodeVersion();
checkPnpmVersion();
checkEditorConfig();
checkNvmrc();
console.log('\n✓ All checks passed!');
```

## 下一步

完成本课后，继续学习 [08. Git Hooks 与提交规范](./08-git-hooks.md)。

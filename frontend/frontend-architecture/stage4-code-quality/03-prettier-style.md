# 03. Prettier 与风格统一

> 配置选项详解、与 ESLint 集成、忽略文件策略——让风格争论从代码审查中消失

## 本课目标

- 理解 Prettier 的格式化原理和设计哲学
- 掌握 Prettier 的核心配置选项及其影响
- 正确集成 Prettier 与 ESLint，消除冲突
- 设计合理的忽略文件策略

## 为什么需要 Prettier

上一课讲了 ESLint 专注于代码质量检查。但在实际项目中，代码审查中最大的噪音往往不是质量问题，而是风格争论：

- "这里应该加分号"
- "引号不统一"
- "对象字面量花括号前后要不要空格"
- "数组太长了应该换行"
- "函数参数要不要每行一个"

这些讨论没有对错之分，但每次都在消耗审查时间。Prettier 的设计哲学就是：**这些决定不由人做，由工具做**。

Prettier 的核心思路是"有态度的格式化器"（opinionated formatter）。它只提供少量配置选项，大部分格式决策是固定的。这不是缺点，而是特性——正因为配置少，才能保证团队中所有人的输出一致。

## Prettier 的格式化原理

Prettier 不是简单的"查找替换"。它的工作流程是：

```
源代码 → 解析为 AST → 丢弃原始格式 → 根据规则重新打印 → 格式化后的代码
```

关键步骤是"丢弃原始格式"。这意味着：

```javascript
// 无论你怎么写
const a = { x:1,y:2,z:3 }

// 或者这样写
const a = {
  x: 1,
  y: 2,
  z: 3,
}

// Prettier 都会输出同样的格式（取决于 printWidth 配置）
const a = { x: 1, y: 2, z: 3 };
```

这和 ESLint 的格式规则有本质区别。ESLint 的 `indent` 规则只是检查缩进是否符合要求，而 Prettier 是完全重写格式。

## 核心配置选项

### .prettierrc

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "embeddedLanguageFormatting": "auto"
}
```

逐个解释每个选项的含义和选择依据：

### printWidth — 行宽限制

```json
{ "printWidth": 100 }
```

每行的最大字符数。Prettier 会在超过这个宽度时尝试换行。

**选择依据**：
- 80：传统终端宽度，适合纯文本，代码中会导致过度换行
- 100：现代显示器的舒适宽度，大多数团队的选择
- 120：允许较长的行，减少换行，但需要更大的屏幕

**注意**：这不是硬限制。Prettier 在以下情况下会超过 printWidth：
- 超长的字符串字面量
- 超长的 URL
- 无法在不破坏语义的情况下换行的代码

```javascript
// printWidth: 100
// 这行超过 100 字符，但 Prettier 不会拆分 URL
const response = await fetch('https://api.example.com/v2/users?include=profile,settings,permissions');
```

### semi — 分号

```json
{ "semi": true }
```

是否在语句末尾添加分号。

**两种选择的考量**：
- `true`（加分号）：更安全，避免 ASI（自动分号插入）导致的边界问题
- `false`（不加分号）：代码更简洁，Standard Style 的选择

```javascript
// semi: true
const a = 1;
const b = 2;

// semi: false
const a = 1
const b = 2
```

**边界问题示例**：

```javascript
// 不加分号时，这段代码有 bug
const a = 1
[1, 2, 3].forEach(console.log)
// 实际被解析为：const a = 1[1, 2, 3].forEach(console.log)
```

现代 Prettier 会自动处理这种边界情况（在行首添加分号），但如果你的团队对此没有共识，加 `semi: true` 是更安全的选择。

### singleQuote — 引号

```json
{ "singleQuote": true }
```

使用单引号还是双引号。

```javascript
// singleQuote: true
const name = 'hello';

// singleQuote: false
const name = "hello";
```

大多数 JavaScript 项目使用单引号，因为不需要按 Shift 键。但 JSX 中的字符串属性通常用双引号（通过 `jsxSingleQuote` 单独控制）。

### trailingComma — 尾逗号

```json
{ "trailingComma": "all" }
```

在多行结构的最后一项后是否添加逗号。

```javascript
// trailingComma: "all"
const obj = {
  a: 1,
  b: 2,
  c: 3,  // 尾逗号
};

const arr = [
  1,
  2,
  3,  // 尾逗号
];

function foo(
  a: string,
  b: number,  // 尾逗号
) {}

// trailingComma: "es5"
// 只在对象和数组中加尾逗号，不在函数参数中加
function foo(
  a: string,
  b: number  // 无尾逗号
) {}

// trailingComma: "none"
const obj = {
  a: 1,
  b: 2,
  c: 3  // 无尾逗号
};
```

**为什么推荐 `all`**：尾逗号让 `git diff` 更清晰。添加新项时，只需要修改一行，而不需要给上一行加逗号。

```diff
// 有尾逗号
  a: 1,
  b: 2,
+ c: 3,

// 无尾逗号
  a: 1,
- b: 2
+ b: 2,
+ c: 3
```

### bracketSpacing — 对象花括号空格

```json
{ "bracketSpacing": true }
```

```javascript
// bracketSpacing: true
const obj = { a: 1, b: 2 };

// bracketSpacing: false
const obj = {a: 1, b: 2};
```

### arrowParens — 箭头函数参数括号

```json
{ "arrowParens": "always" }
```

```javascript
// arrowParens: "always"
const fn = (x) => x;

// arrowParens: "avoid"
const fn = x => x;
```

`always` 更一致：所有箭头函数的参数都有括号。`avoid` 在单参数时省略括号，但添加第二个参数时需要加括号，导致修改量更大。

### endOfLine — 行尾符号

```json
{ "endOfLine": "lf" }
```

- `lf`：Unix 风格（`\n`），推荐，跨平台一致性最好
- `crlf`：Windows 风格（`\r\n`）
- `cr`：老 Mac 风格（`\r`），基本不用
- `auto`：保持文件原有的行尾符号

**推荐 `lf`**：配合 `.editorconfig` 的 `end_of_line = lf`，避免 Windows 开发者提交 `\r\n` 导致 diff 异常。

## Prettier 忽略文件

### .prettierignore

```
# 构建产物
dist
build
coverage

# 依赖
node_modules

# 锁文件
pnpm-lock.yaml
package-lock.json
yarn.lock

# 生成的文件
*.min.js
*.min.css

# 特殊文件（保持特定格式）
CHANGELOG.md
```

### 内联忽略

在文件中用注释标记不需要格式化的区域：

```javascript
// prettier-ignore
const matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// prettier-ignore-start
// 这个区域不会被 Prettier 格式化
const ugly = { a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10,k:11,l:12 };
// prettier-ignore-end
```

**什么时候用 prettier-ignore**：
- 数学矩阵、ASCII art 等需要保持特定对齐的内容
- 生成的代码（如代码生成器的输出）
- 性能关键的手动优化代码

**不要滥用**：如果经常需要 prettier-ignore，说明你和 Prettier 的格式偏好差异太大，应该调整配置而不是到处加 ignore。

## 与 ESLint 正确集成

### 冲突的本质

ESLint 有一些规则也管格式，比如：

- `indent`：缩进检查
- `quotes`：引号检查
- `semi`：分号检查
- `comma-dangle`：尾逗号检查
- `no-multiple-empty-lines`：空行检查

当 ESLint 和 Prettier 的配置不一致时，就会出现"ESLint 要求加分号，Prettier 要求不加分号"的死循环。

### 解决方案

```
eslint-config-prettier：关闭 ESLint 中与 Prettier 冲突的规则
eslint-plugin-prettier：把 Prettier 作为 ESLint 规则运行（不推荐）
```

**推荐方案**：只用 `eslint-config-prettier`，不用 `eslint-plugin-prettier`。

原因：`eslint-plugin-prettier` 把 Prettier 的输出作为 ESLint 的错误报告，但这样会让 Prettier 的格式问题和 ESLint 的代码质量问题混在一起，不利于区分处理。

### flat config 集成

```javascript
// eslint.config.js
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-console': 'warn',
    },
  },
  // 放在最后，关闭所有与 Prettier 冲突的规则
  prettierConfig,
];
```

### 验证集成是否正确

```bash
# 检查是否有冲突的规则
npx eslint-config-prettier src/index.ts
```

如果没有输出，说明集成正确。如果有输出，说明还有冲突的规则需要处理。

## 编辑器集成

### VS Code

安装 Prettier 扩展后，在 settings.json 中配置：

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### WebStorm

WebStorm 内置了 Prettier 支持。在 Settings → Languages & Frameworks → JavaScript → Prettier 中配置：
- Prettier package：选择项目中的 prettier 路径
- Run on save：勾选

### EditorConfig 配合

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
```

EditorConfig 确保在 Prettier 运行之前，编辑器的基础格式就一致。

## Prettier 的格式化范围

Prettier 支持多种语言：

| 语言 | 扩展名 | 备注 |
|------|--------|------|
| JavaScript | .js, .mjs, .cjs | 核心支持 |
| TypeScript | .ts, .tsx | 核心支持 |
| JSX/TSX | .jsx, .tsx | 核心支持 |
| JSON | .json, .jsonc | 核心支持 |
| CSS/SCSS/Less | .css, .scss, .less | 核心支持 |
| HTML | .html | 核心支持 |
| Markdown | .md, .mdx | 核心支持 |
| YAML | .yml, .yaml | 核心支持 |
| GraphQL | .graphql | 核心支持 |
| Vue | .vue | 核心支持 |
| Svelte | .svelte | 需要 prettier-plugin-svelte |
| Tailwind CSS | - | 需要 prettier-plugin-tailwindcss |

### 使用插件

```javascript
// .prettierrc
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindFunctions": ["clsx", "cva"]
}
```

## 常见误区

### 误区一：Prettier 和 ESLint 做的事一样

**错误理解**：两者都是代码检查工具，选一个就够了

**正确理解**：ESLint 检查代码质量（逻辑问题、潜在 bug、最佳实践），Prettier 格式化代码风格（缩进、引号、换行）。两者互补，不互相替代。

### 误区二：Prettier 的格式不好看

**错误理解**：Prettier 格式化的代码不符合我的审美，我手写的更好

**正确理解**：Prettier 的目标不是"好看"，而是"一致"。当团队中所有人使用同一配置时，所有代码的格式都是一样的。这比"好看"更有价值。

### 误区三：配置越多越灵活

**错误理解**：应该给 Prettier 所有可能的配置项都设上值

**正确理解**：Prettier 的配置项越少，团队的格式差异就越小。只配置你真正需要改变的选项，其他用默认值。

### 误区四：prettier-plugin-prettier 比直接运行 Prettier 好

**错误理解**：把 Prettier 集成到 ESLint 中更方便

**正确理解**：`eslint-plugin-prettier` 会把 Prettier 的格式问题报告为 ESLint 错误。但 Prettier 的格式化应该是自动修复的，不应该作为错误报告。直接运行 `prettier --write` 或编辑器保存时格式化是更好的方案。

## 本课小结

1. **Prettier 的设计哲学**：有态度的格式化器，减少决策，保证一致
2. **核心配置**：printWidth、semi、singleQuote、trailingComma、endOfLine
3. **ESLint 集成**：用 eslint-config-prettier 关闭冲突规则，放在配置数组最后
4. **忽略策略**：构建产物、依赖、生成文件、锁文件
5. **编辑器集成**：保存时自动格式化，EditorConfig 配合

## 练习

### 练习一：配置 Prettier

为一个新项目配置 Prettier，要求：
- 单引号
- 不加分号
- 尾逗号为 all
- 行宽 100
- LF 行尾

### 练习二：解决 ESLint 和 Prettier 冲突

给定以下 ESLint 和 Prettier 配置，找出冲突项并修复：

```json
// .eslintrc.json
{
  "rules": {
    "indent": ["error", 4],
    "quotes": ["error", "double"],
    "semi": ["error", "always"]
  }
}

// .prettierrc
{
  "tabWidth": 2,
  "singleQuote": true,
  "semi": false
}
```

### 练习三：设计忽略策略

为一个包含以下目录的项目设计 .prettierignore：

```
project/
├── src/
├── dist/
├── coverage/
├── scripts/
├── docs/
├── .husky/
├── node_modules/
├── package.json
├── pnpm-lock.yaml
└── CHANGELOG.md
```

## 参考答案

### 练习一

```json
// .prettierrc
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

```json
// package.json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 练习二

冲突项：
- `indent: 4` vs `tabWidth: 2` — 缩进不一致
- `quotes: "double"` vs `singleQuote: true` — 引号不一致
- `semi: "always"` vs `semi: false` — 分号不一致

修复方案：

```json
// .eslintrc.json - 移除格式规则
{
  "extends": ["eslint:recommended"],
  "rules": {}
}

// .prettierrc - 保持格式配置
{
  "tabWidth": 2,
  "singleQuote": true,
  "semi": false
}
```

然后在 ESLint 配置中加上 `eslint-config-prettier`：

```json
{
  "extends": ["eslint:recommended", "prettier"]
}
```

### 练习三

```gitignore
# .prettierignore

# 构建产物
dist
coverage

# 依赖
node_modules

# 锁文件
pnpm-lock.yaml

# 生成的文件
CHANGELOG.md

# Git hooks
.husky

# 脚本（保持脚本原有的格式）
scripts
```

## 下一步

完成本课后，继续学习 [04. TypeScript 严格模式与类型检查](./04-typescript-strict.md)。

# 01. 代码规范不是约束

> 从"靠自觉"到"靠工程"，理解代码规范为什么存在以及如何落地

## 本课目标

- 理解代码规范从"个人习惯"到"工程化方案"的演进逻辑
- 明确代码规范要解决的具体问题
- 掌握代码规范工程化的核心组件和它们之间的关系
- 能为团队选择合适的规范方案

## 一个真实的代码审查场景

你在一个五人团队里做代码审查，打开一个 PR，看到这样的代码：

```javascript
const handleUserClick = (e) => {
  var target = e.target;
  if(target.className == 'btn'){
    fetch('/api/user').then(res => res.json()).then(data => {
      document.getElementById('app').innerHTML = `<span>${data.name}</span>`
    })
  }
}
```

你想提 review 意见，但不知道从哪说起：

- `var` 应该用 `const` 或 `let`
- 缩进不一致
- `==` 应该用 `===`
- 字符串拼接应该用模板字面量（已经是了，但混用了引号）
- 没有错误处理
- 直接操作 DOM 而不是用框架
- 函数命名不够清晰

你提了五条评论，同事回复"好的我改"。下一次 PR，同样的问题又出现了。

这不是同事态度不好，而是**靠自觉无法维持规范**。人会疲劳、会遗忘、会在赶工时妥协。规范要真正落地，必须靠工程手段强制执行。

## 代码规范到底在解决什么问题

代码规范不是为了让代码"好看"，它解决的是三个工程问题：

### 1. 降低认知切换成本

当团队中每个人写代码的风格不同时，阅读代码需要不断切换"心智模型"：

```javascript
// A 同事的风格
function getUserInfo(userId) {
  return fetch(`/api/user/${userId}`)
    .then(response => response.json())
}

// B 同事的风格
const getUserInfo = async (id) => {
  const res = await fetch('/api/user/' + id)
  return await res.json()
}

// C 同事的风格
function getUserInfo( uid ){
  return fetch("/api/user/"+uid).then(r=>r.json())
}
```

三种写法功能完全一样，但阅读时大脑需要反复适应不同的：命名风格、引号选择、箭头函数 vs function 声明、参数命名（userId vs id vs uid）。

当项目有几万行代码、十几个贡献者时，这种切换成本会严重拖慢理解和修改速度。

### 2. 减少无意义的 Review 讨论

没有规范时，代码审查中大量的讨论是关于风格的：

- "这里应该用 `const`"
- "缩进应该是 2 个空格"
- "字符串应该用单引号"
- "这里应该加分号"

这些讨论占用了本应该讨论架构、逻辑、性能的审查时间。有了规范，这些讨论变成了一条自动化检查的输出——要么通过，要么不通过，不需要人来判断。

### 3. 防止低级错误

有些规范不仅仅是风格问题，而是直接关联到代码质量：

```javascript
// == 的隐式类型转换导致的 bug
if (0 == '') {
  // true，但逻辑上不应该相等
}

// var 的变量提升导致的 bug
console.log(x); // undefined，而不是报错
var x = 10;

// 未处理的 Promise rejection
fetch('/api/data').then(res => res.json());
// 如果请求失败，错误被静默吞掉
```

这些不是"风格偏好"，而是真实的 bug 来源。强制使用 `===`、`const`/`let`、要求处理 Promise 错误，能直接减少线上问题。

## 规范的层次

代码规范不是一个单一的东西，它有明确的层次：

```
┌─────────────────────────────────────────────┐
│            代码质量（Logic）                  │
│   错误处理、类型安全、安全漏洞、性能问题       │
│   工具：ESLint 规则、TypeScript、测试         │
├─────────────────────────────────────────────┤
│            代码模式（Pattern）                │
│   命名规范、文件组织、模块边界、API 设计       │
│   工具：ESLint 自定义规则、文档、Review        │
├─────────────────────────────────────────────┤
│            代码风格（Style）                  │
│   缩进、引号、分号、换行、空格                 │
│   工具：Prettier、EditorConfig               │
└─────────────────────────────────────────────┘
```

**代码风格**是最浅层的，也是最容易自动化的。Prettier 可以在保存文件时自动格式化，不需要开发者操心。

**代码模式**需要更多判断。比如"函数不超过 50 行"、"组件 props 不超过 7 个"、"禁止在 useEffect 中直接修改外部变量"。这些需要 ESLint 规则来检查，部分需要自定义规则。

**代码质量**是最深层的。类型安全、错误处理、安全漏洞需要 TypeScript 和专门的安全扫描工具。

## 工程化方案的核心组件

一个完整的代码规范工程化方案包含这些组件：

```
编写代码
    │
    ▼
编辑器实时检查（EditorConfig + ESLint 插件 + Prettier 插件）
    │
    ▼
保存时自动格式化（Prettier）
    │
    ▼
Git 提交时检查（Husky + lint-staged）
    │
    ▼
PR 创建时 CI 检查（GitHub Actions + ESLint + 测试）
    │
    ▼
代码审查（人工 + 自动化报告）
    │
    ▼
合并到主分支
```

每个环节的作用：

| 环节 | 作用 | 失败的后果 |
|------|------|-----------|
| 编辑器实时检查 | 最早发现问题，修复成本最低 | 问题推迟到后面环节 |
| 保存时格式化 | 消除风格差异，开发者不需要手动调整 | 风格争论占用 Review 时间 |
| Git 提交时检查 | 阻止不合规代码进入仓库 | 不合规代码被提交，污染代码库 |
| CI 检查 | 最后一道防线，确保主分支质量 | 不合规代码被合并，影响所有人 |
| 代码审查 | 发现自动化工具无法检测的问题 | 架构和逻辑问题被遗漏 |

## 选择规范方案

团队不需要从零开始制定规范。社区已经有成熟的方案：

### JavaScript/TypeScript 规范

| 方案 | 特点 | 适用场景 |
|------|------|----------|
| Airbnb Style Guide | 最全面，覆盖广泛 | 大型团队、严格要求 |
| Standard Style | 无分号风格，零配置 | 小团队、快速启动 |
| Google Style Guide | Google 内部规范 | 参考学习 |
| ESLint recommended | ESLint 官方推荐规则 | 基础起点 |

### CSS 规范

| 方案 | 特点 |
|------|------|
| stylelint-config-standard | Stylelint 官方推荐 |
| BEM 命名规范 | 类名命名约定 |

### 提交信息规范

| 方案 | 特点 |
|------|------|
| Conventional Commits | 最广泛使用，支持自动化 |
| Angular Commit Convention | Angular 团队规范 |

实际项目中，通常不会直接使用某个方案，而是以某个方案为基础，根据团队情况做调整。

## 从零搭建一个规范方案

以一个 TypeScript + React 项目为例，看看需要哪些配置文件：

### .editorconfig — 编辑器基础配置

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

EditorConfig 的作用是让不同编辑器（VS Code、WebStorm、Vim）保持一致的基础格式。它不能替代 Prettier，但能覆盖 Prettier 不管的部分（比如 WebStorm 的默认配置）。

### .eslintrc.cjs — ESLint 配置

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // 放在最后，关闭与 Prettier 冲突的规则
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
};
```

这个配置做了几件事：
1. 继承了三组推荐规则（ESLint 基础、TypeScript、React）
2. 用 `prettier` 关闭了格式相关的规则
3. 自定义了几个规则：限制 console、处理未使用变量
4. 配置了 JSX 和 TypeScript 解析器

### .prettierrc — Prettier 配置

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "jsxSingleQuote": false
}
```

### .prettierignore — Prettier 忽略文件

```
dist
node_modules
coverage
*.min.js
pnpm-lock.yaml
```

### package.json 中的 scripts

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

这些配置文件之间的关系：

```
.editorconfig          编辑器基础格式
    ↓
Prettier               代码风格格式化
    ↓
ESLint                 代码质量检查
    ↓ (prettier config) 关闭 ESLint 格式规则，避免冲突
```

## 命名规范

命名是代码规范中最容易引发争论、也最值得统一的部分。好的命名能大幅降低理解成本。

### 文件命名

```
# 组件文件：PascalCase
UserProfile.tsx
UserCard.tsx
LoginPage.tsx

# 工具函数：kebab-case
format-date.ts
validate-email.ts
api-client.ts

# 样式文件：与组件同名
UserProfile.module.css
UserProfile.test.tsx
UserProfile.stories.tsx

# 配置文件：小写或 kebab-case
eslint.config.js
prettier.config.js
tsconfig.json
```

不同团队可能有不同的偏好，关键是**保持一致**。

### 变量命名

```javascript
// ✅ 好的命名：有业务语义
const userAge = 25;
const isLoggedIn = true;
const filteredUsers = users.filter(u => u.active);
const handleSubmit = () => {};

// ❌ 坏的命名：无意义或歧义
const a = 25;
const flag = true;
const list = users.filter(u => u.active);
const fn = () => {};
```

### 布尔变量命名

布尔变量应该用 `is`、`has`、`can`、`should` 等前缀：

```javascript
// ✅ 清晰表达布尔语义
const isActive = true;
const hasPermission = false;
const canEdit = true;
const shouldRedirect = false;

// ❌ 从名字看不出是布尔
const active = true;
const permission = false;
const edit = true;
```

### 函数命名

函数命名应该表达"做什么"，而不是"怎么做"：

```javascript
// ✅ 表达意图
function getUserById(id) { }
function formatCurrency(amount) { }
function validateEmail(email) { }
function sendNotification(user, message) { }

// ❌ 表达实现细节
function fetchFromDatabase(id) { }
function addDollarSign(amount) { }
function regexTest(email) { }
function callNotificationApi(user, message) { }
```

### 常量命名

```javascript
// ✅ 大写蛇形，表达"这是一个固定的值"
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_PAGE_SIZE = 20;

// ❌ 小写或驼峰，容易和变量混淆
const maxRetryCount = 3;
const apiBaseUrl = 'https://api.example.com';
```

### 命名中的常见陷阱

```javascript
// 陷阱一：data、info、item 这类泛化命名
// ❌
function getData(data) {
  return data.info.items.map(item => item.value);
}

// ✅
function extractProductPrices(products) {
  return products.map(product => product.price);
}

// 陷阱二：缩写不一致
// ❌ 一会儿全拼，一会儿缩写
const userInfo = getUser();
const usr = getUserById(1);

// ✅ 统一使用全拼
const userInfo = getUser();
const user = getUserById(1);

// 陷阱三：复数不一致
// ❌ 单数表示集合，复数表示单个？混乱
const user = [1, 2, 3];      // 实际是数组
const users = { id: 1 };     // 实际是单个对象

// ✅ 复数表示集合，单数表示单个
const users = [1, 2, 3];
const user = { id: 1 };
```

## 文件组织规范

### 目录结构

一个典型的前端项目目录：

```
src/
├── components/          # 通用组件
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Button.test.tsx
│   │   └── index.ts
│   └── index.ts         # 统一导出
├── features/            # 业务功能模块
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   └── dashboard/
│       ├── components/
│       ├── hooks/
│       └── services/
├── hooks/               # 通用 hooks
├── utils/               # 工具函数
├── services/            # API 服务
├── types/               # 全局类型
├── styles/              # 全局样式
└── App.tsx
```

### 文件大小

单个文件不宜过大。一些参考标准：

```
组件文件：< 300 行
工具函数文件：< 200 行
类型定义文件：< 200 行
配置文件：< 100 行
```

当文件超过这些限制时，考虑拆分。

### 导入顺序

统一的导入顺序让文件结构更清晰：

```typescript
// 1. 第三方库
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. 内部通用组件
import { Button, Input, Modal } from '@/components';

// 3. 内部工具函数
import { formatDate, validateEmail } from '@/utils';

// 4. 当前模块的组件
import { UserCard } from './UserCard';
import { UserForm } from './UserForm';

// 5. 类型
import type { User, UserRole } from './types';

// 6. 样式
import styles from './UserProfile.module.css';
```

可以用 ESLint 的 `import/order` 规则自动检查和排序。

## 规范的推广策略

### 渐进式引入

不要试图一次性引入所有规范。推荐的顺序：

```
第一周：.editorconfig + Prettier
    ↓ 团队适应格式化
第二周：ESLint 基础规则
    ↓ 团队适应代码检查
第三周：Husky + lint-staged
    ↓ 团队适应提交时检查
第四周：CI 流水线
    ↓ 团队适应 CI 检查
后续：逐步收紧规则，添加自定义规则
```

### 处理已有项目的技术债

已有项目引入规范时，会遇到大量历史代码不合规的问题。几种处理策略：

**策略一：只检查新代码**

```javascript
// eslint.config.js
export default [
  {
    ignores: ['src/legacy/**'], // 忽略旧代码
  },
  // ... 规则配置
];
```

**策略二：批量修复**

```bash
# 用 Prettier 格式化所有文件
pnpm format

# 用 ESLint 自动修复
pnpm lint:fix

# 单独一个 PR 提交格式化变更
```

**策略三：逐文件推进**

在 CI 中配置"增量检查"，只检查本次 PR 修改的文件，不检查未修改的旧文件。

### 建立规范文档

规范不仅要配置在工具中，还要写在文档里：

```markdown
# 代码规范

## 工具
- ESLint 9 + flat config
- Prettier
- TypeScript strict mode

## 命名规范
- 文件名：组件用 PascalCase，其他用 kebab-case
- 变量：camelCase，布尔用 is/has/can 前缀
- 常量：UPPER_SNAKE_CASE
- 类型/接口：PascalCase

## 导入顺序
1. 第三方库
2. 内部通用组件
3. 工具函数
4. 当前模块
5. 类型
6. 样式

## Git 提交
- 使用 Conventional Commits
- type: feat, fix, docs, refactor, perf, test, chore
```

## 常见误区

### 误区一：规范会降低开发效率

**错误理解**：写代码还要遵守各种规则，太慢了

**正确理解**：规范减少的是"无意义的决策时间"。你不需要纠结用单引号还是双引号、加不加分号——工具帮你决定。节省下来的心智资源可以用于解决真正的业务问题。

### 误区二：规范是给新手看的

**错误理解**：资深开发者不需要规范

**正确理解**：规范是给团队用的。再资深的开发者，在疲劳、赶工、分心时也会写出不一致的代码。而且规范最大的价值不是约束个人，而是让不同人的代码看起来像一个人写的。

### 误区三：选最严格的规范就对了

**错误理解**：规则越多越好，越严格越好

**正确理解**：过于严格的规范会导致大量误报，开发者会用 `eslint-disable` 绕过，反而削弱了规范的权威性。规范应该"刚好够用"——拦截真正的问题，不制造噪音。

### 误区四：配好工具就完事了

**错误理解**：装好 ESLint 和 Prettier，代码质量就有保障了

**正确理解**：工具只能检查可以自动化检查的东西。架构设计、业务逻辑合理性、命名的语义准确性——这些需要人来判断。工具是辅助，不是替代。

## 本课小结

1. **规范的动机**：降低认知成本、减少无意义讨论、防止低级错误
2. **规范的层次**：风格（Prettier）→ 模式（ESLint）→ 质量（TypeScript + 测试）
3. **工程化方案**：编辑器 → 保存时 → 提交时 → CI → Review，层层拦截
4. **选择策略**：以社区方案为基础，根据团队情况调整
5. **核心原则**：能自动化的都自动化，把精力留给需要人工判断的事

## 练习

### 练习一：分析你的项目

拿出你当前的项目，回答以下问题：
- 项目中有哪些规范配置文件？
- 这些配置文件之间是什么关系？
- 有没有遗漏的环节（比如没有 Git 提交时检查）？
- 代码审查中经常讨论的风格问题有哪些？

### 练习二：搭建最小规范方案

在一个新项目中，只用 `.editorconfig` + `eslint:recommended` + `prettier` 搭建最小的规范方案，体验每个组件的作用。

## 参考答案

### 练习一

以一个典型的 Create React App 项目为例：

```
已有配置：
- .eslintrc.json（CRA 内置，extends: react-app）
- tsconfig.json（TypeScript 配置）

缺失环节：
- 没有 .editorconfig
- 没有 Prettier 配置
- 没有 Git 提交时检查（无 Husky）
- 没有 CI 流水线
- 没有 CODEOWNERS

常见 Review 讨论：
- 分号要不要加
- 引号用单引号还是双引号
- 组件文件用 .tsx 还是 .jsx
- 命名用 camelCase 还是 PascalCase
```

### 练习二

最小规范方案的文件清单：

```
project/
├── .editorconfig
├── .eslintrc.json
├── .prettierrc
├── package.json
└── src/
    └── index.ts
```

**.editorconfig**：
```ini
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
```

**.eslintrc.json**：
```json
{
  "extends": ["eslint:recommended"],
  "env": { "es2022": true, "node": true },
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" }
}
```

**.prettierrc**：
```json
{ "semi": true, "singleQuote": true, "tabWidth": 2 }
```

**package.json scripts**：
```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

运行 `pnpm lint` 和 `pnpm format`，观察效果。你会发现：
- ESLint 报告代码质量问题（如未使用变量、`==` 比较）
- Prettier 自动修复格式问题（缩进、引号、分号）

## 下一步

完成本课后，继续学习 [02. ESLint 深度配置与自定义规则](./02-eslint-deep-config.md)。

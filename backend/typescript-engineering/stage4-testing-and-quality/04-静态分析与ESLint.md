# 04 - 静态分析与 ESLint

## 场景引入

团队代码风格不统一，有人用 `var`，有人用 `any`，有人把 `async/await` 和 `.then()` 混着用。Code review 时反复指出同样的问题，效率低下。你需要一套自动化的静态分析规则，在代码提交前就拦截这些问题。

## 学习目标

- 掌握 typescript-eslint 的安装与配置
- 理解推荐规则集的设计理念，能按需调整
- 学会编写自定义 ESLint 规则
- 掌握类型感知 linting 的使用场景
- 配置 import 规则，规范模块依赖关系

## 一、typescript-eslint 配置

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

使用 flat config 格式（ESLint v9+）：

```typescript
// eslint.config.ts
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  { ignores: ['dist/', 'node_modules/', '*.js'] }
)
```

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "lint:check": "eslint src/ --max-warnings 0"
  }
}
```

## 二、推荐规则集

typescript-eslint 提供三套规则集，按严格程度递增：`recommended`（基础推荐）、`strict`（更严格）、`stylistic`（代码风格）。

```typescript
// eslint.config.ts
export default {
  rules: {
    // 禁止使用 any —— 最重要的 TypeScript 规则
    '@typescript-eslint/no-explicit-any': 'error',
    // 禁止不必要的类型断言
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    // 要求使用 const 断言
    '@typescript-eslint/prefer-as-const': 'error',
    // 禁止使用 @ts-ignore，要求使用 @ts-expect-error
    '@typescript-eslint/ban-ts-comment': ['error', {
      'ts-ignore': 'allow-with-description',
      'ts-expect-error': 'allow-with-description',
    }],
    // 要求使用 ?? 而不是 ||
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    // 要求使用 optional chaining
    '@typescript-eslint/prefer-optional-chain': 'warn',
  },
}
```

选择建议：新项目用 `recommended` + `strict`；存量项目从 `recommended` 开始，逐步收紧。

## 三、自定义规则

当内置规则不满足需求时，可以编写自定义 ESLint 规则：

```typescript
// rules/no-hardcoded-api-url.ts
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rules/${name}`
)

export const noHardcodedApiUrl = createRule({
  name: 'no-hardcoded-api-url',
  meta: {
    type: 'problem',
    docs: { description: '禁止硬编码 API URL，应使用环境变量' },
    messages: { noHardcodedUrl: '不要硬编码 API URL "{{url}}"，请使用环境变量' },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node: TSESTree.Literal) {
        if (typeof node.value === 'string' && /^https?:\/\/api\./.test(node.value)) {
          context.report({ node, messageId: 'noHardcodedUrl', data: { url: node.value } })
        }
      },
    }
  },
})
```

使用自定义规则：

```typescript
// eslint.config.ts
import { noHardcodedApiUrl } from './rules/no-hardcoded-api-url'

export default {
  plugins: { custom: { rules: { 'no-hardcoded-api-url': noHardcodedApiUrl } } },
  rules: { 'custom/no-hardcoded-api-url': 'error' },
}
```

## 四、类型感知 linting

类型感知规则需要访问 TypeScript 类型信息，能发现更深层的问题：

```typescript
// eslint.config.ts
export default tseslint.config({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // 禁止将非 Promise 值用于 await
    '@typescript-eslint/await-thenable': 'error',
    // 禁止对 Promise 进行不必要的 await
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    // 禁止不安全的类型操作
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    // 要求使用 Promise.all 处理并行 Promise
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
  },
})
```

类型感知规则的实际效果：

```typescript
// ❌ no-floating-promises 会报错
async function badExample() {
  fetchUser() // 未处理的 Promise
}

// ✅ 正确处理
async function goodExample() {
  await fetchUser()
}

// ❌ no-misused-promises 会报错
async function badPromiseCheck() {
  if (fetchUser()) { // Promise 不能作为布尔值
    console.log('user exists')
  }
}
```

## 五、Import 规则

规范模块导入关系，防止循环依赖和不规范的导入方式：

```bash
npm install -D eslint-plugin-import-x
```

```typescript
// eslint.config.ts
import importX from 'eslint-plugin-import-x'

export default {
  plugins: { 'import-x': importX },
  rules: {
    'import-x/no-cycle': ['error', { maxDepth: 3 }],
    'import-x/order': ['error', {
      groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc' },
    }],
    'import-x/no-duplicates': 'error',
  },
}
```

正确的导入顺序：

```typescript
import fs from 'fs'                        // builtin
import path from 'path'                    // builtin

import express from 'express'              // external
import { z } from 'zod'                   // external

import { UserService } from '@/services/user'  // internal

import { helper } from '../utils/helper'   // parent
import { config } from './config'          // sibling

import type { User } from '@/types/user'   // type
```

## 常见误区

1. **一次性启用所有规则**：从 `strict` 规则集一步到位会导致大量报错。应该从 `recommended` 开始，逐步收紧。

2. **过度使用 `eslint-disable`**：频繁使用 `// eslint-disable-next-line` 说明规则和实际需求不匹配。应该调整规则配置，而不是到处禁用。

3. **忽略类型感知规则的性能**：类型感知规则需要编译 TypeScript，大型项目中会显著增加 lint 时间。可以只在 CI 中启用。

4. **把格式化交给 ESLint**：ESLint 负责代码质量，Prettier 负责代码格式。不要用 ESLint 规则处理缩进、分号等格式问题。

## 工程建议

1. **配置写在项目中**：`eslint.config.ts` 应该提交到版本库，确保团队使用同一套规则。

2. **CI 中强制检查**：在 CI 流水线中运行 `eslint --max-warnings 0`，确保代码质量门禁。

3. **IDE 集成**：配置 VS Code 的 ESLint 插件，实现保存时自动修复。

4. **渐进式迁移**：对于存量项目，可以使用 `--report-unused-disable-directives` 清理过时的 disable 注释。

## 小结

ESLint 配合 typescript-eslint 是 TypeScript 项目质量保障的基础。通过合理的规则配置、类型感知 linting 和 import 规则，可以在编码阶段就拦截大量潜在问题。关键是找到严格度和开发效率的平衡点。

## 练习

### 练习一：ESLint 配置

为一个新项目配置 ESLint，要求：启用 recommended + strict 规则集，禁止 any，要求函数返回类型，配置 import 排序规则。

### 练习二：自定义规则

编写一个 ESLint 自定义规则，禁止在代码中直接使用 `console.log`，要求使用项目统一的 logger 工具。

### 练习三：类型感知 linting

配置类型感知 linting 规则，并解释以下代码中哪些行会触发 lint 报错：

```typescript
async function processOrders() {
  const orders = fetchOrders()
  orders.forEach(async (order) => {
    await validateOrder(order)
    if (order.paid) {
      await shipOrder(order)
    }
  })
}
```

---

## 参考答案

### 练习一

**思路**：使用 flat config 格式，组合推荐规则集，添加 import 插件配置。

**答案**：

```typescript
// eslint.config.ts
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': importX },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      'import-x/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import-x/no-duplicates': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist/', 'node_modules/'] }
)
```

**要点**：`tseslint.config()` 支持组合多个配置；`files` 限定规则生效范围。

### 练习二

**思路**：使用 ESLint 的 AST 选择器匹配 `console.log` 调用。

**答案**：

```typescript
// rules/no-console-log.ts
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rules/${name}`
)

export const noConsoleLog = createRule({
  name: 'no-console-log',
  meta: {
    type: 'problem',
    docs: { description: '禁止使用 console.log，应使用统一的 logger' },
    messages: { noConsole: '不要使用 console.log，请使用 logger.info' },
    fixable: 'code',
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'console' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'log'
        ) {
          context.report({
            node,
            messageId: 'noConsole',
            fix(fixer) { return fixer.replaceText(node.callee, 'logger.info') },
          })
        }
      },
    }
  },
})
```

**要点**：AST 选择器匹配 `console.log` 的调用模式；`fixable` 提供自动修复能力。

### 练习三

**思路**：分析代码中的异步问题，配置对应的类型感知规则。

**答案**：

```typescript
// 配置类型感知规则
export default tseslint.config({
  languageOptions: {
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  },
})
```

以下行会触发 lint 报错：

```typescript
async function processOrders() {
  const orders = fetchOrders()  // ❌ no-floating-promises：未 await 的 Promise
  orders.forEach(async (order) => {  // ❌ no-misused-promises：forEach 不处理 async 回调
    await validateOrder(order)
  })
}

// ✅ 修复后
async function processOrders() {
  const orders = await fetchOrders()
  for (const order of orders) {
    await validateOrder(order)
  }
}
```

**要点**：`no-floating-promises` 捕获未处理的 Promise；`no-misused-promises` 捕获 forEach 中的 async 回调；使用 `for...of` 替代 `forEach`。

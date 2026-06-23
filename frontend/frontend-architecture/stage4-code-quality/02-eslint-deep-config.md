# 02. ESLint 深度配置与自定义规则

> flat config 架构、插件开发、自定义规则——让 ESLint 真正服务于你的项目

## 本课目标

- 理解 ESLint 的工作原理和 flat config 架构
- 掌握 ESLint 插件开发的核心流程
- 能够编写自定义规则解决团队特有的代码问题
- 了解 ESLint 的性能优化策略

## ESLint 解决了什么问题

上一课讲了代码规范的必要性。ESLint 是 JavaScript/TypeScript 生态中最核心的代码检查工具。它做的事情可以概括为：**用 AST 分析代码，然后根据规则报告问题**。

```
源代码 → 解析器（@typescript-eslint/parser）→ AST → 规则遍历 AST → 报告问题
```

理解这个流程很重要，因为 ESLint 的所有配置和扩展都围绕这三个环节展开：
- **解析器**决定了 ESLint 能理解什么语法
- **规则**决定了 ESLint 检查什么问题
- **配置**决定了哪些规则生效、在哪些文件上生效

## flat config：ESLint 的新架构

ESLint 从 v9 开始默认使用 flat config（扁平配置），替代了之前的 `.eslintrc` 格式。

### 为什么要做这个改变

旧配置（`.eslintrc`）有几个让人头疼的问题：

1. **配置继承链太深**：`extends: ['a', 'b', 'c', 'd']`，规则从哪里来、优先级是什么，很难搞清楚
2. **插件加载方式不直观**：`plugins: ['@typescript-eslint']` 只是注册了插件名，不会自动启用规则
3. **配置文件格式不统一**：支持 `.eslintrc.js`、`.eslintrc.json`、`.eslintrc.yml`，行为可能不一致
4. **ignore 配置分散**：`.eslintignore`、配置中的 `ignorePatterns`、命令行的 `--ignore-pattern`

flat config 用一个 `eslint.config.js` 文件解决所有问题。

### flat config 的基本结构

```javascript
// eslint.config.js
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // 全局配置
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'no-console': 'warn',
    },
  },

  // 特定文件的配置
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 忽略文件
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
```

### flat config vs 旧配置的对照

| 旧配置 | flat config |
|--------|------------|
| `extends: ['eslint:recommended']` | 展开 `js.configs.recommended.rules` |
| `plugins: ['@typescript-eslint']` | `plugins: { '@typescript-eslint': tsPlugin }` |
| `parser: '@typescript-eslint/parser'` | `languageOptions: { parser: tsParser }` |
| `.eslintignore` 文件 | 配置中的 `ignores` 数组 |
| `env: { browser: true }` | `languageOptions: { globals: { ... } }` |

### flat config 的组合模式

flat config 的核心优势是**配置就是数组**，组合变得非常直观：

```javascript
// eslint.config.js
import baseConfig from './configs/eslint-base.js';
import tsConfig from './configs/eslint-ts.js';
import reactConfig from './configs/eslint-react.js';
import testConfig from './configs/eslint-test.js';

export default [
  ...baseConfig,
  ...tsConfig,
  ...reactConfig,
  ...testConfig,
  {
    rules: {
      // 项目级覆盖
    },
  },
];
```

每个配置模块导出一个数组，主配置文件把它们拼接起来。规则的优先级就是数组的顺序——后面的覆盖前面的。

### Monorepo 中的 flat config

在 Monorepo 中，可以在根目录放一个共享配置，各包用自己的配置扩展：

```javascript
// packages/app/eslint.config.js
import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // app 特有的规则
      'no-console': 'error', // app 比 lib 更严格
    },
  },
];
```

## 规则的执行原理

要写自定义规则，先要理解 ESLint 规则的执行模型。

### AST 遍历

ESLint 使用 ESTree 格式的 AST。规则通过"选择器"（selector）来监听特定的 AST 节点：

```javascript
export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止使用 console.log',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      // 当遍历到 CallExpression 节点时执行
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'console' &&
          node.callee.property.name === 'log'
        ) {
          context.report({
            node,
            message: '禁止使用 console.log，请使用 logger',
          });
        }
      },
    };
  },
};
```

`create` 函数返回一个对象，键是 AST 节点类型（如 `CallExpression`、`VariableDeclaration`、`FunctionDeclaration`），值是当遍历器进入该节点时执行的回调函数。

### 节点选择器

ESLint 支持多种选择器：

```javascript
// 简单类型
CallExpression(node) { },
VariableDeclaration(node) { },

// 带属性的选择器
'CallExpression[callee.name="setTimeout"]'(node) { },
'VariableDeclaration[kind="var"]'(node) { },

// 嵌套属性
'CallExpression[callee.object.name="console"]'(node) { },

// 通配符
':matches(CallExpression, NewExpression)'(node) { },

// 进入和离开
FunctionDeclaration: {
  enter(node) { /* 进入函数时 */ },
  exit(node) { /* 离开函数时 */ },
},
```

### context.report

发现违规时，用 `context.report` 报告：

```javascript
context.report({
  node,
  message: '不允许使用 var',
  // 可选：自动修复
  fix(fixer) {
    return fixer.replaceText(node, 'const');
  },
  // 可选：提供建议
  suggest: [
    {
      message: '改为 const',
      fix(fixer) {
        return fixer.replaceText(node, 'const');
      },
    },
  ],
});
```

## 编写自定义规则

### 场景一：禁止特定的 API 调用

假设团队决定不再使用 `moment.js`，要求用 `dayjs`：

```javascript
// rules/no-moment.js
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止使用 moment.js，请使用 dayjs',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === 'moment') {
          context.report({
            node,
            message: '请使用 dayjs 替代 moment',
            fix(fixer) {
              return fixer.replaceText(node.source, "'dayjs'");
            },
          });
        }
      },
    };
  },
};
```

### 场景二：强制函数参数命名

团队约定回调函数的错误参数必须命名为 `err`，不能用 `error`、`e`、`ex`：

```javascript
// rules/callback-error-naming.js
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '回调函数的错误参数必须命名为 err',
    },
    schema: [],
  },
  create(context) {
    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node) {
        const firstParam = node.params[0];
        if (!firstParam || firstParam.type !== 'Identifier') return;

        const name = firstParam.name;
        if (['error', 'e', 'ex', 'exception'].includes(name)) {
          context.report({
            node: firstParam,
            message: `错误参数应命名为 "err"，而不是 "${name}"`,
          });
        }
      },
    };
  },
};
```

### 场景三：限制组件 Props 数量

React 组件的 Props 超过一定数量时，应该考虑拆分：

```javascript
// rules/max-component-props.js
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '限制 React 组件 Props 数量',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const max = context.options[0]?.max ?? 7;

    return {
      FunctionDeclaration(node) {
        // 检查是否是 React 组件（函数名大写开头）
        if (!node.id || !/^[A-Z]/.test(node.id.name)) return;

        // 获取第一个参数（Props）
        const propsParam = node.params[0];
        if (!propsParam) return;

        let propCount = 0;

        if (propsParam.type === 'ObjectPattern') {
          propCount = propsParam.properties.length;
        } else if (propsParam.type === 'Identifier') {
          // 解构在函数体内，需要更复杂的分析
          return;
        }

        if (propCount > max) {
          context.report({
            node: propsParam,
            message: `组件 ${node.id.name} 有 ${propCount} 个 Props，建议不超过 ${max} 个`,
          });
        }
      },
    };
  },
};
```

## 开发 ESLint 插件

当有多个相关规则时，应该组织成插件：

```
eslint-plugin-team-rules/
├── index.js              # 插件入口
├── rules/
│   ├── no-moment.js
│   ├── callback-error-naming.js
│   └── max-component-props.js
└── package.json
```

### 插件入口

```javascript
// eslint-plugin-team-rules/index.js
import noMoment from './rules/no-moment.js';
import callbackErrorNaming from './rules/callback-error-naming.js';
import maxComponentProps from './rules/max-component-props.js';

export default {
  rules: {
    'no-moment': noMoment,
    'callback-error-naming': callbackErrorNaming,
    'max-component-props': maxComponentProps,
  },
  configs: {
    recommended: {
      plugins: {
        'team-rules': { rules: { /* 填充 */ } },
      },
      rules: {
        'team-rules/no-moment': 'error',
        'team-rules/callback-error-naming': 'warn',
        'team-rules/max-component-props': ['warn', { max: 7 }],
      },
    },
  },
};
```

### 在 flat config 中使用插件

```javascript
// eslint.config.js
import teamRules from 'eslint-plugin-team-rules';

export default [
  {
    plugins: {
      'team-rules': teamRules,
    },
    rules: {
      'team-rules/no-moment': 'error',
      'team-rules/max-component-props': ['warn', { max: 5 }],
    },
  },
];
```

### package.json

```json
{
  "name": "eslint-plugin-team-rules",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "peerDependencies": {
    "eslint": ">=9.0.0"
  },
  "keywords": ["eslint", "eslintplugin"]
}
```

## 规则的类型和严重级别

### 规则类型

ESLint 规则有三种类型：

```javascript
meta: {
  type: 'problem'     // 代码可能有 bug
  type: 'suggestion'  // 可能有更好的写法
  type: 'layout'      // 格式问题（现在通常交给 Prettier）
}
```

### 严重级别

```javascript
rules: {
  'no-console': 'off',       // 0 - 关闭
  'no-console': 'warn',      // 1 - 警告（不阻止构建）
  'no-console': 'error',     // 2 - 错误（阻止构建）
  'no-console': [2, { allow: ['warn'] }], // 带选项
}
```

实际项目中的选择策略：

- **error**：必须修复的问题。用于：可能导致 bug 的代码、团队严格禁止的写法
- **warn**：应该修复但不紧急的问题。用于：代码味道、潜在问题、迁移中的临时状态
- **off**：不检查的问题。用于：Prettier 已处理的格式规则、团队决定不用的规则

## ESLint 性能优化

ESLint 在大型项目中可能很慢。几个优化策略：

### 1. 只检查需要检查的文件

```javascript
// eslint.config.js
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    // 只对 src 目录下的 TS 文件应用规则
  },
  {
    ignores: ['**/*.min.js', '**/vendor/**'],
  },
];
```

### 2. 使用缓存

```bash
# 命令行启用缓存
eslint --cache --cache-location .eslintcache .
```

### 3. 减少规则数量

每个规则都需要遍历 AST。关闭不需要的规则可以减少遍历次数。

### 4. 使用 ESLint 的 timing 功能

```bash
ESLINT_USE_FLAT_CONFIG=true eslint --timing .
```

这会输出每条规则的执行时间，帮助你找到性能瓶颈。

## 常见误区

### 误区一：规则越多越好

**错误理解**：开启所有能开启的规则，代码质量就最高

**正确理解**：规则太多会导致大量误报，开发者会批量使用 `eslint-disable`，真正的问题反而被淹没。选择规则的原则是：这个规则发现的问题，是否真的需要在代码审查中讨论。

### 误区二：用 ESLint 处理格式问题

**错误理解**：ESLint 什么都能检查，包括格式

**正确理解**：ESLint 的格式规则（如 `indent`、`quotes`、`semi`）应该交给 Prettier。ESLint 专注代码质量，Prettier 专注代码风格，各司其职。

### 误区三：到处写 eslint-disable

**错误理解**：如果 ESLint 报错但代码没问题，加个 disable 注释就行

**正确理解**：如果同一条规则被大量 disable，说明这条规则不适合你的项目。应该调整规则配置或关闭它，而不是到处加 disable。

## 本课小结

1. **ESLint 工作原理**：源代码 → 解析器 → AST → 规则遍历 → 报告问题
2. **flat config**：配置就是数组，组合就是拼接，优先级就是顺序
3. **自定义规则**：通过 AST 选择器监听节点，用 context.report 报告问题
4. **插件开发**：多个相关规则组织成插件，提供推荐配置
5. **性能优化**：缩小检查范围、使用缓存、减少规则数量

## 练习

### 练习一：迁移配置到 flat config

将一个使用 `.eslintrc.json` 的项目迁移到 `eslint.config.js`。

### 练习二：编写一个自定义规则

编写一个 ESLint 规则，禁止在 React 组件中直接使用 `Math.random()`，要求封装成一个工具函数。

### 练习三：开发一个插件

将练习二的规则和以下规则组织成一个 ESLint 插件：
- 禁止在组件中使用 `any` 类型（仅限组件文件）
- 要求异步函数必须处理错误

## 参考答案

### 练习一

**旧配置**（.eslintrc.json）：
```json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-console": "warn"
  }
}
```

**新配置**（eslint.config.js）：
```javascript
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-console': 'warn',
    },
  },
];
```

### 练习二

```javascript
// rules/no-math-random.js
export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在 React 组件中直接使用 Math.random()',
    },
    schema: [],
  },
  create(context) {
    let inComponent = false;

    return {
      'FunctionDeclaration[id.name=/^[A-Z]/]'(node) {
        inComponent = true;
      },
      'FunctionDeclaration[id.name=/^[A-Z]/]:exit'() {
        inComponent = false;
      },
      'CallExpression[callee.object.name="Math"][callee.property.name="random"]'(node) {
        if (inComponent) {
          context.report({
            node,
            message: '请封装 Math.random() 为工具函数，便于测试和控制',
          });
        }
      },
    };
  },
};
```

### 练习三

```
eslint-plugin-safe-components/
├── index.js
├── rules/
│   ├── no-math-random.js
│   ├── no-any-in-component.js
│   └── require-async-error-handling.js
└── package.json
```

```javascript
// index.js
import noMathRandom from './rules/no-math-random.js';
import noAnyInComponent from './rules/no-any-in-component.js';
import requireAsyncErrorHandling from './rules/require-async-error-handling.js';

export default {
  rules: {
    'no-math-random': noMathRandom,
    'no-any-in-component': noAnyInComponent,
    'require-async-error-handling': requireAsyncErrorHandling,
  },
};
```

## 下一步

完成本课后，继续学习 [03. Prettier 与风格统一](./03-prettier-style.md)。

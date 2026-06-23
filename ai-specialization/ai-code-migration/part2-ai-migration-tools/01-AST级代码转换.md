# 01 - AST 级代码转换

> **课程定位**：Part 2 核心技术课，掌握结构化代码修改能力。
>
> **前置要求**：了解 JavaScript 语法，有基本的代码重构经验
>
> **预计时长**：2 小时

---

团队维护着 800 多文件的 React 项目，300 多个组件还在用 Class Component。三个月内要完成 React 18 升级。手动改？300 个组件 × 20 分钟 = 100 小时纯体力活。用正则？正则分不清哪些 `class` 是 React 组件、哪些是普通工具类。

AST 级代码转换的价值：它不是在文本层面做查找替换，而是真正理解代码的语法结构。

---

## AST vs 正则替换

```
正则替换的局限：
  class UserStore { fetch() { ... } }
  正则: /class\s+(\w+)/ → "function $1"
  → 无法识别是 React 组件还是普通类
  → 不知道 fetch() 是生命周期还是自定义方法
  → 字符串和注释中的 "class" 也会被误匹配

AST 转换的优势：
  1. 精确匹配：只操作特定类型的节点
  2. 结构感知：理解嵌套关系、作用域、引用
  3. 安全修改：保持代码格式和注释
  4. 可组合：多个转换可以串联执行
```

---

## jscodeshift 架构

jscodeshift 是 Facebook 开源的 codemod 框架，建立在 recast 之上。核心抽象是 **Collection**——AST 节点的集合，用 `j(file).find(...)` 筛选节点，链式操作执行变换。

```
你的 Transform 脚本 → jscodeshift API (find/filter/replaceWith) → recast 打印器 (保留格式) → @babel/parser (解析 AST)
```

---

## 实战：callback → async/await 转换

```javascript
// transforms/callback-to-async.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let hasChanges = false;

  root.find(j.FunctionDeclaration).forEach(path => {
    const params = path.node.params;
    if (params.length === 0) return;
    const lastParam = params[params.length - 1];
    if (lastParam.type !== 'Identifier' || lastParam.name !== 'callback') return;

    const callbackCalls = j(path).find(j.CallExpression, { callee: { type: 'Identifier', name: 'callback' } });
    if (callbackCalls.length === 0) return;

    hasChanges = true;
    path.node.params = params.slice(0, -1);
    path.node.async = true;

    j(path).find(j.CallExpression).forEach(callPath => {
      const callee = callPath.node.callee;
      if (callee.type !== 'MemberExpression' || callPath.node.arguments.length < 2) return;
      const lastArg = callPath.node.arguments[callPath.node.arguments.length - 1];
      if (lastArg.type !== 'ArrowFunctionExpression' && lastArg.type !== 'FunctionExpression') return;
      if (lastArg.params.length < 2) return;

      const resultParam = lastArg.params[1];
      const body = lastArg.body.body;
      if (!body || body.length === 0 || body[0].type !== 'IfStatement') return;

      const tryBody = resultParam ? [
        j.variableDeclaration('const', [
          j.variableDeclarator(j.identifier(resultParam.name), j.awaitExpression(j.callExpression(callee, callPath.node.arguments.slice(0, -1))))
        ])
      ] : [];

      j(lastArg).find(j.CallExpression, { callee: { type: 'Identifier', name: 'callback' } }).forEach(cbCallPath => {
        const cbArgs = cbCallPath.node.arguments;
        if (cbArgs.length === 2 && cbArgs[0].type === 'NullLiteral') {
          const parent = cbCallPath.parent;
          if (parent.node.type === 'ExpressionStatement') j(parent).replaceWith(j.returnStatement(cbArgs[1]));
        }
      });

      j(callPath.parent).replaceWith(
        j.tryStatement(j.blockStatement(tryBody), j.catchClause(j.identifier('error'), j.blockStatement([j.throwStatement(j.identifier('error'))])))
      );
    });
  });

  return hasChanges ? root.toSource({ quote: 'single' }) : fileInfo.source;
};
```

运行：`npx jscodeshift -t transforms/callback-to-async.js src/ --extensions=js --dry --print`

---

## 实战：ts-morph 结构化修改

ts-morph 封装了 TypeScript 编译器 API，能访问类型信息：

```typescript
import { Project, SyntaxKind } from 'ts-morph';
const project = new Project({ tsConfigFilePath: 'tsconfig.json' });

// 批量重命名：getAllUsers → fetchAllUsers
for (const sourceFile of project.getSourceFiles('src/api/**/*.ts')) {
  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpr.getExpression();
    if (expression.getText() === 'getAllUsers') {
      expression.replaceWithText('fetchAllUsers');
      const declaration = expression.getSymbol()?.getDeclarations()?.[0];
      if (declaration && 'rename' in declaration) (declaration as any).rename('fetchAllUsers');
    }
  }
  sourceFile.saveSync();
}

// 为没有返回类型注解的函数添加类型
for (const sourceFile of project.getSourceFiles('src/**/*.ts')) {
  for (const func of sourceFile.getFunctions()) {
    if (func.getReturnTypeNode()) continue;
    const typeText = func.getReturnType().getText();
    if (typeText !== 'void' && typeText !== 'undefined') func.setReturnType(typeText);
  }
  sourceFile.saveSync();
}
```

ts-morph 的核心优势：`getReturnType()` 能推断返回类型，即使源码没有显式标注。jscodeshift 只操作 AST 节点，不进行语义分析。

---

## codemod 测试策略

使用 fixture 文件做输入/输出对比：

```javascript
const { defineInlineTest } = require('jscodeshift/src/testUtils');
const transform = require('../callback-to-async');

defineInlineTest(transform, {},
  `function fetchUser(id, callback) {\n  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {\n    if (err) { callback(err); return; }\n    callback(null, rows[0]);\n  });\n}`,
  `async function fetchUser(id) {\n  try {\n    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);\n    return rows[0];\n  } catch (error) { throw error; }\n}`,
  'converts callback to async/await'
);

defineInlineTest(transform, {},
  `function noCallback(x) { return x + 1; }`,
  `function noCallback(x) { return x + 1; }`,
  'does not modify functions without callback'
);
```

---

## 增量式 codemod

面对复杂转换（如 Class → Function Component），分步骤：

```
步骤 1: 提取 state → useState     步骤 4: 替换 this.props → 参数解构
步骤 2: 转换生命周期 → useEffect   步骤 5: 替换 this.state → 局部变量
步骤 3: 箭头函数 → useCallback    步骤 6: 移除 class → function 声明
```

每步独立运行、独立测试、可回滚、可复用。

---

## 练习

### 练习一：变量重命名 codemod

编写 jscodeshift transform，将所有名为 `data` 的局部变量重命名为 `userData`。只重命名局部变量，不影响全局变量和函数参数。

### 练习二：console.log 清除器

移除所有独立语句的 `console.log`。保留 `console.error` 和 `console.warn`。

---

## 参考答案

### 练习一

```javascript
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  root.find(j.VariableDeclarator, { id: { type: 'Identifier', name: 'data' } }).forEach(path => {
    const scope = path.scope;
    if (!scope || scope.isGlobal) return;
    const binding = scope.getBinding('data');
    if (!binding) return;
    binding.referencePaths.reverse().forEach(refPath => { if (refPath.node.type === 'Identifier') refPath.node.name = 'userData'; });
    path.node.id.name = 'userData';
  });
  return root.toSource({ quote: 'single' });
};
```

要点：`scope.getBinding()` 获取所有引用；从后往前替换避免位置偏移。

### 练习二

```javascript
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  root.find(j.ExpressionStatement).filter(path => {
    const expr = path.node.expression;
    return expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression' && expr.callee.object.name === 'console' && expr.callee.property.name === 'log';
  }).forEach(path => { j(path).remove(); });
  return root.toSource({ quote: 'single' });
};
```

要点：只移除作为独立 `ExpressionStatement` 的 `console.log`，不处理表达式内部的情况。

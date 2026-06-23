# AST 级代码转换

## 场景引入

团队维护着一个有 800 多个文件的 React 项目，其中 300 多个组件还在使用 Class Component 写法。产品经理要求三个月内完成 React 18 升级，你需要把这些 Class 组件批量转换成 Function Component + Hooks。

手动改？每个组件平均要 20 分钟，300 个组件就是 100 小时的纯体力活。更要命的是，手动改容易遗漏 `this.setState` 的边界情况——比如 `setState` 传入函数式更新时，`prevState` 参数需要映射到 `useState` 的函数式 setter；再比如 `componentDidMount`、`componentDidUpdate`、`componentWillUnmount` 三个生命周期要合并成一个 `useEffect`，但依赖数组的处理完全不同。

用正则替换？你会发现正则根本分不清哪些 `class` 是 React 组件、哪些是普通的工具类。一个 `class Utils { render() {} }` 如果被正则误判为 React 组件，替换后的代码直接报错。

这就是 AST 级代码转换的价值：它不是在文本层面做查找替换，而是真正理解代码的语法结构。你告诉它"把 class 组件变成 function 组件"，它能精确识别哪些是 `render` 方法、哪些是状态声明、哪些是生命周期钩子，然后安全地改写。

## 学习目标

完成本课学习后，你将能够：

1. 理解 AST（抽象语法树）的结构和遍历原理
2. 使用 jscodeshift 编写生产级代码转换工具（codemod）
3. 使用 ts-morph 进行 TypeScript 代码的结构化修改
4. 实现真实场景的转换：回调转 async/await、Class 转 Function 组件
5. 掌握 codemod 的测试策略和增量式转换方法

## 核心概念

### 什么是 AST

当你写 `const sum = (a, b) => a + b` 时，JavaScript 引擎看到的不是字符串，而是一棵树。AST（Abstract Syntax Tree，抽象语法树）是源代码的结构化表示，每个节点代表一个语法结构：

```
                  Program
                    |
          VariableDeclaration
            kind: "const"
                    |
          VariableDeclarator
            id: Identifier("sum")
                    |
         ArrowFunctionExpression
          params: [Identifier("a"), Identifier("b")]
                    |
         BinaryExpression
          operator: "+"
            /              \
   Identifier("a")    Identifier("b")
```

AST 的关键特性是**无歧义**。正则表达式 `function\s+\w+` 无法区分函数声明和函数调用，但 AST 节点的 `type` 字段明确告诉你这是 `FunctionDeclaration` 还是 `CallExpression`。

### AST 转换 vs 正则替换

```
┌─────────────────────────────────────────────────────────────┐
│                     正则替换的局限性                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  源码: class UserStore { fetch() { ... } }                 │
│  正则: /class\s+(\w+)/ → "function $1"                     │
│                                                             │
│  问题 1: 无法识别这是 React 组件还是普通类                    │
│  问题 2: 不知道 fetch() 是生命周期还是自定义方法              │
│  问题 3: 无法处理跨行的 class 定义                           │
│  问题 4: 字符串和注释中的 "class" 也会被误匹配               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     AST 转换的优势                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 精确匹配：只操作特定类型的节点                           │
│  2. 结构感知：理解嵌套关系、作用域、引用                      │
│  3. 安全修改：保持代码格式和注释                             │
│  4. 可组合：多个转换可以串联执行                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### jscodeshift 架构

jscodeshift 是 Facebook 开源的 codemod 框架，它建立在 `recast` 之上，核心架构分为四层：

```
┌──────────────────────────────────────────┐
│            你的 Transform 脚本            │
│  (定义转换规则：找到什么 → 改成什么)       │
├──────────────────────────────────────────┤
│              jscodeshift API              │
│  j()  find()  filter()  replaceWith()    │
│  forEach()  paths()  toSource()          │
├──────────────────────────────────────────┤
│               recast 打印器               │
│  (保证修改后的代码保留原始格式和注释)      │
├──────────────────────────────────────────┤
│           @babel/parser 解析器            │
│  (将源码解析为 AST)                       │
└──────────────────────────────────────────┘
```

jscodeshift 的核心抽象是 **Collection**——一个 AST 节点的集合。你可以用 `j(file).find(...)` 筛选节点，用链式操作对集合中的每个节点执行变换：

```javascript
// 伪代码展示核心 API
j(source)
  .find(j.CallExpression, { callee: { name: 'callback' } })
  .forEach(path => {
    // 对每个匹配的节点执行变换
  })
  .toSource(); // 输出修改后的代码
```

### ts-morph 的不同思路

jscodeshift 操作的是原始 AST 节点，适合通用的 JavaScript 转换。但当你要做 TypeScript 特有的操作（重命名符号、添加类型注解、提取接口）时，ts-morph 更合适，因为它直接封装了 TypeScript 编译器 API：

```
┌──────────────────────────────────────────┐
│               ts-morph API               │
│  SourceFile  ClassDeclaration  Method    │
│  addParameter()  rename()  getType()    │
├──────────────────────────────────────────┤
│          TypeScript Compiler API         │
│  语义分析、类型推断、符号解析              │
├──────────────────────────────────────────┤
│            TypeScript AST                │
│  (包含类型信息的完整语法树)               │
└──────────────────────────────────────────┘
```

ts-morph 的优势在于它能访问**类型信息**。比如你可以判断一个函数的参数类型是 `string` 还是 `number`，而 jscodeshift 只能看到这是 `Identifier` 节点。

## 实战：callback → async/await 转换

这是最经典的 codemod 场景之一。假设你的代码库里有大量这种模式：

```javascript
// 转换前
function fetchUser(id, callback) {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, rows[0]);
  });
}
```

目标是转换成：

```javascript
// 转换后
async function fetchUser(id) {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
}
```

下面是一个完整的 jscodeshift transform：

```javascript
// transforms/callback-to-async.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let hasChanges = false;

  // 找到所有以 callback 作为最后一个参数的函数
  root
    .find(j.FunctionDeclaration)
    .forEach(path => {
      const params = path.node.params;
      if (params.length === 0) return;

      const lastParam = params[params.length - 1];
      if (lastParam.type !== 'Identifier' || lastParam.name !== 'callback') return;

      // 检查函数体内是否有 callback 调用
      const callbackCalls = j(path)
        .find(j.CallExpression, {
          callee: { type: 'Identifier', name: 'callback' }
        });

      if (callbackCalls.length === 0) return;

      // 标记需要转换
      hasChanges = true;

      // 1. 移除 callback 参数
      path.node.params = params.slice(0, -1);

      // 2. 添加 async 关键字
      path.node.async = true;

      // 3. 转换函数体内的 callback 模式
      j(path)
        .find(j.CallExpression)
        .forEach(callPath => {
          const callee = callPath.node.callee;
          // 找到带回调的异步调用：db.query(..., (err, result) => { ... })
          if (
            callee.type === 'MemberExpression' &&
            callPath.node.arguments.length >= 2
          ) {
            const lastArg = callPath.node.arguments[callPath.node.arguments.length - 1];
            if (lastArg.type !== 'ArrowFunctionExpression' &&
                lastArg.type !== 'FunctionExpression') return;

            const callbackParams = lastArg.params;
            if (callbackParams.length < 2) return;

            const errParam = callbackParams[0];
            const resultParam = callbackParams[1];

            // 检查回调体内是否有 if (err) callback(err)
            const body = lastArg.body.body;
            if (!body || body.length === 0) return;

            const ifStatement = body[0];
            if (ifStatement.type !== 'IfStatement') return;

            // 构建 try-catch + await 替换
            const tryBody = [];
            if (resultParam) {
              tryBody.push(
                j.variableDeclaration('const', [
                  j.variableDeclarator(
                    j.identifier(resultParam.name),
                    j.awaitExpression(
                      j.callExpression(
                        callee,
                        callPath.node.arguments.slice(0, -1)
                      )
                    )
                  )
                ])
              );
            }

            // 找到 callback(null, result) 并替换为 return
            j(lastArg)
              .find(j.CallExpression, {
                callee: { type: 'Identifier', name: 'callback' }
              })
              .forEach(cbCallPath => {
                const cbArgs = cbCallPath.node.arguments;
                if (cbArgs.length === 2 && cbArgs[0].type === 'NullLiteral') {
                  // callback(null, value) → return value
                  const parent = cbCallPath.parent;
                  if (parent.node.type === 'ExpressionStatement') {
                    j(parent).replaceWith(j.returnStatement(cbArgs[1]));
                  }
                }
              });

            // 用 try-catch 包裹
            const catchClause = j.catchClause(
              j.identifier('error'),
              j.blockStatement([
                j.throwStatement(j.identifier('error'))
              ])
            );

            const parentStmt = callPath.parent;
            j(parentStmt).replaceWith(
              j.tryStatement(
                j.blockStatement(tryBody),
                catchClause
              )
            );
          }
        });
    });

  return hasChanges ? root.toSource({ quote: 'single' }) : fileInfo.source;
};
```

运行方式：

```bash
npx jscodeshift -t transforms/callback-to-async.js src/ --extensions=js --dry --print
```

`--dry` 参数表示只预览不实际修改，`--print` 打印转换后的代码。确认无误后去掉 `--dry` 执行实际转换。

## 实战：Class Component → Function Component

这是更复杂的转换场景。一个典型的 React Class 组件：

```jsx
class UserProfile extends React.Component {
  state = { loading: true, user: null };

  async componentDidMount() {
    const user = await fetchUser(this.props.userId);
    this.setState({ loading: false, user });
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.setState({ loading: true });
      const user = await fetchUser(this.props.userId);
      this.setState({ loading: false, user });
    }
  }

  handleClick = () => {
    console.log('clicked', this.state.user.name);
  };

  render() {
    if (this.state.loading) return <Spinner />;
    return <div onClick={this.handleClick}>{this.state.user.name}</div>;
  }
}
```

转换后的 Function Component：

```jsx
function UserProfile({ userId }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fetched = await fetchUser(userId);
      if (!cancelled) {
        setUser(fetched);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleClick = useCallback(() => {
    console.log('clicked', user.name);
  }, [user]);

  if (loading) return <Spinner />;
  return <div onClick={handleClick}>{user.name}</div>;
}
```

关键的转换逻辑如下（完整 transform 代码）：

```javascript
// transforms/class-to-function.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // 收集需要添加的 React Hooks import
  const neededHooks = new Set();

  root
    .find(j.ClassDeclaration)
    .forEach(classPath => {
      const className = classPath.node.id.name;

      // 检查是否继承 React.Component 或 Component
      const superClass = classPath.node.superClass;
      const isReactComponent =
        (superClass && superClass.name === 'Component') ||
        (superClass && superClass.type === 'MemberExpression' &&
         superClass.object.name === 'React' &&
         superClass.property.name === 'Component');

      if (!isReactComponent) return;

      const classBody = classPath.node.body.body;
      const stateProperties = [];
      const effectBlocks = [];
      const callbackBlocks = [];
      let renderBody = null;

      // 解析 state 初始化
      const stateProp = classBody.find(
        node => node.type === 'ClassProperty' && node.key.name === 'state'
      );
      if (stateProp && stateProp.value && stateProp.value.type === 'ObjectExpression') {
        stateProp.value.properties.forEach(prop => {
          stateProperties.push({
            name: prop.key.name,
            value: prop.value
          });
          neededHooks.add('useState');
        });
      }

      // 解析方法
      classBody.forEach(node => {
        if (node.type === 'ClassProperty' && node.value.type === 'ArrowFunctionExpression') {
          // 箭头函数属性 → useCallback
          callbackBlocks.push({
            name: node.key.name,
            params: node.value.params,
            body: node.value.body
          });
          neededHooks.add('useCallback');
        }

        if (node.type === 'MethodDefinition' && node.key.name === 'render') {
          renderBody = node.value.body;
        }

        if (node.type === 'MethodDefinition' && node.key.name === 'componentDidMount') {
          effectBlocks.push({
            deps: '[]',
            body: node.value.body,
            cleanup: null
          });
          neededHooks.add('useEffect');
        }

        if (node.type === 'MethodDefinition' && node.key.name === 'componentDidUpdate') {
          // 从 prevProps 参数推断依赖数组
          const deps = [];
          effectBlocks.push({
            deps: deps,
            body: node.value.body,
            cleanup: null
          });
          neededHooks.add('useEffect');
        }
      });

      // 构建 Function Component 的 body
      const functionBody = [];

      // useState 声明
      stateProperties.forEach(({ name, value }) => {
        const setterName = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        functionBody.push(
          j.variableDeclaration('const', [
            j.variableDeclarator(
              j.arrayPattern([j.identifier(name), j.identifier(setterName)]),
              j.callExpression(j.identifier('useState'), [value])
            )
          ])
        );
      });

      // useEffect 声明
      effectBlocks.forEach(({ deps, body }) => {
        const arrowFn = j.arrowFunctionExpression([], body);
        arrowFn.async = true;
        functionBody.push(
          j.expressionStatement(
            j.callExpression(j.identifier('useEffect'), [
              j.arrowFunctionExpression([], body),
              j.arrayExpression(deps.map(d => j.identifier(d)))
            ])
          )
        );
      });

      // useCallback 声明
      callbackBlocks.forEach(({ name, params, body }) => {
        functionBody.push(
          j.variableDeclaration('const', [
            j.variableDeclarator(
              j.identifier(name),
              j.callExpression(j.identifier('useCallback'), [
                j.arrowFunctionExpression(params, body),
                j.arrayExpression([])
              ])
            )
          ])
        );
      });

      // 替换 class 为 function
      j(classPath).replaceWith(
        j.functionDeclaration(
          j.identifier(className),
          [], // props 解构在实际实现中处理
          j.blockStatement(functionBody)
        )
      );
    });

  // 添加必要的 import
  if (neededHooks.size > 0) {
    const importSpecifiers = [...neededHooks].map(hook =>
      j.importSpecifier(j.identifier(hook))
    );

    const existingImport = root.find(j.ImportDeclaration, {
      source: { value: 'react' }
    });

    if (existingImport.length > 0) {
      const specifiers = existingImport.get(0).node.specifiers;
      importSpecifiers.forEach(spec => {
        if (!specifiers.some(s => s.imported.name === spec.imported.name)) {
          specifiers.push(spec);
        }
      });
    } else {
      root.find(j.Program).get('body', 0).insertBefore(
        j.importDeclaration(
          importSpecifiers,
          j.literal('react')
        )
      );
    }
  }

  return root.toSource({ quote: 'single' });
};
```

## 实战：ts-morph 结构化修改

当你的代码是 TypeScript 时，ts-morph 提供了更强大的能力。下面演示如何用 ts-morph 批量重命名 API 方法并添加类型注解：

```typescript
// scripts/refactor-api.ts
import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

// 1. 批量重命名：getAllUsers → fetchAllUsers
const sourceFiles = project.getSourceFiles('src/api/**/*.ts');

for (const sourceFile of sourceFiles) {
  const callExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  );

  for (const callExpr of callExpressions) {
    const expression = callExpr.getExpression();
    if (expression.getText() === 'getAllUsers') {
      // 重命名调用
      expression.replaceWithText('fetchAllUsers');

      // 同时检查是否有对应的声明需要重命名
      const declaration = expression.getSymbol()?.getDeclarations()?.[0];
      if (declaration && 'rename' in declaration) {
        (declaration as any).rename('fetchAllUsers');
      }
    }
  }

  sourceFile.saveSync();
}

// 2. 为没有返回类型注解的函数添加类型
const allFiles = project.getSourceFiles('src/**/*.ts');

for (const sourceFile of allFiles) {
  const functions = sourceFile.getFunctions();

  for (const func of functions) {
    if (func.getReturnTypeNode()) continue; // 已有类型注解，跳过

    const returnType = func.getReturnType();
    const typeText = returnType.getText();

    // 跳过 void 和简单的字面量类型
    if (typeText === 'void' || typeText === 'undefined') continue;

    // 添加返回类型注解
    func.setReturnType(typeText);
  }

  sourceFile.saveSync();
}
```

ts-morph 的核心优势在于 `getReturnType()` 能推断出函数的返回类型，即使源码没有显式标注。这在 jscodeshift 中做不到——jscodeshift 只操作 AST 节点，不进行语义分析。

## codemod 测试策略

codemod 的测试不应依赖真实代码库，而应使用 fixture 文件。标准的测试结构如下：

```
transforms/
├── __tests__/
│   └── callback-to-async.test.js
├── __testfixtures__/
│   ├── callback-to-async.input.js      # 输入
│   └── callback-to-async.output.js     # 期望输出
└── callback-to-async.js
```

测试代码：

```javascript
// transforms/__tests__/callback-to-async.test.js
const { defineInlineTest } = require('jscodeshift/src/testUtils');
const transform = require('../callback-to-async');

// 自动测试：input → output 对比
defineInlineTest(
  transform,
  {},
  // 输入
  `function fetchUser(id, callback) {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) { callback(err); return; }
    callback(null, rows[0]);
  });
}`,
  // 期望输出
  `async function fetchUser(id) {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  } catch (error) {
    throw error;
  }
}`,
  'converts callback pattern to async/await'
);

// 边界情况测试
defineInlineTest(
  transform,
  {},
  `function noCallback(x) { return x + 1; }`,
  `function noCallback(x) { return x + 1; }`,
  'does not modify functions without callback parameter'
);
```

运行测试：

```bash
npx jest transforms/__tests__/callback-to-async.test.js
```

## 增量式 codemod：分步骤转换复杂模式

面对复杂的转换场景（比如 Class Component → Function Component），不要试图写一个巨大的 transform。正确做法是分步骤：

```
步骤 1: 提取 state 到 useState
步骤 2: 转换生命周期到 useEffect
步骤 3: 转换箭头函数属性到 useCallback
步骤 4: 替换 this.props 为函数参数解构
步骤 5: 替换 this.state 为局部变量
步骤 6: 移除 class 声明，替换为 function 声明
```

每个步骤独立运行、独立测试：

```bash
# 按顺序执行多个 transform
npx jscodeshift -t transforms/step1-extract-state.js src/components/
npx jscodeshift -t transforms/step2-lifecycle-to-effect.js src/components/
npx jscodeshift -t transforms/step3-arrow-to-callback.js src/components/
npx jscodeshift -t transforms/step4-destructure-props.js src/components/
npx jscodeshift -t transforms/step5-remove-this-state.js src/components/
npx jscodeshift -t transforms/step6-class-to-function.js src/components/
```

这样做的好处：

1. **每步可验证**：每一步都可以跑测试、看 diff
2. **可回滚**：某一步出错，只需回滚那一步
3. **可复用**：步骤 2 的 transform 可以在其他项目中复用
4. **可调试**：出问题时只需排查单个步骤的逻辑

## 常见误区

**误区一：试图一步完成所有转换**

写一个巨大的 transform 处理所有情况，结果是代码难以理解、难以调试。应该把大转换拆成多个小 transform，每个只做一件事。

**误区二：忽略格式保留**

jscodeshift 默认使用 recast 打印器，它会尽量保留原始格式。但如果你用 `j(file).toSource()` 不传选项，某些情况下会丢失缩进。应该显式传入 `{ quote: 'single', tabWidth: 2 }` 等选项。

**误区三：不做 dry run**

直接在代码库上运行 codemod 而不先用 `--dry --print` 预览，可能产生不可预期的修改。永远先预览、确认 diff、再执行。

**误区四：忽略 codemod 本身的测试**

很多人写完 codemod 就直接跑，不写测试。当 codemod 需要维护或在不同项目中复用时，没有测试就是灾难。

## 小结

- AST 转换是结构化的代码修改，比正则替换安全得多
- jscodeshift 适合 JavaScript/JSX 的通用转换，基于 Collection API 链式操作
- ts-morph 适合 TypeScript 的语义级修改，能访问类型信息
- 复杂转换应拆成多个小步骤，每步独立运行和测试
- codemod 必须测试，使用 fixture 文件做输入/输出对比

## 练习

### 练习一：编写变量重命名 codemod

编写一个 jscodeshift transform，将代码中所有名为 `data` 的变量重命名为 `userData`。要求只重命名局部变量，不影响全局变量和函数参数。

### 练习二：编写 console.log 清除器

编写一个 codemody，移除代码中所有的 `console.log` 语句。要求保留 `console.error` 和 `console.warn`。

---

## 参考答案

### 练习一

**思路**：使用 jscodeshift 查找所有 `VariableDeclarator` 节点中 `id.name === 'data'` 的情况，然后用 `scope` 检查是否为局部变量，并替换所有引用。

**答案**：

```javascript
// transforms/rename-data.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root
    .find(j.VariableDeclarator, {
      id: { type: 'Identifier', name: 'data' }
    })
    .forEach(path => {
      // 检查是否在函数作用域内（局部变量）
      const scope = path.scope;
      if (!scope || scope.isGlobal) return;

      // 获取所有引用该变量的节点
      const binding = scope.getBinding('data');
      if (!binding) return;

      // 重命名所有引用（反向替换避免冲突）
      binding.referencePaths.reverse().forEach(refPath => {
        if (refPath.node.type === 'Identifier') {
          refPath.node.name = 'userData';
        }
      });

      // 重命名声明
      path.node.id.name = 'userData';
    });

  return root.toSource({ quote: 'single' });
};
```

**要点**：
- `scope.getBinding()` 获取变量的所有引用，包括声明和使用处
- 从后往前替换（reverse）可以避免位置偏移问题
- `scope.isGlobal` 检查避免修改全局变量

### 练习二

**思路**：查找所有 `ExpressionStatement` 中调用 `console.log` 的节点，然后移除整个语句。需要注意 `console.log` 可能出现在表达式内部（如赋值右侧），这些情况不能直接移除。

**答案**：

```javascript
// transforms/remove-console-log.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let removedCount = 0;

  root
    .find(j.ExpressionStatement)
    .filter(path => {
      const expr = path.node.expression;
      return (
        expr.type === 'CallExpression' &&
        expr.callee.type === 'MemberExpression' &&
        expr.callee.object.name === 'console' &&
        expr.callee.property.name === 'log'
      );
    })
    .forEach(path => {
      j(path).remove();
      removedCount++;
    });

  if (removedCount === 0) return fileInfo.source;
  return root.toSource({ quote: 'single' });
};
```

**要点**：
- 只移除作为独立语句的 `console.log`，不处理 `const x = console.log(...)` 这种情况
- `filter` 用于在 `forEach` 前进一步筛选匹配条件
- 返回 `fileInfo.source` 表示没有变更，jscodeshift 会跳过这个文件

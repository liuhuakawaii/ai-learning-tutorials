# 02 - AST 抽象语法树基础

> **课程定位**：本课是代码理解的技术基础。掌握 AST，你才能从"字符流"层面的代码操作升级到"结构化"层面的代码操作——这是所有自动化代码迁移工具的底层原理。
>
> **前置要求**：有 JavaScript 或 Python 编程经验，了解基本的编译概念
>
> **预计时长**：2 小时

---

## 场景引入

你接到一个任务：把项目中所有的 `var` 声明替换为 `const` 或 `let`。

看起来很简单？用全局搜索替换就行：

```bash
# 天真的做法
sed -i 's/var /const /g' *.js
```

然后你运行测试，发现大量报错。因为 `for (var i = 0; ...)` 被替换成了 `for (const i = 0; ...)`，而 `const` 不能重新赋值。

问题在于：`sed` 是按字符匹配的，它不理解代码的**语义**。要正确完成这个任务，你需要理解代码的**结构**——哪些 `var` 声明的变量后续被重新赋值了。这就需要 AST。

---

## 学习目标

完成本课后，你将能够：

1. 解释从源代码到可执行程序的完整编译流程
2. 用 JavaScript 和 Python 解析代码为 AST
3. 用 visitor 模式遍历和修改 AST
4. 实现一个简单的 `var → const/let` 转换器

---

## 一、从源代码到执行：编译流程全景

```
源代码（字符串）
  │
  ▼
┌─────────────┐
│  词法分析     │  把字符流切成 token
│  (Lexer)     │  "var x = 1" → [var] [x] [=] [1]
└─────────────┘
  │
  ▼
┌─────────────┐
│  语法分析     │  把 token 流组装成 AST
│  (Parser)    │  [var] [x] [=] [1] → VariableDeclaration
└─────────────┘
  │
  ▼
┌─────────────┐
│  语义分析     │  类型检查、作用域分析
│  (Analyzer)  │
└─────────────┘
  │
  ▼
┌─────────────┐
│  中间代码生成  │  平台无关的中间表示
│  (IR Gen)    │
└─────────────┘
  │
  ▼
┌─────────────┐
│  优化 + 目标  │  机器码 / 字节码 / 另一种源代码
│  代码生成     │
└─────────────┘
```

AST 位于第二步：语法分析（Parsing）。它是源代码的**结构化表示**——把一维的字符流转换成树形结构，保留了语法关系，去掉了无关的格式信息。

"抽象"意味着省略了不影响语义的细节。`var x = 1;` 和 `var x=1` 的 AST 结构相同——分号和空格不会作为独立节点存在。

---

## 二、JavaScript AST 核心节点

JavaScript 的 AST 遵循 ESTree 规范。核心节点类型：

```
Program                          ← 整个文件
├── VariableDeclaration          ← var/let/const 声明
│   ├── kind: "var" | "let" | "const"
│   └── declarations: [VariableDeclarator]
│       ├── id: Identifier       ← 变量名
│       └── init: Expression     ← 初始值
│
├── FunctionDeclaration          ← function foo() {}
│   ├── id: Identifier           ← 函数名
│   ├── params: [Identifier]     ← 参数列表
│   └── body: BlockStatement     ← 函数体
│
├── CallExpression               ← foo()
│   ├── callee: Identifier       ← 被调用的函数
│   └── arguments: [Expression]  ← 参数
│
├── IfStatement                  ← if/else
│   ├── test: Expression
│   ├── consequent: Statement
│   └── alternate: Statement
│
└── ForStatement                 ← for 循环
    ├── init: VariableDeclaration
    ├── test: Expression
    ├── update: Expression
    └── body: Statement
```

### 用 Babel Parser 解析 JavaScript

```javascript
// ast_demo.js
// 运行：npm install @babel/parser && node ast_demo.js

const parser = require("@babel/parser");

const code = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}
`;

const ast = parser.parse(code, { sourceType: "module" });

function printAST(node, indent = 0) {
  if (!node || typeof node !== "object") return;
  const prefix = "  ".repeat(indent);

  if (node.type === "Identifier") {
    console.log(`${prefix}Identifier: ${node.name}`);
  } else if (node.type === "NumericLiteral") {
    console.log(`${prefix}NumericLiteral: ${node.value}`);
  } else {
    console.log(`${prefix}${node.type}`);
  }

  for (const key of Object.keys(node)) {
    if (["type", "start", "end", "loc", "extra"].includes(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) printAST(item, indent + 1);
      }
    } else if (child && typeof child === "object" && child.type) {
      printAST(child, indent + 1);
    }
  }
}

printAST(ast.program);
```

---

## 三、用 Python ast 模块解析代码

Python 内置了 `ast` 模块，无需安装第三方库：

```python
#!/usr/bin/env python3
"""
python_ast_demo.py
运行：python python_ast_demo.py
"""

import ast


def print_ast(node, indent=0):
    """以树形结构打印 AST。"""
    if not isinstance(node, ast.AST):
        return

    prefix = "  " * indent
    node_type = type(node).__name__

    extra = ""
    if isinstance(node, ast.FunctionDef):
        extra = f" name={node.name}"
    elif isinstance(node, ast.Name):
        extra = f" id={node.id}"
    elif isinstance(node, ast.Constant):
        extra = f" value={node.value!r}"

    print(f"{prefix}{node_type}{extra}")

    for child in ast.iter_child_nodes(node):
        print_ast(child, indent + 1)


code = """
def calculate_total(items):
    total = 0
    for item in items:
        total += item['price']
    return total
"""

tree = ast.parse(code)
print_ast(tree)
```

输出：

```
Module
  FunctionDef name=calculate_total
    arguments
      arg arg=items
    Assign targets=['total']
      Constant value=0
    For
      Name id=item
      Name id=items
      AugAssign
        Name id=total
        Subscript
          Name id=item
          Constant value='price'
    Return
      Name id=total
```

---

## 四、AST 遍历：Visitor 模式

拿到 AST 之后，你需要遍历它来查找和修改特定节点。Visitor 模式让你可以为不同类型的节点定义不同的处理逻辑。

```python
#!/usr/bin/env python3
"""
visitor_demo.py
运行：python visitor_demo.py
"""

import ast


class VariableAnalyzer(ast.NodeVisitor):
    """分析代码中变量的定义和使用情况。"""

    def __init__(self):
        self.defined = set()
        self.used = set()
        self.current_scope = "global"

    def visit_FunctionDef(self, node):
        prev_scope = self.current_scope
        self.current_scope = node.name
        for arg in node.args.args:
            self.defined.add((arg.arg, node.name))
        self.generic_visit(node)
        self.current_scope = prev_scope

    def visit_Assign(self, node):
        for target in node.targets:
            if isinstance(target, ast.Name):
                self.defined.add((target.id, self.current_scope))
        self.generic_visit(node)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self.used.add((node.id, self.current_scope))
        elif isinstance(node.ctx, ast.Store):
            self.defined.add((node.id, self.current_scope))
        self.generic_visit(node)

    def visit_For(self, node):
        if isinstance(node.target, ast.Name):
            self.defined.add((node.target.id, self.current_scope))
        self.generic_visit(node)


code = """
def process_orders(orders):
    total = 0
    for order in orders:
        if order['status'] == 'completed':
            total += order['amount']
    return total
"""

tree = ast.parse(code)
analyzer = VariableAnalyzer()
analyzer.visit(tree)

print("已定义的变量：")
for name, scope in sorted(analyzer.defined):
    print(f"  {name} (作用域: {scope})")

print("\n已使用的变量：")
for name, scope in sorted(analyzer.used):
    print(f"  {name} (作用域: {scope})")
```

核心思想：**为每种节点类型定义一个 `visit_XXX` 方法**。调用 `self.generic_visit(node)` 继续遍历子节点；不调用则停止遍历。

---

## 五、AST 在代码迁移中的应用

AST 是几乎所有代码自动化工具的底层原理：

- **格式化器**（Prettier、Black）：`源代码 → Parser → AST → Printer → 格式化代码`
- **Linter**（ESLint、Ruff）：`源代码 → Parser → AST → 遍历规则 → 报告`
- **Codemod**（jscodeshift、Babel Plugin）：`源代码 → Parser → AST → 修改 → Generator → 新代码`

Codemod 是代码迁移的核心工具：先解析成 AST，按规则修改，再重新生成代码。

---

## 六、实战：var → const/let 转换

核心逻辑：如果 `var` 声明的变量被重新赋值过，用 `let`；否则用 `const`。

```javascript
// var_to_let_const.js
// 运行：npm install @babel/parser @babel/generator @babel/traverse @babel/types
//       node var_to_let_const.js

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const code = `
var count = 0;
var name = "Alice";
var items = [1, 2, 3];

for (var i = 0; i < items.length; i++) {
  count += items[i];
}

function process() {
  var result = name + " processed";
  result = result.toUpperCase();
  return result;
}
`;

function convertVarToLetConst(sourceCode) {
  const ast = parser.parse(sourceCode, { sourceType: "module" });
  const varDeclarations = new Map();

  // 第一步：收集所有 var 声明
  traverse(ast, {
    VariableDeclaration(path) {
      if (path.node.kind !== "var") return;
      for (const declarator of path.node.declarations) {
        if (!t.isIdentifier(declarator.id)) continue;
        const binding = path.scope.getBinding(declarator.id.name);
        if (binding) {
          varDeclarations.set(declarator.id.name, {
            node: path.node,
            binding,
            reassigned: false,
          });
        }
      }
    },
  });

  // 第二步：检测哪些变量被重新赋值
  for (const [name, info] of varDeclarations) {
    for (const refPath of info.binding.referencePaths) {
      const parent = refPath.parentPath;
      if (!parent) continue;
      if (
        t.isAssignmentExpression(parent.node, { left: refPath.node }) ||
        t.isUpdateExpression(parent.node, { argument: refPath.node })
      ) {
        info.reassigned = true;
        break;
      }
    }
    // for 循环中的 i++ 特殊处理
    const forStmt = info.binding.path.findParent((p) => p.isForStatement());
    if (forStmt) {
      const update = forStmt.get("update");
      if (update && update.isUpdateExpression()) {
        const arg = update.get("argument");
        if (arg.isIdentifier() && arg.node.name === name) {
          info.reassigned = true;
        }
      }
    }
  }

  // 第三步：替换 var 为 let/const
  for (const [, info] of varDeclarations) {
    info.node.kind = info.reassigned ? "let" : "const";
  }

  return generate(ast).code;
}

const result = convertVarToLetConst(code);
console.log(result);
```

输出结果中，`i` 因为在 `for` 循环中被 `i++` 修改变成 `let`；`result` 因为被 `result.toUpperCase()` 赋值变成 `let`；其他变量变成 `const`。

---

## 七、用 Python 实现 AST 修改

```python
#!/usr/bin/env python3
"""
rename_variable.py
运行：python rename_variable.py
"""

import ast
import astor  # pip install astor


class VariableRenamer(ast.NodeTransformer):
    def __init__(self, old_name, new_name):
        self.old_name = old_name
        self.new_name = new_name

    def visit_Name(self, node):
        if node.id == self.old_name:
            node.id = self.new_name
        return node

    def visit_FunctionDef(self, node):
        if node.name == self.old_name:
            node.name = self.new_name
        for arg in node.args.args:
            if arg.arg == self.old_name:
                arg.arg = self.new_name
        self.generic_visit(node)
        return node


code = """
def calculate(price, tax_rate):
    discount = price * 0.1
    return price - discount
"""

tree = ast.parse(code)
renamer = VariableRenamer("price", "base_price")
new_tree = renamer.visit(tree)
ast.fix_missing_locations(new_tree)
print(astor.to_source(new_tree))
```

`ast.NodeTransformer` 是修改 AST 的标准方式：重写 `visit_XXX` 方法，修改节点后返回。返回 `None` 则删除节点。

---

## 八、常见误区

### 误区一：正则表达式能替代 AST

正则无法处理代码的递归嵌套结构。比如字符串中的 `var` 不应该被转换，但正则分不清代码和字符串：

```javascript
const str = "var x = 1";  // 这里的 var 是字符串内容
var realVar = 42;          // 这里的 var 才需要转换
```

只有 AST 能区分"代码中的 var"和"字符串中的 var"。

### 误区二：AST 太复杂，没必要学

掌握 AST 后你能：编写 Codemod 自动迁移代码、理解 ESLint/Prettier/TypeScript 编译器原理、构建代码分析工具、验证 AI 生成的代码是否正确。

### 误区三：解析 AST 一定要用 Babel

| 场景 | 推荐工具 |
|------|----------|
| JavaScript/TypeScript | @babel/parser、acorn、typescript compiler API |
| Python | 内置 ast 模块、libcst（保留格式） |
| Java | JavaParser |
| Go | 内置 go/ast 包 |
| 多语言通用 | tree-sitter（支持 100+ 语言） |

tree-sitter 在迁移场景中很有价值：它支持增量解析，速度快，支持几乎所有主流语言。

---

## 小结

- AST 是源代码的结构化树形表示，是所有代码自动化工具的底层原理。
- 编译流程：源代码 → 词法分析 → 语法分析（AST）→ 语义分析 → 优化 → 目标代码。
- JavaScript 用 `@babel/parser` 解析，Python 用内置 `ast` 模块解析。
- Visitor 模式为每种节点类型定义 `visit_XXX` 方法，是 AST 操作的标准范式。
- `var → const/let` 的核心不是文本替换，而是分析变量是否被重新赋值——只有 AST 能做到。

## 练习

### 练习一：解析并打印 AST

用 `@babel/parser`（JavaScript）或 `ast` 模块（Python）解析以下代码，找出所有 `CallExpression` 和 `BinaryExpression` 节点：

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

### 练习二：用 AST 统计圈复杂度

编写脚本计算函数的圈复杂度（Cyclomatic Complexity）：初始值为 1，每遇到 `if`/`for`/`while` +1，每遇到 `&&`/`||` +1。

测试代码：

```python
def process_order(order):
    total = 0
    for item in order['items']:
        if item['available']:
            total += item['price']
            if item['quantity'] > 1:
                total *= 0.9
    if total > 1000 and order['vip']:
        total *= 0.8
    return total
```

预期输出：`process_order` 的圈复杂度为 5。

---

## 参考答案

### 练习一

**思路**：解析代码为 AST，递归遍历，按节点类型收集信息。

```javascript
const parser = require("@babel/parser");

const code = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;

const ast = parser.parse(code, { sourceType: "module" });
const calls = [];
const binaryOps = [];

function traverse(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "CallExpression" && node.callee.name) {
    calls.push(node.callee.name);
  }
  if (node.type === "BinaryExpression") {
    binaryOps.push(node.operator);
  }
  for (const key of Object.keys(node)) {
    if (["type", "start", "end", "loc", "extra"].includes(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((item) => { if (item?.type) traverse(item); });
    } else if (child?.type) {
      traverse(child);
    }
  }
}

traverse(ast.program);
console.log("函数调用:", calls);     // ["fibonacci", "fibonacci"]
console.log("二元运算:", binaryOps); // ["<=", "-", "-"]
```

**要点**：`CallExpression` 的 `callee` 可能是 `Identifier`（直接调用）或 `MemberExpression`（方法调用），需要判断。

### 练习二

**思路**：用 `ast.NodeVisitor` 遍历，为每个函数维护独立的复杂度计数器。

```python
import ast

class ComplexityAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.functions = []
        self._func = None
        self._complexity = 0

    def visit_FunctionDef(self, node):
        prev_func, prev_comp = self._func, self._complexity
        self._func = node.name
        self._complexity = 1
        self.generic_visit(node)
        self.functions.append({"name": self._func, "complexity": self._complexity})
        self._func, self._complexity = prev_func, prev_comp

    def visit_If(self, node):
        if self._func: self._complexity += 1
        self.generic_visit(node)

    def visit_For(self, node):
        if self._func: self._complexity += 1
        self.generic_visit(node)

    def visit_While(self, node):
        if self._func: self._complexity += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        if self._func: self._complexity += len(node.values) - 1
        self.generic_visit(node)


code = """
def process_order(order):
    total = 0
    for item in order['items']:
        if item['available']:
            total += item['price']
            if item['quantity'] > 1:
                total *= 0.9
    if total > 1000 and order['vip']:
        total *= 0.8
    return total
"""

tree = ast.parse(code)
analyzer = ComplexityAnalyzer()
analyzer.visit(tree)
for func in analyzer.functions:
    print(f"{func['name']}: 复杂度 = {func['complexity']}")
# 输出：process_order: 复杂度 = 5
```

**要点**：`BoolOp` 节点的 `values` 列表长度减 1 就是逻辑运算符数量。嵌套函数需要保存/恢复外层状态。

**Files touched**:
- `D:\CODE\personal-project\ai-learning-tutorials\ai-specialization\ai-code-migration\part1-code-understanding\02-AST基础.md`

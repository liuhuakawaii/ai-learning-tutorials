# 代码生成与 AST

## 场景引入

你的项目有 20 个数据库表，每张表都要写 Entity 类、CreateDTO、UpdateDTO、Service、Controller 六个文件。这些文件结构几乎一样，只是字段不同。每次加一个字段要改六个文件，这种重复劳动不仅枯燥，还容易出错。有没有办法从表结构定义自动生成这些代码？

## 学习目标

- 理解 AST（抽象语法树）的基本概念
- 掌握 TypeScript Compiler API 读取和遍历 AST
- 学会使用 ts-morph 简化 AST 操作
- 能从 Schema 定义生成 TypeScript 类型
- 掌握代码脚手架的实现思路

## 一、AST 基础概念

AST（Abstract Syntax Tree）是源代码的树形结构表示。每一段代码都被解析为节点（Node），节点之间有父子关系。

```typescript
const greeting: string = "hello";
// AST 结构：
// VariableDeclaration
//   ├── name: Identifier("greeting")
//   ├── type: TypeReference("string")
//   └── init: StringLiteral("hello")
```

TypeScript 编译器在解析代码时生成 AST，然后在 AST 上做类型检查、转换和输出。

## 二、TypeScript Compiler API

```bash
pnpm add -D typescript
```

```typescript
// scripts/read-ast.ts
import ts from "typescript";

const sourceCode = `
interface User { id: string; name: string; }
function greet(user: User): string { return user.name; }
`;

const sourceFile = ts.createSourceFile("example.ts", sourceCode, ts.ScriptTarget.Latest, true);

function visit(node: ts.Node, depth = 0) {
  const indent = "  ".repeat(depth);
  if (ts.isInterfaceDeclaration(node)) {
    console.log(`${indent}接口: ${node.name.text}`);
    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        console.log(`${indent}  属性: ${member.name.getText(sourceFile)}`);
      }
    }
  }
  ts.forEachChild(node, (child) => visit(child, depth + 1));
}
visit(sourceFile);
```

使用 Compiler API 生成代码：

```typescript
import ts from "typescript";

const interfaceDecl = ts.factory.createInterfaceDeclaration(
  [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
  "Product", undefined, undefined,
  [
    ts.factory.createPropertySignature(undefined, "id", undefined,
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)),
    ts.factory.createPropertySignature(undefined, "price", undefined,
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)),
  ]
);

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
console.log(printer.printNode(ts.EmitHint.Unspecified, interfaceDecl,
  ts.createSourceFile("", "", ts.ScriptTarget.Latest)));
// 输出：export interface Product { id: string; price: number; }
```

## 三、ts-morph 简化 AST 操作

ts-morph 是对 Compiler API 的高层封装，API 更友好。

```bash
pnpm add -D ts-morph
```

```typescript
import { Project } from "ts-morph";

const project = new Project();
const sourceFile = project.createSourceFile("generated.ts", "", { overwrite: true });

sourceFile.addInterface({
  name: "User", isExported: true,
  properties: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "email", type: "string" },
  ],
});

sourceFile.addTypeAlias({
  name: "CreateUserInput", isExported: true,
  type: "Omit<User, 'id'>",
});

sourceFile.addFunction({
  name: "createUser", isExported: true,
  parameters: [{ name: "input", type: "CreateUserInput" }],
  returnType: "User",
  statements: `return { id: crypto.randomUUID(), ...input };`,
});

console.log(sourceFile.getFullText());
```

## 四、从 Schema 生成类型

实际项目中，类型通常从数据库 Schema 或 API 定义生成：

```typescript
import { Project } from "ts-morph";

interface TableDef {
  name: string;
  fields: Array<{ name: string; type: string; nullable?: boolean }>;
}

const tables: TableDef[] = [
  {
    name: "User",
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "email", type: "string" },
      { name: "age", type: "number", nullable: true },
    ],
  },
];

const project = new Project();
const sourceFile = project.createSourceFile("src/generated/entities.ts", "", { overwrite: true });

for (const table of tables) {
  sourceFile.addInterface({
    name: table.name, isExported: true,
    properties: table.fields.map((f) => ({
      name: f.name,
      type: f.nullable ? `${f.type} | null` : f.type,
    })),
  });

  const createFields = table.fields.filter((f) => f.name !== "id");
  sourceFile.addTypeAlias({
    name: `Create${table.name}Input`, isExported: true,
    type: `{ ${createFields.map((f) => `${f.name}${f.nullable ? "?" : ""}: ${f.type}`).join("; ")} }`,
  });
}

sourceFile.saveSync();
```

## 五、代码脚手架

脚手架根据模板快速生成项目文件：

```typescript
import { Project } from "ts-morph";
import * as fs from "fs/promises";
import * as path from "path";

async function scaffoldModule(name: string, fields: Array<{ name: string; type: string }>) {
  const lower = name.toLowerCase();
  const dir = path.join("src/modules", lower);
  await fs.mkdir(dir, { recursive: true });

  const project = new Project();

  // Entity
  const entity = project.createSourceFile(path.join(dir, `${lower}.entity.ts`), "", { overwrite: true });
  entity.addInterface({ name, isExported: true, properties: fields });

  // Service
  const service = project.createSourceFile(path.join(dir, `${lower}.service.ts`), "", { overwrite: true });
  service.addVariableStatement({
    isExported: true, declarationKind: "const" as any,
    declarations: [{
      name: `${lower}Service`,
      initializer: `{\n  findAll(): ${name}[] { return []; },\n  create(input: Omit<${name}, "id">): ${name} { return { id: crypto.randomUUID(), ...input }; }\n}`,
    }],
  });

  await project.save();
}

await scaffoldModule("Product", [
  { name: "id", type: "string" },
  { name: "name", type: "string" },
  { name: "price", type: "number" },
]);
```

## 常见误区

1. **过度使用代码生成**：只有 3-4 处重复时，手动维护可能更简单
2. **生成的代码不加注释**：应有头部注释说明来源，避免手动修改后被覆盖
3. **忽略生成代码的类型安全**：生成的代码也要能通过 tsc 类型检查
4. **AST 操作和字符串拼接混淆**：简单场景用字符串模板就够了

## 工程建议

1. **简单场景用字符串模板**：只替换变量时，模板字符串比 AST 操作更直观
2. **复杂场景用 ts-morph**：需要精确控制代码结构时，ts-morph 比原生 API 好用 10 倍
3. **生成文件加 .generated.ts 后缀**：让团队成员识别哪些是自动生成的
4. **把生成脚本加入 CI**：确保生成的代码始终与 Schema 同步

## 小结

本课讲解了 AST 的基本概念和 TypeScript 代码生成实践。Compiler API 是底层工具，ts-morph 是更友好的封装。最常见的场景是从数据库 Schema 生成 TypeScript 类型和样板代码，大幅减少重复劳动。

## 练习

### 练习一：AST 遍历

使用 TypeScript Compiler API 遍历以下代码，提取所有接口名和属性名：

```typescript
interface Article { title: string; content: string; tags: string[]; }
interface Comment { id: string; text: string; }
```

### 练习二：ts-morph 代码生成

使用 ts-morph 生成一个包含 `id: string`、`name: string`、`items: number[]` 属性的 `Order` 接口。

### 练习三：Schema 驱动生成

给定 Schema `{ name: "Config", fields: [{ name: "host", type: "string" }, { name: "port", type: "number" }, { name: "debug", type: "boolean" }] }`，编写脚本生成对应的 TypeScript 接口。

---

## 参考答案

### 练习一

**思路**：使用 `ts.createSourceFile` 创建 AST，遍历节点检查 `isInterfaceDeclaration`。

**答案**：

```typescript
import ts from "typescript";
const code = `interface Article { title: string; content: string; tags: string[]; } interface Comment { id: string; text: string; }`;
const sf = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
function visit(node: ts.Node) {
  if (ts.isInterfaceDeclaration(node)) {
    const props = node.members.filter(ts.isPropertySignature).map((m) => m.name.getText(sf));
    console.log(`${node.name.text}: ${props.join(", ")}`);
  }
  ts.forEachChild(node, visit);
}
visit(sf);
```

**要点**：`ts.isInterfaceDeclaration` 判断节点类型，`getText(sourceFile)` 获取原始文本。

### 练习二

**思路**：使用 ts-morph 的 `addInterface` 声明式创建。

**答案**：

```typescript
import { Project } from "ts-morph";
const project = new Project();
const sf = project.createSourceFile("order.ts", "", { overwrite: true });
sf.addInterface({ name: "Order", isExported: true, properties: [
  { name: "id", type: "string" }, { name: "name", type: "string" }, { name: "items", type: "number[]" },
]});
console.log(sf.getFullText());
```

**要点**：ts-morph 的 `addInterface` 是声明式 API，类型直接写字符串。

### 练习三

**思路**：读取 Schema，用 ts-morph 动态生成接口。

**答案**：

```typescript
import { Project } from "ts-morph";
const schema = { name: "Config", fields: [
  { name: "host", type: "string" }, { name: "port", type: "number" }, { name: "debug", type: "boolean" },
]};
const project = new Project();
const sf = project.createSourceFile(`src/generated/${schema.name.toLowerCase()}.ts`, "", { overwrite: true });
sf.addInterface({ name: schema.name, isExported: true, properties: schema.fields });
sf.saveSync();
```

**要点**：Schema 的 type 字段直接对应 TypeScript 类型名，`saveSync()` 立即写入磁盘。

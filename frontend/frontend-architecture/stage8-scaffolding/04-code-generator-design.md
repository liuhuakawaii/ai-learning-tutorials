# 04. 代码生成器设计

> 代码生成器不是"复制粘贴"，而是"理解意图后智能生成"

## 本课目标

- 理解 AST（抽象语法树）的基本概念
- 学会使用 AST 进行代码分析和修改
- 掌握 Plop.js 等代码生成工具的使用
- 设计和实现自定义代码生成器

## 从一个真实场景说起

你有没有这样的经历：

1. **创建组件时**：每次都手动创建文件、写 import、导出组件、添加类型定义
2. **创建页面时**：每次都复制页面模板、修改路由配置、添加菜单项
3. **创建模块时**：每次都创建目录结构、添加 CRUD 接口、编写数据库模型

这些重复工作完全可以自动化。代码生成器就是干这个的。

但简单的文件复制不够用。比如你想在现有文件中添加一个 import 语句，或者在路由配置中添加一个新路由，这时候就需要理解代码结构。

AST（抽象语法树）就是理解代码结构的钥匙。

## AST 基础

AST 是代码的树形表示，每个节点代表代码中的一个语法元素。

### 示例

```javascript
// 原始代码
const name = 'hello';
console.log(name);

// AST 表示
{
  type: 'Program',
  body: [
    {
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: 'name'
          },
          init: {
            type: 'Literal',
            value: 'hello'
          }
        }
      ],
      kind: 'const'
    },
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'console'
          },
          property: {
            type: 'Identifier',
            name: 'log'
          }
        },
        arguments: [
          {
            type: 'Identifier',
            name: 'name'
          }
        ]
      }
    }
  ]
}
```

### AST 工具

#### Babel

Babel 不只是转译工具，也是强大的 AST 操作库。

```bash
npm install @babel/core @babel/parser @babel/generator @babel/traverse
```

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

// 解析代码为 AST
const code = `const name = 'hello';`;
const ast = parser.parse(code);

// 遍历 AST
traverse(ast, {
  VariableDeclaration(path) {
    console.log('变量声明：', path.node.kind);
  },
  Identifier(path) {
    console.log('标识符：', path.node.name);
  }
});

// 生成代码
const output = generate(ast, {}, code);
console.log(output.code);
```

#### recast

recast 是另一个 AST 操作库，更注重保持代码格式。

```bash
npm install recast
```

```javascript
const recast = require('recast');
const fs = require('fs');

// 解析代码
const code = fs.readFileSync('file.js', 'utf-8');
const ast = recast.parse(code);

// 修改 AST
recast.visit(ast, {
  visitVariableDeclaration(path) {
    console.log('变量声明：', path.node.kind);
    return false;
  }
});

// 生成代码（保持格式）
const output = recast.print(ast);
console.log(output.code);
```

## 使用 Babel 操作 AST

### 添加 import 语句

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function addImport(code, importStatement) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // 解析新的 import 语句
  const importAst = parser.parse(importStatement, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // 找到第一个 import 语句的位置
  let lastImportIndex = -1;
  traverse(ast, {
    ImportDeclaration(path) {
      lastImportIndex = path.key;
    }
  });

  // 在最后一个 import 后插入新的 import
  const newImport = importAst.program.body[0];
  if (lastImportIndex >= 0) {
    ast.program.body.splice(lastImportIndex + 1, 0, newImport);
  } else {
    ast.program.body.unshift(newImport);
  }

  return generate(ast, {}, code).code;
}

// 使用示例
const code = `import React from 'react';

function App() {
  return <div>Hello</div>;
}`;

const newCode = addImport(code, `import { useState } from 'react';`);
console.log(newCode);
// 输出：
// import React from 'react';
// import { useState } from 'react';
//
// function App() {
//   return <div>Hello</div>;
// }
```

### 修改组件属性

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function addProps(code, componentName, props) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  traverse(ast, {
    JSXOpeningElement(path) {
      if (path.node.name.name === componentName) {
        props.forEach(prop => {
          path.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(prop.name),
              t.jsxExpressionContainer(t.stringLiteral(prop.value))
            )
          );
        });
      }
    }
  });

  return generate(ast, {}, code).code;
}

// 使用示例
const code = `<Button />`;

const newCode = addProps(code, 'Button', [
  { name: 'type', value: 'primary' },
  { name: 'size', value: 'large' }
]);
console.log(newCode);
// 输出：<Button type="primary" size="large" />
```

### 添加路由配置

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function addRoute(code, route) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id.name === 'routes') {
        const routesArray = path.node.init;
        if (t.isArrayExpression(routesArray)) {
          const newRoute = t.objectExpression([
            t.objectProperty(t.identifier('path'), t.stringLiteral(route.path)),
            t.objectProperty(t.identifier('component'), t.identifier(route.component)),
            t.objectProperty(t.identifier('exact'), t.booleanLiteral(true))
          ]);
          routesArray.elements.push(newRoute);
        }
      }
    }
  });

  return generate(ast, {}, code).code;
}

// 使用示例
const code = `const routes = [
  { path: '/', component: Home, exact: true },
  { path: '/about', component: About, exact: true }
];`;

const newCode = addRoute(code, {
  path: '/contact',
  component: 'Contact'
});
console.log(newCode);
// 输出：
// const routes = [
//   { path: '/', component: Home, exact: true },
//   { path: '/about', component: About, exact: true },
//   { path: '/contact', component: Contact, exact: true }
// ];
```

## Plop.js：快速代码生成

Plop.js 是一个轻量级的代码生成器，提供了简单的 API 和模板系统。

### 基础用法

```bash
npm install -g plop
```

```javascript
// plopfile.js
module.exports = function (plop) {
  plop.setGenerator('component', {
    description: '创建 React 组件',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: '组件名称：'
      },
      {
        type: 'list',
        name: 'type',
        message: '组件类型：',
        choices: ['function', 'class']
      }
    ],
    actions: [
      {
        type: 'add',
        path: 'src/components/{{name}}/{{name}}.tsx',
        templateFile: 'templates/component/Component.tsx.hbs'
      },
      {
        type: 'add',
        path: 'src/components/{{name}}/{{name}}.test.tsx',
        templateFile: 'templates/component/Component.test.tsx.hbs'
      },
      {
        type: 'add',
        path: 'src/components/{{name}}/index.ts',
        templateFile: 'templates/component/index.ts.hbs'
      }
    ]
  });
};
```

### 模板文件

```handlebars
// templates/component/Component.tsx.hbs
import React from 'react';

{{#if (eq type "function")}}
interface {{name}}Props {
  // 定义 props
}

export const {{name}}: React.FC<{{name}}Props> = (props) => {
  return (
    <div>
      {{name}}
    </div>
  );
};

export default {{name}};
{{else}}
interface {{name}}Props {
  // 定义 props
}

class {{name}} extends React.Component<{{name}}Props> {
  render() {
    return (
      <div>
        {{name}}
      </div>
    );
  }
}

export default {{name}};
{{/if}}
```

### 运行 Plop

```bash
# 交互式运行
plop

# 直接运行指定生成器
plop component
```

## 自定义代码生成器

让我们实现一个完整的代码生成器。

### 项目结构

```
code-generator/
├── package.json
├── generators/
│   ├── component.js
│   ├── page.js
│   └── hook.js
├── templates/
│   ├── component/
│   ├── page/
│   └── hook/
└── utils/
    ├── ast.js
    └── file.js
```

### 生成器配置

```javascript
// generators/component.js
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const templateDir = path.join(__dirname, '../templates/component');

const prompts = [
  {
    type: 'input',
    name: 'name',
    message: '组件名称：',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return '组件名称不能为空';
      }
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(input)) {
        return '组件名称必须以大写字母开头，只包含字母和数字';
      }
      return true;
    }
  },
  {
    type: 'list',
    name: 'type',
    message: '组件类型：',
    choices: [
      { name: '函数组件', value: 'function' },
      { name: '类组件', value: 'class' }
    ]
  },
  {
    type: 'confirm',
    name: 'withTest',
    message: '生成测试文件？',
    default: true
  }
];

async function generate(answers) {
  const { name, type, withTest } = answers;
  const targetDir = path.join(process.cwd(), 'src/components', name);

  // 创建目录
  fs.mkdirSync(targetDir, { recursive: true });

  // 生成组件文件
  const componentTemplate = fs.readFileSync(
    path.join(templateDir, 'Component.tsx.ejs'),
    'utf-8'
  );
  const componentContent = ejs.render(componentTemplate, { name, type });
  fs.writeFileSync(path.join(targetDir, `${name}.tsx`), componentContent);

  // 生成 index 文件
  const indexTemplate = fs.readFileSync(
    path.join(templateDir, 'index.ts.ejs'),
    'utf-8'
  );
  const indexContent = ejs.render(indexTemplate, { name });
  fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent);

  // 生成测试文件
  if (withTest) {
    const testTemplate = fs.readFileSync(
      path.join(templateDir, 'Component.test.tsx.ejs'),
      'utf-8'
    );
    const testContent = ejs.render(testTemplate, { name });
    fs.writeFileSync(path.join(targetDir, `${name}.test.tsx`), testContent);
  }

  console.log(`✓ 组件 ${name} 创建成功！`);
  console.log(`  目录：${targetDir}`);
  console.log(`  文件：`);
  console.log(`    - ${name}.tsx`);
  console.log(`    - index.ts`);
  if (withTest) {
    console.log(`    - ${name}.test.tsx`);
  }
}

module.exports = {
  prompts,
  generate
};
```

### 生成器运行器

```javascript
// generator-runner.js
const inquirer = require('inquirer');
const componentGenerator = require('./generators/component');
const pageGenerator = require('./generators/page');
const hookGenerator = require('./generators/hook');

const generators = {
  component: componentGenerator,
  page: pageGenerator,
  hook: hookGenerator
};

async function runGenerator(type) {
  const generator = generators[type];
  if (!generator) {
    console.error(`未知生成器：${type}`);
    console.error('可用生成器：component, page, hook');
    process.exit(1);
  }

  console.log(`\n生成器：${type}`);
  console.log('---');

  // 获取用户输入
  const answers = await inquirer.prompt(generator.prompts);

  // 执行生成
  await generator.generate(answers);
}

module.exports = runGenerator;
```

### 使用示例

```javascript
// index.js
const runGenerator = require('./generator-runner');

const type = process.argv[2] || 'component';
runGenerator(type).catch(console.error);
```

```bash
# 生成组件
node index.js component

# 生成页面
node index.js page

# 生成 Hook
node index.js hook
```

## 智能代码生成

### 分析现有代码

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function analyzeComponent(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const analysis = {
    imports: [],
    exports: [],
    props: [],
    state: [],
    hooks: []
  };

  traverse(ast, {
    ImportDeclaration(path) {
      analysis.imports.push({
        source: path.node.source.value,
        specifiers: path.node.specifiers.map(s => s.local.name)
      });
    },
    ExportDefaultDeclaration(path) {
      analysis.exports.push(path.node.declaration.name);
    },
    ArrowFunctionExpression(path) {
      if (path.node.params.length > 0) {
        analysis.props = path.node.params.map(p => p.name);
      }
    }
  });

  return analysis;
}
```

### 基于分析生成代码

```javascript
function generateComponentFromAnalysis(analysis) {
  const template = `
import React from 'react';
${analysis.imports.map(i => `import { ${i.specifiers.join(', ')} } from '${i.source}';`).join('\n')}

interface ${analysis.exports[0]}Props {
${analysis.props.map(p => `  ${p}: any;`).join('\n')}
}

const ${analysis.exports[0]}: React.FC<${analysis.exports[0]}Props> = ({ ${analysis.props.join(', ')} }) => {
  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
};

export default ${analysis.exports[0]};
`;

  return template;
}
```

## 代码生成最佳实践

### 1. 保持生成代码的可读性

```javascript
// 不推荐：生成压缩代码
const code = `function App(){return React.createElement("div",null,"Hello")}`;

// 推荐：生成格式化代码
const code = `
function App() {
  return (
    <div>
      Hello
    </div>
  );
}
`;
```

### 2. 支持自定义模板

```javascript
// 允许用户覆盖默认模板
const templatePath = path.join(process.cwd(), '.templates', 'Component.tsx.ejs');
if (fs.existsSync(templatePath)) {
  // 使用用户自定义模板
} else {
  // 使用默认模板
}
```

### 3. 生成后执行钩子

```javascript
async function generate(answers) {
  // 生成文件
  await generateFiles(answers);

  // 执行后置钩子
  if (answers.withTest) {
    console.log('运行测试...');
    await execSync('npm test', { stdio: 'inherit' });
  }

  if (answers.withLint) {
    console.log('运行 lint...');
    await execSync('npm run lint', { stdio: 'inherit' });
  }
}
```

### 4. 提供撤销功能

```javascript
const generatedFiles = [];

async function generate(answers) {
  // 生成文件
  const files = await generateFiles(answers);
  generatedFiles.push(...files);

  console.log('生成完成！');
  console.log('如需撤销，运行：node undo.js');
}

// undo.js
async function undo() {
  generatedFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`已删除：${file}`);
    }
  });
}
```

## 本课小结

本课我们学习了代码生成器设计：

1. **AST 基础**：理解代码的树形表示
2. **Babel 操作 AST**：添加 import、修改属性、添加路由
3. **Plop.js**：快速构建代码生成器
4. **自定义生成器**：完整的设计和实现
5. **智能生成**：基于分析生成代码

## 练习

### 练习一：创建页面生成器

创建一个页面生成器，支持：
- 生成页面组件
- 添加路由配置
- 添加菜单项

### 练习二：创建 Hook 生成器

创建一个自定义 Hook 生成器，支持：
- 生成 Hook 文件
- 添加类型定义
- 生成测试文件

## 参考答案

### 练习一

```javascript
// generators/page.js
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const prompts = [
  {
    type: 'input',
    name: 'name',
    message: '页面名称：',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return '页面名称不能为空';
      }
      return true;
    }
  },
  {
    type: 'input',
    name: 'path',
    message: '路由路径：',
    default: (answers) => `/${answers.name.toLowerCase()}`
  }
];

async function generate(answers) {
  const { name, path: routePath } = answers;

  // 生成页面组件
  const pageTemplate = `
import React from 'react';

const ${name}Page: React.FC = () => {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
};

export default ${name}Page;
`;

  const targetDir = path.join(process.cwd(), 'src/pages', name);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, `${name}Page.tsx`), pageTemplate);

  // 添加路由配置
  const routesPath = path.join(process.cwd(), 'src/routes.ts');
  if (fs.existsSync(routesPath)) {
    const routesCode = fs.readFileSync(routesPath, 'utf-8');
    const ast = parser.parse(routesCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.name === 'routes') {
          const routesArray = path.node.init;
          if (t.isArrayExpression(routesArray)) {
            const newRoute = t.objectExpression([
              t.objectProperty(t.identifier('path'), t.stringLiteral(routePath)),
              t.objectProperty(t.identifier('component'), t.identifier(`${name}Page`)),
              t.objectProperty(t.identifier('exact'), t.booleanLiteral(true))
            ]);
            routesArray.elements.push(newRoute);
          }
        }
      }
    });

    const output = generate(ast, {}, routesCode).code;
    fs.writeFileSync(routesPath, output);
  }

  console.log(`✓ 页面 ${name} 创建成功！`);
}

module.exports = { prompts, generate };
```

### 练习二

```javascript
// generators/hook.js
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const templateDir = path.join(__dirname, '../templates/hook');

const prompts = [
  {
    type: 'input',
    name: 'name',
    message: 'Hook 名称：',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Hook 名称不能为空';
      }
      if (!/^use[A-Z][a-zA-Z0-9]*$/.test(input)) {
        return 'Hook 名称必须以 use 开头，后跟大写字母';
      }
      return true;
    }
  },
  {
    type: 'confirm',
    name: 'withTest',
    message: '生成测试文件？',
    default: true
  }
];

async function generate(answers) {
  const { name, withTest } = answers;
  const targetDir = path.join(process.cwd(), 'src/hooks');

  // 创建目录
  fs.mkdirSync(targetDir, { recursive: true });

  // 生成 Hook 文件
  const hookTemplate = fs.readFileSync(
    path.join(templateDir, 'Hook.ts.ejs'),
    'utf-8'
  );
  const hookContent = ejs.render(hookTemplate, { name });
  fs.writeFileSync(path.join(targetDir, `${name}.ts`), hookContent);

  // 生成测试文件
  if (withTest) {
    const testTemplate = fs.readFileSync(
      path.join(templateDir, 'Hook.test.ts.ejs'),
      'utf-8'
    );
    const testContent = ejs.render(testTemplate, { name });
    fs.writeFileSync(path.join(targetDir, `${name}.test.ts`), testContent);
  }

  console.log(`✓ Hook ${name} 创建成功！`);
}

module.exports = { prompts, generate };
```

## 下一步

完成本课后，继续学习 [05. 配置管理与预设系统](./05-config-management-preset-system.md)。
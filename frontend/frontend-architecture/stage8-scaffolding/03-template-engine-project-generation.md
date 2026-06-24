# 03. 模板引擎与项目生成

> 模板引擎让"静态文件复制"变成"动态代码生成"，是脚手架的核心能力

## 本课目标

- 掌握 EJS 模板引擎的使用
- 学会 Handlebars 模板引擎的高级特性
- 理解模板变量、条件渲染、循环渲染
- 实现完整的项目生成流程

## 从一个真实场景说起

假设你要创建一个脚手架，支持生成 React 项目。最简单的方式是：

```javascript
// 直接复制文件
fs.copyFileSync('template/index.tsx', 'src/index.tsx');
```

但这有个问题：生成的文件都是固定的，无法根据用户输入动态调整。

比如用户选择了 TypeScript，生成的文件应该是 `.tsx` 而不是 `.jsx`。用户输入了项目名称，生成的文件应该包含正确的项目名称。

这时候就需要模板引擎。

## EJS：简单直观的模板引擎

EJS（Embedded JavaScript）是最简单的模板引擎，语法就是 JavaScript。

### 基础用法

```bash
npm install ejs
```

```javascript
const ejs = require('ejs');
const fs = require('fs');

// 模板内容
const template = `
# <%= projectName %>

这是一个由脚手架生成的项目。

## 技术栈

- 框架：<%= framework %>
- TypeScript：<%= useTypeScript ? '是' : '否' %>
- ESLint：<%= useEslint ? '是' : '否' %>
`;

// 渲染模板
const result = ejs.render(template, {
  projectName: 'my-app',
  framework: 'React',
  useTypeScript: true,
  useEslint: true
});

// 写入文件
fs.writeFileSync('README.md', result);
```

### 模板语法

#### 变量输出

```ejs
<%= variable %>
<%- variable %>
```

- `<%= variable %>`：转义 HTML 实体
- `<%- variable %>`：不转义，直接输出

```ejs
<h1><%= title %></h1>        <!-- 输出：<h1>Hello &amp; World</h1> -->
<h1><%- title %></h1>        <!-- 输出：<h1>Hello & World</h1> -->
```

#### 条件渲染

```ejs
<% if (condition) { %>
  <p>条件为真</p>
<% } else { %>
  <p>条件为假</p>
<% } %>

<% if (useTypeScript) { %>
  <script src="typescript.js"></script>
<% } %>
```

#### 循环渲染

```ejs
<% for (let i = 0; i < items.length; i++) { %>
  <li><%= items[i] %></li>
<% } %>

<% items.forEach(item => { %>
  <li><%= item %></li>
<% }) %>
```

#### 模板包含

```ejs
<%- include('header') %>
<main>
  <p>主要内容</p>
</main>
<%- include('footer') %>
```

#### 注释

```ejs
<%# 这是注释，不会输出 %>
```

### 高级用法

#### 过滤器

```javascript
const ejs = require('ejs');

// 自定义过滤器
ejs.filters.upper = (str) => str.toUpperCase();
ejs.filters.lower = (str) => str.toLowerCase();
ejs.filters.capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// 在模板中使用
const template = `
<%= name|upper %>
<%= name|lower %>
<%= name|capitalize %>
`;
```

#### 异步渲染

```javascript
const ejs = require('ejs');

const template = `
<% const data = await fetchData(); %>
<p><%= data %></p>
`;

const result = await ejs.renderAsync(template, {}, {
  async: true
});
```

#### 自定义分隔符

```javascript
const ejs = require('ejs');

// 使用不同的分隔符
const template = `
<#= variable #>
<# if (condition) { #>
  <p>条件为真</p>
<# } #>
`;

const result = ejs.render(template, {
  variable: 'value',
  condition: true
}, {
  delimiter: '#'
});
```

## Handlebars：功能强大的模板引擎

Handlebars 是一个功能更强大的模板引擎，支持自定义助手函数。

### 基础用法

```bash
npm install handlebars
```

```javascript
const Handlebars = require('handlebars');

const template = `
# {{projectName}}

这是一个由脚手架生成的项目。

## 技术栈

- 框架：{{framework}}
- TypeScript：{{#if useTypeScript}}是{{else}}否{{/if}}
- ESLint：{{#if useEslint}}是{{else}}否{{/if}}
`;

const result = Handlebars.compile(template)({
  projectName: 'my-app',
  framework: 'React',
  useTypeScript: true,
  useEslint: true
});
```

### 模板语法

#### 变量输出

```handlebars
{{variable}}
{{{variable}}}
```

- `{{variable}}`：转义 HTML 实体
- `{{{variable}}}`：不转义，直接输出

#### 条件渲染

```handlebars
{{#if condition}}
  <p>条件为真</p>
{{else}}
  <p>条件为假</p>
{{/if}}
```

#### 循环渲染

```handlebars
{{#each items}}
  <li>{{this}}</li>
{{/each}}

{{#each items as |item index|}}
  <li>{{index}}: {{item}}</li>
{{/each}}
```

#### 模板包含

```handlebars
{{> header}}
<main>
  <p>主要内容</p>
</main>
{{> footer}}
```

#### 自定义助手函数

```javascript
const Handlebars = require('handlebars');

// 注册自定义助手
Handlebars.registerHelper('uppercase', function(str) {
  return str.toUpperCase();
});

Handlebars.registerHelper('lowercase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('capitalize', function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

// 在模板中使用
const template = `
{{uppercase name}}
{{lowercase name}}
{{capitalize name}}
{{#ifEquals framework "React"}}
  <p>React 项目</p>
{{/ifEquals}}
`;
```

### 从文件加载模板

```javascript
const Handlebars = require('handlebars');
const fs = require('fs');

// 从文件加载模板
const templateFile = fs.readFileSync('template.hbs', 'utf-8');
const template = Handlebars.compile(templateFile);

const result = template({
  projectName: 'my-app',
  framework: 'React'
});
```

## 项目生成实战

让我们实现一个完整的项目生成器。

### 项目结构

```
project-generator/
├── package.json
├── generator.js
├── templates/
│   ├── react/
│   │   ├── package.json.ejs
│   │   ├── tsconfig.json.ejs
│   │   ├── src/
│   │   │   ├── index.tsx.ejs
│   │   │   ├── App.tsx.ejs
│   │   │   └── components/
│   │   │       └── Header.tsx.ejs
│   │   └── public/
│   │       └── index.html.ejs
│   └── vue/
│       └── ...
└── utils/
    ├── file.js
    └── template.js
```

### 生成器核心

```javascript
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

class ProjectGenerator {
  constructor(options) {
    this.projectName = options.projectName;
    this.template = options.template;
    this.features = options.features || [];
    this.targetDir = path.join(process.cwd(), this.projectName);
  }

  async generate() {
    // 1. 创建目标目录
    this.createDir(this.targetDir);

    // 2. 获取模板目录
    const templateDir = path.join(__dirname, 'templates', this.template);

    // 3. 递归处理模板文件
    await this.processDir(templateDir, this.targetDir);

    console.log(`项目 ${this.projectName} 生成完成！`);
  }

  async processDir(sourceDir, targetDir) {
    const items = fs.readdirSync(sourceDir);

    for (const item of items) {
      const sourcePath = path.join(sourceDir, item);
      const targetPath = path.join(targetDir, item);

      if (fs.statSync(sourcePath).isDirectory()) {
        // 递归处理子目录
        this.createDir(targetPath);
        await this.processDir(sourcePath, targetPath);
      } else if (item.endsWith('.ejs')) {
        // 处理模板文件
        await this.processFile(sourcePath, targetPath.replace('.ejs', ''));
      } else {
        // 直接复制普通文件
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  async processFile(sourcePath, targetPath) {
    // 读取模板内容
    const templateContent = fs.readFileSync(sourcePath, 'utf-8');

    // 准备模板变量
    const variables = {
      projectName: this.projectName,
      useTypeScript: this.features.includes('typescript'),
      useEslint: this.features.includes('eslint'),
      usePrettier: this.features.includes('prettier'),
      useStorybook: this.features.includes('storybook'),
      framework: this.template
    };

    // 渲染模板
    const result = ejs.render(templateContent, variables);

    // 写入文件
    fs.writeFileSync(targetPath, result);
    console.log(`✓ ${targetPath}`);
  }

  createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

module.exports = ProjectGenerator;
```

### 使用示例

```javascript
const ProjectGenerator = require('./generator');

const generator = new ProjectGenerator({
  projectName: 'my-app',
  template: 'react',
  features: ['typescript', 'eslint', 'prettier']
});

generator.generate().catch(console.error);
```

## 模板文件示例

### package.json 模板

```json
{
  "name": "<%= projectName %>",
  "version": "1.0.0",
  "private": true,
  <% if (useTypeScript) { %>
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  <% } else { %>
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  <% } %>
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^3.1.0",
    "vite": "^4.1.0"<% if (useTypeScript) { %>,
    "typescript": "^4.9.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"<% } %><% if (useEslint) { %>,
    "eslint": "^8.30.0"<% } %><% if (usePrettier) { %>,
    "prettier": "^2.8.0"<% } %>
  }
}
```

### tsconfig.json 模板

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### index.tsx 模板

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### App.tsx 模板

```tsx
import { useState } from 'react'
<% if (useTypeScript) { %>
import Header from './components/Header'
<% } %>

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <% if (useTypeScript) { %>
      <Header title="<%= projectName %>" />
      <% } else { %>
      <header>
        <h1><%= projectName %></h1>
      </header>
      <% } %>
      <main>
        <button onClick={() => setCount(count + 1)}>
          Count: {count}
        </button>
      </main>
    </div>
  )
}

export default App
```

## 模板引擎选择指南

### EJS vs Handlebars

| 特性 | EJS | Handlebars |
|------|-----|------------|
| 语法 | JavaScript 原生 | 自定义语法 |
| 学习曲线 | 低 | 中 |
| 功能 | 基础 | 丰富 |
| 性能 | 较好 | 一般 |
| 社区 | 较小 | 较大 |
| 适用场景 | 简单项目 | 复杂项目 |

### 选择建议

- **简单项目**：使用 EJS，语法简单，够用
- **复杂项目**：使用 Handlebars，功能强大，可扩展
- **团队熟悉 JavaScript**：使用 EJS
- **团队需要自定义助手**：使用 Handlebars

## 模板设计最佳实践

### 1. 保持模板简洁

```ejs
<!-- 不推荐：复杂的逻辑 -->
<% if (useTypeScript) { %>
  <% if (useEslint) { %>
    <% if (usePrettier) { %>
      <!-- 更多嵌套... -->
    <% } %>
  <% } %>
<% } %>

<!-- 推荐：使用辅助函数或变量 -->
<% const fullStack = useTypeScript && useEslint && usePrettier; %>
<% if (fullStack) { %>
  <!-- 完整配置 -->
<% } %>
```

### 2. 提供合理的默认值

```javascript
const variables = {
  projectName: 'my-app',
  useTypeScript: true,  // 默认启用
  useEslint: true,      // 默认启用
  usePrettier: true,    // 默认启用
  ...userOptions  // 用户选项覆盖默认值
};
```

### 3. 处理边界情况

```javascript
// 验证项目名称
if (!projectName || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(projectName)) {
  throw new Error('无效的项目名称');
}

// 验证模板是否存在
if (!fs.existsSync(templateDir)) {
  throw new Error(`模板 ${templateName} 不存在`);
}
```

### 4. 提供清晰的错误信息

```javascript
try {
  await generator.generate();
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('目录已存在，请选择其他名称');
  } else if (error.code === 'ENOENT') {
    console.error('模板文件不存在');
  } else {
    console.error('生成失败：', error.message);
  }
  process.exit(1);
}
```

## 本课小结

本课我们学习了模板引擎和项目生成：

1. **EJS**：简单直观，适合简单项目
2. **Handlebars**：功能强大，适合复杂项目
3. **项目生成**：递归处理模板，支持条件和循环
4. **模板设计**：保持简洁，提供默认值，处理边界情况

## 练习

### 练习一：创建 Vue 模板

为脚手架添加 Vue 模板支持：
- 创建 Vue 模板目录
- 添加 package.json、tsconfig.json 等模板文件
- 添加 Vue 组件模板

### 练习二：添加自定义助手

为 Handlebars 添加以下自定义助手：
- `uppercase`：转大写
- `lowercase`：转小写
- `capitalize`：首字母大写
- `join`：连接数组

## 参考答案

### 练习一

```javascript
// templates/vue/package.json.ejs
{
  "name": "<%= projectName %>",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.0.0",
    "vite": "^4.1.0"<% if (useTypeScript) { %>,
    "typescript": "^4.9.0",
    "vue-tsc": "^1.0.0"<% } %>
  }
}

// templates/vue/src/App.vue.ejs
<template>
  <div class="app">
    <% if (useTypeScript) { %>
    <Header title="<%= projectName %>" />
    <% } else { %>
    <header>
      <h1><%= projectName %></h1>
    </header>
    <% } %>
    <main>
      <button @click="count++">
        Count: {{ count }}
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
<% if (useTypeScript) { %>
import { ref } from 'vue'
import Header from './components/Header.vue'

const count = ref<number>(0)
<% } else { %>
import { ref } from 'vue'
import Header from './components/Header.vue'

const count = ref(0)
<% } %>
</script>
```

### 练习二

```javascript
const Handlebars = require('handlebars');

Handlebars.registerHelper('uppercase', function(str) {
  return str.toUpperCase();
});

Handlebars.registerHelper('lowercase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('capitalize', function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('join', function(arr, separator) {
  return arr.join(separator || ', ');
});

// 在模板中使用
const template = `
{{uppercase name}}
{{lowercase name}}
{{capitalize name}}
{{join features ", "}}
`;
```

## 下一步

完成本课后，继续学习 [04. 代码生成器设计](./04-code-generator-design.md)。
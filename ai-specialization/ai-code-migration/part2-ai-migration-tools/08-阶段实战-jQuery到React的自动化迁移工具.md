# 阶段实战——jQuery 到 React 的自动化迁移工具

## 场景引入

你所在的公司有一个运营了 8 年的管理后台，前端全部用 jQuery 写的，有 200 多个页面、15000 行 jQuery 代码。团队决定迁移到 React，但手动重写需要 3 个人干 6 个月。你提出了一个方案：**写一个自动化迁移工具**，把 jQuery 代码转换成 React 组件。

本课整合 Part 2 学到的所有知识：AST 转换、LLM 翻译、批量重构、兼容层，构建一个完整的迁移工具。

## 学习目标

完成本课学习后，你将能够：

1. 理解 jQuery 到 React 迁移的核心挑战
2. 用 AST 解析 jQuery 代码，提取关键模式
3. 设计 jQuery→React 的转换规则引擎
4. 用 LLM 辅助复杂逻辑的转换
5. 构建 React 组件生成器和迁移验证器

---

## 核心概念

### jQuery 代码的典型模式

```
jQuery 代码模式分类
├── DOM 操作
│   ├── $('sel').html('...')        → dangerouslySetInnerHTML
│   ├── $('sel').text('...')        → {textContent}
│   ├── $('sel').addClass('...')    → className
│   └── $('sel').css({...})         → style={{...}}
│
├── 事件绑定
│   ├── $('sel').on('click', fn)    → onClick={fn}
│   ├── $('sel').submit(fn)         → onSubmit={fn}
│   └── $('sel').change(fn)         → onChange={fn}
│
├── AJAX 调用
│   ├── $.ajax({url, method})       → fetch / axios
│   ├── $.get(url)                  → fetch(url)
│   └── $.post(url, data)          → fetch(url, {method:'POST'})
│
└── 插件
    ├── $('sel').datepicker()       → react-datepicker
    └── $('sel').select2()          → react-select
```

### 迁移工具架构

```
┌─────────────────────────────────────────────────────────────┐
│                    jQuery → React 迁移工具                    │
├──────────────┬──────────────┬───────────────┬───────────────┤
│   解析层      │   分析层      │   转换层       │   输出层      │
│              │              │               │              │
│ HTML 解析    │ 模式识别     │ AST 转换      │ 组件生成      │
│ JS 解析      │ 依赖分析     │ LLM 辅助      │ 项目结构      │
│ CSS 解析     │ 插件检测     │ 规则引擎      │ 测试生成      │
└──────────────┴──────────────┴───────────────┴───────────────┘
```

---

## 实战：构建迁移工具

### 项目初始化

```bash
mkdir jquery-to-react && cd jquery-to-react
npm init -y
npm install @babel/parser @babel/traverse @babel/generator @babel/types cheerio openai glob
```

### 模块一：jQuery 代码模式识别器

```javascript
// src/analyzer/pattern-matcher.js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const JQUERY_PATTERNS = {
  domOperations: [
    { pattern: /\.html\(/, react: 'dangerouslySetInnerHTML', risk: 'high' },
    { pattern: /\.text\(/, react: 'textContent', risk: 'low' },
    { pattern: /\.val\(/, react: 'value / onChange', risk: 'medium' },
    { pattern: /\.addClass\(/, react: 'className', risk: 'low' },
    { pattern: /\.css\(/, react: 'style prop', risk: 'low' },
    { pattern: /\.show\(/, react: 'conditional rendering', risk: 'medium' },
    { pattern: /\.hide\(/, react: 'conditional rendering', risk: 'medium' },
    { pattern: /\.append\(/, react: 'JSX children', risk: 'medium' },
  ],
  eventBindings: [
    { pattern: /\.on\(/, react: 'onClick / addEventListener', risk: 'medium' },
    { pattern: /\.click\(/, react: 'onClick', risk: 'low' },
    { pattern: /\.submit\(/, react: 'onSubmit', risk: 'medium' },
    { pattern: /\.change\(/, react: 'onChange', risk: 'low' },
  ],
  ajaxCalls: [
    { pattern: /\$\.ajax\(/, react: 'fetch / axios', risk: 'high' },
    { pattern: /\$\.get\(/, react: 'fetch(url)', risk: 'medium' },
    { pattern: /\$\.post\(/, react: 'fetch(url, {method})', risk: 'medium' },
  ],
  animations: [
    { pattern: /\.fadeIn\(/, react: 'CSS transition', risk: 'high' },
    { pattern: /\.fadeOut\(/, react: 'CSS transition', risk: 'high' },
    { pattern: /\.animate\(/, react: 'framer-motion / GSAP', risk: 'high' },
  ],
};

function analyzeJQueryCode(code) {
  const findings = {
    domOperations: [], eventBindings: [], ajaxCalls: [],
    animations: [], plugins: [], selectors: [],
  };

  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch {
    return analyzeWithRegex(code);
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;

      // 识别 $.ajax, $.get, $.post
      if (callee.type === 'MemberExpression' && callee.object?.name === '$') {
        const method = callee.property?.name;
        if (['ajax', 'get', 'post', 'getJSON'].includes(method)) {
          findings.ajaxCalls.push({
            type: method, line: path.node.loc?.start.line,
            args: extractArguments(path.node),
          });
        }
      }

      // 识别 $('selector').method() 链式调用
      if (callee.type === 'MemberExpression' &&
          callee.object?.type === 'CallExpression' &&
          callee.object?.callee?.name === '$') {
        const selector = callee.object.arguments[0]?.value;
        const method = callee.property?.name;

        findings.selectors.push({ selector, line: path.node.loc?.start.line });

        // 匹配各类模式
        for (const [category, patterns] of Object.entries(JQUERY_PATTERNS)) {
          const match = patterns.find(p => p.pattern.test(`.${method}(`));
          if (match) {
            findings[category === 'domOperations' ? 'domOperations' :
                     category === 'eventBindings' ? 'eventBindings' :
                     category === 'ajaxCalls' ? 'ajaxCalls' : 'animations'].push({
              method, selector, risk: match.risk,
              reactEquivalent: match.react, line: path.node.loc?.start.line,
            });
          }
        }
      }
    },
  });

  return findings;
}

function analyzeWithRegex(code) {
  const findings = { domOperations: [], eventBindings: [], ajaxCalls: [], animations: [], selectors: [] };
  const selectorRegex = /\$\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = selectorRegex.exec(code)) !== null) {
    findings.selectors.push({ selector: match[1] });
  }
  return findings;
}

function extractArguments(node) {
  return node.arguments.map(arg => {
    if (arg.type === 'StringLiteral') return arg.value;
    if (arg.type === 'NumericLiteral') return arg.value;
    return '[Complex]';
  });
}

module.exports = { analyzeJQueryCode, JQUERY_PATTERNS };
```

### 模块二：转换规则引擎

```javascript
// src/transformer/rule-engine.js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const TRANSFORMATION_RULES = [
  // $(selector).html(content) → dangerouslySetInnerHTML
  {
    name: 'html-to-dangerouslySetInnerHTML',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: 'html' }) &&
        path.node.arguments.length === 1;
    },
    transformer: (path) => {
      const contentArg = path.node.arguments[0];
      path.replaceWith(
        t.jsxAttribute(
          t.jsxIdentifier('dangerouslySetInnerHTML'),
          t.jsxExpressionContainer(
            t.objectExpression([t.objectProperty(t.identifier('__html'), contentArg)])
          )
        )
      );
    },
  },

  // $(selector).on('click', handler) → onClick={handler}
  {
    name: 'on-to-onClick',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: 'on' }) &&
        path.node.arguments.length === 2 &&
        t.isStringLiteral(path.node.arguments[0]);
    },
    transformer: (path) => {
      const eventName = path.node.arguments[0].value;
      const handler = path.node.arguments[1];
      const reactEvent = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
      path.replaceWith(
        t.jsxAttribute(t.jsxIdentifier(reactEvent), t.jsxExpressionContainer(handler))
      );
    },
  },

  // $.ajax({url, method, data}) → fetch
  {
    name: 'ajax-to-fetch',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.object, { name: '$' }) &&
        t.isIdentifier(path.node.callee.property, { name: 'ajax' });
    },
    transformer: (path) => {
      const config = path.node.arguments[0];
      if (!t.isObjectExpression(config)) return;

      const props = {};
      for (const prop of config.properties) {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          props[prop.key.name] = prop.value;
        }
      }

      const fetchCall = t.awaitExpression(
        t.callExpression(t.identifier('fetch'), [
          props.url || t.stringLiteral(''),
          t.objectExpression([
            t.objectProperty(t.identifier('method'), props.method || t.stringLiteral('GET')),
          ]),
        ])
      );

      path.replaceWith(
        t.variableDeclaration('const', [t.variableDeclarator(t.identifier('response'), fetchCall)])
      );
    },
  },
];

function transformCode(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });

  traverse(ast, {
    CallExpression(path) {
      for (const rule of TRANSFORMATION_RULES) {
        if (rule.matcher(path)) {
          try { rule.transformer(path); } catch (e) { console.warn(`规则 ${rule.name} 失败:`, e.message); }
          break;
        }
      }
    },
  });

  return generate(ast, { retainLines: false }).code;
}

module.exports = { transformCode, TRANSFORMATION_RULES };
```

### 模块三：LLM 辅助复杂逻辑转换

```javascript
// src/llm/translator.js
const OpenAI = require('openai');

class LLMTranslator {
  constructor({ apiKey, model = 'gpt-4o', baseUrl }) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async translateSnippet(jqueryCode, context = {}) {
    const prompt = `你是一个前端迁移专家。请将以下 jQuery 代码转换为 React 函数组件代码。

规则：
1. 使用 React Hooks（useState, useEffect, useRef）
2. 用 JSX 替代 DOM 操作
3. 用 fetch 替代 $.ajax
4. 用 className 替代 .addClass/.removeClass
5. 用 state 替代直接 DOM 修改
6. 保持业务逻辑不变

${context.componentName ? `组件名称: ${context.componentName}` : ''}

jQuery 代码:
\`\`\`javascript
${jqueryCode}
\`\`\`

请只输出 React 代码，不要解释。`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content;
    const codeMatch = content.match(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : content.trim();
  }

  needsLLMAssist(findings) {
    if (findings.animations.length > 0) return true;
    if (findings.plugins.length > 0) return true;
    if (findings.ajaxCalls.length > 2) return true;
    if (findings.domOperations.length > 10) return true;
    return false;
  }
}

module.exports = { LLMTranslator };
```

### 模块四：React 组件生成器

```javascript
// src/generator/component-gen.js
function generateReactComponent({ componentName, imports, state, effects, handlers, jsx }) {
  const lines = [];

  lines.push("import React, { useState, useEffect, useRef } from 'react';");
  for (const imp of imports) lines.push(imp);
  lines.push('');
  lines.push(`export default function ${componentName}() {`);

  for (const s of state) {
    lines.push(`  const [${s.name}, set${capitalize(s.name)}] = useState(${s.initialValue});`);
  }
  if (state.length > 0) lines.push('');

  lines.push('  const containerRef = useRef(null);');
  lines.push('');

  for (const effect of effects) {
    lines.push(`  useEffect(() => {`);
    lines.push(`    ${effect.body}`);
    lines.push(`  }, [${effect.deps.join(', ')}]);`);
    lines.push('');
  }

  for (const handler of handlers) {
    lines.push(`  const ${handler.name} = (${handler.params}) => {`);
    lines.push(`    ${handler.body}`);
    lines.push('  };');
    lines.push('');
  }

  lines.push('  return (');
  lines.push(`    <div ref={containerRef} className="${kebabToCamel(componentName)}">`);
  lines.push(`      ${jsx}`);
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');

  return lines.join('\n');
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function kebabToCamel(str) { return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function generateFromAnalysis(componentName, analysis) {
  const state = [], handlers = [], effects = [], imports = [];

  for (const op of analysis.domOperations) {
    if (op.method === 'text' || op.method === 'html') {
      state.push({ name: inferStateName(op.selector), initialValue: "''" });
    }
  }

  for (const evt of analysis.eventBindings) {
    handlers.push({
      name: `handle${capitalize(evt.method)}${capitalize(inferStateName(evt.selector))}`,
      params: 'event',
      body: `// TODO: 迁移自 jQuery ${evt.method} 事件`,
    });
  }

  for (const ajax of analysis.ajaxCalls) {
    effects.push({ body: `// TODO: 迁移自 $.${ajax.type}`, deps: [] });
    imports.push("import axios from 'axios';");
  }

  const jsx = analysis.selectors.length > 0
    ? analysis.selectors.slice(0, 5).map(s => `<div className="${s.selector.replace(/[#.]/g, '')}">...</div>`).join('\n      ')
    : '{/* TODO: 迁移自 jQuery DOM 操作 */}';

  return generateReactComponent({
    componentName, imports: [...new Set(imports)], state, effects, handlers, jsx,
  });
}

function inferStateName(selector) {
  if (!selector) return 'data';
  return selector.replace(/[#.]/g, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()) || 'data';
}

module.exports = { generateReactComponent, generateFromAnalysis };
```

### 模块五：迁移验证器

```javascript
// src/tester/validator.js
const fs = require('fs');
const path = require('path');

class MigrationValidator {
  constructor(originalDir, migratedDir) {
    this.originalDir = originalDir;
    this.migratedDir = migratedDir;
    this.results = { passed: 0, failed: 0, warnings: [], errors: [] };
  }

  validate() {
    this.checkFileCoverage();
    this.checkNoJQueryRemains();
    this.checkSyntax();
    this.checkFunctionality();
    return this.results;
  }

  checkFileCoverage() {
    const originalFiles = this.listFiles(this.originalDir, '.html');
    const migratedFiles = this.listFiles(this.migratedDir, '.jsx');
    for (const orig of originalFiles) {
      const expectedName = path.basename(orig, '.html') + '.jsx';
      if (migratedFiles.find(f => path.basename(f) === expectedName)) {
        this.results.passed++;
      } else {
        this.results.failed++;
        this.results.errors.push(`缺少迁移文件: ${expectedName}`);
      }
    }
  }

  checkNoJQueryRemains() {
    const migratedFiles = this.listFiles(this.migratedDir, '.jsx');
    const jqueryPatterns = [/\$\(/, /jQuery\(/, /\$\.ajax/, /\.fadeIn/, /\.fadeOut/];
    for (const file of migratedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of jqueryPatterns) {
        if (pattern.test(content)) {
          this.results.warnings.push(`${path.basename(file)}: 可能遗留 jQuery 代码 (${pattern})`);
        }
      }
    }
  }

  checkSyntax() {
    const migratedFiles = this.listFiles(this.migratedDir, '.jsx');
    for (const file of migratedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      try {
        const { parse } = require('@babel/parser');
        parse(content, { sourceType: 'module', plugins: ['jsx'] });
        this.results.passed++;
      } catch (error) {
        this.results.failed++;
        this.results.errors.push(`${path.basename(file)}: 语法错误 - ${error.message}`);
      }
    }
  }

  checkFunctionality() {
    const migratedFiles = this.listFiles(this.migratedDir, '.jsx');
    for (const file of migratedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const todoCount = (content.match(/TODO/g) || []).length;
      if (todoCount > 0) {
        this.results.warnings.push(`${path.basename(file)}: 有 ${todoCount} 个 TODO 需要人工处理`);
      }
    }
  }

  listFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...this.listFiles(fullPath, ext));
      else if (entry.name.endsWith(ext)) files.push(fullPath);
    }
    return files;
  }

  generateReport() {
    return [
      '# 迁移验证报告', '',
      `## 结果概览`,
      `- 通过: ${this.results.passed}`,
      `- 失败: ${this.results.failed}`,
      `- 警告: ${this.results.warnings.length}`, '',
      ...(this.results.errors.length ? ['## 错误', ...this.results.errors.map(e => `- ❌ ${e}`), ''] : []),
      ...(this.results.warnings.length ? ['## 警告', ...this.results.warnings.map(w => `- ⚠️ ${w}`)] : []),
    ].join('\n');
  }
}

module.exports = { MigrationValidator };
```

### 完整项目入口

```javascript
// src/index.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { analyzeJQueryCode } = require('./analyzer/pattern-matcher');
const { LLMTranslator } = require('./llm/translator');
const { generateFromAnalysis } = require('./generator/component-gen');
const { MigrationValidator } = require('./tester/validator');

async function migrateProject(options) {
  const { inputDir, outputDir, useLLM = false, llmApiKey, llmModel = 'gpt-4o', llmBaseUrl } = options;

  console.log(`开始迁移: ${inputDir} → ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlFiles = await glob('**/*.html', { cwd: inputDir });
  console.log(`找到 ${htmlFiles.length} 个 HTML 文件`);

  const translator = useLLM && llmApiKey ? new LLMTranslator({ apiKey: llmApiKey, model: llmModel, baseUrl: llmBaseUrl }) : null;
  const stats = { total: 0, autoConverted: 0, llmAssisted: 0, failed: 0 };

  for (const htmlFile of htmlFiles) {
    const inputPath = path.join(inputDir, htmlFile);
    const componentName = path.basename(htmlFile, '.html');
    const outputPath = path.join(outputDir, `${componentName}.jsx`);

    console.log(`\n处理: ${htmlFile}`);

    try {
      const content = fs.readFileSync(inputPath, 'utf-8');
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (!scriptMatch) { console.log('  跳过: 没有 script 标签'); continue; }

      const jsCode = scriptMatch.map(s => s.replace(/<\/?script[^>]*>/g, '')).join('\n');
      const analysis = analyzeJQueryCode(jsCode);

      console.log(`  发现: ${analysis.domOperations.length} DOM, ${analysis.eventBindings.length} 事件, ${analysis.ajaxCalls.length} AJAX`);

      let reactCode;
      if (translator && translator.needsLLMAssist(analysis)) {
        console.log('  使用 LLM 辅助翻译');
        reactCode = await translator.translateSnippet(jsCode, { componentName });
        stats.llmAssisted++;
      } else {
        console.log('  使用 AST 自动转换');
        reactCode = generateFromAnalysis(componentName, analysis, jsCode);
        stats.autoConverted++;
      }

      fs.writeFileSync(outputPath, reactCode);
      console.log(`  已生成: ${outputPath}`);
      stats.total++;
    } catch (error) {
      console.error(`  失败: ${error.message}`);
      stats.failed++;
    }
  }

  console.log('\n验证迁移结果...');
  const validator = new MigrationValidator(inputDir, outputDir);
  const results = validator.validate();
  fs.writeFileSync(path.join(outputDir, 'migration-report.md'), validator.generateReport());

  console.log(`\n迁移完成: 总计 ${stats.total}, 自动 ${stats.autoConverted}, LLM ${stats.llmAssisted}, 失败 ${stats.failed}`);
  console.log(`验证: 通过 ${results.passed}, 警告 ${results.warnings.length}`);
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.log('用法: node src/index.js <input-dir> [output-dir] [--llm] [--api-key=KEY] [--model=MODEL]');
  process.exit(1);
}

const useLLM = args.includes('--llm');
const apiKey = args.find(a => a.startsWith('--api-key='))?.split('=')[1];
const model = args.find(a => a.startsWith('--model='))?.split('=')[1];
const baseUrl = args.find(a => a.startsWith('--base-url='))?.split('=')[1];

migrateProject({
  inputDir: args[0],
  outputDir: args[1] || './output',
  useLLM, llmApiKey: apiKey || process.env.OPENAI_API_KEY, llmModel: model, llmBaseUrl: baseUrl,
}).catch(console.error);
```

---

## 使用示例

### 输入：jQuery 表单页面

```html
<!-- login.html -->
<html>
<body>
  <form id="loginForm">
    <input id="username" type="text" />
    <input id="password" type="password" />
    <button type="submit">登录</button>
    <div id="error" style="display:none;color:red;"></div>
  </form>
  <script src="https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js"></script>
  <script>
    $('#loginForm').on('submit', function(e) {
      e.preventDefault();
      $.ajax({
        url: '/api/login', method: 'POST',
        data: JSON.stringify({ username: $('#username').val(), password: $('#password').val() }),
        contentType: 'application/json',
        success: function() { window.location.href = '/dashboard'; },
        error: function(xhr) { $('#error').text(xhr.responseJSON.message).show(); }
      });
    });
  </script>
</body>
</html>
```

### 输出：React 组件

```jsx
// output/login.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function login() {
  const [error, setError] = useState('');
  const [showerror, setShowerror] = useState(true);
  const containerRef = useRef(null);

  const handlesubmitloginform = (event) => {
    // TODO: 迁移自 jQuery submit 事件
  };

  return (
    <div ref={containerRef} className="login">
      <form onSubmit={handlesubmitloginform}>
        <input type="text" className="username" />
        <input type="password" className="password" />
        <button type="submit">登录</button>
        {showerror && <div className="error" style={{color: 'red'}}>{error}</div>}
      </form>
    </div>
  );
}
```

---

## 常见误区

**误区一：忽略 jQuery 插件的处理。** 很多项目用了插件（datepicker、select2、DataTable），不能简单转换，需要找到 React 替代库。

**误区二：不做回归测试。** 自动生成的代码可能有逻辑错误，必须用 Playwright 做端到端测试对比新旧页面行为。

**误区三：期望 100% 自动化。** 工具能处理 60-80% 的代码，剩下的需要人工。关键是把 6 个月的工作降到 1 个月。

---

## 小结

- jQuery 到 React 迁移需要：解析→分析→转换→生成→验证 五个步骤
- 用 AST 识别 jQuery 模式（DOM 操作、事件绑定、AJAX、动画）
- 简单模式用规则引擎自动转换，复杂模式用 LLM 辅助
- 生成的代码需要验证：文件覆盖、语法检查、jQuery 残留检测
- 工具能处理 60-80% 的代码，剩下的需要人工处理

## 练习

### 练习一：扩展转换规则

为规则引擎添加以下 jQuery 模式的转换规则：
1. `$(selector).addClass('active')` → 动态 className
2. `$(selector).prop('disabled', true)` → disabled 属性
3. `$(selector).animate({left: 100}, 500)` → CSS transition

### 练习二：添加 Vue 输出支持

修改组件生成器，支持输出 Vue 3 组件（Composition API）而不是 React。对比两种输出的差异。

---

## 参考答案

### 练习一

**思路**：每条规则需要一个 matcher（匹配 AST 节点）和一个 transformer（替换节点）。

**答案**：

```javascript
const additionalRules = [
  // $(selector).addClass('active') → className 动态拼接
  {
    name: 'addClass-to-className',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: 'addClass' }) &&
        path.node.arguments.length === 1 && t.isStringLiteral(path.node.arguments[0]);
    },
    transformer: (path) => {
      const className = path.node.arguments[0].value;
      path.replaceWith(
        t.jsxAttribute(
          t.jsxIdentifier('className'),
          t.jsxExpressionContainer(
            t.templateLiteral(
              [t.templateElement({ raw: '' }), t.templateElement({ raw: ` ${className}` })],
              [t.identifier(`is${capitalize(className)}`)]
            )
          )
        )
      );
    },
  },

  // $(selector).prop('disabled', true) → disabled={true}
  {
    name: 'prop-disabled-to-attribute',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: 'prop' }) &&
        path.node.arguments.length === 2 &&
        t.isStringLiteral(path.node.arguments[0], { value: 'disabled' });
    },
    transformer: (path) => {
      path.replaceWith(
        t.jsxAttribute(t.jsxIdentifier('disabled'), t.jsxExpressionContainer(path.node.arguments[1]))
      );
    },
  },

  // $(selector).animate({left: 100}, 500) → CSS transition
  {
    name: 'animate-to-css-transition',
    matcher: (path) => {
      return t.isCallExpression(path.node) &&
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: 'animate' });
    },
    transformer: (path) => {
      const duration = path.node.arguments[1]?.value || 300;
      path.replaceWith(
        t.jsxAttribute(
          t.jsxIdentifier('style'),
          t.jsxExpressionContainer(t.objectExpression([
            t.objectProperty(t.identifier('transition'), t.stringLiteral(`all ${duration}ms ease`))
          ]))
        )
      );
    },
  },
];
```

**要点**：matcher 检查 AST 节点类型和属性值；animate 转换比较复杂因为 jQuery 动画和 CSS transition 语义不完全一致。

### 练习二

**思路**：Vue 3 Composition API 用 `ref` 替代 `useState`，用 `onMounted` 替代 `useEffect`，用 `<template>` 替代 JSX。

**答案**：

```javascript
function generateVueComponent({ componentName, imports, state, effects, handlers, template }) {
  const lines = [];
  lines.push('<script setup>');
  lines.push("import { ref, onMounted } from 'vue';");
  for (const imp of imports) lines.push(imp);
  lines.push('');

  for (const s of state) lines.push(`const ${s.name} = ref(${s.initialValue});`);
  lines.push('');

  for (const effect of effects) {
    lines.push('onMounted(() => {');
    lines.push(`  ${effect.body}`);
    lines.push('});');
  }

  for (const handler of handlers) {
    lines.push(`const ${handler.name} = (${handler.params}) => {`);
    lines.push(`  ${handler.body}`);
    lines.push('};');
  }

  lines.push('</script>');
  lines.push('<template>');
  lines.push(`  <div class="${componentName}">`);
  lines.push(`    ${template}`);
  lines.push('  </div>');
  lines.push('</template>');

  return lines.join('\n');
}
```

**React vs Vue 差异**：React 用 `useState`/`useEffect`/JSX，Vue 用 `ref`/`onMounted`/`<template>`；React 事件用 `onClick`，Vue 用 `@click`。

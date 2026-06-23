# 08 - 阶段实战：jQuery 到 React 的自动化迁移工具

> **课程定位**：Part 2 综合实战，整合 AST 转换、LLM 辅助、代码生成。
>
> **前置要求**：完成 AST 级代码转换课程
>
> **预计时长**：2 小时

---

公司有一个运营 8 年的管理后台，200 多个页面、15000 行 jQuery。手动重写需要 3 人 × 6 个月。你提出方案：写一个自动化迁移工具。

---

## 架构

```
解析层 (HTML/JS解析) → 分析层 (模式识别/依赖分析) → 转换层 (规则引擎/LLM辅助) → 输出层 (组件生成/测试生成)
```

jQuery 模式分类：`$('sel').html()` → `dangerouslySetInnerHTML`，`$('sel').on('click')` → `onClick`，`$.ajax()` → `fetch`，插件 → React 组件库。

---

## 模块一：模式识别器

```javascript
// src/analyzer/pattern-matcher.js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function analyzeJQueryCode(code) {
  const findings = { domOperations: [], eventBindings: [], ajaxCalls: [], selectors: [] };
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch { return findings; }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      // $.ajax, $.get, $.post
      if (callee.type === 'MemberExpression' && callee.object?.name === '$') {
        const method = callee.property?.name;
        if (['ajax', 'get', 'post'].includes(method)) findings.ajaxCalls.push({ type: method, line: path.node.loc?.start.line });
      }
      // $('selector').method()
      if (callee.type === 'MemberExpression' && callee.object?.type === 'CallExpression' && callee.object?.callee?.name === '$') {
        const selector = callee.object.arguments[0]?.value;
        const method = callee.property?.name;
        findings.selectors.push({ selector, line: path.node.loc?.start.line });
        if (['html','text','val','addClass','show','hide'].includes(method)) findings.domOperations.push({ method, selector });
        if (['on','click','submit','change'].includes(method)) findings.eventBindings.push({ method, selector });
      }
    },
  });
  return findings;
}

module.exports = { analyzeJQueryCode };
```

---

## 模块二：规则引擎

```javascript
// src/transformer/rule-engine.js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const TRANSFORMATION_RULES = [
  // $.ajax({url, method}) → fetch
  {
    name: 'ajax-to-fetch',
    matcher: (path) => t.isCallExpression(path.node) && t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.object, { name: '$' }) && t.isIdentifier(path.node.callee.property, { name: 'ajax' }),
    transformer: (path) => {
      const config = path.node.arguments[0];
      if (!t.isObjectExpression(config)) return;
      const props = {};
      for (const prop of config.properties) { if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) props[prop.key.name] = prop.value; }
      path.replaceWith(t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier('response'), t.awaitExpression(t.callExpression(t.identifier('fetch'), [props.url || t.stringLiteral(''), t.objectExpression([t.objectProperty(t.identifier('method'), props.method || t.stringLiteral('GET'))])])))
      ]));
    },
  },
  // $(selector).on('click', handler) → onClick={handler}
  {
    name: 'on-to-onClick',
    matcher: (path) => t.isCallExpression(path.node) && t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property, { name: 'on' }) && path.node.arguments.length === 2 && t.isStringLiteral(path.node.arguments[0]),
    transformer: (path) => {
      const eventName = path.node.arguments[0].value;
      const reactEvent = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
      path.replaceWith(t.jsxAttribute(t.jsxIdentifier(reactEvent), t.jsxExpressionContainer(path.node.arguments[1])));
    },
  },
];

function transformCode(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  traverse(ast, { CallExpression(path) { for (const rule of TRANSFORMATION_RULES) { if (rule.matcher(path)) { try { rule.transformer(path); } catch {} break; } } } });
  return generate(ast, { retainLines: false }).code;
}

module.exports = { transformCode, TRANSFORMATION_RULES };
```

---

## 模块三：LLM 辅助与组件生成

```javascript
// src/llm/translator.js
const OpenAI = require('openai');

class LLMTranslator {
  constructor({ apiKey, model = 'gpt-4o', baseUrl }) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async translateSnippet(jqueryCode, context = {}) {
    const response = await this.client.chat.completions.create({
      model: this.model, temperature: 0.1,
      messages: [{ role: 'user', content: `将以下 jQuery 代码转换为 React 函数组件（useState/useEffect/useRef，JSX，fetch）。${context.componentName ? '组件名: ' + context.componentName : ''}\n\njQuery:\n\`\`\`javascript\n${jqueryCode}\n\`\`\`\n\n只输出 React 代码。` }],
    });
    const content = response.choices[0].message.content;
    const match = content.match(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : content.trim();
  }

  needsLLMAssist(findings) {
    return findings.ajaxCalls.length > 2 || findings.domOperations.length > 10;
  }
}

module.exports = { LLMTranslator };
```

```javascript
// src/generator/component-gen.js
function generateFromAnalysis(componentName, analysis) {
  const lines = ["import React, { useState, useEffect, useRef } from 'react';", '', `export default function ${componentName}() {`];
  for (const op of analysis.domOperations) {
    if (op.method === 'text' || op.method === 'html') lines.push(`  const [${op.selector.replace(/[#.]/g, '')}, set${op.selector.replace(/[#.]/g, '').charAt(0).toUpperCase()}${op.selector.replace(/[#.]/g, '').slice(1)}] = useState('');`);
  }
  lines.push('  const containerRef = useRef(null);', '');
  for (const evt of analysis.eventBindings) lines.push(`  const handle${evt.method} = (event) => { /* TODO: 迁移自 jQuery ${evt.method} */ };`, '');
  for (const ajax of analysis.ajaxCalls) lines.push(`  useEffect(() => { /* TODO: 迁移自 $.${ajax.type} */ }, []);`, '');
  lines.push('  return (', `    <div ref={containerRef}>`, '      {/* TODO: 迁移自 jQuery DOM 操作 */}', '    </div>', '  );', '}');
  return lines.join('\n');
}

module.exports = { generateFromAnalysis };
```

---

## 模块四：验证器与入口

```javascript
// src/tester/validator.js
const fs = require('fs');
const path = require('path');

class MigrationValidator {
  constructor(originalDir, migratedDir) { this.originalDir = originalDir; this.migratedDir = migratedDir; this.results = { passed: 0, failed: 0, warnings: [], errors: [] }; }

  validate() {
    const originals = this.listFiles(this.originalDir, '.html');
    const migrated = this.listFiles(this.migratedDir, '.jsx');
    for (const orig of originals) {
      const expected = path.basename(orig, '.html') + '.jsx';
      if (migrated.find(f => path.basename(f) === expected)) this.results.passed++;
      else { this.results.failed++; this.results.errors.push(`缺少: ${expected}`); }
    }
    for (const file of migrated) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/\$\(|jQuery\(/.test(content)) this.results.warnings.push(`${path.basename(file)}: 可能遗留 jQuery`);
      const todoCount = (content.match(/TODO/g) || []).length;
      if (todoCount > 0) this.results.warnings.push(`${path.basename(file)}: ${todoCount} 个 TODO 需人工处理`);
    }
    return this.results;
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
}

module.exports = { MigrationValidator };
```

```javascript
// src/index.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { analyzeJQueryCode } = require('./analyzer/pattern-matcher');
const { LLMTranslator } = require('./llm/translator');
const { generateFromAnalysis } = require('./generator/component-gen');
const { MigrationValidator } = require('./tester/validator');

async function migrateProject({ inputDir, outputDir, useLLM, llmApiKey, llmModel, llmBaseUrl }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const htmlFiles = await glob('**/*.html', { cwd: inputDir });
  const translator = useLLM && llmApiKey ? new LLMTranslator({ apiKey: llmApiKey, model: llmModel, baseUrl: llmBaseUrl }) : null;
  const stats = { total: 0, auto: 0, llm: 0, failed: 0 };

  for (const htmlFile of htmlFiles) {
    try {
      const content = fs.readFileSync(path.join(inputDir, htmlFile), 'utf-8');
      const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (!scripts) continue;
      const jsCode = scripts.map(s => s.replace(/<\/?script[^>]*>/g, '')).join('\n');
      const analysis = analyzeJQueryCode(jsCode);
      const componentName = path.basename(htmlFile, '.html');
      const reactCode = translator && translator.needsLLMAssist(analysis)
        ? (stats.llm++, await translator.translateSnippet(jsCode, { componentName }))
        : (stats.auto++, generateFromAnalysis(componentName, analysis));
      fs.writeFileSync(path.join(outputDir, `${componentName}.jsx`), reactCode);
      stats.total++;
    } catch (e) { stats.failed++; }
  }

  const validator = new MigrationValidator(inputDir, outputDir);
  const results = validator.validate();
  console.log(`迁移完成: ${stats.total} 个, 自动 ${stats.auto}, LLM ${stats.llm}, 失败 ${stats.failed}`);
  console.log(`验证: 通过 ${results.passed}, 警告 ${results.warnings.length}`);
}

const args = process.argv.slice(2);
if (!args[0]) { console.log('用法: node src/index.js <input-dir> [output-dir] [--llm] [--api-key=KEY]'); process.exit(1); }
migrateProject({ inputDir: args[0], outputDir: args[1] || './output', useLLM: args.includes('--llm'), llmApiKey: args.find(a => a.startsWith('--api-key='))?.split('=')[1] || process.env.OPENAI_API_KEY, llmModel: args.find(a => a.startsWith('--model='))?.split('=')[1], llmBaseUrl: args.find(a => a.startsWith('--base-url='))?.split('=')[1] }).catch(console.error);
```

---

## 练习

### 练习一：扩展转换规则

添加：`$(selector).addClass('active')` → 动态 className，`$(selector).prop('disabled', true)` → disabled 属性。

### 练习二：Vue 输出支持

修改组件生成器，支持输出 Vue 3 组件（Composition API）。核心差异：`useState` → `ref`，`useEffect` → `onMounted`，JSX → `<template>`。

---

## 参考答案

### 练习一

每条规则需要 `matcher`（检查 AST 节点类型和属性值）和 `transformer`（替换节点）。`addClass` 需要生成模板字符串拼接 className，`prop('disabled', true)` 直接映射为 JSX disabled 属性。

### 练习二

React 用 `useState`/`useEffect`/JSX，Vue 用 `ref`/`onMounted`/`<template>`。生成器需要一个 `framework` 参数切换输出模板。事件绑定差异：React `onClick`，Vue `@click`。

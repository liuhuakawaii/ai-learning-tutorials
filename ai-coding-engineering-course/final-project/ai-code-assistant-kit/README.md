# AI Code Assistant Kit

一个实用的 AI 编程助手工具集 CLI，集成 Prompt 模板管理、代码审查、测试生成等核心功能。

## 特性

- 🎯 **Prompt 模板引擎** - 5+ 个可复用的 Prompt 模板，支持变量替换
- 🔍 **代码审查助手** - 静态分析 + AI 辅助代码审查
- 🧪 **测试生成器** - 自动生成单元测试脚手架
- 📊 **报告生成** - Markdown 格式的审查和覆盖率报告

## 快速开始

### 安装

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
npm run check
```

## 项目结构

```
ai-code-assistant-kit/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types.ts              # 类型定义
│   ├── prompt-templates.ts   # Prompt 模板引擎
│   ├── code-reviewer.ts      # 代码审查引擎
│   └── test-generator.ts     # 测试生成引擎
├── reports/                   # 报告输出目录
├── scripts/
│   └── check.cjs             # 项目检查脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 使用示例

### Prompt 模板

```typescript
import { PromptTemplateEngine } from './src/prompt-templates';

const engine = new PromptTemplateEngine();
const result = engine.execute('function-generation', {
  language: 'TypeScript',
  requirement: '实现一个深拷贝函数',
  constraints: '支持 Date、RegExp 类型',
});
console.log(result);
```

### 代码审查

```typescript
import { CodeReviewer } from './src/code-reviewer';

const reviewer = new CodeReviewer();
const suggestions = reviewer.review(`
function divide(a, b) {
  return a / b;
}
`);
console.log(suggestions);
```

### 测试生成

```typescript
import { TestGenerator } from './src/test-generator';

const generator = new TestGenerator();
const tests = generator.generate('add', '(a: number, b: number): number');
console.log(tests);
```

## 开发指南

### 添加新的 Prompt 模板

1. 在 `src/prompt-templates.ts` 中添加模板定义
2. 实现变量替换逻辑
3. 编写测试用例
4. 更新文档

### 自定义审查规则

1. 在 `src/code-reviewer.ts` 中添加规则
2. 实现检测逻辑
3. 定义严重级别和建议

## 许可证

MIT

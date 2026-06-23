# LLM 代码翻译

## 场景引入

你刚加入一个创业团队，后端是 Python Flask，前端是 React。新 CTO 上任后要求把部分核心模块迁移到 TypeScript，理由是统一技术栈、减少前后端类型不一致导致的 bug。需要迁移的模块有 40 个文件，涉及数据库查询、缓存逻辑、鉴权中间件。

用 AST 工具？Python 和 TypeScript 的语法结构完全不同，AST 转换器需要从零编写，工作量比直接重写还大。手动翻译？一个人翻译完这些代码至少要两个月，而且还容易因为疲劳引入 bug——Python 的 `dict` 到 TypeScript 的 `Record<string, unknown>`，类型对不上的问题会贯穿整个迁移过程。

这时候 LLM 代码翻译就派上用场了。2025 年的主流大模型（GPT-4o、Claude 4、Gemini 2.5 Pro）同时精通 Python 和 TypeScript，能把 Python 代码翻译成语义等价的 TypeScript 代码。但它不是万能的——大文件会截断、上下文会丢失、类型映射可能出错。本课教你如何高效地用 LLM 做代码翻译，并建立质量保障体系。

## 学习目标

完成本课学习后，你将能够：

1. 设计高效的代码翻译 prompt 模板
2. 处理大文件的分块翻译策略
3. 管理跨文件的上下文和导入关系
4. 建立翻译质量的自动评估机制
5. 处理代码翻译中的常见边界情况

## 核心概念

### LLM 代码翻译的工作流

LLM 代码翻译不是"把代码丢给 AI 就完事"。一个可靠的翻译流程包含五个阶段：

```
原始代码文件
    |
    v
[预处理] 分析依赖、提取上下文、拆分块
    |
    v
[翻译]   逐块发送给 LLM，附带上下文
    |
    v
[编译检查] TypeScript 编译、类型验证
    |
    v
[测试对比] 原始测试 + 翻译后测试
    |
    v
[人工审查] 标记需要人工介入的部分
```

每个阶段都有对应的策略和工具。跳过任何一步都会导致翻译质量不可控。

### LLM 翻译的能力边界

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM 翻译擅长的场景                        │
├─────────────────────────────────────────────────────────────┤
│  ✓ 函数级别的代码翻译（50-200 行）                           │
│  ✓ 常见模式映射（dict→Record, list→Array）                  │
│  ✓ API 调用转换（requests→fetch, flask→express）            │
│  ✓ 类型注解添加（Python 无类型→TypeScript 有类型）           │
│  ✓ 错误处理模式转换（try/except→try/catch）                  │
├─────────────────────────────────────────────────────────────┤
│                    LLM 翻译不擅长的场景                      │
├─────────────────────────────────────────────────────────────┤
│  ✗ 超过 500 行的单文件（上下文窗口限制）                     │
│  ✗ 跨文件的类型一致性（LLM 不维护全局类型表）                │
│  ✗ 复杂的业务逻辑推理（LLM 不理解你的业务）                  │
│  ✗ 并发模型差异（Python asyncio → Node.js event loop）      │
│  ✗ 性能敏感代码（LLM 不考虑运行时性能差异）                  │
└─────────────────────────────────────────────────────────────┘
```

理解这些边界很重要。LLM 翻译的目标不是替代人工，而是把 80% 的重复性工作自动化，让工程师专注于 20% 需要判断力的部分。

### Prompt Engineering for Code Translation

翻译 prompt 的质量直接决定翻译结果的质量。一个好的翻译 prompt 需要包含四要素：

```
┌──────────────────────────────────────────┐
│            翻译 Prompt 四要素             │
├──────────────────────────────────────────┤
│                                          │
│  1. 角色定义                             │
│     "你是一个 Python→TypeScript 翻译专家" │
│                                          │
│  2. 目标语言约束                         │
│     "使用 TypeScript strict 模式"         │
│     "使用 ES2022 语法"                    │
│                                          │
│  3. 映射规则                             │
│     "dict → Record<string, unknown>"     │
│     "None → null"                        │
│     "列表推导 → Array.filter().map()"    │
│                                          │
│  4. 输出格式                             │
│     "只输出代码，不要解释"                │
│     "保留原始注释"                        │
│                                          │
└──────────────────────────────────────────┘
```

下面是一个经过验证的翻译 prompt 模板：

```typescript
const TRANSLATION_PROMPT = `你是一个资深的 Python→TypeScript 翻译工程师。

## 任务
将以下 Python 代码翻译为 TypeScript。

## 约束
- 使用 TypeScript strict 模式
- 使用 ES2022+ 语法
- Python dict → Record<string, unknown> 或具体接口类型
- Python list → Array<T> 或 T[]
- Python None → null
- Python True/False → true/false
- Python f-string → TypeScript template literal
- Python with → try/finally 或对应的资源管理模式
- Python async/await → 直接对应，但注意 Python 的 asyncio 和 Node.js 的事件循环差异
- 保留原始注释，翻译为中文或英文（与原始语言一致）
- 添加完整的类型注解，不要使用 any
- 如果原始 Python 有 type hints，优先使用它们推断 TypeScript 类型

## 上下文
以下是你需要参考的依赖类型定义：
{{DEPENDENCY_TYPES}}

## 输出格式
只输出 TypeScript 代码，不要解释。

## 原始 Python 代码
\`\`\`python
{{PYTHON_CODE}}
\`\`\``;
```

## 实战：Python→TypeScript 翻译 Pipeline

下面是一个完整的翻译 pipeline 实现，包含文件读取、分块、翻译、编译检查：

```typescript
// scripts/translate-pipeline.ts
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TranslationResult {
  originalPath: string;
  translatedCode: string;
  compilationErrors: string[];
  needsHumanReview: boolean;
  reviewReasons: string[];
}

// 读取 Python 文件并分析依赖
async function analyzeSource(filePath: string): Promise<{
  code: string;
  imports: string[];
  functions: string[];
}> {
  const code = await fs.readFile(filePath, 'utf-8');
  const imports: string[] = [];
  const functions: string[] = [];

  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      imports.push(trimmed);
    }
    if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
      const match = trimmed.match(/(?:async\s+)?def\s+(\w+)/);
      if (match) functions.push(match[1]);
    }
  }

  return { code, imports, functions };
}

// 将大文件拆分为可翻译的块
function splitIntoChunks(code: string, maxLines: number = 150): string[] {
  const lines = code.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let braceDepth = 0;

  for (const line of lines) {
    currentChunk.push(line);
    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;

    // 在顶层边界处切分
    if (currentChunk.length >= maxLines && braceDepth <= 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

// 调用 LLM 翻译单个代码块
async function translateChunk(
  code: string,
  dependencyTypes: string
): Promise<string> {
  const prompt = `你是一个资深的 Python→TypeScript 翻译工程师。

## 约束
- 使用 TypeScript strict 模式，ES2022+ 语法
- Python dict → Record<string, unknown> 或具体接口类型
- Python list → Array<T> 或 T[]
- Python None → null
- 添加完整的类型注解，不要使用 any
- 保留原始注释

## 依赖类型参考
${dependencyTypes}

## 输出格式
只输出 TypeScript 代码，不要解释。

## 原始 Python 代码
\`\`\`python
${code}
\`\`\``;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // 低温度确保翻译一致性
    max_tokens: 4096,
  });

  let result = response.choices[0].message.content || '';

  // 清理 LLM 输出中的 markdown 代码块标记
  result = result.replace(/^```(?:typescript|ts)?\n/, '');
  result = result.replace(/\n```$/, '');

  return result;
}

// TypeScript 编译检查
function checkCompilation(tsCode: string, filePath: string): string[] {
  const tempPath = filePath.replace('.py', '.temp.ts');
  const errors: string[] = [];

  try {
    fs.writeFileSync(tempPath, tsCode);
    execSync(`npx tsc --noEmit --strict ${tempPath}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    const stderr = error.stderr || '';
    const errorLines = stderr.split('\n').filter((line: string) =>
      line.includes('error TS')
    );
    errors.push(...errorLines);
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }

  return errors;
}

// 生成需要人工审查的标记
function identifyReviewNeeds(
  originalCode: string,
  translatedCode: string,
  compilationErrors: string[]
): { needsReview: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // 检查是否有 any 类型
  if (translatedCode.includes(': any')) {
    reasons.push('包含 any 类型，需要手动细化');
  }

  // 检查是否丢失了函数
  const originalFunctions = originalCode.match(/(?:async\s+)?def\s+(\w+)/g) || [];
  const translatedFunctions = translatedCode.match(
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g
  ) || [];

  if (originalFunctions.length > translatedFunctions.length) {
    reasons.push(
      `原始代码有 ${originalFunctions.length} 个函数，翻译后只有 ${translatedFunctions.length} 个`
    );
  }

  // 检查编译错误
  if (compilationErrors.length > 0) {
    reasons.push(`有 ${compilationErrors.length} 个编译错误`);
  }

  // 检查是否有未翻译的 Python 语法残留
  if (translatedCode.includes('def ') || translatedCode.includes('print(')) {
    reasons.push('存在未翻译的 Python 语法残留');
  }

  return { needsReview: reasons.length > 0, reasons };
}

// 主流程
async function translateProject(
  sourceDir: string,
  outputDir: string
): Promise<TranslationResult[]> {
  const files = await fs.readdir(sourceDir);
  const pyFiles = files.filter(f => f.endsWith('.py'));
  const results: TranslationResult[] = [];

  for (const file of pyFiles) {
    console.log(`翻译中: ${file}`);

    const sourcePath = path.join(sourceDir, file);
    const { code, imports } = await analyzeSource(sourcePath);

    // 收集依赖类型信息
    const dependencyTypes = imports
      .map(imp => `# ${imp}`)
      .join('\n');

    // 分块翻译
    const chunks = splitIntoChunks(code);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const translated = await translateChunk(chunk, dependencyTypes);
      translatedChunks.push(translated);
    }

    const translatedCode = translatedChunks.join('\n\n');

    // 编译检查
    const outputPath = path.join(outputDir, file.replace('.py', '.ts'));
    const compilationErrors = checkCompilation(translatedCode, outputPath);

    // 审查标记
    const { needsReview, reasons } = identifyReviewNeeds(
      code, translatedCode, compilationErrors
    );

    // 写入翻译结果
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, translatedCode);

    results.push({
      originalPath: sourcePath,
      translatedCode,
      compilationErrors,
      needsHumanReview: needsReview,
      reviewReasons: reasons,
    });
  }

  return results;
}

// 执行翻译
translateProject('./src/python', './src/typescript').then(results => {
  const summary = {
    total: results.length,
    success: results.filter(r => !r.needsHumanReview).length,
    needsReview: results.filter(r => r.needsHumanReview).length,
  };

  console.log('\n翻译完成:');
  console.log(`  总计: ${summary.total} 个文件`);
  console.log(`  成功: ${summary.success} 个文件`);
  console.log(`  需审查: ${summary.needsReview} 个文件`);

  // 输出需要审查的文件详情
  results
    .filter(r => r.needsHumanReview)
    .forEach(r => {
      console.log(`\n  ${r.originalPath}:`);
      r.reviewReasons.forEach(reason => console.log(`    - ${reason}`));
    });
});
```

## 分块翻译策略

大文件翻译是 LLM 代码翻译的核心挑战。一个 800 行的 Python 文件无法一次性发送给 LLM——即使上下文窗口足够，翻译质量也会因为内容过多而下降。

分块策略的核心原则是**按语义边界切分**，而不是简单地按行数切分：

```
┌─────────────────────────────────────────────────────────┐
│                    错误的切分方式                         │
├─────────────────────────────────────────────────────────┤
│  第 1 块: 第 1-200 行（可能切在函数中间）                │
│  第 2 块: 第 201-400 行（丢失了函数签名）                │
│  第 3 块: 第 401-600 行（不知道变量类型）                │
├─────────────────────────────────────────────────────────┤
│                    正确的切分方式                         │
├─────────────────────────────────────────────────────────┤
│  第 1 块: imports + 类型定义 + 前 3 个函数               │
│  第 2 块: 中间 3 个函数（附带类型定义摘要）              │
│  第 3 块: 最后 2 个函数 + exports                       │
└─────────────────────────────────────────────────────────┘
```

分块时需要保留的上下文信息：

1. **import 块**：每块翻译都需要知道依赖了哪些模块
2. **类型定义**：如果前面的块定义了类型，后面的块需要引用
3. **函数签名**：即使函数被切到不同的块，翻译时需要知道完整签名

## 翻译后验证

翻译完成后，必须进行三层验证：

```typescript
// scripts/validate-translation.ts
import * as ts from 'typescript';
import { execSync } from 'child_process';

interface ValidationResult {
  file: string;
  compilation: { passed: boolean; errors: string[] };
  typeCheck: { passed: boolean; errors: string[] };
  testComparison: { passed: boolean; details: string };
}

async function validateTranslation(
  originalPy: string,
  translatedTs: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    file: translatedTs,
    compilation: { passed: false, errors: [] },
    typeCheck: { passed: false, errors: [] },
    testComparison: { passed: false, details: '' },
  };

  // 第一层：编译检查
  try {
    execSync(`npx tsc --noEmit --strict ${translatedTs}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    result.compilation.passed = true;
  } catch (error: any) {
    result.compilation.errors = error.stderr
      .split('\n')
      .filter((line: string) => line.includes('error TS'));
  }

  // 第二层：类型检查（更严格）
  try {
    execSync(
      `npx tsc --noEmit --strict --noUncheckedIndexedAccess ${translatedTs}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    result.typeCheck.passed = true;
  } catch (error: any) {
    result.typeCheck.errors = error.stderr
      .split('\n')
      .filter((line: string) => line.includes('error TS'));
  }

  // 第三层：测试对比
  // 运行原始 Python 测试
  let pythonOutput = '';
  try {
    pythonOutput = execSync(`python ${originalPy.replace('.py', '_test.py')}`, {
      encoding: 'utf-8',
    });
  } catch {}

  // 运行翻译后的 TypeScript 测试
  let tsOutput = '';
  try {
    tsOutput = execSync(`npx tsx ${translatedTs.replace('.ts', '.test.ts')}`, {
      encoding: 'utf-8',
    });
  } catch {}

  if (pythonOutput && tsOutput) {
    result.testComparison.passed = pythonOutput.trim() === tsOutput.trim();
    if (!result.testComparison.passed) {
      result.testComparison.details =
        `Python 输出和 TypeScript 输出不一致`;
    }
  }

  return result;
}
```

## 人工审查工作流

LLM 翻译的结果需要人工审查。为了提高审查效率，应该为翻译结果标记置信度：

```typescript
interface ReviewItem {
  file: string;
  line: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

function generateReviewChecklist(
  originalCode: string,
  translatedCode: string
): ReviewItem[] {
  const items: ReviewItem[] = [];

  // 检查 any 类型使用
  const anyMatches = [...translatedCode.matchAll(/:\s*any\b/g)];
  for (const match of anyMatches) {
    const line = translatedCode.substring(0, match.index).split('\n').length;
    items.push({
      file: '',
      line,
      severity: 'medium',
      description: '使用了 any 类型',
      suggestion: '根据 Python 原始类型注解推断更精确的 TypeScript 类型',
    });
  }

  // 检查类型断言
  const assertionMatches = [...translatedCode.matchAll(/as\s+\w+/g)];
  for (const match of assertionMatches) {
    const line = translatedCode.substring(0, match.index).split('\n').length;
    items.push({
      file: '',
      line,
      severity: 'high',
      description: '使用了类型断言',
      suggestion: '类型断言可能掩盖类型错误，考虑使用类型守卫',
    });
  }

  // 检查空值处理
  if (originalCode.includes('None') && !translatedCode.includes('null')) {
    items.push({
      file: '',
      line: 0,
      severity: 'high',
      description: 'Python 使用了 None 但翻译结果中没有 null',
      suggestion: '检查空值处理是否正确转换',
    });
  }

  return items;
}
```

## 多轮翻译优化

第一次翻译的结果通常不完美。多轮优化的策略是**基于错误反馈迭代 prompt**：

```typescript
async function iterativeTranslation(
  code: string,
  maxIterations: number = 3
): Promise<string> {
  let currentTranslation = await translateChunk(code, '');
  let iteration = 0;

  while (iteration < maxIterations) {
    const errors = checkCompilation(currentTranslation, 'temp.ts');

    if (errors.length === 0) break;

    // 将编译错误反馈给 LLM
    const feedbackPrompt = `以下 TypeScript 代码有编译错误，请修复：

\`\`\`typescript
${currentTranslation}
\`\`\`

编译错误：
${errors.join('\n')}

要求：
- 修复所有编译错误
- 保持代码逻辑不变
- 只输出修复后的代码`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: feedbackPrompt }],
      temperature: 0.1,
    });

    let result = response.choices[0].message.content || '';
    result = result.replace(/^```(?:typescript|ts)?\n/, '');
    result = result.replace(/\n```$/, '');
    currentTranslation = result;

    iteration++;
  }

  return currentTranslation;
}
```

## 常见误区

**误区一：直接让 LLM 翻译整个文件**

一个 500 行的文件直接丢给 LLM，结果要么超出 token 限制被截断，要么因为上下文太长导致翻译质量下降。必须分块翻译，并为每块提供足够的上下文。

**误区二：不做编译检查就人工审查**

LLM 翻译的结果可能有语法错误、类型错误。让人工审查一个编译不过的代码是浪费时间。应该先自动修复编译错误，再让人审查语义。

**误区三：忽略 Python 和 TypeScript 的语义差异**

Python 的 `is` 和 `==` 不同，TypeScript 的 `===` 和 `==` 不同。Python 的 `list` 是引用类型，TypeScript 的数组也是引用类型，但浅拷贝行为不同。这些差异需要在 prompt 中明确说明。

**误区四：期望一次翻译成功**

LLM 翻译是一个迭代过程。第一次翻译的结果通常需要 2-3 轮修正才能通过编译。不要期望"一次搞定"，而是设计好迭代流程。

## 小结

- LLM 代码翻译适合函数级别的代码迁移，不适合整个文件的直接翻译
- 翻译 prompt 需要包含角色定义、语言约束、映射规则、输出格式
- 大文件必须分块翻译，按语义边界切分，每块保留上下文
- 翻译后必须进行三层验证：编译检查、类型检查、测试对比
- 多轮迭代优化是提高翻译质量的关键策略

## 练习

### 练习一：设计 Python→Go 翻译 prompt

设计一个将 Python 代码翻译为 Go 的 prompt 模板。要求包含 Python 和 Go 之间的常见模式映射（如 dict→map、list→slice、class→struct）。

### 练习二：实现分块策略

编写一个函数，将 Python 文件按类和函数定义进行语义分块，每个块不超过 200 行。要求保留每个块的 import 上下文。

---

## 参考答案

### 练习一

**思路**：Go 和 Python 的差异比 TypeScript 更大——Go 没有异常处理（使用 error 返回值）、没有继承（使用组合和接口）、没有动态类型。prompt 需要特别强调这些差异。

**答案**：

```typescript
const PYTHON_TO_GO_PROMPT = `你是一个资深的 Python→Go 翻译工程师。

## 约束
- 使用 Go 1.22+ 语法
- Python dict → map[string]interface{} 或具体 struct
- Python list → []T（slice）
- Python class → struct + 方法
- Python 类继承 → Go 接口 + 组合
- Python 异常 → Go error 返回值
- Python None → Go nil
- Python True/False → Go true/false
- Python with 语句 → Go defer
- Python async/await → Go goroutine + channel
- Python print() → fmt.Println()
- Python len() → len()
- 添加完整的类型注解
- 所有函数必须有 error 返回值（如果原始代码可能抛出异常）
- 使用 Go 的命名规范（驼峰命名，首字母大写表示导出）

## 输出格式
只输出 Go 代码，不要解释。

## 原始 Python 代码
\`\`\`python
{{PYTHON_CODE}}
\`\`\``;
```

**要点**：
- Go 的错误处理模式和 Python 完全不同，prompt 必须明确说明
- Go 没有类继承，需要翻译为接口和组合
- Go 的命名规范（首字母大小写决定可见性）需要特别注意

### 练习二

**思路**：使用正则表达式匹配 Python 的 `def` 和 `class` 关键字，在这些边界处切分文件。每个块需要包含前面的 import 语句，以确保翻译时有完整的上下文。

**答案**：

```typescript
interface CodeChunk {
  imports: string;
  body: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'module-level';
}

function splitPythonBySemantics(
  code: string,
  maxLines: number = 200
): CodeChunk[] {
  const lines = code.split('\n');
  const chunks: CodeChunk[] = [];

  // 提取 import 块
  const importLines: string[] = [];
  let importEndLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      importLines.push(lines[i]);
      importEndLine = i;
    } else if (trimmed && !trimmed.startsWith('#')) {
      break;
    }
  }
  const importContext = importLines.join('\n');

  // 查找语义边界（def 和 class）
  const boundaries: { line: number; type: 'function' | 'class' }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(async\s+)?def\s+/.test(trimmed)) {
      boundaries.push({ line: i, type: 'function' });
    } else if (/^class\s+/.test(trimmed)) {
      boundaries.push({ line: i, type: 'class' });
    }
  }

  // 按边界切分
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line : lines.length;
    const body = lines.slice(start, end).join('\n');

    // 如果块太大，进一步拆分
    if (end - start > maxLines) {
      const subLines = lines.slice(start, end);
      for (let j = 0; j < subLines.length; j += maxLines) {
        const subChunk = subLines.slice(j, j + maxLines).join('\n');
        chunks.push({
          imports: importContext,
          body: subChunk,
          startLine: start + j,
          endLine: start + j + Math.min(maxLines, subLines.length - j),
          type: boundaries[i].type,
        });
      }
    } else {
      chunks.push({
        imports: importContext,
        body,
        startLine: start,
        endLine: end,
        type: boundaries[i].type,
      });
    }
  }

  // 处理 import 之前的模块级代码（如常量定义）
  if (boundaries.length > 0 && boundaries[0].line > importEndLine + 1) {
    const moduleCode = lines.slice(importEndLine + 1, boundaries[0].line).join('\n');
    if (moduleCode.trim()) {
      chunks.unshift({
        imports: importContext,
        body: moduleCode,
        startLine: importEndLine + 1,
        endLine: boundaries[0].line,
        type: 'module-level',
      });
    }
  }

  return chunks;
}
```

**要点**：
- import 块必须作为上下文注入每个 chunk
- `class` 定义应作为一个整体块，不要在 class 中间切分
- 超大函数需要二次切分，但要尽量在逻辑边界处（如空行）切分

# 第2课：文档解析——PDF、Markdown、TXT、网页内容

> **课程定位**：把各种格式的文档变成可处理的文本
> **前置知识**：第 1 课 RAG 概念
> **预计时长**：40 分钟

---

## 场景引入

你接手了一个知识库项目，用户上传了各种格式的文档：技术文档是 Markdown、产品手册是 PDF、还有一堆会议记录是 TXT。你兴致勃勃地把所有文件直接丢进切分器，结果发现：PDF 里提取出来的文本全是乱序的，表格数据变成了乱码，Markdown 的代码块被切碎了，TXT 文件的中文全部变成了问号。文档解析看起来简单，但它是 RAG 链路中最容易出问题的环节——解析质量差，后面的一切优化都是白搭。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解文档解析在 RAG 中的位置
2. 从 PDF、Markdown、TXT 中提取文本
3. 处理各种格式的特殊问题（表格、图片、代码块）
4. 为后续的文本切分准备好干净的文本

---

## 一、文档解析的位置

```
RAG 的索引阶段：

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ 文档上传  │───→│ 文档解析  │───→│ 文本切分  │───→│ 向量化   │
  │ PDF/MD   │    │ 提取文本  │    │ chunking │    │embedding │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
                   ↑
                   本课重点
```

---

## 二、Markdown 解析

### 2.1 Markdown 的特点

```
Markdown 是最容易处理的格式：

  - 纯文本，结构清晰
  - 标题层级明确（# ## ###）
  - 代码块有标记（```）
  - 列表、表格有固定语法

挑战：
  - 需要保留结构信息（标题层级）
  - 需要处理代码块（不要切碎）
  - 需要处理表格（保留语义）
```

### 2.2 基础解析

```typescript
// lib/parsers/markdown.ts
import fs from 'fs'

interface ParsedDocument {
  content: string
  metadata: {
    filename: string
    type: 'markdown'
    headings: { level: number; text: string }[]
  }
}

export function parseMarkdown(filePath: string): ParsedDocument {
  const content = fs.readFileSync(filePath, 'utf-8')
  const filename = filePath.split('/').pop() || filePath

  // 提取标题结构
  const headings: { level: number; text: string }[] = []
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    })
  }

  return {
    content,
    metadata: {
      filename,
      type: 'markdown',
      headings,
    },
  }
}
```

### 2.3 保留结构信息

```typescript
// 为每个段落添加标题上下文
function addHeadingContext(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  const headingStack: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()

      // 更新标题栈
      headingStack.length = level - 1
      headingStack[level - 1] = text

      result.push(line)
    } else if (line.trim()) {
      // 非空行，添加当前标题上下文
      const context = headingStack.filter(Boolean).join(' > ')
      if (context) {
        result.push(`[上下文: ${context}] ${line}`)
      } else {
        result.push(line)
      }
    }
  }

  return result.join('\n')
}
```

---

## 三、TXT 解析

### 3.1 纯文本的特点

```
TXT 是最简单的格式：

  - 纯文本，无格式标记
  - 可能有各种编码（UTF-8、GBK）
  - 没有明确的结构信息

挑战：
  - 需要检测编码
  - 需要识别段落边界
  - 没有标题等结构信息
```

### 3.2 编码处理

```typescript
// lib/parsers/txt.ts
import fs from 'fs'

function detectEncoding(filePath: string): BufferEncoding {
  const buffer = fs.readFileSync(filePath)

  // 检查 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8'
  }

  // 简单判断：如果包含大量非 ASCII 字符，可能是 GBK
  // 实际项目中可以使用 chardet 库
  try {
    const text = buffer.toString('utf-8')
    // 如果 UTF-8 解码后没有乱码，就用 UTF-8
    if (!text.includes('�')) {
      return 'utf-8'
    }
  } catch {
    // UTF-8 解码失败，尝试 GBK
  }

  return 'gbk'
}

export function parseTxt(filePath: string): ParsedDocument {
  const encoding = detectEncoding(filePath)
  const content = fs.readFileSync(filePath, encoding)
  const filename = filePath.split('/').pop() || filePath

  return {
    content,
    metadata: {
      filename,
      type: 'txt',
      encoding,
    },
  }
}
```

---

## 四、PDF 解析

### 4.1 PDF 的复杂性

```
PDF 是最复杂的格式：

  - 不是纯文本，是"页面描述语言"
  - 文字位置是绝对坐标
  - 可能包含图片、表格、水印
  - 双栏布局、页眉页脚

挑战：
  - 需要从坐标中重建文本顺序
  - 需要处理表格（识别行列）
  - 需要跳过页眉页脚
  - 扫描版 PDF 需要 OCR
```

### 4.2 使用 pdf-parse

```typescript
// lib/parsers/pdf.ts
import fs from 'fs'

// npm install pdf-parse
import pdf from 'pdf-parse'

interface ParsedDocument {
  content: string
  metadata: {
    filename: string
    type: 'pdf'
    pages: number
    info: any
  }
}

export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath)
  const data = await pdf(buffer)
  const filename = filePath.split('/').pop() || filePath

  return {
    content: data.text,
    metadata: {
      filename,
      type: 'pdf',
      pages: data.numpages,
      info: data.info,
    },
  }
}
```

### 4.3 处理 PDF 的特殊问题

```typescript
// 清理 PDF 提取的文本
function cleanPdfText(text: string): string {
  return text
    // 移除多余空白
    .replace(/\s+/g, ' ')
    // 移除页眉页脚模式（如 "Page 1 of 10"）
    .replace(/Page \d+ of \d+/gi, '')
    // 修复断行（PDF 中经常把一个句子断成多行）
    .replace(/([a-z,])\n([a-z])/g, '$1 $2')
    // 移除页码
    .replace(/^\d+$/gm, '')
    .trim()
}
```

---

## 五、统一的解析接口

### 5.1 设计统一接口

```typescript
// lib/parsers/index.ts
import { parseMarkdown } from './markdown'
import { parseTxt } from './txt'
import { parsePdf } from './pdf'

export interface ParsedDocument {
  content: string
  metadata: {
    filename: string
    type: string
    [key: string]: any
  }
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = filePath.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'md':
    case 'markdown':
      return parseMarkdown(filePath)

    case 'txt':
      return parseTxt(filePath)

    case 'pdf':
      return await parsePdf(filePath)

    default:
      throw new Error(`不支持的文件格式: ${ext}`)
  }
}
```

### 5.2 文件上传 API

```typescript
// app/api/upload/route.ts
import { NextRequest } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { parseDocument } from '@/lib/parsers'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return Response.json({ error: '没有上传文件' }, { status: 400 })
    }

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadDir = path.join(process.cwd(), 'uploads')
    const filePath = path.join(uploadDir, file.name)
    await writeFile(filePath, buffer)

    // 解析文档
    const document = await parseDocument(filePath)

    return Response.json({
      success: true,
      document: {
        filename: document.metadata.filename,
        type: document.metadata.type,
        contentLength: document.content.length,
      },
    })

  } catch (error) {
    console.error('上传失败:', error)
    return Response.json({ error: '上传失败' }, { status: 500 })
  }
}
```

---

## 六、质量检查

### 6.1 解析质量检查

```typescript
function validateParsedDocument(doc: ParsedDocument): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // 检查内容是否为空
  if (!doc.content || doc.content.trim().length === 0) {
    issues.push('文档内容为空')
  }

  // 检查内容长度
  if (doc.content.length < 100) {
    issues.push('文档内容过短，可能解析失败')
  }

  // 检查乱码
  const garbledRatio = (doc.content.match(/�/g) || []).length / doc.content.length
  if (garbledRatio > 0.01) {
    issues.push('文档可能存在编码问题（乱码）')
  }

  // 检查重复内容
  const lines = doc.content.split('\n')
  const uniqueLines = new Set(lines)
  if (uniqueLines.size < lines.length * 0.5) {
    issues.push('文档包含大量重复内容')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
```

---

## 动手练习

### 练习一：解析 Markdown

1. 找一个包含标题、列表、代码块的 Markdown 文件
2. 用本课的代码解析它
3. 验证标题结构是否正确提取

### 练习二：处理不同编码

1. 创建一个 GBK 编码的 TXT 文件
2. 用本课的代码解析它
3. 验证中文是否正确显示

### 练习三：PDF 解析

1. 找一个 PDF 文件
2. 用 pdf-parse 解析
3. 观察提取的文本质量

---

## 参考答案

### 练习一

**思路**：Markdown 解析的核心是提取标题结构并保留层级关系。用正则匹配 `#` 开头的行即可提取标题，同时需要处理代码块中的 `#` 不被误识别为标题。

**答案**：

```typescript
import fs from 'fs'

interface ParsedDocument {
  content: string
  metadata: {
    filename: string
    type: 'markdown'
    headings: { level: number; text: string }[]
  }
}

function parseMarkdown(filePath: string): ParsedDocument {
  const content = fs.readFileSync(filePath, 'utf-8')
  const filename = filePath.split('/').pop() || filePath

  const headings: { level: number; text: string }[] = []
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    })
  }

  return {
    content,
    metadata: {
      filename,
      type: 'markdown',
      headings,
    },
  }
}

// 测试
const doc = parseMarkdown('./test.md')
console.log('标题结构:')
doc.metadata.headings.forEach(h => {
  const indent = '  '.repeat(h.level - 1)
  console.log(`${indent}${'#'.repeat(h.level)} ${h.text}`)
})
```

验证方法：找一个包含三级标题的 Markdown 文件，运行上面的代码，检查输出的标题层级是否与原文一致。

**要点**：
- 正则 `^(#{1,6})\s+(.+)$` 能匹配 1-6 级标题，`^` 确保匹配行首
- 需要注意代码块中的 `#` 可能被误匹配，生产环境应先排除代码块区域
- 常见错误：没有用 `^` 锚定行首，导致行中间的 `#` 被误匹配

### 练习二

**思路**：GBK 编码的文件如果直接用 UTF-8 读取会出现乱码。关键是先检测编码，再用对应编码读取。可以先用 BOM 检测，再尝试 UTF-8 解码看是否有替换字符 `�`。

**答案**：

```typescript
import fs from 'fs'

function detectEncoding(filePath: string): BufferEncoding {
  const buffer = fs.readFileSync(filePath)

  // 检查 UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8'
  }

  // 尝试 UTF-8 解码
  try {
    const text = buffer.toString('utf-8')
    if (!text.includes('�')) {
      return 'utf-8'
    }
  } catch {
    // UTF-8 解码失败
  }

  return 'gbk'
}

// 创建 GBK 编码的测试文件（需要用 Node.js 的 iconv-lite）
// npm install iconv-lite
import iconv from 'iconv-lite'

const testContent = '这是一段中文测试内容，包含标点符号。'
const gbkBuffer = iconv.encode(testContent, 'gbk')
fs.writeFileSync('./test-gbk.txt', gbkBuffer)

// 解析
const encoding = detectEncoding('./test-gbk.txt')
console.log(`检测到编码: ${encoding}`)

const content = fs.readFileSync('./test-gbk.txt', encoding)
console.log(`解析结果: ${content}`)
console.log(`中文是否正确: ${content === testContent}`)
```

**要点**：
- BOM 检测是最快的方式，但不是所有 UTF-8 文件都有 BOM
- 尝试解码后检查 `�` 替换字符是一种简单的启发式判断
- 常见错误：直接用 `fs.readFileSync(path, 'utf-8')` 读取所有文件，遇到 GBK 文件会乱码

### 练习三

**思路**：PDF 解析的核心挑战是从"页面描述语言"中重建文本顺序。pdf-parse 对纯文字 PDF 效果不错，但对扫描版 PDF 会返回空文本。解析后需要做质量检查。

**答案**：

```typescript
import fs from 'fs'
import pdf from 'pdf-parse'

async function parseAndValidatePdf(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const data = await pdf(buffer)

  console.log(`文件: ${filePath}`)
  console.log(`页数: ${data.numpages}`)
  console.log(`提取文本长度: ${data.text.length}`)

  // 质量检查
  const issues: string[] = []

  if (data.text.trim().length === 0) {
    issues.push('文本为空，可能是扫描版 PDF，需要 OCR')
  } else if (data.text.length < 50 * data.numpages) {
    issues.push(`文本过少（平均每页 <50 字符），可能解析不完整`)
  }

  const garbledRatio = (data.text.match(/�/g) || []).length / data.text.length
  if (garbledRatio > 0.01) {
    issues.push('存在乱码，可能是编码问题')
  }

  if (issues.length > 0) {
    console.log('质量问题:')
    issues.forEach(i => console.log(`  ⚠️ ${i}`))
  } else {
    console.log('✅ 解析质量正常')
  }

  // 清理文本
  const cleaned = data.text
    .replace(/\s+/g, ' ')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/^\d+$/gm, '')
    .trim()

  console.log(`清理后文本长度: ${cleaned.length}`)
  console.log(`前 200 字符: ${cleaned.slice(0, 200)}`)

  return { content: cleaned, pages: data.numpages, issues }
}

parseAndValidatePdf('./test.pdf')
```

**要点**：
- pdf-parse 对纯文字 PDF 效果好，但对扫描版（图片）PDF 会返回空文本
- 解析后必须做质量检查：空文本、文本过少、乱码比例
- 常见错误：不做质量检查直接入库，导致检索时返回垃圾结果；忽略页眉页脚污染

---

## 常见误区

1. **直接用 pdf-parse 提取所有 PDF**：pdf-parse 对纯文字 PDF 效果不错，但遇到扫描版 PDF（图片）会返回空文本。生产环境需要先判断 PDF 类型，扫描版走 OCR 流程。

2. **忽略页眉页脚和水印**：PDF 中的页眉、页脚、水印文字会被一起提取出来，如果不清理，这些重复内容会污染检索结果。需要在解析阶段识别并移除。

3. **把 Markdown 的代码块当普通文本切分**：代码块是一个语义单元，如果在切分时把它从中间切断，会导致代码不完整，检索到的片段也无法作为有效的代码参考。

4. **不做解析质量检查就直接入库**：解析出空文本、乱码文本、重复文本直接入库，会导致检索时返回垃圾结果。应该在解析后加一个质量校验步骤。

---

## 工程建议

1. **为每种格式写独立的 parser**：不要用一个万能函数处理所有格式。Markdown、TXT、PDF 的解析逻辑差异很大，独立 parser 更容易维护和测试。通过统一接口（`parseDocument`）对外暴露。

2. **解析后立即做质量校验**：检查内容是否为空、是否过短（<100 字符）、是否包含大量乱码、是否重复率过高。不通过的文档标记为 `error` 状态，不让它进入后续流程。

3. **保留结构元数据**：解析阶段就要提取标题层级、页码、章节名等结构信息，这些元数据在后续的切分和引用溯源中都会用到。如果解析时丢弃了，后面很难补回来。

4. **PDF 优先用文本提取，OCR 作为 fallback**：先尝试文本提取，如果提取出的内容过少（<50 字符/页），再走 OCR 流程。OCR 成本高、速度慢，不应该作为默认路径。

---

## 小结

本课的核心要点：

1. **Markdown 最易处理**：结构清晰，保留标题信息
2. **TXT 需要注意编码**：UTF-8、GBK 等
3. **PDF 最复杂**：需要重建文本顺序，处理表格和图片
4. **统一接口**：不同格式通过统一接口处理
5. **质量检查**：解析后需要验证内容质量

---

**下一课**: [第3课：Chunk 策略——大小、重叠、标题层级和元数据](./03-Chunk策略大小重叠与元数据.md)

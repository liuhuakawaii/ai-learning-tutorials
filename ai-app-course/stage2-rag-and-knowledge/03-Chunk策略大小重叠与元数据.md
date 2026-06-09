# 第3课：Chunk 策略——大小、重叠、标题层级和元数据

> **课程定位**：文本切分是 RAG 质量的关键
> **前置知识**：第 2 课的文档解析
> **预计时长**：45 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要文本切分
2. 设计合适的 chunk 大小
3. 使用重叠避免信息丢失
4. 为每个 chunk 添加元数据
5. 实现多种切分策略

---

## 一、为什么需要切分

### 1.1 检索的粒度问题

```
不切分的问题：

  一篇 10 页的文档
  用户问："退款政策是什么？"

  如果把整篇文档作为检索结果：
    - 太长，包含大量无关信息
    - 模型的上下文窗口被浪费
    - 检索精度低（相似度被稀释）

  如果切成小段：
    - 检索到的片段精确相关
    - 模型可以专注于回答
    - 引用更精确
```

### 1.2 切分的目标

```
┌─────────────────────────────────────────────────────────────────┐
│                    文本切分的目标                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 每个 chunk 是一个语义完整的单元                              │
│     - 一个段落、一个小节、一个要点                               │
│     - 不要把一个句子切成两半                                     │
│                                                                 │
│  ✅ chunk 大小适中                                               │
│     - 太小：缺少上下文，检索不准确                               │
│     - 太大：包含太多无关信息，浪费 token                          │
│                                                                 │
│  ✅ chunk 之间有适当的重叠                                       │
│     - 避免重要信息刚好在边界被切断                               │
│                                                                 │
│  ✅ 每个 chunk 有元数据                                          │
│     - 来源文件、位置、标题上下文                                 │
│     - 用于引用和过滤                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、Chunk 大小的选择

### 2.1 大小的影响

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chunk 大小的影响                               │
├───────────────┬──────────────────────┬──────────────────────────┤
│  大小          │  优点                │  缺点                    │
├───────────────┼──────────────────────┼──────────────────────────┤
│  太小 (<100)  │  检索精确             │  缺少上下文               │
│               │                      │  语义不完整               │
├───────────────┼──────────────────────┼──────────────────────────┤
│  适中 (200-1000)│ 检索准确            │  平衡的选择               │
│               │  上下文充足           │                          │
├───────────────┼──────────────────────┼──────────────────────────┤
│  太大 (>2000) │  上下文完整           │  检索不精确               │
│               │                      │  包含无关信息             │
└───────────────┴──────────────────────┴──────────────────────────┘

推荐：200-1000 个字符（中文）或 100-500 个 token（英文）
```

### 2.2 根据场景调整

```typescript
// 不同场景的 chunk 大小建议
const CHUNK_SIZES = {
  // 技术文档：段落通常较短，精确检索更重要
  technical: { min: 200, max: 500 },

  // 学术论文：段落较长，需要更多上下文
  academic: { min: 500, max: 1000 },

  // 对话记录：每轮对话是独立单元
  conversation: { min: 100, max: 300 },

  // 代码文件：函数或类是合适单元
  code: { min: 50, max: 500 },
}
```

---

## 三、重叠（Overlap）

### 3.1 为什么需要重叠

```
没有重叠的情况：

  Chunk 1: "...退款需要在购买后 30 天内申请。"
  Chunk 2: "申请时需要提供订单号和购买凭证。"
                                    ↑
                          重要信息被切断了！

  用户问："退款需要什么条件？"
  检索到 Chunk 1：只有 30 天的限制
  检索到 Chunk 2：只有需要凭证的要求
  两个 chunk 都不完整！

有重叠的情况：

  Chunk 1: "...退款需要在购买后 30 天内申请。申请时需要提供..."
  Chunk 2: "...申请时需要提供订单号和购买凭证。"
                                    ↑
                          重叠部分保证信息完整

  检索到 Chunk 1：完整信息 ✓
```

### 3.2 重叠比例

```typescript
// 重叠比例建议
const OVERLAP_RATIOS = {
  // 无重叠：适用于独立的段落或列表项
  none: 0,

  // 小重叠：适用于大多数场景
  small: 0.1,  // 10% 重叠

  // 中等重叠：适用于信息密集的文档
  medium: 0.2,  // 20% 重叠

  // 大重叠：适用于需要高精度的场景
  large: 0.3,  // 30% 重叠
}
```

---

## 四、元数据设计

### 4.1 元数据的价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chunk 元数据                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  基础元数据                                                      │
│  ├── filename: 来源文件名                                        │
│  ├── page: 所在页码（PDF）                                       │
│  ├── position: 在文档中的位置                                    │
│  └── timestamp: 创建时间                                         │
│                                                                 │
│  结构元数据                                                      │
│  ├── heading: 所属标题                                           │
│  ├── headingLevel: 标题层级                                      │
│  ├── section: 所属章节                                           │
│  └── parentHeadings: 父级标题链                                  │
│                                                                 │
│  内容元数据                                                      │
│  ├── type: 内容类型（paragraph/list/code/table）                 │
│  ├── language: 语言                                              │
│  └── charCount: 字符数                                           │
│                                                                 │
│  用途：                                                          │
│  ├── 引用溯源：告诉用户答案来自哪里                               │
│  ├── 过滤检索：只在特定文件或章节中搜索                           │
│  └── 排序优化：优先显示标题下的内容                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 元数据结构

```typescript
interface ChunkMetadata {
  // 来源信息
  source: {
    filename: string
    type: 'markdown' | 'pdf' | 'txt'
    page?: number
  }

  // 位置信息
  position: {
    start: number
    end: number
    index: number
  }

  // 结构信息
  structure: {
    heading?: string
    headingLevel?: number
    section?: string
    parentHeadings: string[]
  }

  // 内容信息
  content: {
    type: 'paragraph' | 'list' | 'code' | 'table' | 'heading'
    charCount: number
  }
}
```

---

## 五、实现文本切分

### 5.1 基础切分器

```typescript
// lib/chunkers/base.ts
interface Chunk {
  content: string
  metadata: ChunkMetadata
}

interface ChunkerOptions {
  chunkSize: number
  overlap: number
}

export function chunkText(
  text: string,
  options: ChunkerOptions = { chunkSize: 500, overlap: 50 }
): string[] {
  const { chunkSize, overlap } = options
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))

    // 移动到下一个位置（考虑重叠）
    start = end - overlap

    // 避免死循环
    if (start >= text.length) break
  }

  return chunks
}
```

### 5.2 按段落切分

```typescript
// lib/chunkers/paragraph.ts
export function chunkByParagraph(
  text: string,
  maxChunkSize: number = 500
): string[] {
  // 按双换行符分割段落
  const paragraphs = text.split(/\n\s*\n/)

  const chunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // 如果当前 chunk 加上新段落超过限制，先保存当前 chunk
    if (currentChunk && (currentChunk.length + trimmed.length) > maxChunkSize) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }

    // 如果单个段落就超过限制，需要进一步切分
    if (trimmed.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      // 递归切分长段落
      chunks.push(...chunkText(trimmed, { chunkSize: maxChunkSize, overlap: 50 }))
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
```

### 5.3 按标题切分（Markdown）

```typescript
// lib/chunkers/markdown.ts
interface MarkdownChunk {
  content: string
  heading: string
  headingLevel: number
  parentHeadings: string[]
}

export function chunkMarkdown(content: string): MarkdownChunk[] {
  const lines = content.split('\n')
  const chunks: MarkdownChunk[] = []

  let currentHeading = ''
  let currentLevel = 0
  const headingStack: { level: number; text: string }[] = []
  let currentContent = ''

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      // 遇到新标题，保存之前的内容
      if (currentContent.trim()) {
        chunks.push({
          content: currentContent.trim(),
          heading: currentHeading,
          headingLevel: currentLevel,
          parentHeadings: headingStack.map(h => h.text),
        })
      }

      // 更新标题栈
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()

      // 移除同级及更低级别的标题
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, text })

      currentHeading = text
      currentLevel = level
      currentContent = ''
    } else {
      currentContent += line + '\n'
    }
  }

  // 保存最后一块
  if (currentContent.trim()) {
    chunks.push({
      content: currentContent.trim(),
      heading: currentHeading,
      headingLevel: currentLevel,
      parentHeadings: headingStack.map(h => h.text),
    })
  }

  return chunks
}
```

### 5.4 递归切分（推荐）

```typescript
// lib/chunkers/recursive.ts
export function recursiveChunk(
  text: string,
  options: {
    chunkSize: number
    overlap: number
    separators?: string[]
  }
): string[] {
  const {
    chunkSize,
    overlap,
    separators = ['\n\n', '\n', '。', '，', ' ', '']
  } = options

  // 如果文本足够短，直接返回
  if (text.length <= chunkSize) {
    return [text]
  }

  // 尝试用不同的分隔符切分
  for (const separator of separators) {
    if (!separator) {
      // 最后一层：按字符切分
      return chunkText(text, { chunkSize, overlap })
    }

    const parts = text.split(separator)

    if (parts.length > 1) {
      const chunks: string[] = []
      let currentChunk = ''

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        if (currentChunk && (currentChunk.length + trimmed.length + separator.length) > chunkSize) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }

        if (trimmed.length > chunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = ''
          }
          // 递归切分长段落
          chunks.push(...recursiveChunk(trimmed, {
            chunkSize,
            overlap,
            separators: separators.slice(1),
          }))
        } else {
          currentChunk += (currentChunk ? separator : '') + trimmed
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }

      return chunks
    }
  }

  return [text]
}
```

---

## 六、完整的切分流程

```typescript
// lib/chunker.ts
import { chunkMarkdown } from './chunkers/markdown'
import { recursiveChunk } from './chunkers/recursive'

interface Chunk {
  content: string
  metadata: {
    source: string
    heading?: string
    headingLevel?: number
    parentHeadings: string[]
    position: { start: number; end: number }
    index: number
  }
}

export function chunkDocument(
  content: string,
  filename: string,
  fileType: string
): Chunk[] {
  let rawChunks: { content: string; heading?: string; headingLevel?: number; parentHeadings?: string[] }[]

  // 根据文件类型选择切分策略
  if (fileType === 'markdown') {
    rawChunks = chunkMarkdown(content)
  } else {
    // 其他文件类型使用递归切分
    const texts = recursiveChunk(content, {
      chunkSize: 500,
      overlap: 50,
    })
    rawChunks = texts.map(t => ({ content: t }))
  }

  // 添加元数据
  let position = 0
  return rawChunks.map((chunk, index) => {
    const start = position
    const end = start + chunk.content.length
    position = end

    return {
      content: chunk.content,
      metadata: {
        source: filename,
        heading: chunk.heading,
        headingLevel: chunk.headingLevel,
        parentHeadings: chunk.parentHeadings || [],
        position: { start, end },
        index,
      },
    }
  })
}
```

---

## 七、切分质量检查

```typescript
function validateChunks(chunks: Chunk[]): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // 检查是否有空 chunk
  const emptyChunks = chunks.filter(c => !c.content.trim())
  if (emptyChunks.length > 0) {
    issues.push(`有 ${emptyChunks.length} 个空 chunk`)
  }

  // 检查 chunk 大小分布
  const sizes = chunks.map(c => c.content.length)
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length
  const tooSmall = sizes.filter(s => s < 50).length
  const tooLarge = sizes.filter(s => s > 2000).length

  if (tooSmall > chunks.length * 0.1) {
    issues.push(`${tooSmall} 个 chunk 过小（<50字符）`)
  }
  if (tooLarge > 0) {
    issues.push(`${tooLarge} 个 chunk 过大（>2000字符）`)
  }

  // 检查内容完整性
  const incompleteChunks = chunks.filter(c => {
    const lastChar = c.content.trim().slice(-1)
    return !['。', '！', '？', '.', '!', '?', '）', ')', '"', '"'].includes(lastChar)
  })
  if (incompleteChunks.length > chunks.length * 0.3) {
    issues.push(`${incompleteChunks.length} 个 chunk 可能不完整`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
```

---

## 动手练习

### 练习一：对比切分策略

用同一个文档，分别用以下策略切分：
1. 固定大小切分（500 字符，无重叠）
2. 固定大小切分（500 字符，50 字符重叠）
3. 按段落切分

对比切分结果的质量。

### 练习二：实现 Markdown 切分器

1. 找一个有 3 级标题的 Markdown 文件
2. 用本课的 Markdown 切分器处理
3. 验证每个 chunk 的 heading 和 parentHeadings 是否正确

### 练习三：设计元数据

为你的 RAG 系统设计元数据结构：
1. 需要哪些字段？
2. 如何用于引用溯源？
3. 如何用于过滤检索？

---

## 小结

本课的核心要点：

1. **切分是 RAG 质量的关键**：太小缺上下文，太大不精确
2. **推荐 200-1000 字符**：根据场景调整
3. **重叠避免信息丢失**：10-20% 的重叠比例
4. **元数据支撑引用和过滤**：来源、标题、位置
5. **递归切分是通用方案**：先尝试大分隔符，再逐步细化

---

## 下一课预告

下一课我们将学习 Embeddings 和向量检索：如何把文本转换成向量，如何计算相似度，如何存储和检索向量。

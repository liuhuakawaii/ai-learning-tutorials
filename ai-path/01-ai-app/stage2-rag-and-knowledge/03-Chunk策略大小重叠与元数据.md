# 第3课：Chunk 策略——从一个检索失败说起

> **前置知识**：第 2 课的文档解析
> **预计时长**：40 分钟

## 一个真实的检索失败

你的 RAG 系统上线了。用户问"退款需要什么条件"，AI 回答"30 天内申请"。看起来没问题，但文档原文是：

> 退款需要在购买后 30 天内申请。申请时需要提供订单号和购买凭证。

AI 漏掉了"购买凭证"。去查原因：退款政策刚好被切在两个 chunk 的边界上——第一个 chunk 有"30 天"但没有"购买凭证"，第二个 chunk 有"购买凭证"但没有"30 天"的上下文。

问题不在模型，不在 Prompt，在切分。

## 实验：同一份文档，三种切法

拿一份真实的退款政策文档，分别用三种策略切分，观察效果。

```typescript
const testDoc = `
# 退款政策

## 适用范围
本政策适用于所有在本公司购买的商品。退款需在购买后30天内申请，且商品需保持原包装完好。

## 退款流程
申请退款时，需要提供订单号和购买凭证。客服会在3个工作日内审核，审核通过后5个工作日内退款到原支付账户。

## 特殊情况
定制商品不支持退款。预售商品的退款需在发货前申请。如遇节假日，退款时间可能顺延。
`
```

### 策略一：固定大小，无重叠

```typescript
function fixedChunk(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

const result = fixedChunk(testDoc, 80)
result.forEach((c, i) => console.log(`Chunk ${i}: "${c.trim()}"`))
```

结果：很可能把"30天内申请"和"需要提供订单号"切到两个 chunk 里。每个 chunk 都不完整，检索到任何一个都无法回答完整问题。

### 策略二：固定大小，有重叠

```typescript
function fixedChunkWithOverlap(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + size, text.length)
    chunks.push(text.slice(start, end))
    start = end - overlap
    if (start >= text.length) break
  }
  return chunks
}

const result = fixedChunkWithOverlap(testDoc, 80, 20)
```

重叠部分保证"30天内申请"和"购买凭证"可能出现在同一个 chunk 里。但重叠太大会导致同一个信息在多个 chunk 中重复，浪费存储。

### 策略三：按标题切分（推荐）

```typescript
function chunkByHeading(content: string) {
  const sections: { heading: string; content: string }[] = []
  const lines = content.split('\n')
  let currentHeading = ''
  let currentContent = ''

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      if (currentContent.trim()) {
        sections.push({ heading: currentHeading, content: currentContent.trim() })
      }
      currentHeading = match[2]
      currentContent = ''
    } else {
      currentContent += line + '\n'
    }
  }
  if (currentContent.trim()) {
    sections.push({ heading: currentHeading, content: currentContent.trim() })
  }
  return sections
}
```

按标题切分，每个 chunk 是一个完整的语义单元。"退款流程"下的所有内容（包括30天、购买凭证、审核时间）都在同一个 chunk 里。

### 对比结论

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 固定大小无重叠 | 实现简单 | 容易切断语义 | 不推荐 |
| 固定大小+重叠 | 缓解边界问题 | 存储冗余 | 没有明确结构的文档 |
| 按标题切分 | 语义完整 | 依赖文档结构 | Markdown、有标题的文档 |

**核心判断**：优先按语义边界切分。Markdown 按标题、代码按函数、对话按轮次。只有没有明确结构时，才退回按字符数切分。

## Chunk 大小怎么选

没有万能值，但有经验起点：

- **200-500 字符**：技术文档、FAQ，段落短，精确检索更重要
- **500-1000 字符**：学术论文、长文章，需要更多上下文
- **100-300 字符**：对话记录、列表项，每个单元本身很短

判断标准：**每个 chunk 应该能独立回答一个具体问题**。如果 chunk 太小，缺少上下文，模型无法理解；如果 chunk 太大，包含太多无关信息，检索精度下降。

实验验证：对同一份文档用不同 chunk 大小切分，用同一个问题检索，观察 top 3 结果的相关性变化。

## 重叠的作用

重叠解决的是边界问题。没有重叠时，关键信息可能刚好在两个 chunk 的交界处，两边都不完整。

重叠比例建议 10-20%。超过 30% 会导致大量重复内容，存储和检索都会受影响。

但要注意：**重叠是治标，按语义边界切分才是治本**。如果你的文档有清晰的结构（标题、段落），优先用结构切分，不需要重叠。

## 元数据：每个 chunk 必须携带的信息

切分只是第一步。每个 chunk 还需要携带元数据，用于引用溯源和过滤检索：

```typescript
interface ChunkMetadata {
  source: string           // 来源文件名，如 "退款政策.pdf"
  heading?: string         // 所属标题，如 "退款流程"
  parentHeadings: string[] // 父级标题链，如 ["退款政策", "退款流程"]
  position: { start: number; end: number }  // 在原文中的位置
}
```

`parentHeadings` 是引用溯源的核心。用户看到回答中的 [1] 引用，点击后展示"退款政策 > 退款流程 > 第 2.1 节"——没有 parentHeadings 就无法做到这一点。

元数据要在切分阶段就生成，后面很难补回来。

## 递归切分：通用方案

当文档没有明确标题结构时，用递归切分：

```typescript
function recursiveChunk(
  text: string,
  chunkSize: number,
  separators: string[] = ['\n\n', '\n', '。', '，', ' ']
): string[] {
  if (text.length <= chunkSize) return [text]

  for (const sep of separators) {
    if (!sep) return [text.slice(0, chunkSize), ...recursiveChunk(text.slice(chunkSize), chunkSize)]

    const parts = text.split(sep)
    if (parts.length > 1) {
      const chunks: string[] = []
      let current = ''
      for (const part of parts) {
        if (current.length + part.length > chunkSize) {
          if (current) chunks.push(current.trim())
          current = part
        } else {
          current += (current ? sep : '') + part
        }
      }
      if (current.trim()) chunks.push(current.trim())
      return chunks
    }
  }
  return [text]
}
```

逻辑：先尝试用大的分隔符（段落分隔 `\n\n`），如果切出来的 chunk 还是太大，用更小的分隔符（换行 `\n`），再不行用句号、逗号，最后按字符切。

## 练习

用项目中的 `ai-knowledge-workspace` 目录，写一个 `src/lib/chunker.ts`：

1. 实现按标题切分的 Markdown 切分器
2. 为每个 chunk 添加 `source`、`heading`、`parentHeadings` 元数据
3. 用一份真实的 Markdown 文档测试，打印每个 chunk 的元数据

---

## 参考答案

按标题切分器的核心是维护一个标题栈：遇到新标题时保存之前的内容，同时更新栈（移除同级及更低级别的标题）。`parentHeadings` 就是栈中所有标题的文本。

测试时用一份有三级标题的 Markdown 文档（如你自己的课程笔记），验证"PDF 解析"的 `parentHeadings` 是否为 `["RAG 系统设计", "文档解析"]`。

**关键判断**：不要把代码块从中间切断。如果 chunk 内容以 ` ``` ` 开头但没有对应的结束标记，说明切分有误。代码块是语义完整的单元，切碎了检索到也无法运行。

---

**下一课**: [第4课：Embeddings 与向量检索——为什么语义相似的文本能被找到](./04-Embeddings与向量检索.md)

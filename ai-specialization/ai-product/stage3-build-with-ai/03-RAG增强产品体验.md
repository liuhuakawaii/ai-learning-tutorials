# 第3课：RAG 增强产品体验

> **课程定位**：用 RAG 让产品具备知识库能力，从"通用 AI"进化为"懂业务的 AI"
> **前置知识**：了解 RAG 基本概念和 LLM API 调用
> **预计时长**：40 分钟

---

## 场景引入

你做了一个 AI 客服产品，用户问"你们的退货政策是什么"，模型回答"一般商家支持 7 天无理由退货"。这个回答没有错，但完全没用——用户想知道的是这家商家具体的退货流程，不是通用知识。问题出在模型只能用训练数据回答，而你需要它基于用户的私有知识库来回答。这就是 RAG 在产品中的核心价值：让 AI 从"什么都知道一点"变成"对你的业务了如指掌"。

---

## 学习目标

完成本课学习后，你将能够：

1. 在产品中设计和实现完整的 RAG Pipeline
2. 选择合适的文档解析、分块和检索策略
3. 处理 RAG 产品中的常见问题：拒答、幻觉、引用
4. 评估和优化 RAG 的检索质量

---

## 一、RAG 在产品中的定位

### 1.1 RAG 不是功能，是能力层

```
RAG 不是一个用户可以直接感知的功能，
它是让其他功能变强的底层能力：

  没有 RAG：
    用户问 → 模型用通用知识回答 → 回答泛泛而谈

  有 RAG：
    用户问 → 检索相关文档 → 模型基于文档回答 → 回答准确具体

RAG 增强的功能：
  - 知识库问答：基于用户上传的文档回答问题
  - 智能客服：基于产品文档和 FAQ 回答客户问题
  - 文档助手：帮用户在大量文档中找到信息
  - 代码助手：基于项目代码库回答技术问题
```

### 1.2 RAG 的产品价值

```typescript
// RAG 解决的核心问题
const ragValue = {
  // 1. 准确性：回答基于真实文档，不是模型"编"的
  accuracy: '引用文档原文，可验证',

  // 2. 时效性：文档更新后，回答自动更新
  freshness: '不需要重新训练模型，更新文档即可',

  // 3. 私有性：可以基于私有文档回答
  privacy: '数据不需要发给模型训练，只在推理时使用',

  // 4. 可追溯：回答可以引用来源
  traceability: '用户可以验证回答的依据',
}
```

---

## 二、RAG Pipeline 完整实现

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG Pipeline                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  文档处理阶段（离线）                                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ 文档上传 │→│ 文档解析 │→│ 文本分块 │→│ 向量化  │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                              │              │
│                                              ▼              │
│                                         ┌─────────┐        │
│                                         │ 向量数据库│        │
│                                         └─────────┘        │
│                                              ▲              │
│  查询阶段（在线）                            │              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │              │
│  │ 用户提问 │→│ 查询向量化│→│ 相似度检索│←────┘              │
│  └─────────┘  └─────────┘  └─────────┘                    │
│                                              │              │
│                                              ▼              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ 回答展示 │←│ 回答生成 │←│ Prompt组装│←│ 结果排序 │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 文档解析

```typescript
// services/document-parser.ts
export interface ParsedDocument {
  content: string
  metadata: {
    filename: string
    fileType: string
    pageCount?: number
    parsedAt: string
  }
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'pdf':
      return parsePDF(file)
    case 'md':
    case 'txt':
      return parseText(file)
    case 'docx':
      return parseDocx(file)
    case 'csv':
    case 'xlsx':
      return parseSpreadsheet(file)
    default:
      throw new Error(`不支持的文件类型: ${ext}`)
  }
}

// PDF 解析
async function parsePDF(file: File): Promise<ParsedDocument> {
  const buffer = await file.arrayBuffer()
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(Buffer.from(buffer))

  return {
    content: data.text,
    metadata: {
      filename: file.name,
      fileType: 'pdf',
      pageCount: data.numpages,
      parsedAt: new Date().toISOString(),
    },
  }
}

// Markdown 解析
async function parseText(file: File): Promise<ParsedDocument> {
  const text = await file.text()

  return {
    content: text,
    metadata: {
      filename: file.name,
      fileType: file.name.split('.').pop()!,
      parsedAt: new Date().toISOString(),
    },
  }
}
```

### 2.3 文本分块策略

```typescript
// services/chunking.ts
export interface Chunk {
  content: string
  metadata: {
    documentId: string
    chunkIndex: number
    startChar: number
    endChar: number
    headers?: string[]  // 所属的标题层级
  }
}

// 递归字符分块：按段落 → 句子 → 字符逐级拆分
export function recursiveChunk(
  text: string,
  options: {
    chunkSize?: number    // 每块最大字符数
    overlap?: number      // 重叠字符数
    separators?: string[] // 分隔符优先级
  } = {}
): string[] {
  const {
    chunkSize = 500,
    overlap = 50,
    separators = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? '],
  } = options

  if (text.length <= chunkSize) {
    return [text]
  }

  // 找到能将文本切成两半的分隔符
  const separator = separators.find(sep => text.includes(sep))
  if (!separator) {
    // 没有分隔符，硬切
    return [text.slice(0, chunkSize), ...recursiveChunk(text.slice(chunkSize - overlap), options)]
  }

  const parts = text.split(separator)
  const chunks: string[] = []
  let currentChunk = ''

  for (const part of parts) {
    if (currentChunk.length + part.length + separator.length <= chunkSize) {
      currentChunk += (currentChunk ? separator : '') + part
    } else {
      if (currentChunk) chunks.push(currentChunk)
      currentChunk = part
    }
  }
  if (currentChunk) chunks.push(currentChunk)

  // 对仍然过长的块递归处理
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize ? recursiveChunk(chunk, { ...options, separators: separators.slice(1) }) : [chunk]
  )
}

// 带元数据的分块（保留标题上下文）
export function chunkWithMetadata(
  text: string,
  documentId: string,
  options?: { chunkSize?: number; overlap?: number }
): Chunk[] {
  const rawChunks = recursiveChunk(text, options)
  let offset = 0

  return rawChunks.map((content, index) => {
    const startChar = offset
    offset += content.length
    return {
      content,
      metadata: {
        documentId,
        chunkIndex: index,
        startChar,
        endChar: offset,
      },
    }
  })
}
```

### 2.4 向量化与检索

```typescript
// services/embedding.ts
import { OpenAIEmbeddings } from '@langchain/openai'

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536,
})

// 向量化文本
export async function embedText(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text)
  return result
}

// 批量向量化
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embeddings.embedDocuments(texts)
}

// services/vector-store.ts
export class VectorStore {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  // 存储文档块和向量
  async addDocuments(chunks: Chunk[], vectors: number[][]) {
    const rows = chunks.map((chunk, i) => ({
      content: chunk.content,
      embedding: vectors[i],
      metadata: chunk.metadata,
    }))

    const { error } = await this.supabase.from('documents').insert(rows)
    if (error) throw error
  }

  // 相似度检索
  async search(queryVector: number[], options: {
    topK?: number
    filter?: Record<string, unknown>
    threshold?: number  // 相似度阈值
  } = {}) {
    const { topK = 5, filter, threshold = 0.7 } = options

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryVector,
      match_count: topK,
      filter: filter ?? {},
    })

    if (error) throw error

    // 过滤低相似度结果
    return (data ?? []).filter((item: any) => item.similarity >= threshold)
  }
}
```

### 2.5 Prompt 组装与回答生成

```typescript
// services/rag-answer.ts
export async function generateRAGAnswer(
  question: string,
  retrievedChunks: Array<{ content: string; metadata: any; similarity: number }>,
  options: { model?: string; language?: string } = {}
): Promise<{ answer: string; sources: string[] }> {
  const { model = 'gpt-4o' } = options

  // 组装上下文
  const context = retrievedChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n')

  const prompt = `你是一个知识库问答助手。请基于以下参考资料回答用户的问题。

规则：
1. 只基于参考资料回答，不要使用你的通用知识
2. 如果参考资料中没有相关信息，明确说"根据现有资料无法回答这个问题"
3. 在回答中用 [数字] 标注引用来源
4. 回答要简洁准确

参考资料：
${context}

用户问题：${question}`

  const response = await modelRouter.chat(
    [{ role: 'system', content: prompt }],
    { tier: 'default' }
  )

  // 提取引用来源
  const sources = retrievedChunks.map(chunk => chunk.metadata.filename)

  return {
    answer: response.content,
    sources: [...new Set(sources)],
  }
}
```

---

## 三、RAG 产品的关键设计

### 3.1 拒答机制

不是所有问题都应该回答。当检索结果不相关时，模型应该拒答而不是编造：

```typescript
// 拒答判断
export async function shouldAnswer(
  question: string,
  retrievedChunks: Array<{ similarity: number }>,
  options: { minSimilarity?: number; minChunks?: number } = {}
): Promise<{ shouldAnswer: boolean; reason?: string }> {
  const { minSimilarity = 0.75, minChunks = 1 } = options

  const relevantChunks = retrievedChunks.filter(c => c.similarity >= minSimilarity)

  if (relevantChunks.length < minChunks) {
    return {
      shouldAnswer: false,
      reason: '未找到足够相关的资料，建议换个方式提问或联系人工客服',
    }
  }

  return { shouldAnswer: true }
}
```

### 3.2 引用展示

```typescript
// 带引用的回答展示
function RAGAnswer({ answer, sources }: { answer: string; sources: Source[] }) {
  // 解析回答中的引用标记 [1], [2]...
  const parts = answer.split(/(\[\d+\])/g)

  return (
    <div className="rag-answer">
      <div className="answer-content">
        {parts.map((part, i) => {
          const refMatch = part.match(/\[(\d+)\]/)
          if (refMatch) {
            const refIndex = parseInt(refMatch[1]) - 1
            return (
              <span key={i} className="reference" title={sources[refIndex]?.filename}>
                [{refMatch[1]}]
              </span>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </div>

      <div className="sources">
        <h4>参考来源</h4>
        {sources.map((source, i) => (
          <div key={i} className="source-item">
            <span className="source-index">[{i + 1}]</span>
            <span className="source-name">{source.filename}</span>
            <button onClick={() => source.onPreview}>查看原文</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 3.3 知识库管理

```typescript
// API：文档管理
// app/api/knowledge/route.ts

// 上传文档
export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const userId = formData.get('userId') as string

  // 1. 解析文档
  const parsed = await parseDocument(file)

  // 2. 分块
  const chunks = chunkWithMetadata(parsed.content, file.name)

  // 3. 向量化
  const vectors = await embedDocuments(chunks.map(c => c.content))

  // 4. 存储
  await vectorStore.addDocuments(chunks, vectors)

  // 5. 记录文档元数据
  await db.knowledgeDocument.create({
    data: {
      userId,
      filename: file.name,
      fileType: parsed.metadata.fileType,
      chunkCount: chunks.length,
      status: 'ready',
    },
  })

  return Response.json({ success: true, chunkCount: chunks.length })
}

// 查询知识库
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')!

  const documents = await db.knowledgeDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ documents })
}
```

---

## 四、RAG 质量优化

### 4.1 检索质量指标

```typescript
// 评估 RAG 检索质量
interface RAGEvaluation {
  // 召回率：相关文档被检索到的比例
  recall: number

  // 精确率：检索到的文档中相关文档的比例
  precision: number

  // MRR：第一个相关结果的排名倒数
  mrr: number  // Mean Reciprocal Rank

  // 回答质量
  answerQuality: {
    relevance: number    // 回答与问题的相关性
    faithfulness: number // 回答与检索内容的一致性
    completeness: number // 回答的完整性
  }
}

// 自动评估函数
export async function evaluateRAG(
  testCases: Array<{ question: string; expectedAnswer: string; relevantDocIds: string[] }>
): Promise<RAGEvaluation> {
  let totalRecall = 0
  let totalPrecision = 0
  let totalMRR = 0

  for (const testCase of testCases) {
    const results = await vectorStore.search(await embedText(testCase.question), { topK: 10 })

    // 计算召回率
    const retrievedDocIds = results.map(r => r.metadata.documentId)
    const relevantRetrieved = testCase.relevantDocIds.filter(id => retrievedDocIds.includes(id))
    totalRecall += relevantRetrieved.length / testCase.relevantDocIds.length

    // 计算精确率
    totalPrecision += relevantRetrieved.length / results.length

    // 计算 MRR
    const firstRelevantIndex = results.findIndex(r => testCase.relevantDocIds.includes(r.metadata.documentId))
    totalMRR += firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0
  }

  const n = testCases.length
  return {
    recall: totalRecall / n,
    precision: totalPrecision / n,
    mrr: totalMRR / n,
    answerQuality: { relevance: 0, faithfulness: 0, completeness: 0 },
  }
}
```

### 4.2 常见优化手段

```typescript
const ragOptimizations = {
  // 1. 查询改写：用户的原始问题可能不适合直接检索
  queryRewrite: {
    description: '将口语化的问题改写为更精确的检索查询',
    example: '用户问"这个东西怎么用" → 改写为"产品使用方法和操作步骤"',
  },

  // 2. 混合检索：结合关键词检索和向量检索
  hybridSearch: {
    description: '关键词检索精确匹配，向量检索语义相似，两者结合效果更好',
    implementation: 'BM25 + 向量相似度加权',
  },

  // 3. 重排序：对检索结果进行二次排序
  reranking: {
    description: '用 Cross-Encoder 模型对检索结果重新排序',
    benefit: '比单纯的向量相似度更准确',
  },

  // 4. 分块策略优化
  chunkOptimization: {
    description: '根据文档结构调整分块大小和边界',
    tips: 'Markdown 按标题分块，代码按函数分块，表格整块保留',
  },
}
```

---

## 常见误区

### 误区一：RAG 可以解决所有问题

RAG 适合基于文档的问答，不适合需要推理、计算或实时数据的场景。问"1+1 等于几"不需要 RAG，问"今天天气怎么样"也不需要 RAG。

### 误区二：分块越小越好

分块太小会丢失上下文，模型拿到一个孤立的句子无法理解完整含义。分块太大则检索不够精确。一般推荐 300-800 字符，根据文档类型调整。

### 误区三：向量检索就够了

纯向量检索在精确匹配（如产品型号、编号）上表现不好。生产环境推荐混合检索（向量 + 关键词），两者互补。

### 误区四：检索到就能回答好

检索到相关文档只是第一步，Prompt 的组装方式同样重要。上下文太长模型会"迷路"，太短信息不够。需要在 Prompt 中明确告诉模型"基于这些资料回答，不要编造"。

---

## 工程建议

### 1. 先做 MVP，再优化

第一版 RAG 用最简单的方案：固定大小分块 + 向量检索 + 单次 Prompt。验证产品价值后再投入优化检索质量。

### 2. 建立评估数据集

准备 50-100 个测试问题和期望答案，每次调整分块策略或检索参数后都要跑评估。没有评估就没有优化方向。

### 3. 监控线上拒答率

拒答率过高说明检索质量差或文档覆盖不足，拒答率过低说明模型可能在"硬答"——宁可拒答也不要编造。

### 4. 文档更新要增量同步

不要每次更新文档都重建整个向量库。实现增量更新：新增文档只处理新增部分，修改文档只更新对应块。

---

## 小结

RAG 让 AI 产品从"通用助手"进化为"懂业务的助手"。核心链路是：文档解析 → 分块 → 向量化 → 检索 → 回答生成。产品层面需要关注拒答机制、引用展示、知识库管理和检索质量优化。先做 MVP 验证价值，再逐步优化质量。

---

## 练习

1. **RAG Pipeline 实现**：为你的项目实现一个基础的 RAG Pipeline，支持上传 Markdown 文档并基于文档回答问题。
2. **分块实验**：对同一份文档尝试不同的分块大小（200/500/1000 字符），比较检索结果的质量差异。
3. **拒答测试**：构造 10 个文档中没有答案的问题，验证你的 RAG 系统能否正确拒答。
4. **引用功能**：在回答中实现引用标注，用户点击引用可以查看原文片段。

---

## 参考答案

### 练习一

**思路**：实现一个完整的 RAG Pipeline 需要四个模块：文档解析、文本分块、向量化存储、检索生成。先搭建基础框架，再逐步完善。使用课程中的递归分块策略和 OpenAI Embedding API。

**答案**：

```typescript
// lib/rag/pipeline.ts
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { PromptTemplate } from '@langchain/core/prompts'

export class SimpleRAGPipeline {
  private embeddings: OpenAIEmbeddings
  private llm: ChatOpenAI
  private vectorStore: MemoryVectorStore | null = null

  constructor() {
    this.embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' })
    this.llm = new ChatOpenAI({ model: 'gpt-4o', temperature: 0.3 })
  }

  // 上传并处理文档
  async ingestDocument(content: string, filename: string): Promise<{ chunkCount: number }> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '。', '！', '？', '. ', ' '],
    })

    const chunks = await splitter.createDocuments(
      [content],
      [{ filename }]  // 元数据：来源文件名
    )

    if (!this.vectorStore) {
      this.vectorStore = await MemoryVectorStore.fromDocuments(chunks, this.embeddings)
    } else {
      await this.vectorStore.addDocuments(chunks)
    }

    return { chunkCount: chunks.length }
  }

  // 检索相关文档
  async retrieve(query: string, topK = 3): Promise<Array<{ content: string; filename: string; score: number }>> {
    if (!this.vectorStore) {
      throw new Error('请先上传文档')
    }

    const results = await this.vectorStore.similaritySearchWithScore(query, topK)
    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      filename: doc.metadata.filename,
      score: 1 - score,  // 转为相似度（越高越相关）
    }))
  }

  // 生成回答
  async answer(question: string): Promise<{ answer: string; sources: Array<{ filename: string; snippet: string }> }> {
    const docs = await this.retrieve(question, 3)

    // 拒答逻辑：如果检索结果都不太相关，直接拒答
    const hasRelevantDoc = docs.some(d => d.score > 0.5)
    if (!hasRelevantDoc) {
      return {
        answer: '抱歉，我没有找到与您问题相关的信息。请确认您的问题是否与已上传的文档内容相关。',
        sources: [],
      }
    }

    const context = docs.map((d, i) => `[来源${i + 1}] ${d.filename}\n${d.content}`).join('\n\n')

    const prompt = PromptTemplate.fromTemplate(
      `基于以下参考资料回答用户的问题。如果参考资料中没有相关信息，请明确说明无法回答，不要编造。

参考资料：
{context}

用户问题：{question}

要求：
1. 回答必须基于参考资料，不要使用你的通用知识
2. 在回答中用 [来源N] 标注引用出处
3. 如果参考资料不足以回答问题，说"根据已有资料无法回答"`

    )

    const response = await this.llm.invoke(
      await prompt.format({ context, question })
    )

    return {
      answer: response.content as string,
      sources: docs.map(d => ({ filename: d.filename, snippet: d.content.slice(0, 100) + '...' })),
    }
  }
}
```

**要点**：
- RAG Pipeline 是"离线索引 + 在线检索"的两阶段架构，文档处理是离线的
- MemoryVectorStore 适合开发和演示，生产环境需要持久化的向量数据库
- 拒答逻辑必须有——检索不到相关内容时不要让模型"硬答"

### 练习二

**思路**：对同一份文档分别用 200、500、1000 字符的分块大小处理，然后用相同的查询测试检索质量。评估维度：检索结果的相关性、信息完整性、是否包含答案。

**答案**：

```typescript
// experiments/chunk-size-test.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'

const testDocument = `
# 公司休假制度

## 年假
入职满一年的员工享有 10 天年假，满五年后增至 15 天。年假需提前一周申请，经直属主管审批。当年未休完的年假可结转至次年 3 月底，逾期清零。

## 病假
员工因病请假需提供医院证明。每月累计病假不超过 3 天，无需扣薪。超过 3 天的部分按日薪的 50% 发放。连续病假超过 30 天需提交 HR 部门审核。

## 事假
事假需提前 3 天申请，每月不超过 2 天。事假期间不发放薪资。特殊情况可事后补申请，但需在 3 个工作日内提交。

## 婚假
员工结婚可享受 3 天带薪婚假。需在婚礼前 30 天提交申请，并附上结婚证复印件。

## 产假
女性员工产假为 158 天，男性员工陪产假为 15 天。产假期间薪资按当地社保政策执行。
`

const testQueries = [
  '年假有几天？',
  '病假需要什么材料？',
  '婚假要提前多久申请？',
]

async function testChunkSize(chunkSize: number) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: Math.floor(chunkSize * 0.1),  // 10% 重叠
  })
  const chunks = await splitter.createDocuments([testDocument])
  const store = await MemoryVectorStore.fromDocuments(chunks, new OpenAIEmbeddings())

  console.log(`\n--- 分块大小: ${chunkSize} 字符 (${chunks.length} 块) ---`)

  for (const query of testQueries) {
    const results = await store.similaritySearchWithScore(query, 3)
    console.log(`\n查询: "${query}"`)
    results.forEach(([doc, score], i) => {
      console.log(`  结果${i + 1} (距离: ${score.toFixed(3)}): ${doc.pageContent.slice(0, 80)}...`)
    })
  }
}

await testChunkSize(200)
await testChunkSize(500)
await testChunkSize(1000)
```

**实验结果分析**：

| 分块大小 | 块数 | 优势 | 劣势 |
|---------|------|------|------|
| 200 字符 | ~15 块 | 检索精准，结果与查询高度相关 | 信息碎片化，可能丢失上下文（如"年假天数"和"结转规则"被切到不同块） |
| 500 字符 | ~6 块 | 平衡精准度和完整性，通常是最优选择 | 偶尔会混入不太相关的内容 |
| 1000 字符 | ~3 块 | 信息完整，上下文丰富 | 检索噪声大，可能返回大段不相关内容，增加 Token 消耗 |

**结论**：500 字符是大多数中文文档的最佳起点。如果文档结构清晰（有标题分隔），可以适当增大到 800；如果查询通常很具体（如查某个数字），可以缩小到 300。

**要点**：
- 分块大小不是越大越好——大块意味着检索时噪声多、Token 消耗高
- 重叠（overlap）很重要——没有重叠会导致块边界处的信息丢失
- 最佳分块大小取决于文档类型和查询模式，没有万能值

### 练习三

**思路**：构造 10 个文档中没有答案的问题，测试 RAG 系统是否能正确拒答而不是编造答案。拒答的判断标准：检索结果相关性低于阈值，或模型明确说"无法回答"。

**答案**：

```typescript
// tests/refusal-test.ts
import { SimpleRAGPipeline } from '../lib/rag/pipeline'

const rag = new SimpleRAGPipeline()

// 先上传一份关于"公司休假制度"的文档
await rag.ingestDocument(`
# 公司休假制度
年假：入职满一年 10 天，满五年 15 天。
病假：需医院证明，每月 3 天内不扣薪。
事假：提前 3 天申请，每月不超过 2 天。
`, '休假制度.md')

// 10 个文档中没有答案的问题
const offTopicQuestions = [
  '公司的股票代码是什么？',           // 文档没有公司信息
  'CEO 的年薪是多少？',              // 文档没有薪资信息
  '公司总部在哪里？',                 // 文档没有地址信息
  '竞争对手有哪些？',                 // 文档没有市场信息
  '今年的营收目标是多少？',            // 文档没有财务信息
  '员工食堂在几楼？',                 // 文档没有设施信息
  '公司的融资历史是什么？',            // 文档没有融资信息
  '产品的技术栈是什么？',             // 文档没有技术信息
  '上季度的客户满意度是多少？',        // 文档没有客户数据
  '公司的上市计划是什么？',           // 文档没有战略信息
]

console.log('=== 拒答测试 ===\n')

let correctRefusal = 0
let falseAnswer = 0

for (const question of offTopicQuestions) {
  const { answer } = await rag.answer(question)
  const isRefused = answer.includes('无法回答') || answer.includes('没有找到') || answer.includes('抱歉')

  if (isRefused) {
    correctRefusal++
    console.log(`✅ 正确拒答: "${question}"`)
  } else {
    falseAnswer++
    console.log(`❌ 错误回答: "${question}" → ${answer.slice(0, 60)}...`)
  }
}

console.log(`\n结果: ${correctRefusal}/10 正确拒答, ${falseAnswer}/10 错误回答`)
console.log(`拒答率: ${correctRefusal * 10}%`)
```

**要点**：
- 拒答率应该在 100%（所有无关问题都拒答）——低于 80% 说明拒答机制有问题
- 常见失败模式：模型用通用知识"硬答"了文档中没有的问题
- 拒答的实现方式：先检查检索结果相关性分数，低于阈值直接拒答；或者在 Prompt 中明确要求"如果资料中没有相关信息就说无法回答"

### 练习四

**思路**：在回答生成时保留检索结果的来源信息，在前端展示引用标注，用户点击可查看原文片段。关键是把引用和原文片段关联起来。

**答案**：

```typescript
// lib/rag/citation.ts
export interface Citation {
  id: number
  sourceFile: string
  snippet: string
  relevanceScore: number
}

export interface AnswerWithCitations {
  answer: string
  citations: Citation[]
}

export async function answerWithCitations(
  rag: SimpleRAGPipeline,
  question: string
): Promise<AnswerWithCitations> {
  // 1. 检索相关文档
  const docs = await rag.retrieve(question, 5)

  // 2. 构建引用表
  const citations: Citation[] = docs
    .filter(d => d.score > 0.3)
    .map((d, i) => ({
      id: i + 1,
      sourceFile: d.filename,
      snippet: d.content,
      relevanceScore: d.score,
    }))

  // 3. 如果没有相关文档，直接拒答
  if (citations.length === 0) {
    return {
      answer: '根据已有资料无法回答该问题。',
      citations: [],
    }
  }

  // 4. 带引用上下文生成回答
  const contextWithIds = citations
    .map(c => `[${c.id}] 来源: ${c.sourceFile}\n${c.snippet}`)
    .join('\n\n')

  const llm = new ChatOpenAI({ model: 'gpt-4o', temperature: 0.3 })
  const response = await llm.invoke(
    `基于以下参考资料回答问题。在回答中用 [N] 格式标注引用来源。

参考资料：
${contextWithIds}

问题：${question}

要求：每个关键事实都要标注引用编号 [N]。`
  )

  return {
    answer: response.content as string,
    citations,
  }
}

// 前端引用展示组件
// components/CitationAnswer.tsx
// 在消息气泡中，将 [1] [2] 等替换为可点击的引用标记：
// 点击后展开显示对应的原文片段和来源文件名
```

**要点**：
- 引用编号必须与检索结果一一对应，不能让模型自由编造编号
- 前端展示时把 `[1]` 替换为带样式的可点击标记（如上标数字）
- 引用片段不宜过长——截取 100-200 字符的原文即可，附带来源文件名

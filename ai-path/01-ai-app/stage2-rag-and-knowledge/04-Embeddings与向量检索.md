# 第4课：Embeddings 与向量检索——相似度、召回、过滤

> **课程定位**：理解向量化和相似度检索的核心原理
> **前置知识**：第 3 课的文本切分
> **预计时长**：50 分钟

---

## 场景引入

你把文档切好 chunk 了，现在需要让用户的问题能匹配到相关片段。最直觉的方案是关键词匹配——用户搜"退款"，你就找包含"退款"两个字的 chunk。但用户问的是"怎么退货"，文档里写的是"退款流程"，关键词匹配就失灵了。你需要一种能理解语义相似度的检索方式——把文本变成向量，用数学距离衡量语义接近程度。这就是 Embedding 和向量检索要解决的核心问题。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解什么是 Embedding（向量嵌入）
2. 计算两个向量之间的相似度
3. 使用 OpenAI API 生成 Embedding
4. 实现向量存储和检索
5. 理解 topK、过滤和召回率

---

## 一、什么是 Embedding

### 1.1 一句话理解

```
Embedding = 把文本转换成一组数字（向量）

  "今天天气真好" → [0.12, -0.34, 0.56, ..., 0.78]  （1536 个数字）
  "今天阳光明媚" → [0.11, -0.33, 0.55, ..., 0.77]  （很接近！）
  "我要写代码"   → [-0.45, 0.67, -0.12, ..., 0.23]  （差很远）

核心思想：
  语义相似的文本，向量也相似
  语义不同的文本，向量也不同
```

### 1.2 用地图来理解

```
把文本想象成地图上的点：

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │     天气相关                      编程相关                   │
  │        ●                            ●                       │
  │       ●●●                          ●●●                      │
  │      ●●●●●                        ●●●●●                     │
  │                                                             │
  │     "今天天气真好"              "我要写代码"                  │
  │     "今天阳光明媚"              "JavaScript 很有趣"           │
  │     "明天会下雨"                "React 是前端框架"            │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  语义相似的文本在空间中距离近
  语义不同的文本在空间中距离远
```

### 1.3 向量的维度

```
不同模型的 Embedding 维度：

  OpenAI text-embedding-3-small:  1536 维
  OpenAI text-embedding-3-large:  3072 维
  BERT base:                       768 维
  Sentence-BERT:                   384 维

维度越高：
  - 信息越丰富
  - 计算成本越高
  - 存储空间越大

选择建议：
  - 一般场景用 1536 维够用
  - 高精度场景用 3072 维
  - 边缘设备用 384 维
```

---

## 二、相似度计算

### 2.1 余弦相似度

```
余弦相似度 = 计算两个向量之间的"夹角"

  夹角小 → 相似度高 → 语义接近
  夹角大 → 相似度低 → 语义不同

  值范围：-1 到 1
  1 表示完全相同
  0 表示无关
  -1 表示完全相反
```

### 2.2 实现相似度计算

```typescript
// lib/similarity.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// 使用示例
const vec1 = [0.12, -0.34, 0.56]
const vec2 = [0.11, -0.33, 0.55]
const vec3 = [-0.45, 0.67, -0.12]

console.log(cosineSimilarity(vec1, vec2))  // ~0.99（很相似）
console.log(cosineSimilarity(vec1, vec3))  // ~-0.8（不相似）
```

---

## 三、使用 OpenAI Embedding API

### 3.1 生成 Embedding

```typescript
// lib/embedding.ts
import OpenAI from 'openai'

const openai = new OpenAI()

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}

// 批量生成
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })

  return response.data.map(d => d.embedding)
}
```

### 3.2 Embedding 的成本

```
OpenAI Embedding 价格（示例）：

  text-embedding-3-small: $0.02 / 1M tokens
  text-embedding-3-large: $0.13 / 1M tokens

成本估算：
  100 篇文章，每篇 1000 字 ≈ 100K tokens
  成本 ≈ $0.002（几乎可以忽略）

  但如果你有 100 万篇文档：
  成本 ≈ $20（仍然很低）

  Embedding 的成本远低于生成回答的成本。
```

---

## 四、向量存储

### 4.1 简单的内存存储

```typescript
// lib/vector-store/memory.ts
import { cosineSimilarity } from '../similarity'

interface VectorEntry {
  id: string
  embedding: number[]
  content: string
  metadata: Record<string, any>
}

export class MemoryVectorStore {
  private vectors: VectorEntry[] = []

  // 添加向量
  async add(entry: VectorEntry): Promise<void> {
    this.vectors.push(entry)
  }

  // 批量添加
  async addMany(entries: VectorEntry[]): Promise<void> {
    this.vectors.push(...entries)
  }

  // 搜索最相似的向量
  async search(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: (entry: VectorEntry) => boolean
  ): Promise<(VectorEntry & { similarity: number })[]> {
    let entries = this.vectors

    // 应用过滤
    if (filter) {
      entries = entries.filter(filter)
    }

    // 计算相似度并排序
    const results = entries
      .map(entry => ({
        ...entry,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)

    return results
  }

  // 删除向量
  async delete(ids: string[]): Promise<void> {
    this.vectors = this.vectors.filter(v => !ids.includes(v.id))
  }

  // 清空
  async clear(): Promise<void> {
    this.vectors = []
  }
}
```

### 4.2 使用 pgvector（PostgreSQL）

```typescript
// lib/vector-store/pgvector.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// 初始化表
export async function initVectorTable() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      content TEXT,
      embedding vector(1536),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `)
}

// 添加向量
export async function addVector(
  content: string,
  embedding: number[],
  metadata: Record<string, any>
) {
  await pool.query(
    'INSERT INTO documents (content, embedding, metadata) VALUES ($1, $2, $3)',
    [content, JSON.stringify(embedding), JSON.stringify(metadata)]
  )
}

// 搜索向量
export async function searchVectors(
  queryEmbedding: number[],
  topK: number = 5,
  filter?: Record<string, any>
) {
  let query = `
    SELECT id, content, metadata,
           1 - (embedding <=> $1) as similarity
    FROM documents
  `
  const params: any[] = [JSON.stringify(queryEmbedding)]

  if (filter) {
    query += ` WHERE metadata @> $2`
    params.push(JSON.stringify(filter))
  }

  query += ` ORDER BY embedding <=> $1 LIMIT $${params.length + 1}`
  params.push(topK)

  const result = await pool.query(query, params)
  return result.rows
}
```

---

## 五、完整的 RAG 检索流程

```typescript
// lib/retrieval.ts
import { getEmbedding } from './embedding'
import { MemoryVectorStore } from './vector-store/memory'

const store = new MemoryVectorStore()

// 索引文档
export async function indexDocument(chunks: {
  content: string
  metadata: Record<string, any>
}[]) {
  const embeddings = await getEmbeddings(chunks.map(c => c.content))

  const entries = chunks.map((chunk, i) => ({
    id: `chunk-${Date.now()}-${i}`,
    embedding: embeddings[i],
    content: chunk.content,
    metadata: chunk.metadata,
  }))

  await store.addMany(entries)
}

// 检索
export async function retrieve(
  query: string,
  topK: number = 5,
  filter?: Record<string, any>
) {
  const queryEmbedding = await getEmbedding(query)

  const filterFn = filter
    ? (entry: any) => {
        return Object.entries(filter).every(
          ([key, value]) => entry.metadata[key] === value
        )
      }
    : undefined

  const results = await store.search(queryEmbedding, topK, filterFn)

  return results.map(r => ({
    content: r.content,
    metadata: r.metadata,
    similarity: r.similarity,
  }))
}
```

---

## 六、TopK 和过滤

### 6.1 TopK 的选择

```
TopK = 返回最相似的 K 个结果

  TopK = 1：只返回最相似的 1 个
    优点：精确
    缺点：可能遗漏相关信息

  TopK = 3-5：返回 3-5 个（推荐）
    优点：平衡精确和全面
    缺点：需要更多 token

  TopK = 10+：返回很多
    优点：全面
    缺点：包含太多无关信息，浪费 token

建议：从 TopK = 3 开始，根据效果调整
```

### 6.2 过滤的作用

```typescript
// 过滤示例：只在特定文件中搜索
const results = await retrieve(
  '退款政策是什么',
  5,
  { source: 'customer-service.md' }  // 只在这个文件中搜索
)

// 过滤示例：只搜索特定类型的内容
const results = await retrieve(
  '如何使用 API',
  5,
  { type: 'code' }  // 只搜索代码类型的内容
)
```

---

## 七、召回率与精确率

```
┌─────────────────────────────────────────────────────────────────┐
│                    检索质量指标                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  召回率（Recall）                                                │
│  ├── 所有相关文档中，有多少被检索到了？                           │
│  ├── 召回率 = 检索到的相关文档 / 所有相关文档                     │
│  └── 高召回率 = 不遗漏                                          │
│                                                                 │
│  精确率（Precision）                                             │
│  ├── 检索到的文档中，有多少是相关的？                             │
│  ├── 精确率 = 相关文档 / 检索到的所有文档                         │
│  └── 高精确率 = 不误报                                          │
│                                                                 │
│  通常需要在两者之间权衡：                                        │
│    TopK 小 → 精确率高，召回率低                                  │
│    TopK 大 → 精确率低，召回率高                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：体验 Embedding

1. 用 OpenAI API 对以下文本生成 Embedding：
   - "今天天气真好"
   - "阳光明媚的一天"
   - "JavaScript 编程"
2. 计算它们之间的余弦相似度
3. 验证语义相似的文本确实有更高的相似度

### 练习二：实现向量检索

1. 准备 10 条文本
2. 生成 Embedding 并存入内存向量库
3. 用一个问题检索最相似的 3 条
4. 验证检索结果是否合理

### 练习三：测试 TopK

用同一个问题，分别测试 TopK = 1、3、5、10：
1. 观察返回结果的数量
2. 评估结果的相关性
3. 找到最合适的 TopK 值

---

## 参考答案

### 练习一

**思路**：Embedding 的核心是把文本转换成向量，语义相似的文本向量距离近。通过调用 OpenAI API 生成向量，再用余弦相似度计算距离，可以验证这一原理。

**答案**：

```typescript
import OpenAI from 'openai'

const openai = new OpenAI()

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function main() {
  const texts = [
    '今天天气真好',
    '阳光明媚的一天',
    'JavaScript 编程',
  ]

  const embeddings = await Promise.all(texts.map(getEmbedding))

  console.log('=== 余弦相似度 ===')
  console.log(`"今天天气真好" vs "阳光明媚的一天": ${cosineSimilarity(embeddings[0], embeddings[1]).toFixed(4)}`)
  console.log(`"今天天气真好" vs "JavaScript 编程": ${cosineSimilarity(embeddings[0], embeddings[2]).toFixed(4)}`)
  console.log(`"阳光明媚的一天" vs "JavaScript 编程": ${cosineSimilarity(embeddings[1], embeddings[2]).toFixed(4)}`)
}

main()
```

预期输出：
- "今天天气真好" vs "阳光明媚的一天"：相似度 > 0.85（语义接近）
- "今天天气真好" vs "JavaScript 编程"：相似度 < 0.3（语义不同）
- 验证了语义相似的文本确实有更高的相似度

**要点**：
- 余弦相似度值域为 [-1, 1]，越接近 1 越相似
- 语义相近的文本（天气相关）向量距离近，语义不同的文本（天气 vs 编程）向量距离远
- 常见错误：用欧氏距离代替余弦相似度，当向量模长不一致时结果不准确

### 练习二

**思路**：向量检索的核心流程是：文本 → Embedding → 存储 → 查询向量 → 相似度排序 → 返回 TopK。用内存向量库实现最简单的版本，验证整个链路能跑通。

**答案**：

```typescript
import OpenAI from 'openai'

const openai = new OpenAI()

interface VectorEntry {
  id: string
  embedding: number[]
  content: string
}

// 内存向量库
class MemoryVectorStore {
  private vectors: VectorEntry[] = []

  add(entry: VectorEntry) {
    this.vectors.push(entry)
  }

  search(queryEmbedding: number[], topK: number): { content: string; similarity: number }[] {
    return this.vectors
      .map(v => ({
        content: v.content,
        similarity: cosineSimilarity(queryEmbedding, v.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function main() {
  const store = new MemoryVectorStore()

  // 10 条测试文本
  const documents = [
    'React 是一个用于构建用户界面的 JavaScript 库',
    'Vue.js 是一个渐进式 JavaScript 框架',
    'Python 是一种通用编程语言',
    'Node.js 让 JavaScript 可以在服务器端运行',
    'TypeScript 是 JavaScript 的超集，添加了类型系统',
    'CSS 用于控制网页的样式和布局',
    'Docker 是一个容器化平台，用于打包和部署应用',
    'PostgreSQL 是一个功能强大的关系型数据库',
    'Redis 是一个高性能的内存数据库',
    'Git 是一个分布式版本控制系统',
  ]

  // 批量生成 Embedding
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: documents,
  })

  // 存入向量库
  documents.forEach((doc, i) => {
    store.add({
      id: `doc-${i}`,
      embedding: response.data[i].embedding,
      content: doc,
    })
  })

  // 查询
  const query = '前端框架有哪些？'
  const queryEmbedding = (await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })).data[0].embedding

  const results = store.search(queryEmbedding, 3)

  console.log(`查询: "${query}"`)
  console.log('\nTop 3 结果:')
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.similarity.toFixed(4)}] ${r.content}`)
  })
}

main()
```

预期输出：Top 3 应该包含 React、Vue.js 相关文档，因为它们是前端框架。

**要点**：
- 批量生成 Embedding 比逐条调用效率高 10-50 倍
- 内存向量库适合开发调试，生产环境用 pgvector 或专用向量数据库
- 常见错误：逐条调用 Embedding API，数据量大时性能极差

### 练习三

**思路**：TopK 的选择需要平衡精确率和召回率。TopK 太小可能遗漏信息，太大会引入噪声。通过对比不同 TopK 的结果，找到最佳平衡点。

**答案**：

```typescript
async function testTopK(store: MemoryVectorStore, queryEmbedding: number[]) {
  const topKValues = [1, 3, 5, 10]

  for (const topK of topKValues) {
    const results = store.search(queryEmbedding, topK)
    console.log(`\n=== TopK = ${topK} ===`)
    console.log(`返回 ${results.length} 条结果`)

    // 评估相关性（假设我们手动标记了相关性）
    const relevantThreshold = 0.8
    const relevant = results.filter(r => r.similarity > relevantThreshold)
    const precision = relevant.length / results.length
    const recall = relevant.length / Math.min(topK, 5) // 假设最多 5 条相关

    console.log(`精确率: ${(precision * 100).toFixed(1)}%`)
    console.log(`召回率: ${(recall * 100).toFixed(1)}%`)
    results.forEach((r, i) => {
      const marker = r.similarity > relevantThreshold ? '✅' : '❌'
      console.log(`  ${marker} ${i + 1}. [${r.similarity.toFixed(4)}] ${r.content.slice(0, 50)}`)
    })
  }
}
```

预期结论：
- TopK = 1：精确率最高，但可能遗漏相关信息
- TopK = 3：平衡点，精确率和召回率都较好
- TopK = 10：召回率最高，但包含大量无关内容，浪费 token

推荐从 TopK = 3 开始，根据实际效果调整。

**要点**：
- TopK 小 → 精确率高、召回率低；TopK 大 → 精确率低、召回率高
- 生产环境中，TopK 还受模型上下文窗口限制——塞太多无关内容会稀释有效信息
- 常见错误：盲目设 TopK = 1 以为最精确，实际遗漏了大量相关信息

---

## 常见误区

1. **只用向量检索，不用关键词检索**：向量检索擅长语义匹配，但对精确关键词（如产品型号、错误码、API 名称）的匹配不如关键词检索。生产环境通常需要混合检索（向量 + BM25）来兼顾两者。

2. **TopK 设得太小或太大**：TopK=1 可能遗漏相关信息，TopK=20 会塞入大量无关内容稀释上下文。应该从 TopK=3 开始，根据实际效果逐步调整。

3. **Embedding 模型和查询模型不一致**：索引时用模型 A 生成 embedding，查询时用模型 B，会导致向量空间不匹配，检索效果大幅下降。索引和查询必须使用同一个 embedding 模型。

4. **忽略向量索引的性能**：数据量小时线性搜索没问题，但当 chunk 数量超过 10 万时，必须使用 ANN（近似最近邻）索引（如 HNSW、IVFFlat），否则查询延迟会不可接受。

---

## 工程建议

1. **开发阶段用内存向量库，生产用 pgvector 或专用向量数据库**：内存向量库（如本课的 MemoryVectorStore）适合开发调试，但不支持持久化。pgvector 对已有 PostgreSQL 的项目是最简单的生产方案，不需要额外引入组件。

2. **批量生成 Embedding 而非逐条调用**：OpenAI Embedding API 支持批量输入（最多 2048 条/次），批量调用比逐条调用快 10-50 倍，成本相同。索引阶段一定要用批量接口。

3. **为向量检索加上过滤条件**：不要每次都在全量数据中搜索。支持按文件名、文档类型、时间范围等元数据过滤，可以大幅提高检索精度和速度。

4. **定期重建向量索引**：如果文档频繁增删改，向量库中的数据会变得碎片化。定期重建索引（删除旧向量、重新生成）能保持检索质量。pgvector 的 IVFFlat 索引在数据变化较大时需要 `REINDEX`。

---

## 小结

本课的核心要点：

1. **Embedding = 文本转向量**：语义相似的文本，向量也相似
2. **余弦相似度**：计算两个向量的夹角，值越大越相似
3. **OpenAI API**：`text-embedding-3-small` 是常用的 Embedding 模型
4. **向量存储**：内存存储（开发）、pgvector（生产）
5. **TopK 和过滤**：控制返回结果的数量和范围

---

**下一课**: [第5课：引用与溯源——source、page、section、snippet](./05-引用与溯源.md)

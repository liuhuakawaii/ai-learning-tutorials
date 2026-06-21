# 第4课：Embeddings 与向量检索——相似度、召回、过滤

> **课程定位**：理解向量化和相似度检索的核心原理
> **前置知识**：第 3 课的文本切分
> **预计时长**：50 分钟

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

## 小结

本课的核心要点：

1. **Embedding = 文本转向量**：语义相似的文本，向量也相似
2. **余弦相似度**：计算两个向量的夹角，值越大越相似
3. **OpenAI API**：`text-embedding-3-small` 是常用的 Embedding 模型
4. **向量存储**：内存存储（开发）、pgvector（生产）
5. **TopK 和过滤**：控制返回结果的数量和范围

---

**下一课**: [第5课：引用与溯源——source、page、section、snippet](./05-引用与溯源.md)

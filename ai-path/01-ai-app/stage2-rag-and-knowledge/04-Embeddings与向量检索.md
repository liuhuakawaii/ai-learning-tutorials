# 第4课：Embeddings 与向量检索——为什么"怎么退货"能找到"退款流程"

> **前置知识**：第 3 课的文本切分
> **预计时长**：35 分钟

## 一个反直觉的现象

你把文档切好 chunk 了，现在需要让用户的问题匹配到相关片段。最直觉的方案是关键词匹配——用户搜"退款"，你就找包含"退款"两个字的 chunk。

但用户问的是"怎么退货"，文档里写的是"退款流程"。关键词匹配直接失灵了——"退货"和"退款"是两个不同的词。

然而，如果你用向量检索，"怎么退货"和"退款流程"的相似度会非常高（通常 > 0.85）。为什么两个不同的词会被认为"相似"？

## 向量空间：语义的地图

Embedding 的本质是把文本映射到一个高维空间中的一个点。在这个空间里，**距离代表语义相似度**。

```
想象一个二维地图（实际是 1536 维）：

  天气相关区域                    编程相关区域
     ●                              ●
    ●●●                            ●●●
   ●●●●●                          ●●●●●

  "今天天气真好"                "我要写代码"
  "今天阳光明媚"                "JavaScript 很有趣"
  "明天会下雨"                  "React 是前端框架"
```

"退货"和"退款"在日常语境中几乎总是出现在相似的上下文里，所以它们的向量表示非常接近。这不是关键词匹配，而是**模型从大量文本中学到的语义关联**。

## 动手验证

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
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function main() {
  const texts = ['怎么退货', '退款流程', '今天天气真好']
  const embeddings = await Promise.all(texts.map(getEmbedding))

  console.log(`"怎么退货" vs "退款流程": ${cosineSimilarity(embeddings[0], embeddings[1]).toFixed(4)}`)
  console.log(`"怎么退货" vs "今天天气真好": ${cosineSimilarity(embeddings[0], embeddings[2]).toFixed(4)}`)
}
```

预期结果：
- "怎么退货" vs "退款流程"：> 0.85（语义接近）
- "怎么退货" vs "今天天气真好"：< 0.30（语义不同）

这就是向量检索能工作的原因：**它衡量的是语义距离，不是字面匹配**。

## 余弦相似度

两个向量之间的"夹角"越小，语义越相似。

```
值域：-1 到 1
  1   → 完全相同
  0.8 → 非常相似
  0.5 → 有些相关
  0   → 无关
  -1  → 完全相反
```

实际使用中，相似度 > 0.8 通常表示强相关，0.5-0.8 表示弱相关，< 0.5 通常不相关。但这个阈值取决于你的数据和场景，需要通过实验确定。

## 从文本到向量：Embedding API

```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: '退款需要什么条件',
})
const vector = response.data[0].embedding  // 1536 个数字
```

`text-embedding-3-small` 输出 1536 维向量，成本 $0.02/1M tokens——100 篇 1000 字的文章，embedding 成本不到 $0.002。embedding 的成本远低于生成回答的成本，不用担心。

## 向量检索的完整流程

把上面的知识串起来，一个完整的向量检索流程是：

1. **索引阶段**（离线）：文档 → 切分 → 每个 chunk 生成 embedding → 存入向量库
2. **查询阶段**（在线）：用户问题 → 生成 embedding → 在向量库中找最相似的 chunk → 返回 topK

```typescript
// 索引：批量生成 embedding
const chunks = ['退款需要30天内申请...', '申请时需要提供订单号...']
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunks,
})
// response.data[i].embedding 存入向量库

// 查询：检索最相似的 chunk
const queryEmbedding = await getEmbedding('退款需要什么条件')
// 在向量库中找与 queryEmbedding 余弦相似度最高的 topK 个 chunk
```

## TopK：返回多少个结果

TopK = 3 是一个好的起点。太小（TopK=1）可能遗漏相关信息，太大（TopK=10）会塞入大量无关内容稀释上下文。

实际项目中，通常先用向量检索返回 top 20 个候选，再用更精细的模型（rerank）重排序后取 top 3-5。这个策略在下一课会讲。

## 过滤：缩小搜索范围

向量检索支持元数据过滤。比如只在某个知识库中搜索、只搜索代码类型的内容、只搜索最近更新的文档。

```typescript
const results = await store.search(queryEmbedding, 5, {
  filter: (entry) => entry.metadata.source === '退款政策.pdf'
})
```

过滤能大幅提高精度——如果你知道答案一定在某个文档里，就不要在全量数据中搜索。

## 练习

在 `ai-knowledge-workspace` 中创建 `src/lib/embedding.ts`：

1. 实现 `getEmbedding(text)` 和 `cosineSimilarity(a, b)` 函数
2. 用 5 对文本测试相似度，包括语义相似和语义不同的组合
3. 创建一个简单的内存向量库，实现 `add` 和 `search` 方法

---

## 参考答案

`getEmbedding` 调用 OpenAI Embedding API，`cosineSimilarity` 计算两个向量的余弦相似度。内存向量库就是一个数组，search 时遍历所有向量计算相似度并排序。

测试时注意：embedding 模型索引和查询必须用同一个模型，否则向量空间不匹配，检索效果会大幅下降。

**关键判断**：数据量小时（< 10 万 chunk）线性搜索没问题。超过 10 万时需要用 ANN 索引（HNSW、IVFFlat），否则查询延迟不可接受。开发阶段用内存向量库够用，生产环境用 pgvector 或专用向量数据库。

---

**下一课**: [第5课：引用与溯源——回答必须能回到原文](./05-引用与溯源.md)

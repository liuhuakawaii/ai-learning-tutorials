# 第二课：RAG 工作流

> **课程定位**：在 n8n 中构建文档检索增强生成（RAG）流程
> **前置知识**：了解向量数据库和 Embedding 概念
> **预计时长**：40 分钟

---

## 场景引入

你的产品有 500 页文档，客户经常问重复的问题。你想让 AI 基于文档回答，而不是凭空编造。RAG（Retrieval-Augmented Generation）就是解决方案：先检索相关文档片段，再让 AI 基于这些片段生成回答。

---

## 学习目标

完成本课学习后，你将能够：

1. 构建文档处理和向量化管道
2. 实现语义检索
3. 组装 RAG 提示词
4. 构建完整的 RAG 工作流

---

## 一、RAG 架构

### 1.1 整体流程

```
离线（索引）：
文档 → 分块 → Embedding → 向量数据库

在线（查询）：
问题 → Embedding → 向量检索 → 相关片段 → LLM 生成回答
```

### 1.2 n8n 实现

```
索引工作流：
Webhook/Schedule → 文档读取 → 分块 → OpenAI Embedding → 向量数据库

查询工作流：
Webhook → 问题 Embedding → 向量检索 → 组装 Prompt → OpenAI → 回答
```

---

## 二、文档处理

### 2.1 文档读取

支持多种格式：

| 格式 | 节点 | 说明 |
|------|------|------|
| PDF | Read PDF | 提取文本内容 |
| Markdown | Read Binary File | 直接读取 |
| Google Docs | Google Docs | API 读取 |
| Web | HTTP Request | 抓取网页 |

### 2.2 文本分块

分块策略：

```javascript
// Code 节点：文本分块
const text = $input.first().json.text;
const chunkSize = 500; // 每块 500 字符
const overlap = 50;    // 重叠 50 字符

const chunks = [];
for (let i = 0; i < text.length; i += chunkSize - overlap) {
  const chunk = text.substring(i, i + chunkSize);
  if (chunk.trim()) {
    chunks.push({
      json: {
        content: chunk,
        metadata: {
          source: $input.first().json.source,
          chunk_index: chunks.length,
          start_char: i,
          end_char: Math.min(i + chunkSize, text.length)
        }
      }
    });
  }
}

return chunks;
```

### 2.3 分块策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 固定长度 | 简单 | 可能切断句子 | 通用文本 |
| 按段落 | 语义完整 | 块大小不均 | 结构化文档 |
| 按句子 | 粒度细 | 上下文不足 | 精确检索 |
| 递归分割 | 平衡 | 实现复杂 | 生产环境 |

---

## 三、向量化

### 3.1 OpenAI Embedding

```json
{
  "resource": "embedding",
  "model": "text-embedding-3-small",
  "input": "={{ $json.content }}"
}
```

输出：

```json
{
  "data": [
    {
      "embedding": [0.0023, -0.0091, 0.0156, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 100,
    "total_tokens": 100
  }
}
```

### 3.2 向量数据库

常用选择：

| 数据库 | 特点 | n8n 支持 |
|--------|------|---------|
| Pinecone | 全托管、简单 | 内置节点 |
| Qdrant | 开源、高性能 | HTTP Request |
| Weaviate | 开源、GraphQL | HTTP Request |
| Supabase pgvector | PostgreSQL 扩展 | PostgreSQL 节点 |

### 3.3 存储到向量数据库

Pinecone 示例：

```json
{
  "resource": "vector",
  "operation": "upsert",
  "namespace": "docs",
  "vectors": {
    "values": [
      {
        "id": "={{ $json.metadata.chunk_id }}",
        "values": "={{ $json.embedding }}",
        "metadata": {
          "content": "={{ $json.content }}",
          "source": "={{ $json.metadata.source }}"
        }
      }
    ]
  }
}
```

---

## 四、语义检索

### 4.1 查询向量化

```
用户问题 → OpenAI Embedding → 问题向量
```

### 4.2 向量检索

Pinecone 查询：

```json
{
  "resource": "vector",
  "operation": "query",
  "vector": "={{ $json.question_embedding }}",
  "topK": 5,
  "namespace": "docs",
  "includeMetadata": true
}
```

返回最相似的 5 个文档片段。

### 4.3 检索后处理

```javascript
// Code 节点：组装上下文
const results = $input.first().json.matches;
const question = $input.first().json.question;

const context = results
  .map((r, i) => `[${i + 1}] ${r.metadata.content}`)
  .join('\n\n');

const prompt = `基于以下参考资料回答用户问题。如果参考资料中没有相关信息，请说明。

参考资料：
${context}

用户问题：${question}

回答：`;

return [{ json: { prompt, context_count: results.length } }];
```

---

## 五、完整 RAG 工作流

### 5.1 索引流程

```
Webhook（上传文档）
    ↓
Read PDF / Read File
    ↓
Code（文本分块）
    ↓
Loop（逐块向量化）
    ↓
OpenAI Embedding
    ↓
Pinecone（存储向量）
```

### 5.2 查询流程

```
Webhook（用户提问）
    ↓
OpenAI Embedding（问题向量化）
    ↓
Pinecone（语义检索，Top 5）
    ↓
Code（组装 RAG Prompt）
    ↓
OpenAI Chat（生成回答）
    ↓
返回回答 + 引用来源
```

### 5.3 RAG Prompt 模板

```javascript
const prompt = `你是一个知识库助手。请基于以下参考资料回答用户问题。

规则：
1. 只使用参考资料中的信息回答
2. 如果参考资料中没有相关信息，回答"抱歉，我没有找到相关信息"
3. 在回答末尾标注引用来源（如 [1][2]）
4. 保持回答简洁准确

参考资料：
${context}

用户问题：${question}

回答：`;
```

---

## 六、优化策略

### 6.1 检索优化

| 策略 | 说明 |
|------|------|
| 混合检索 | 向量检索 + 关键词检索 |
| 重排序 | 用 Cross-Encoder 重新排序 |
| 查询扩展 | 改写问题提高召回率 |
| 过滤 | 按元数据过滤（如文档类型、日期） |

### 6.2 分块优化

| 策略 | 说明 |
|------|------|
| 递归分割 | 先按大块分，再按小块分 |
| 语义分块 | 按语义边界分块 |
| 父子块 | 检索小子块，返回父大块 |

### 6.3 生成优化

| 策略 | 说明 |
|------|------|
| 温度控制 | 知识问答用低温度 (0.1-0.3) |
| 强制引用 | 要求标注来源 |
| 不确定性处理 | 无相关信息时明确说明 |

---

## 常见误区

### 误区一："分块越小越好"

太小的块缺乏上下文，检索到也难以理解。一般 300-1000 字符比较合适。

### 误区二："Top K 越多越好"

太多检索结果会引入噪声，增加 Token 消耗。一般 Top 3-5 就够了。

### 误区三："RAG 能解决所有问题"

RAG 适合基于事实的问答。需要推理、计算或实时数据的场景，需要结合其他工具。

---

## 工程建议

1. **先验证检索质量**：在优化生成之前，先确保检索结果相关。
2. **记录检索结果**：方便调试和优化。
3. **监控 Token 成本**：RAG 的 Token 消耗比直接调用 LLM 高。
4. **定期更新索引**：文档变化后需要重新索引。
5. **评估系统效果**：建立测试集，定期评估回答质量。

---

## 小结

- RAG 流程：文档 → 分块 → Embedding → 向量存储 → 检索 → 生成
- 分块策略影响检索质量，需要根据文档特点调整
- 向量数据库存储和检索 Embedding 向量
- RAG Prompt 应该基于检索结果生成，并标注来源
- 优化方向包括检索、分块和生成三个层面

---

## 练习

### 练习一：文档索引

创建一个工作流：读取一个 Markdown 文件，分块后用 OpenAI Embedding 存储到向量数据库。

### 练习二：语义检索

创建一个工作流：接收问题，用 OpenAI Embedding 向量化，从向量数据库检索 Top 3 相关片段。

### 练习三：完整 RAG

组合练习一和练习二，实现完整的 RAG 流程：接收问题 → 检索 → 生成回答 → 返回结果。

---

## 参考答案

### 练习一

**思路**：Read File → Code(分块) → Loop → OpenAI Embedding → Pinecone。

**答案**：

分块代码：
```javascript
const text = $input.first().json.data;
const chunks = [];
const size = 500;
const overlap = 50;

for (let i = 0; i < text.length; i += size - overlap) {
  chunks.push({
    json: {
      content: text.substring(i, i + size),
      chunk_id: `chunk_${chunks.length}`,
      source: 'product-docs.md'
    }
  });
}
return chunks;
```

### 练习二

**思路**：Webhook → OpenAI Embedding → Pinecone Query。

**答案**：

1. Webhook（POST /search）
2. OpenAI Embedding（问题向量化）
3. Pinecone Query（Top 3）
4. Set（格式化结果）

### 练习三

**思路**：组合索引和查询流程。

**答案**：

```
Webhook(提问) → Embedding → Pinecone(检索) → Code(组装Prompt) → OpenAI(生成) → 返回
```

RAG Prompt：
```javascript
const context = $input.first().json.matches
  .map((m, i) => `[${i+1}] ${m.metadata.content}`).join('\n');
const question = $input.first().json.question;

return [{
  json: {
    prompt: `参考资料：\n${context}\n\n问题：${question}\n\n基于资料回答：`
  }
}];
```

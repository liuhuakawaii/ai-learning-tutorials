# Lesson 4: Embedding 模型选型

```
╔══════════════════════════════════════════════════════════════╗
║  Stage 1 · Lesson 4                                         ║
║  Embedding 模型选型                                          ║
║  预计时间: 50 分钟                                            ║
╚══════════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 [Lesson 1-3](./01-RAG架构回顾.md)
- 了解向量和相似度计算的基本概念
- 了解深度学习基础（可选）

## 场景引入

你的 RAG 系统上线后，用户反馈"搜出来的内容经常答非所问"。排查发现，用户问"怎么提升网站加载速度"，系统检索到的却是"服务器负载均衡"的文档——两者确实相关，但用户要的是前端优化方案。问题出在 Embedding 模型上：你用的通用英文模型对中文技术领域的语义理解不够精准，"加载速度"和"负载均衡"在向量空间中距离太近。选对 Embedding 模型，是 RAG 检索质量的基石。

## 学习目标

完成本课后，你将能够：

1. **理解 Embedding 架构**：了解 Sentence-BERT、对比学习等核心架构
2. **评估 Embedding 模型**：使用 MTEB 等基准评测模型质量
3. **选择合适的模型**：在 OpenAI、Cohere、BGE、GTE 等模型中做出选择
4. **微调 Embedding 模型**：了解领域适配微调的基本方法

---

## 1. 什么是 Embedding？

Embedding 是将文本转换为高维向量的过程，向量能够捕捉文本的语义信息。

```
┌─────────────────────────────────────────────────────────────┐
│                    Embedding 原理                            │
│                                                             │
│  输入文本                     输出向量                        │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ "什么是RAG?"    │────────▶│ [0.12, -0.34,   │           │
│  └─────────────────┘         │  0.56, 0.78,    │           │
│                              │  ... , -0.23]   │           │
│                              └─────────────────┘           │
│                                    维度: 768/1024/1536      │
│                                                             │
│  语义相似的文本，向量距离更近:                                 │
│                                                             │
│  "什么是RAG?"          ──────┐                              │
│                              ├──▶ 距离近 (相似)              │
│  "RAG是什么意思?"      ──────┘                              │
│                                                             │
│  "什么是机器学习?"      ──────┐                              │
│                              ├──▶ 距离远 (不相似)            │
│  "今天天气怎么样?"      ──────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Embedding 模型架构

### 2.1 Sentence-BERT 架构

```
┌─────────────────────────────────────────────────────────────┐
│                 Sentence-BERT 架构                           │
│                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                  │
│  │  输入    │   │  BERT   │   │  池化   │   ┌─────────┐    │
│  │  文本    │──▶│  编码器 │──▶│  层    │──▶│  向量   │    │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘    │
│                                                             │
│  池化策略:                                                   │
│  - [CLS] token: 使用第一个 token 的表示                      │
│  - Mean pooling: 所有 token 的平均值（推荐）                 │
│  - Max pooling: 所有 token 的最大值                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 对比学习训练

```
┌─────────────────────────────────────────────────────────────┐
│                    对比学习原理                               │
│                                                             │
│  训练目标: 相似样本距离近，不相似样本距离远                    │
│                                                             │
│  正样本对:                                                   │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ "什么是RAG?" │────────▶│ "RAG的定义"  │  距离: 近       │
│  └──────────────┘         └──────────────┘                 │
│                                                             │
│  负样本对:                                                   │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ "什么是RAG?" │────────▶│ "今天天气"   │  距离: 远       │
│  └──────────────┘         └──────────────┘                 │
│                                                             │
│  损失函数: InfoNCE / Triplet Loss / Contrastive Loss        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 主流 Embedding 模型

### 3.1 OpenAI Embeddings

```python
"""
OpenAI Embedding 模型使用
支持 text-embedding-3-small 和 text-embedding-3-large
"""

from openai import OpenAI
import numpy as np

client = OpenAI()

def get_openai_embeddings(
    texts: list[str],
    model: str = "text-embedding-3-small",
    dimensions: int | None = None
) -> list[list[float]]:
    """
    获取 OpenAI Embeddings
    
    Args:
        texts: 文本列表
        model: 模型名称
            - text-embedding-3-small: 1536 维, 性价比高
            - text-embedding-3-large: 3072 维, 精度更高
        dimensions: 输出维度（支持降维，节省存储）
    
    Returns:
        向量列表
    """
    # OpenAI API 限制每次最多 2048 条
    batch_size = 2048
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        kwargs = {"input": batch, "model": model}
        if dimensions:
            kwargs["dimensions"] = dimensions
        
        response = client.embeddings.create(**kwargs)
        embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(embeddings)
    
    return all_dimensions


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """计算余弦相似度"""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))


# 使用示例
texts = [
    "什么是RAG?",
    "RAG是什么意思?",
    "今天天气怎么样?"
]

embeddings = get_openai_embeddings(texts, model="text-embedding-3-small")

# 计算相似度
sim_1_2 = cosine_similarity(embeddings[0], embeddings[1])
sim_1_3 = cosine_similarity(embeddings[0], embeddings[2])

print(f""什么是RAG?" vs "RAG是什么意思?": {sim_1_2:.4f}")
print(f""什么是RAG?" vs "今天天气怎么样?": {sim_1_3:.4f}")
# 预期: sim_1_2 > sim_1_3
```

### 3.2 Cohere Embed v3

```python
"""
Cohere Embed v3 模型使用
支持多语言和多种输入类型
"""

import cohere
import numpy as np

co = cohere.Client("YOUR_API_KEY")

def get_cohere_embeddings(
    texts: list[str],
    model: str = "embed-multilingual-v3.0",
    input_type: str = "search_document",
    embedding_types: list[str] | None = None
) -> dict:
    """
    获取 Cohere Embeddings
    
    Args:
        texts: 文本列表
        model: 模型名称
            - embed-english-v3.0: 英文专用
            - embed-multilingual-v3.0: 多语言支持
            - embed-english-light-v3.0: 轻量版
        input_type: 输入类型
            - "search_document": 用于索引文档
            - "search_query": 用于查询
            - "classification": 用于分类
            - "clustering": 用于聚类
        embedding_types: 输出类型 ["float", "int8", "ubinary"]
    
    Returns:
        包含多种格式的 embedding 字典
    """
    if embedding_types is None:
        embedding_types = ["float"]
    
    response = co.embed(
        texts=texts,
        model=model,
        input_type=input_type,
        embedding_types=embedding_types,
        truncate="END"  # 超长文本自动截断
    )
    
    return {
        "embeddings": response.embeddings,
        "texts": texts,
        "model": model
    }


# 使用示例
texts = [
    "什么是RAG?",
    "RAG是什么意思?",
    "今天天气怎么样?"
]

# 索引时使用 search_document
doc_embeddings = get_cohere_embeddings(
    texts[:2],
    input_type="search_document"
)

# 查询时使用 search_query
query_embedding = get_cohere_embeddings(
    [texts[0]],
    input_type="search_query"
)

print(f"模型: {doc_embeddings['model']}")
print(f"向量维度: {len(doc_embeddings['embeddings'][0])}")
```

### 3.3 BGE 模型（中文推荐）

```python
"""
BGE (BAAI General Embedding) 模型使用
中文场景下的优秀开源模型
"""

from sentence_transformers import SentenceTransformer
import numpy as np

class BGEEmbedder:
    """
    BGE Embedding 模型封装
    
    推荐模型:
    - BAAI/bge-large-zh-v1.5: 中文大模型, 1024 维
    - BAAI/bge-base-zh-v1.5: 中文基础模型, 768 维
    - BAAI/bge-small-zh-v1.5: 中文小模型, 512 维
    - BAAI/bge-m3: 多语言模型, 1024 维
    """
    
    def __init__(
        self,
        model_name: str = "BAAI/bge-large-zh-v1.5",
        device: str = "cpu",
        normalize_embeddings: bool = True
    ):
        self.model = SentenceTransformer(model_name, device=device)
        self.normalize = normalize_embeddings
        
        # BGE 模型建议添加查询前缀
        self.query_prefix = "为这个句子生成表示以用于检索中文文档："
    
    def encode_documents(
        self,
        texts: list[str],
        batch_size: int = 32,
        show_progress: bool = True
    ) -> np.ndarray:
        """
        编码文档（用于索引）
        
        Args:
            texts: 文档文本列表
            batch_size: 批处理大小
        
        Returns:
            文档向量矩阵
        """
        return self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            normalize_embeddings=self.normalize
        )
    
    def encode_queries(
        self,
        queries: list[str],
        batch_size: int = 32
    ) -> np.ndarray:
        """
        编码查询（用于检索）
        
        BGE 模型建议为查询添加前缀，以区分文档和查询
        """
        # 添加查询前缀
        prefixed_queries = [self.query_prefix + q for q in queries]
        
        return self.model.encode(
            prefixed_queries,
            batch_size=batch_size,
            normalize_embeddings=self.normalize
        )
    
    def similarity(
        self,
        embeddings1: np.ndarray,
        embeddings2: np.ndarray
    ) -> np.ndarray:
        """计算相似度矩阵"""
        from sentence_transformers import util
        return util.cos_sim(embeddings1, embeddings2)


# 使用示例
embedder = BGEEmbedder(model_name="BAAI/bge-large-zh-v1.5")

# 索引文档
documents = [
    "RAG（检索增强生成）是一种将外部知识与LLM结合的技术",
    "向量数据库用于存储和检索高维向量",
    "Python 是一种流行的编程语言"
]

doc_embeddings = embedder.encode_documents(documents)
print(f"文档向量形状: {doc_embeddings.shape}")

# 查询
query = "什么是RAG技术?"
query_embedding = embedder.encode_queries([query])

# 计算相似度
similarities = embedder.similarity(query_embedding, doc_embeddings)
print(f"\n查询: {query}")
for i, (doc, sim) in enumerate(zip(documents, similarities[0])):
    print(f"  文档 {i+1}: {sim:.4f} - {doc[:30]}...")
```

### 3.4 GTE 模型

```python
"""
GTE (General Text Embeddings) 模型使用
阿里巴巴通义千问团队开源的 Embedding 模型
"""

from sentence_transformers import SentenceTransformer
import numpy as np

class GTEEmbedder:
    """
    GTE Embedding 模型封装
    
    推荐模型:
    - Alibaba-NLP/gte-large-zh: 中文大模型, 1024 维
    - Alibaba-NLP/gte-base-zh: 中文基础模型, 768 维
    - Alibaba-NLP/gte-Qwen2-1.5B-instruct: 大模型版本
    """
    
    def __init__(
        self,
        model_name: str = "Alibaba-NLP/gte-large-zh",
        device: str = "cpu",
        normalize_embeddings: bool = True,
        max_length: int = 8192  # GTE 支持长文本
    ):
        self.model = SentenceTransformer(model_name, device=device)
        self.normalize = normalize_embeddings
        self.max_length = max_length
    
    def encode(
        self,
        texts: list[str],
        batch_size: int = 32,
        is_query: bool = False
    ) -> np.ndarray:
        """
        编码文本
        
        Args:
            texts: 文本列表
            batch_size: 批处理大小
            is_query: 是否为查询（GTE 不需要区分）
        
        Returns:
            向量矩阵
        """
        return self.model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=self.normalize,
            show_progress_bar=True
        )
    
    def encode_long_text(
        self,
        text: str,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> np.ndarray:
        """
        编码长文本（滑动窗口 + 平均池化）
        
        Args:
            text: 长文本
            chunk_size: 窗口大小
            chunk_overlap: 重叠大小
        
        Returns:
            文本向量
        """
        # 按字符切分
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start = end - chunk_overlap
        
        # 编码所有块
        chunk_embeddings = self.encode(chunks)
        
        # 平均池化
        return np.mean(chunk_embeddings, axis=0)


# 使用示例
embedder = GTEEmbedder(model_name="Alibaba-NLP/gte-large-zh")

# 编码普通文本
texts = ["什么是RAG?", "RAG是什么意思?"]
embeddings = embedder.encode(texts)

# 编码长文本
long_text = "这是一篇很长的技术文档..." * 100
long_embedding = embedder.encode_long_text(long_text)

print(f"普通向量维度: {embeddings.shape[1]}")
print(f"长文本向量维度: {long_embedding.shape[0]}")
```

### 3.5 sentence-transformers 通用用法

```python
"""
sentence-transformers 通用用法
支持几乎所有开源 Embedding 模型
"""

from sentence_transformers import SentenceTransformer, util
import numpy as np

def create_embedder(
    model_name: str = "BAAI/bge-large-zh-v1.5",
    device: str = "cpu"
) -> SentenceTransformer:
    """
    创建 Sentence Transformer 模型
    
    常用模型:
    - 中文: BAAI/bge-large-zh-v1.5, Alibaba-NLP/gte-large-zh
    - 英文: all-MiniLM-L6-v2, all-mpnet-base-v2
    - 多语言: paraphrase-multilingual-MiniLM-L12-v2
    """
    return SentenceTransformer(model_name, device=device)


def batch_encode(
    model: SentenceTransformer,
    texts: list[str],
    batch_size: int = 32,
    show_progress: bool = True
) -> np.ndarray:
    """批量编码文本"""
    return model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=show_progress,
        normalize_embeddings=True
    )


def semantic_search(
    model: SentenceTransformer,
    query: str,
    corpus: list[str],
    top_k: int = 5
) -> list[dict]:
    """
    语义搜索
    
    Args:
        model: Embedding 模型
        query: 查询文本
        corpus: 文档语料库
        top_k: 返回前 k 个结果
    
    Returns:
        搜索结果列表
    """
    # 编码
    query_embedding = model.encode(query, normalize_embeddings=True)
    corpus_embeddings = model.encode(corpus, normalize_embeddings=True)
    
    # 计算相似度
    scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
    
    # 排序
    top_results = np.argsort(scores.numpy())[::-1][:top_k]
    
    results = []
    for idx in top_results:
        results.append({
            "text": corpus[idx],
            "score": float(scores[idx]),
            "index": int(idx)
        })
    
    return results


# 使用示例
model = create_embedder("BAAI/bge-large-zh-v1.5")

corpus = [
    "RAG（检索增强生成）是一种将外部知识与LLM结合的技术",
    "向量数据库用于存储和检索高维向量",
    "Python 是一种流行的编程语言",
    "机器学习是人工智能的核心子领域",
    "深度学习使用多层神经网络进行学习"
]

results = semantic_search(model, "什么是RAG?", corpus, top_k=3)

print("搜索结果:")
for r in results:
    print(f"  [{r['score']:.4f}] {r['text']}")
```

---

## 4. 模型对比

| 模型 | 维度 | MTEB 中文 | 价格 | 特点 | 推荐场景 |
|------|------|-----------|------|------|----------|
| **text-embedding-3-small** | 1536 | - | $0.02/1M tokens | 性价比高 | 通用英文场景 |
| **text-embedding-3-large** | 3072 | - | $0.13/1M tokens | 精度高 | 高精度英文场景 |
| **Cohere embed-v3** | 1024 | - | $0.1/1M tokens | 多语言支持好 | 多语言场景 |
| **BGE-large-zh** | 1024 | 64.5 | 免费 | 中文优化 | 中文场景首选 |
| **BGE-base-zh** | 768 | 62.0 | 免费 | 平衡性能 | 中文轻量场景 |
| **BGE-M3** | 1024 | 66.1 | 免费 | 多语言+稀疏 | 多语言+混合检索 |
| **GTE-large-zh** | 1024 | 65.8 | 免费 | 长文本支持 | 长文档场景 |
| **GTE-Qwen2** | 1536 | 67.2 | 免费 | 大模型 | 高精度中文场景 |
| **all-MiniLM-L6-v2** | 384 | - | 免费 | 速度快 | 英文轻量场景 |
| **paraphrase-multilingual** | 384 | - | 免费 | 多语言 | 多语言轻量场景 |

**选型建议：**
- 中文生产环境 → BGE-large-zh 或 GTE-large-zh
- 中文高精度 → GTE-Qwen2-1.5B-instruct
- 英文场景 → text-embedding-3-small（API）或 all-MiniLM-L6-v2（本地）
- 多语言场景 → BGE-M3 或 Cohere embed-v3
- 预算有限 → 开源模型本地部署

---

## 5. 常见误区

```
┌─────────────────────────────────────────────────────────────┐
│                    常见错误 TOP 5                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ 错误 1: 文档和查询使用相同的编码函数                      │
│     ✓ 正确: BGE 等模型需要为查询添加前缀                     │
│                                                             │
│  ❌ 错误 2: 不做向量归一化                                   │
│     ✓ 正确: 设置 normalize_embeddings=True                   │
│                                                             │
│  ❌ 错误 3: 忽略模型的输入长度限制                            │
│     ✓ 正确: 超长文本需要分块编码后平均                        │
│                                                             │
│  ❌ 错误 4: 直接用 API 模型的成本估算                        │
│     ✓ 正确: 考虑索引和查询的 token 总量                      │
│                                                             │
│  ❌ 错误 5: 不测试就上生产                                   │
│     ✓ 正确: 在自己的数据集上评测模型效果                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 工程建议

1. **先评估再选型**：不要盲目选择排行榜第一的模型。准备 50-100 组你业务领域的真实查询-文档对，用 Recall@10 评估候选模型在你的数据上的实际表现。
2. **文档编码和查询编码要区分**：BGE 等模型建议为查询添加前缀以区分文档和查询的编码方式。在生产环境中，索引时用 `encode_documents`，查询时用 `encode_queries`，不要混用。
3. **考虑推理延迟和成本的权衡**：大模型精度高但推理慢、成本高。对于延迟敏感的在线场景，可以先用小模型（如 bge-small-zh）做粗筛，再用大模型对 Top-K 结果精排。
4. **向量归一化是必做项**：无论选择哪个模型，都建议在编码后做 L2 归一化。这样余弦相似度和点积等价，可以使用更高效的点积检索，同时避免向量尺度差异导致的排序偏差。

---

## 7. 本课总结

```
┌─────────────────────────────────────────────────────────────┐
│                      Lesson 4 总结                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Embedding 原理:                                          │
│     - 将文本转换为高维向量                                   │
│     - 语义相似的文本，向量距离近                              │
│     - 支持余弦相似度、欧氏距离等度量                          │
│                                                             │
│  ✅ 主流模型:                                                │
│     - OpenAI: text-embedding-3-small/large                  │
│     - Cohere: embed-multilingual-v3.0                       │
│     - BGE: bge-large-zh-v1.5 (中文首选)                     │
│     - GTE: gte-large-zh (长文本支持)                        │
│                                                             │
│  ✅ 选型原则:                                                │
│     - 中文场景 → BGE/GTE                                    │
│     - 英文场景 → OpenAI/MiniLM                              │
│     - 多语言 → BGE-M3/Cohere                                │
│     - 预算有限 → 开源模型本地部署                            │
│                                                             │
│  ✅ 最佳实践:                                                │
│     - 区分文档编码和查询编码                                 │
│     - 做向量归一化                                           │
│     - 在自己的数据上评测                                     │
│     - 考虑成本和延迟                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 练习题

### 练习 1：模型对比评测
准备 10 组中文问答对，分别使用 BGE-large-zh 和 text-embedding-3-small 计算相似度，对比两个模型在中文语义理解上的差异。

### 练习 2：长文本编码
实现一个函数，能够处理超过模型最大长度的文本，使用滑动窗口 + 平均池化的方式生成向量，并测试不同窗口大小对结果的影响。

### 练习 3：领域微调方案设计
假设你要为医疗领域构建 RAG 系统，设计一个 Embedding 模型微调方案，包括：训练数据准备、损失函数选择、评估指标设计。

---

## 下一课

👉 [Lesson 5: 向量数据库对比](./05-向量数据库对比.md)

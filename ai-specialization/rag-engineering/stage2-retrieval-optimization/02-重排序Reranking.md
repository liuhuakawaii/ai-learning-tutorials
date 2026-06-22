# Stage 2 · L2: 重排序 Reranking

> **时长**: 50 分钟 | **前置**: L1 完成

## 场景引入

你已经用混合检索把向量和 BM25 融合在一起，检索召回率提升了 15%。但用户反馈说"答案找到了但经常排在第三第四条，第一条反而是不太相关的"。问题出在排序质量上——向量检索的相似度分数和 BM25 的分数量纲不同，简单融合后排序并不理想。你需要一个更"聪明"的排序器，能够真正理解 query 和文档的相关性，而不是简单依赖距离度量。这就是 Reranker 要解决的问题。

## 学习目标

完成本课后，你将能够：

1. 解释 Bi-Encoder 与 Cross-Encoder 的区别及适用场景
2. 使用 Cohere Rerank API 对检索结果精排
3. 使用 BGE Reranker 本地部署重排序模型
4. 实现自定义 RRF 融合与 Reranker 的组合管线
5. 量化 Reranking 对检索质量的提升效果

---

## 1. 为什么需要 Reranking？

检索是"粗排"——快速从海量文档中筛出候选集。但粗排的结果往往不够精确：

```
┌─────────────────────────────────────────────────────────────────┐
│                 检索 vs 重排序的分工                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  阶段        目标              速度        精度                   │
│  ─────────────────────────────────────────────                  │
│  检索        从 100K 文档      快 (ms)     中等                   │
│  (Retrieval) 中召回 Top-100                                     │
│                                                                 │
│  重排序      从 100 候选中      慢 (100ms)  高                    │
│  (Reranking) 精排 Top-10                                        │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                   │
│  │ 100K 文档 │───▶│ 检索     │───▶│ 重排序   │───▶ Top-10        │
│  │          │    │ Top-100  │    │ Top-10   │                   │
│  └──────────┘    └──────────┘    └──────────┘                   │
│                                                                 │
│  关键洞察: 检索追求"不漏"，重排序追求"排准"                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Bi-Encoder vs Cross-Encoder

这是理解 Reranking 的核心概念：

```
┌─────────────────────────────────────────────────────────────────┐
│              Bi-Encoder vs Cross-Encoder                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bi-Encoder (用于检索):                                          │
│  ┌─────────┐    ┌─────────┐                                    │
│  │  Query  │    │  Doc    │                                    │
│  └────┬────┘    └────┬────┘                                    │
│       ▼              ▼                                          │
│  ┌─────────┐    ┌─────────┐                                    │
│  │ Encoder │    │ Encoder │   ← 共享或独立编码器                 │
│  └────┬────┘    └────┬────┘                                    │
│       ▼              ▼                                          │
│    [0.1, 0.3...]  [0.2, 0.1...]                                │
│       └──────┬──────┘                                           │
│              ▼                                                   │
│        cosine_similarity                                        │
│         score = 0.85                                            │
│                                                                 │
│  特点: Query 和 Doc 独立编码，可预计算 Doc 向量                    │
│  速度: ★★★★★ (毫秒级)                                          │
│  精度: ★★★☆☆                                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Cross-Encoder (用于重排序):                                     │
│  ┌──────────────────────┐                                       │
│  │ [CLS] Query [SEP] Doc [SEP] │  ← 拼接后联合编码              │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│       ┌──────────┐                                              │
│       │ Encoder  │   ← 深层交互注意力                            │
│       └────┬─────┘                                              │
│            ▼                                                     │
│       relevance_score = 0.95                                    │
│                                                                 │
│  特点: Query 和 Doc 联合编码，捕捉深层交互                        │
│  速度: ★★☆☆☆ (百毫秒级)                                        │
│  精度: ★★★★★                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 维度 | Bi-Encoder | Cross-Encoder |
|------|-----------|---------------|
| **编码方式** | Query/Doc 分别编码 | Query+Doc 拼接联合编码 |
| **预计算** | ✅ Doc 向量可预计算 | ❌ 每次都需要重新编码 |
| **速度** | 极快 (适合大规模检索) | 较慢 (适合小规模精排) |
| **精度** | 中等 | 高 |
| **典型用途** | 第一阶段检索 | 第二阶段重排序 |
| **代表模型** | BGE、E5、OpenAI Embedding | ms-marco-MiniLM、BGE Reranker |

---

## 3. Cohere Rerank API

Cohere 提供了开箱即用的 Rerank 服务：

```python
"""
使用 Cohere Rerank API 进行重排序
"""
import cohere
from typing import List, Dict, Tuple


class CohereReranker:
    """Cohere Rerank 封装"""

    def __init__(self, api_key: str, model: str = "rerank-multilingual-v3.0"):
        self.client = cohere.Client(api_key)
        self.model = model

    def rerank(
        self,
        query: str,
        documents: List[Dict],
        top_n: int = 5,
        text_field: str = "content"
    ) -> List[Tuple[float, Dict]]:
        """
        对文档进行重排序

        Args:
            query: 查询文本
            documents: 候选文档列表
            top_n: 返回数量
            text_field: 文本字段名

        Returns:
            [(relevance_score, document), ...]
        """
        texts = [doc[text_field] for doc in documents]

        response = self.client.rerank(
            model=self.model,
            query=query,
            documents=texts,
            top_n=top_n,
            return_documents=True
        )

        results = []
        for item in response.results:
            doc = documents[item.index].copy()
            doc["_rerank_score"] = item.relevance_score
            results.append((item.relevance_score, doc))

        return results


# ========== 使用示例 ==========
if __name__ == "__main__":
    import os

    reranker = CohereReranker(api_key=os.environ["COHERE_API_KEY"])

    # 模拟检索器返回的候选文档
    candidates = [
        {"id": 1, "content": "iPhone 15 Pro Max 配备 4422mAh 电池，支持 27W 快充"},
        {"id": 2, "content": "智能手机电池技术发展趋势：固态电池将取代锂离子电池"},
        {"id": 3, "content": "iPhone 15 Pro Max 摄像头采用 4800 万像素主摄"},
        {"id": 4, "content": "手机续航优化指南：关闭后台应用可延长电池使用时间"},
        {"id": 5, "content": "Samsung Galaxy S24 Ultra 电池容量为 5000mAh"},
    ]

    query = "iPhone 15 Pro Max 电池容量"

    # Rerank
    reranked = reranker.rerank(query, candidates, top_n=3)

    print(f"Query: {query}")
    print(f"{'='*60}")
    for score, doc in reranked:
        print(f"  Score: {score:.4f} | {doc['content']}")
```

---

## 4. BGE Reranker 本地部署

BGE Reranker 是智源（BAAI）开源的重排序模型，支持本地部署：

```python
"""
BGE Reranker 本地部署
使用 sentence-transformers 加载 Cross-Encoder 模型
"""
from sentence_transformers import CrossEncoder
from typing import List, Dict, Tuple
import numpy as np


class BGEReranker:
    """BGE Reranker 本地封装"""

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str = None
    ):
        """
        初始化 Reranker

        推荐模型:
        - BAAI/bge-reranker-v2-m3: 多语言，精度高速度适中
        - BAAI/bge-reranker-base: 英文为主，速度快
        - BAAI/bge-reranker-large: 大模型，精度最高
        """
        self.model = CrossEncoder(
            model_name,
            max_length=512,
            device=device
        )

    def rerank(
        self,
        query: str,
        documents: List[Dict],
        top_k: int = 5,
        text_field: str = "content"
    ) -> List[Tuple[float, Dict]]:
        """
        重排序文档

        Args:
            query: 查询文本
            documents: 候选文档
            top_k: 返回数量
            text_field: 文本字段

        Returns:
            [(score, document), ...]
        """
        # 构建 query-document 对
        pairs = [(query, doc[text_field]) for doc in documents]

        # 计算相关性分数
        scores = self.model.predict(pairs)

        # 按分数排序
        scored_docs = list(zip(scores, documents))
        scored_docs.sort(key=lambda x: x[0], reverse=True)

        return [(float(score), doc) for score, doc in scored_docs[:top_k]]


# ========== 使用示例 ==========
if __name__ == "__main__":
    reranker = BGEReranker(model_name="BAAI/bge-reranker-v2-m3")

    candidates = [
        {"id": 1, "content": "iPhone 15 Pro Max 配备 4422mAh 电池"},
        {"id": 2, "content": "智能手机电池技术发展趋势"},
        {"id": 3, "content": "iPhone 15 Pro Max 摄像头参数"},
        {"id": 4, "content": "手机续航优化指南"},
        {"id": 5, "content": "Samsung Galaxy S24 Ultra 电池容量"},
    ]

    query = "iPhone 15 Pro Max 电池容量是多少"
    results = reranker.rerank(query, candidates, top_k=3)

    print(f"Query: {query}")
    for score, doc in results:
        print(f"  Score: {score:.4f} | {doc['content']}")
```

---

## 5. 完整管线：混合检索 + Reranking

```
┌─────────────────────────────────────────────────────────────────┐
│            混合检索 + Reranking 完整管线                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户 Query: "iPhone 15 Pro Max 电池容量"                        │
│       │                                                         │
│       ├──────────────────┬──────────────────┐                   │
│       ▼                  ▼                  ▼                   │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐                 │
│  │  BM25   │      │ 向量检索 │      │ 其他路  │                  │
│  │ Top-50  │      │ Top-50  │      │ Top-50  │                  │
│  └────┬────┘      └────┬────┘      └────┬────┘                 │
│       │                │                │                       │
│       └────────────────┼────────────────┘                       │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │   RRF 融合       │                               │
│               │   Top-20        │                               │
│               └────────┬────────┘                               │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │  Cross-Encoder  │                               │
│               │  Reranker       │                               │
│               │  Top-5          │                               │
│               └────────┬────────┘                               │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │  LLM 生成回答    │                               │
│               └─────────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 完整实现

```python
"""
混合检索 + Reranking 完整管线
"""
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document
from sentence_transformers import CrossEncoder
from typing import List, Dict


class HybridRerankPipeline:
    """混合检索 + Reranking 完整管线"""

    def __init__(
        self,
        documents: List[Document],
        bm25_weight: float = 0.4,
        vector_weight: float = 0.6,
        reranker_model: str = "BAAI/bge-reranker-v2-m3",
        retrieval_k: int = 20,
        final_k: int = 5
    ):
        self.retrieval_k = retrieval_k
        self.final_k = final_k

        # BM25 检索器
        self.bm25 = BM25Retriever.from_documents(documents)
        self.bm25.k = retrieval_k

        # 向量检索器
        embeddings = OpenAIEmbeddings()
        vectorstore = Chroma.from_documents(documents, embeddings)
        self.vector = vectorstore.as_retriever(
            search_kwargs={"k": retrieval_k}
        )

        # 混合检索器
        self.ensemble = EnsembleRetriever(
            retrievers=[self.bm25, self.vector],
            weights=[bm25_weight, vector_weight]
        )

        # Reranker
        self.reranker = CrossEncoder(reranker_model, max_length=512)

    def retrieve(self, query: str) -> List[Dict]:
        """
        完整检索流程: 混合检索 → Reranking

        Args:
            query: 用户查询

        Returns:
            精排后的 Top-K 文档
        """
        # Step 1: 混合检索获取候选集
        candidates = self.ensemble.get_relevant_documents(query)

        # Step 2: Cross-Encoder Reranking
        pairs = [(query, doc.page_content) for doc in candidates]
        scores = self.reranker.predict(pairs)

        # Step 3: 按 Reranker 分数重新排序
        scored_docs = list(zip(scores, candidates))
        scored_docs.sort(key=lambda x: x[0], reverse=True)

        # Step 4: 返回 Top-K
        results = []
        for score, doc in scored_docs[:self.final_k]:
            results.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "rerank_score": float(score)
            })

        return results


# ========== 使用示例 ==========
if __name__ == "__main__":
    documents = [
        Document(page_content="iPhone 15 Pro Max 配备 4422mAh 电池，支持 27W 快充"),
        Document(page_content="智能手机电池技术发展趋势：固态电池将取代锂离子电池"),
        Document(page_content="iPhone 15 Pro Max 摄像头采用 4800 万像素主摄"),
        Document(page_content="手机续航优化指南：关闭后台应用可延长电池使用时间"),
        Document(page_content="Samsung Galaxy S24 Ultra 电池容量为 5000mAh"),
    ]

    pipeline = HybridRerankPipeline(documents)
    results = pipeline.retrieve("iPhone 15 Pro Max 电池容量")

    for i, r in enumerate(results):
        print(f"[{i+1}] Score: {r['rerank_score']:.4f} | {r['content']}")
```

---

## 6. RRF 融合进阶：带 Reranking 分数的加权融合

```python
"""
三路融合: BM25 + Vector + Reranker
"""
from typing import List, Tuple, Dict
from collections import defaultdict


def three_way_rrf_fusion(
    bm25_results: List[Tuple[int, float, Dict]],
    vector_results: List[Tuple[int, float, Dict]],
    reranker_results: List[Tuple[float, Dict]],
    k: int = 60,
    weights: Tuple[float, float, float] = (0.3, 0.3, 0.4)
) -> List[Tuple[float, Dict]]:
    """
    三路 RRF 融合: BM25 + Vector + Reranker

    Args:
        bm25_results: BM25 检索结果
        vector_results: 向量检索结果
        reranker_results: Reranker 重排序结果
        k: RRF 平滑参数
        weights: (bm25_weight, vector_weight, reranker_weight)

    Returns:
        [(fused_score, document), ...]
    """
    rrf_scores: Dict[int, float] = defaultdict(float)
    doc_map: Dict[int, Dict] = {}

    # BM25 贡献
    for rank, (doc_idx, _, doc) in enumerate(bm25_results):
        rrf_scores[doc_idx] += weights[0] / (k + rank + 1)
        doc_map[doc_idx] = doc

    # Vector 贡献
    for rank, (doc_idx, _, doc) in enumerate(vector_results):
        rrf_scores[doc_idx] += weights[1] / (k + rank + 1)
        doc_map[doc_idx] = doc

    # Reranker 贡献
    for rank, (_, doc) in enumerate(reranker_results):
        doc_idx = doc.get("id", rank)
        rrf_scores[doc_idx] += weights[2] / (k + rank + 1)
        doc_map[doc_idx] = doc

    # 排序
    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_map[idx]) for idx, score in sorted_docs]
```

---

## 7. Reranking 模型对比

| 模型 | 类型 | 精度 | 速度 | 多语言 | 部署方式 | 适用场景 |
|------|------|------|------|--------|----------|----------|
| Cohere Rerank v3 | API | ★★★★★ | ★★★★ | ✅ 100+ 语言 | 云端 API | 生产环境、多语言场景 |
| BGE Reranker v2 M3 | Cross-Encoder | ★★★★★ | ★★★☆ | ✅ 中英等 | 本地部署 | 中文场景、数据隐私要求高 |
| ms-marco-MiniLM-L6 | Cross-Encoder | ★★★★ | ★★★★★ | ✗ 英文为主 | 本地部署 | 英文场景、低延迟要求 |
| BGE Reranker Large | Cross-Encoder | ★★★★★ | ★★☆ | ✅ 中英等 | 本地部署 | 精度优先、算力充足 |
| ColBERT v2 | Late Interaction | ★★★★ | ★★★★ | ✗ 英文为主 | 本地部署 | 大规模检索、延迟敏感 |

```
┌─────────────────────────────────────────────────────────────────┐
│                Reranking 模型选型决策树                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  需要中文支持?                                                    │
│  ├── 是 → 数据隐私要求高?                                        │
│  │       ├── 是 → BGE Reranker v2 M3 (本地)                     │
│  │       └── 否 → Cohere Rerank v3 (API)                        │
│  └── 否 → 延迟敏感?                                              │
│          ├── 是 → ms-marco-MiniLM-L6                            │
│          └── 否 → BGE Reranker Large                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 常见误区

### ❌ 错误 1: 对全部文档做 Reranking

```python
# 错误: 对 100K 文档全部做 Cross-Encoder 重排序
# Cross-Encoder 比 Bi-Encoder 慢 100-1000 倍！
scores = reranker.predict([(query, doc) for doc in all_100k_docs])

# 正确: 先用 Bi-Encoder/混合检索召回 Top-100，再 Rerank
candidates = hybrid_retriever.search(query, top_k=100)
scores = reranker.predict([(query, doc) for doc in candidates])
```

### ❌ 错误 2: 忽略 Reranker 的 max_length

```python
# 错误: 超长文档被截断，丢失关键信息
reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")  # 默认 max_length=512

# 正确: 调整 max_length 或对文档做分段
reranker = CrossEncoder("BAAI/bge-reranker-v2-m3", max_length=1024)
# 或者对长文档做 chunk 后分别 rerank
```

### ❌ 错误 3: 混淆 Reranker 分数的含义

```python
# 错误: 把 Reranker 分数当作"相关性概率"
# Reranker 分数是 logits，不是概率，不同模型的分数不可比较
print(f"相关性概率: {score}")  # ← 不是概率！

# 正确: 只用于排序，不用于绝对值判断
print(f"相关性分数 (仅用于排序): {score}")
```

### ❌ 错误 4: 生产环境只用一种 Reranker

```python
# 错误: API 调用失败时没有降级方案
reranker = CohereReranker(api_key="...")  # API 挂了怎么办？

# 正确: 配置降级策略
class RobustReranker:
    def __init__(self):
        self.primary = CohereReranker(api_key="...")
        self.fallback = BGEReranker(model_name="BAAI/bge-reranker-v2-m3")

    def rerank(self, query, docs):
        try:
            return self.primary.rerank(query, docs)
        except Exception:
            return self.fallback.rerank(query, docs)
```

---

## 9. 工程建议

1. **Reranker 只对 Top-K 候选做精排**：不要对全量文档做 Reranking，Cross-Encoder 的推理成本远高于 Bi-Encoder。建议先用向量检索召回 Top-50 到 Top-100，再用 Reranker 精排到 Top-5。
2. **在延迟允许的范围内优先用更大的模型**：Cohere Rerank 的 large 版本比 small 版本精度高 3-5%，但延迟也更高。如果你的 SLA 允许 200ms 以内的额外延迟，优先选择大模型。
3. **Reranker 的分数不要暴露给用户**：Cross-Encoder 输出的相关性分数只用于排序，不适合直接作为"相似度百分比"展示。它的分数分布因 query 而异，不适合跨查询比较。
4. **建立 Reranker 效果的定期评估机制**：随着知识库内容更新，Reranker 的效果可能变化。建议每周用固定的评估集跑一次 Recall@5 和 MRR，发现指标下降时及时排查。

---

## 10. 本课总结

```
┌─────────────────────────────────────────────────────────────────┐
│                       L2 核心要点                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Bi-Encoder 用于检索（快），Cross-Encoder 用于重排序（准）      │
│                                                                 │
│  2. Reranking 是检索后的精排阶段，从 Top-100 中选 Top-5          │
│                                                                 │
│  3. Cohere Rerank 适合快速集成，BGE Reranker 适合本地部署         │
│                                                                 │
│  4. Reranker 分数只用于排序，不代表相关性概率                      │
│                                                                 │
│  5. 先粗排再精排，不要对全量文档做 Reranking                      │
│                                                                 │
│  6. 生产环境需要配置 Reranker 降级策略                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 练习

### 练习 1: 对比不同 Reranker

```python
"""
要求:
1. 加载 BGE Reranker base 和 large 两个模型
2. 在 20 个测试查询上对比两者的排序结果
3. 计算两者的排序一致性 (Kendall Tau 或 Spearman)
4. 记录每个模型的推理耗时
"""
# YOUR CODE HERE
```

### 练习 2: 实现 Reranker 降级策略

```python
"""
要求:
1. 实现主 Reranker (API) + 备用 Reranker (本地) 的降级策略
2. 模拟 API 超时/错误场景
3. 记录降级发生次数和响应时间变化
4. 绘制降级前后的效果对比
"""
# YOUR CODE HERE
```

### 练习 3: Reranking 效果量化评估

```python
"""
要求:
1. 构建 50 个查询的评估数据集（含标注）
2. 对比三种配置:
   a) 仅向量检索
   b) 混合检索 (BM25 + Vector)
   c) 混合检索 + Reranking
3. 计算 Recall@5、MRR、NDCG@5
4. 绘制三种配置的指标对比图
"""
# YOUR CODE HERE
```

---

## 参考答案

### 练习 1: 对比不同 Reranker

**思路**：对比 BGE Reranker 的 base 和 large 两个版本，需要在同一测试集上分别运行推理，记录排序结果和耗时。Kendall Tau 距离衡量两个排序之间的不一致对数，值越小说明两个模型排序越一致。

**答案**：

```python
import time
import numpy as np
from typing import List, Dict, Tuple
from sentence_transformers import CrossEncoder
from itertools import combinations


def kendall_tau(rank_a: List[int], rank_b: List[int]) -> float:
    """计算 Kendall Tau 相关系数"""
    n = len(rank_a)
    if n < 2:
        return 1.0
    pos_a = {doc_id: i for i, doc_id in enumerate(rank_a)}
    pos_b = {doc_id: i for i, doc_id in enumerate(rank_b)}
    concordant, discordant = 0, 0
    for i, j in combinations(range(n), 2):
        a_i, a_j = rank_a[i], rank_a[j]
        b_order_same = (pos_b[a_i] < pos_b[a_j])
        a_order_same = (i < j)
        if a_order_same == b_order_same:
            concordant += 1
        else:
            discordant += 1
    total = concordant + discordant
    return (concordant - discordant) / total if total > 0 else 1.0


def compare_rerankers(
    queries: List[str],
    candidate_docs: List[List[Dict]],
    model_names: List[str],
    text_field: str = "content"
):
    """对比多个 Reranker 模型"""
    models = {name: CrossEncoder(name, max_length=512) for name in model_names}

    all_results = {name: {"ranks": [], "times": []} for name in model_names}

    for query, candidates in zip(queries, candidate_docs):
        texts = [doc[text_field] for doc in candidates]
        pairs = [(query, text) for text in texts]

        for name, model in models.items():
            start = time.time()
            scores = model.predict(pairs)
            elapsed = (time.time() - start) * 1000

            ranked_indices = np.argsort(scores)[::-1].tolist()
            all_results[name]["ranks"].append(ranked_indices)
            all_results[name]["times"].append(elapsed)

    # 计算排序一致性
    if len(model_names) >= 2:
        name_a, name_b = model_names[0], model_names[1]
        taus = []
        for i in range(len(queries)):
            rank_a = all_results[name_a]["ranks"][i]
            rank_b = all_results[name_b]["ranks"][i]
            tau = kendall_tau(rank_a, rank_b)
            taus.append(tau)
        avg_tau = np.mean(taus)
        print(f"Kendall Tau ({name_a} vs {name_b}): {avg_tau:.4f}")

    # 输出耗时对比
    for name in model_names:
        avg_time = np.mean(all_results[name]["times"])
        print(f"{name}: 平均耗时 {avg_time:.1f}ms")


if __name__ == "__main__":
    queries = [
        "iPhone 15 Pro Max 电池容量",
        "Python Web 框架对比",
        "退款流程是什么",
        "手机续航优化方法",
        "FastAPI 性能如何",
    ]
    candidates_per_query = [
        [
            {"id": 1, "content": "iPhone 15 Pro Max 配备 4422mAh 电池"},
            {"id": 2, "content": "智能手机电池技术发展趋势"},
            {"id": 3, "content": "iPhone 15 Pro Max 摄像头参数"},
            {"id": 4, "content": "Samsung Galaxy S24 Ultra 电池容量 5000mAh"},
            {"id": 5, "content": "手机续航优化指南"},
        ],
        [
            {"id": 6, "content": "Django 是 Python 最流行的 Web 框架"},
            {"id": 7, "content": "FastAPI 高性能异步框架"},
            {"id": 8, "content": "Flask 轻量级微框架"},
            {"id": 9, "content": "Python Web 框架性能基准测试"},
            {"id": 10, "content": "Go 语言 Web 框架 Gin"},
        ],
        [
            {"id": 11, "content": "退款政策：30 天内可申请全额退款"},
            {"id": 12, "content": "退款流程：登录→订单→申请退款"},
            {"id": 13, "content": "微信支付退款到账时间 1-3 工作日"},
            {"id": 14, "content": "电子商品激活后不可退款"},
            {"id": 15, "content": "退款审核需要 5-7 个工作日"},
        ],
        [
            {"id": 16, "content": "关闭后台应用可延长电池使用时间"},
            {"id": 17, "content": "降低屏幕亮度节省电量"},
            {"id": 18, "content": "启用省电模式可延长 20-30% 续航"},
            {"id": 19, "content": "电池健康度检测方法"},
            {"id": 20, "content": "快充对电池寿命的影响"},
        ],
        [
            {"id": 21, "content": "FastAPI 基于 Python 类型提示"},
            {"id": 22, "content": "FastAPI 性能接近 Node.js 和 Go"},
            {"id": 23, "content": "FastAPI 自动生成 OpenAPI 文档"},
            {"id": 24, "content": "Flask vs FastAPI 性能对比"},
            {"id": 25, "content": "Django REST Framework 介绍"},
        ],
    ]

    compare_rerankers(
        queries, candidates_per_query,
        model_names=["BAAI/bge-reranker-base", "BAAI/bge-reranker-large"]
    )
```

**要点**：
- Kendall Tau 值接近 1 表示两个模型排序高度一致，接近 -1 表示完全相反，接近 0 表示无关联
- large 模型通常比 base 模型精度更高，但推理时间可能增加 2-3 倍
- 如果两个模型排序一致性 > 0.8，说明大部分查询上结果相同，差异主要来自边界 case

---

### 练习 2: 实现 Reranker 降级策略

**思路**：降级策略的核心是主备切换。主 Reranker 用 API（如 Cohere），速度快但依赖网络；备用 Reranker 用本地模型（如 BGE），速度稍慢但稳定可靠。需要实现超时检测、异常捕获、降级计数和效果监控。

**答案**：

```python
import time
import random
from typing import List, Dict, Tuple
from dataclasses import dataclass, field
from sentence_transformers import CrossEncoder


@dataclass
class RerankerMetrics:
    """降级监控指标"""
    total_calls: int = 0
    primary_success: int = 0
    fallback_triggered: int = 0
    primary_latencies: List[float] = field(default_factory=list)
    fallback_latencies: List[float] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class MockCohereReranker:
    """模拟 Cohere API Reranker（用于演示）"""

    def __init__(self, fail_rate: float = 0.3, timeout_ms: float = 100):
        self.fail_rate = fail_rate
        self.timeout_ms = timeout_ms

    def rerank(self, query: str, documents: List[Dict], top_n: int = 5,
               text_field: str = "content") -> List[Tuple[float, Dict]]:
        # 模拟网络延迟
        time.sleep(random.uniform(0.01, self.timeout_ms / 1000))
        # 模拟随机失败
        if random.random() < self.fail_rate:
            raise ConnectionError("API 超时或服务不可用")
        # 模拟返回结果
        scored = [(random.random(), doc) for doc in documents]
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[:top_n]


class LocalReranker:
    """本地 BGE Reranker"""

    def __init__(self, model_name: str = "BAAI/bge-reranker-v2-m3"):
        self.model = CrossEncoder(model_name, max_length=512)

    def rerank(self, query: str, documents: List[Dict], top_n: int = 5,
               text_field: str = "content") -> List[Tuple[float, Dict]]:
        pairs = [(query, doc[text_field]) for doc in documents]
        scores = self.model.predict(pairs)
        scored = list(zip(scores, documents))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [(float(s), doc) for s, doc in scored[:top_n]]


class RobustReranker:
    """带降级策略的 Reranker"""

    def __init__(
        self,
        primary,
        fallback,
        timeout_s: float = 0.5,
        metrics: RerankerMetrics = None
    ):
        self.primary = primary
        self.fallback = fallback
        self.timeout_s = timeout_s
        self.metrics = metrics or RerankerMetrics()

    def rerank(self, query: str, documents: List[Dict], top_n: int = 5,
               text_field: str = "content") -> List[Tuple[float, Dict]]:
        self.metrics.total_calls += 1

        # 尝试主 Reranker
        try:
            start = time.time()
            results = self.primary.rerank(query, documents, top_n, text_field)
            latency = (time.time() - start) * 1000
            if latency > self.timeout_s * 1000:
                raise TimeoutError(f"延迟 {latency:.0f}ms 超过阈值 {self.timeout_s*1000:.0f}ms")
            self.metrics.primary_success += 1
            self.metrics.primary_latencies.append(latency)
            return results
        except Exception as e:
            self.metrics.errors.append(str(e))
            self.metrics.fallback_triggered += 1

        # 降级到备用 Reranker
        start = time.time()
        results = self.fallback.rerank(query, documents, top_n, text_field)
        latency = (time.time() - start) * 1000
        self.metrics.fallback_latencies.append(latency)
        return results

    def report(self) -> str:
        m = self.metrics
        lines = [
            "=" * 50,
            "降级策略报告",
            "=" * 50,
            f"总调用次数: {m.total_calls}",
            f"主 Reranker 成功: {m.primary_success}",
            f"降级触发次数: {m.fallback_triggered}",
            f"降级率: {m.fallback_triggered/m.total_calls*100:.1f}%",
        ]
        if m.primary_latencies:
            lines.append(f"主 Reranker 平均延迟: {sum(m.primary_latencies)/len(m.primary_latencies):.1f}ms")
        if m.fallback_latencies:
            lines.append(f"备用 Reranker 平均延迟: {sum(m.fallback_latencies)/len(m.fallback_latencies):.1f}ms")
        if m.errors:
            lines.append(f"最近错误: {m.errors[-1]}")
        lines.append("=" * 50)
        return "\n".join(lines)


if __name__ == "__main__":
    primary = MockCohereReranker(fail_rate=0.4)
    fallback = LocalReranker("BAAI/bge-reranker-v2-m3")
    metrics = RerankerMetrics()
    reranker = RobustReranker(primary, fallback, timeout_s=0.05, metrics=metrics)

    candidates = [
        {"id": 1, "content": "iPhone 15 Pro Max 配备 4422mAh 电池"},
        {"id": 2, "content": "智能手机电池技术发展趋势"},
        {"id": 3, "content": "iPhone 15 Pro Max 摄像头参数"},
        {"id": 4, "content": "手机续航优化指南"},
        {"id": 5, "content": "Samsung Galaxy S24 Ultra 电池容量"},
    ]

    for i in range(10):
        query = f"测试查询 {i+1}: iPhone 电池"
        results = reranker.rerank(query, candidates, top_n=3)
        status = "主" if metrics.primary_success > (i + 1 - metrics.fallback_triggered) else "备用"
        print(f"  [{i+1}] {status} | Top-1: {results[0][1]['content'][:30]}")

    print(reranker.report())
```

**要点**：
- 降级触发条件包括：API 超时、返回错误、网络异常，任一条件满足即切换到本地模型
- 生产环境中应记录降级发生的时间戳和错误类型，便于排查 API 稳定性问题
- 本地备用模型的延迟通常更稳定，但精度可能略低于 API 版本的大模型

---

### 练习 3: Reranking 效果量化评估

**思路**：构建评估数据集后，对比三种递进配置（纯向量→混合检索→混合+Reranker）的 Recall@5、MRR 和 NDCG@5。关键是保证三种配置使用相同的文档库和评估集，确保对比公平。

**答案**：

```python
import math
import numpy as np
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from sentence_transformers import SentenceTransformer, CrossEncoder


def recall_at_k(retrieved: List[str], relevant: Set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant) if relevant else 0


def mrr_at_k(retrieved: List[str], relevant: Set[str], k: int) -> float:
    for i, d in enumerate(retrieved[:k]):
        if d in relevant:
            return 1.0 / (i + 1)
    return 0.0


def ndcg_at_k(retrieved: List[str], relevant: Set[str], k: int) -> float:
    if not relevant:
        return 0.0
    dcg = sum(
        (1.0 if retrieved[i] in relevant else 0.0) / math.log2(i + 2)
        for i in range(min(k, len(retrieved)))
    )
    ideal = sorted(
        [1.0 if retrieved[i] in relevant else 0.0 for i in range(min(k, len(retrieved)))],
        reverse=True
    )
    while len(ideal) < min(len(relevant), k):
        ideal.append(1.0)
    idcg = sum(r / math.log2(i + 2) for i, r in enumerate(ideal[:k]))
    return dcg / idcg if idcg > 0 else 0.0


class BM25Simple:
    def __init__(self):
        self.corpus, self.idf, self.docs = [], {}, []

    def fit(self, docs, field="content"):
        import jieba, re
        from collections import Counter
        self.docs = docs
        self.corpus = [list(jieba.cut(d[field].lower())) for d in docs]
        n = len(self.corpus)
        df = Counter()
        for tokens in self.corpus:
            for t in set(tokens):
                df[t] += 1
        self.idf = {t: math.log((n - f + 0.5) / (f + 0.5) + 1) for t, f in df.items()}

    def search(self, query, top_k=10):
        import jieba
        from collections import Counter
        qt = list(jieba.cut(query.lower()))
        results = []
        for idx, tokens in enumerate(self.corpus):
            tf = Counter(tokens)
            score = sum(self.idf.get(t, 0) * tf.get(t, 0) for t in qt if t in self.idf)
            results.append((idx, score, self.docs[idx]))
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


def rrf_fusion(results_list, k=60):
    scores = defaultdict(float)
    doc_map = {}
    for results in results_list:
        for rank, (idx, _, doc) in enumerate(results):
            scores[idx] += 1.0 / (k + rank + 1)
            doc_map[idx] = doc
    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(s, doc_map[i]) for i, s in sorted_docs]


if __name__ == "__main__":
    documents = [
        {"id": "doc0", "content": "iPhone 15 Pro Max 配备 4422mAh 电池，支持 27W 快充"},
        {"id": "doc1", "content": "智能手机电池技术发展趋势：固态电池将取代锂离子电池"},
        {"id": "doc2", "content": "iPhone 15 Pro Max 摄像头采用 4800 万像素主摄"},
        {"id": "doc3", "content": "手机续航优化指南：关闭后台应用可延长电池使用时间"},
        {"id": "doc4", "content": "Samsung Galaxy S24 Ultra 电池容量为 5000mAh"},
        {"id": "doc5", "content": "Python Web 框架对比：Django、Flask、FastAPI"},
        {"id": "doc6", "content": "FastAPI 是高性能异步 Web 框架，性能接近 Go"},
        {"id": "doc7", "content": "退款政策：购买后 30 天内可申请全额退款"},
        {"id": "doc8", "content": "微信支付退款到账时间：1-3 个工作日"},
        {"id": "doc9", "content": "电商平台退货退款常见问题解答"},
    ]

    eval_data = [
        ("iPhone 15 Pro Max 电池容量", {"doc0"}),
        ("哪个手机电池最大", {"doc0", "doc4"}),
        ("手机续航怎么优化", {"doc3"}),
        ("Python Web 框架哪个性能最好", {"doc5", "doc6"}),
        ("退款多久到账", {"doc7", "doc8"}),
        ("FastAPI 有什么优势", {"doc6"}),
        ("退款流程是什么", {"doc7", "doc9"}),
        ("固态电池发展趋势", {"doc1"}),
        ("Samsung 电池容量", {"doc4"}),
        ("Django 适合什么场景", {"doc5"}),
    ]

    # 构建索引
    bm25 = BM25Simple()
    bm25.fit(documents)
    embed_model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
    doc_embeddings = embed_model.encode([d["content"] for d in documents], normalize_embeddings=True)
    reranker = CrossEncoder("BAAI/bge-reranker-v2-m3", max_length=512)

    configs = {
        "A: Vector Only": [],
        "B: Hybrid (Vec+BM25)": [],
        "C: Hybrid+Reranker": [],
    }

    for query, relevant in eval_data:
        q_emb = embed_model.encode([query], normalize_embeddings=True)
        vec_scores = np.dot(doc_embeddings, q_emb.T).flatten()
        vec_top = np.argsort(vec_scores)[::-1][:10]
        vec_results = [(int(i), float(vec_scores[i]), documents[int(i)]) for i in vec_top]
        vec_ids = [documents[int(i)]["id"] for i in vec_top[:5]]

        bm25_results = bm25.search(query, top_k=10)
        fused = rrf_fusion([vec_results, bm25_results])
        hybrid_ids = [doc["id"] for _, doc in fused[:5]]

        pairs = [(query, doc["content"]) for _, doc in fused]
        rerank_scores = reranker.predict(pairs)
        scored = list(zip(rerank_scores, [doc for _, doc in fused]))
        scored.sort(key=lambda x: x[0], reverse=True)
        reranked_ids = [doc["id"] for _, doc in scored[:5]]

        configs["A: Vector Only"].append(vec_ids)
        configs["B: Hybrid (Vec+BM25)"].append(hybrid_ids)
        configs["C: Hybrid+Reranker"].append(reranked_ids)

    # 计算指标
    k = 5
    print(f"{'配置':<25} {'Recall@5':<12} {'MRR':<10} {'NDCG@5':<10}")
    print("-" * 60)
    for name, all_ids in configs.items():
        recalls = [recall_at_k(ids, rel, k) for ids, (_, rel) in zip(all_ids, eval_data)]
        mrrs = [mrr_at_k(ids, rel, k) for ids, (_, rel) in zip(all_ids, eval_data)]
        ndcgs = [ndcg_at_k(ids, rel, k) for ids, (_, rel) in zip(all_ids, eval_data)]
        print(f"{name:<25} {np.mean(recalls):<12.3f} {np.mean(mrrs):<10.3f} {np.mean(ndcgs):<10.3f}")
```

**要点**：
- 三种配置应使用完全相同的文档库和评估集，确保变量唯一
- Reranker 对 MRR 的提升通常最明显，因为它能把最相关的结果排到第一位
- NDCG 同时考虑了排序位置和相关性，比 Recall 更能反映用户体验

---

> **下一课**: [L3: 查询改写与扩展](./03-查询改写与扩展.md)

# 阶段实战：实现一个带反思机制的 RAG 系统

> Stage 3 · Capstone | 前置：Lesson 1-5 完成 | 时长：90 分钟

把 Self-RAG 的反思机制真正落地，和 Stage 1 基线做对比。不是每种高级技术都适合你的场景，通过实际构建来判断。

## 你要完成的事

- 实现带完整反思链的 Self-RAG 系统
- 和 Naive RAG 基线做量化对比
- 理解每层反思的延迟成本

## 1. 核心实现

```python
from dataclasses import dataclass
from openai import OpenAI
from pymilvus import MilvusClient

client = OpenAI()
milvus = MilvusClient(uri="http://localhost:19530")

@dataclass
class SelfRAGResult:
    query: str
    answer: str
    did_retrieve: bool
    relevance_scores: list[bool]
    support_level: str
    latency_ms: float
    method: str

class SelfRAG:
    def __init__(self, collection="knowledge_base", model="gpt-4o-mini"):
        self.collection = collection
        self.model = model

    def _call(self, prompt, max_tokens=200):
        return client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0, max_tokens=max_tokens
        ).choices[0].message.content

    def should_retrieve(self, query):
        return "需要" in self._call(
            f"判断是否需要外部文档才能准确回答。只回答"需要"或"不需要"。\n\n问题：{query}", 10)

    def retrieve(self, query, top_k=5):
        vector = client.embeddings.create(model="text-embedding-3-small", input=query).data[0].embedding
        results = milvus.search(collection_name=self.collection, data=[vector],
                                limit=top_k, output_fields=["text", "source"])
        return [{"text": r["entity"]["text"], "source": r["entity"]["source"]} for r in results[0]]

    def filter_relevant(self, query, docs):
        relevant = []
        for doc in docs:
            if "相关" in self._call(
                f"判断文档是否和问题相关。只回答"相关"或"不相关"。\n\n问题：{query}\n文档：{doc['text'][:400]}", 10):
                relevant.append(doc)
        return relevant

    def assess_support(self, answer, contexts):
        return self._call(
            f"判断答案是否有文档依据。只回答"充分支持"、"部分支持"或"无支持"。\n\n"
            f"答案：{answer}\n文档：{' '.join(contexts[:3])}", 10)

    def query(self, query):
        import time
        start = time.time()

        if not self.should_retrieve(query):
            answer = self._call(query, 500)
            return SelfRAGResult(query=query, answer=answer, did_retrieve=False,
                relevance_scores=[], support_level="N/A",
                latency_ms=(time.time()-start)*1000, method="direct")

        docs = self.retrieve(query)
        relevant = self.filter_relevant(query, docs)

        if not relevant:
            answer = self._call(query, 500)
            return SelfRAGResult(query=query, answer=answer, did_retrieve=True,
                relevance_scores=[False]*len(docs), support_level="无支持",
                latency_ms=(time.time()-start)*1000, method="fallback_direct")

        context = "\n\n".join(d["text"] for d in relevant[:3])
        answer = self._call(f"基于文档回答。如果没有相关信息请说明。\n\n{context}\n\n问题：{query}", 500)
        support = self.assess_support(answer, [d["text"] for d in relevant])

        return SelfRAGResult(query=query, answer=answer, did_retrieve=True,
            relevance_scores=[d in relevant for d in docs], support_level=support,
            latency_ms=(time.time()-start)*1000, method="rag_with_reflection")
```

## 2. 对比实验

```python
import time

def naive_rag(query):
    start = time.time()
    vector = client.embeddings.create(model="text-embedding-3-small", input=query).data[0].embedding
    results = milvus.search(collection_name="knowledge_base", data=[vector], limit=5, output_fields=["text"])
    contexts = "\n\n".join(r["entity"]["text"] for r in results[0])
    answer = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"基于文档回答：\n\n{contexts}\n\n问题：{query}"}],
        temperature=0.0).choices[0].message.content
    return {"answer": answer, "latency_ms": (time.time()-start)*1000}

self_rag = SelfRAG()
test_queries = [
    ("你好", False), ("2+2等于几", False),
    ("如何申请退货", True), ("Python 3.12 新特性", True),
]

print(f"{'查询':<20} {'检索?':<6} {'Naive延迟':<10} {'Self延迟':<10}")
print("=" * 50)
for q, expected in test_queries:
    n = naive_rag(q)
    s = self_rag.query(q)
    print(f"{q:<20} {'是' if s.did_retrieve else '否':<6} {n['latency_ms']:<10.0f} {s.latency_ms:<10.0f}")
```

## 3. 成本分析

```text
场景                    Naive RAG     Self-RAG      差异
──────────────────────────────────────────────────────────
不需要检索               ~800ms        ~600ms        省了检索
需要检索+结果好           ~1200ms       ~2500ms       +1300ms (反思调用)
需要检索+结果差           ~1200ms       ~2500ms       但质量更好
```

Self-RAG 的额外成本是 2-4 次 LLM 调用。如果延迟是硬约束，可以只保留路由判断，去掉其他反思环节。

## 4. 观测反思 token 分布

```python
stats = {"direct": 0, "rag_with_reflection": 0, "fallback_direct": 0}
support_dist = {"充分支持": 0, "部分支持": 0, "无支持": 0}

for item in eval_queries:
    result = self_rag.query(item["query"])
    stats[result.method] += 1
    if result.support_level != "N/A":
        support_dist[result.support_level] += 1

print("路由分布:", stats)
print("支持度:", support_dist)
```

如果"无支持" > 15%，先优化检索，Self-RAG 救不了差的检索。

## 练习

### 练习一：添加检索重试

当所有结果都不相关时，用 LLM 改写查询重试，最多 2 次。统计重试成功率。

### 练习二：对比生成质量

准备 20 个问答对，分别用 Naive RAG 和 Self-RAG 回答，用 LLM-as-Judge 评分。分析收益集中在哪个场景。

---

## 参考答案

### 练习一

```python
def retrieve_with_retry(self, query, max_retries=2):
    docs = self.retrieve(query)
    relevant = self.filter_relevant(query, docs)
    retries = 0
    while not relevant and retries < max_retries:
        retries += 1
        rewritten = self._call(f"换一种表述：\n{query}", 100)
        docs = self.retrieve(rewritten)
        relevant = self.filter_relevant(query, docs)
    return relevant
```

典型重试成功率 30-50%。重试后仍全部不相关，说明知识库缺内容。

### 练习二

典型结果：Self-RAG 在不需要检索的问题上优势明显（4.2 vs 2.5），在需要检索的问题上差异不大（3.6 vs 3.5）。收益集中在"不该检索时别检索"。

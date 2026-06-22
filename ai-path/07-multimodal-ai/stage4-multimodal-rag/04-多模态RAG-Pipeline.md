# 04 多模态 RAG Pipeline——图文混合检索 + 多模态 LLM 生成

> 多模态 RAG 结合检索和生成，实现图文问答。

## 场景引入

你要为一个产品客服系统构建多模态问答能力：用户上传一张产品故障照片并问"这是什么问题？怎么解决？"系统需要从产品手册中检索相关的图文内容，结合图片理解给出准确的回答。这比纯文本 RAG 复杂得多——你需要同时处理图片查询和文本查询，从图文混合的索引中检索，组装包含图片和文本的上下文，最后让 LLM 生成图文并茂的回答。每一步都有独特的工程挑战。

## 学习目标

- 掌握多模态 RAG 的设计方法
- 理解图文混合检索和生成
- 学会构建多模态问答系统

---

## 一、系统架构

```
多模态 RAG 系统：

用户问题 → 向量化 → 检索 → 上下文组装 → LLM 生成 → 回答
  │          │        │          │            │        │
  ▼          ▼        ▼          ▼            ▼        ▼
文本/图片  文本/图片向量 图文结果  图文上下文  GPT-4o  图文回答
```

---

## 二、核心实现

```python
class MultimodalRAG:
    """多模态 RAG"""
    
    def __init__(self):
        self.index = MultimodalIndex()
        self.client = OpenAI()
    
    def add_document(self, doc_path: str):
        """添加文档"""
        # 解析文档
        elements = parse_document(doc_path)
        
        for element in elements:
            if element.category == "Image":
                self.index.add_image(element.metadata.image_path)
            else:
                self.index.add_text(element.text)
    
    def ask(self, question: str, include_images: bool = True) -> dict:
        """提问"""
        # 检索相关结果
        results = self.index.search(question, top_k=5)
        
        # 组装上下文
        context = self._build_context(results, include_images)
        
        # 生成答案
        answer = self._generate_answer(question, context)
        
        return {
            "answer": answer,
            "sources": results
        }
    
    def _build_context(self, results: list, include_images: bool) -> list:
        """组装上下文"""
        context = []
        
        for result in results:
            if result["type"] == "text":
                context.append({
                    "type": "text",
                    "text": result["content"]
                })
            elif result["type"] == "image" and include_images:
                context.append({
                    "type": "image_url",
                    "image_url": {"url": result["path"]}
                })
        
        return context
    
    def _generate_answer(self, question: str, context: list) -> str:
        """生成答案"""
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": f"基于以下信息回答问题：\n\n问题：{question}"},
                *context
            ]
        }]
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        return response.choices[0].message.content
```

---

## 三、使用示例

```python
rag = MultimodalRAG()
rag.add_document("product_catalog.pdf")

result = rag.ask("这款产品的外观是什么样的？")
print(result["answer"])
```

---

## 四、优化策略

```
多模态 RAG 优化：

1. 检索优化
   - 调整 top_k
   - 混合检索策略
   - 重排序

2. 上下文优化
   - 限制上下文大小
   - 优先高质量结果
   - 去重

3. 生成优化
   - 优化 Prompt
   - 流式输出
   - 引用溯源
```

---

## 五、评估

```python
def evaluate_multimodal_rag(rag: MultimodalRAG, test_cases: list) -> dict:
    """评估多模态 RAG"""
    results = []
    
    for case in test_cases:
        answer = rag.ask(case["question"])
        score = evaluate_answer(answer["answer"], case["reference"])
        results.append(score)
    
    return {
        "avg_score": sum(results) / len(results),
        "min_score": min(results),
        "max_score": max(results)
    }
```

---

## 常见误区

1. **把图片直接当文本处理**：图片不能直接拼接到 prompt 中，需要通过 image_url 格式传递，否则会浪费大量 token 且无法被模型理解。
2. **检索结果不做去重就拼接**：同一段内容可能被多次检索到，不去重会浪费上下文空间且影响生成质量。
3. **上下文过长导致模型"迷路"**：拼接太多检索结果会让模型难以抓住重点，应该限制上下文长度并优先保留高质量结果。
4. **不做流式输出**：多模态 RAG 的生成延迟通常比纯文本更高，不做流式输出会让用户等待很久。

## 工程建议

1. **上下文组装做智能裁剪**：限制总 token 数（如 4000），优先保留相似度高的结果，图片和文本分别控制比例。
2. **实现引用溯源**：每个回答标注来自哪个文档的哪个段落，图片标注来源页码，方便用户验证。
3. **做 Prompt 工程优化**：明确告诉模型"基于以下图文信息回答"，指导模型正确理解和引用图片内容。
4. **实现流式输出**：LLM 流式生成回答，前端逐步渲染，大幅降低用户感知延迟。

## 小结

```
本课核心要点：

1. 多模态 RAG 结合图文检索和生成
2. 支持文本和图片混合上下文
3. 用 GPT-4o 生成图文回答
4. 优化策略：检索、上下文、生成

---

**下一课**: [05 评估多模态 RAG——多模态场景下的评估指标与方法](./05-评估多模态RAG.md)
```

---

## 练习

1. **系统题**：构建一个多模态 RAG 系统。

2. **检索题**：优化检索效果。

3. **评估题**：评估系统效果。

---

## 参考答案

### 练习一：系统题——构建一个多模态 RAG 系统

**思路**：设计一个完整的多模态 RAG Pipeline，包含文档解析、图文索引、检索、上下文组装和 LLM 生成五个核心环节。

**答案**：
```python
import chromadb
from openai import OpenAI
from PIL import Image
import json

class MultimodalRAG:
    """多模态 RAG 系统"""

    def __init__(self, persist_dir: str = "./rag_chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name="rag_docs",
            metadata={"hnsw:space": "cosine"}
        )
        self.llm = OpenAI()
        self.max_context_tokens = 4000

    def add_document(self, doc_path: str):
        """添加文档（解析图文并索引）"""
        elements = parse_document(doc_path)  # 假设已有文档解析函数

        for i, element in enumerate(elements):
            if element.category == "Image":
                emb = get_image_embedding(element.metadata.image_path)
                self.collection.add(
                    ids=[f"{doc_path}_img_{i}"],
                    embeddings=[emb],
                    metadatas=[{
                        "type": "image",
                        "path": element.metadata.image_path,
                        "source": doc_path,
                        "page": getattr(element.metadata, "page_number", 0)
                    }]
                )
            elif element.category in ("Text", "Table"):
                emb = get_text_embedding(element.text)
                self.collection.add(
                    ids=[f"{doc_path}_txt_{i}"],
                    embeddings=[emb],
                    metadatas=[{
                        "type": "text",
                        "content": element.text,
                        "source": doc_path,
                        "category": element.category
                    }]
                )

    def ask(self, question: str, include_images: bool = True) -> dict:
        """提问并生成回答"""
        query_emb = get_text_embedding(question)

        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=10
        )

        context = self._build_context(results, include_images)
        answer = self._generate_answer(question, context)

        return {
            "answer": answer,
            "sources": self._extract_sources(results)
        }

    def _build_context(self, results: dict, include_images: bool) -> list:
        """组装上下文，控制总 token 数"""
        context = []
        total_chars = 0

        for i in range(len(results["ids"][0])):
            meta = results["metadatas"][0][i]
            distance = results["distances"][0][i]

            if distance > 0.6:  # 相似度过低则跳过
                continue

            if meta["type"] == "text":
                text = meta["content"]
                if total_chars + len(text) > self.max_context_tokens:
                    continue
                context.append({"type": "text", "text": text})
                total_chars += len(text)
            elif meta["type"] == "image" and include_images:
                context.append({
                    "type": "image_url",
                    "image_url": {"url": meta["path"]}
                })

        return context

    def _generate_answer(self, question: str, context: list) -> str:
        """调用 LLM 生成回答"""
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": f"请基于以下图文信息回答问题。如果信息不足，请说明。\n\n问题：{question}"},
                *context
            ]
        }]

        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1024
        )
        return response.choices[0].message.content

    def _extract_sources(self, results: dict) -> list:
        """提取来源信息"""
        sources = []
        for i in range(len(results["ids"][0])):
            meta = results["metadatas"][0][i]
            sources.append({
                "source": meta.get("source", ""),
                "type": meta["type"],
                "distance": results["distances"][0][i]
            })
        return sources

# 使用示例
rag = MultimodalRAG()
rag.add_document("product_manual.pdf")
result = rag.ask("这款产品的外观是什么样的？")
print(result["answer"])
```

**要点**：
- 上下文组装必须做 token 数控制，否则超长上下文会让模型"迷路"
- 相似度过低的结果应该过滤掉，噪声上下文会降低生成质量
- 常见错误：把所有检索结果不加筛选地拼接，导致上下文过长且噪声多

### 练习二：检索题——优化检索效果

**思路**：通过混合检索（向量 + 关键词）、重排序（Reranking）和元数据预过滤三个手段提升检索精度。

**答案**：
```python
from collections import Counter

class OptimizedMultimodalRAG(MultimodalRAG):
    """优化检索效果的 RAG"""

    def hybrid_search(self, query: str, top_k: int = 10) -> list:
        """混合检索：向量检索 + 关键词匹配"""
        # 向量检索
        query_emb = get_text_embedding(query)
        vector_results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=top_k * 2
        )

        # 关键词匹配（简单的 BM25 模拟）
        query_keywords = set(query.lower().split())
        keyword_scores = {}

        for i, doc_id in enumerate(vector_results["ids"][0]):
            meta = vector_results["metadatas"][0][i]
            if meta["type"] == "text":
                content = meta["content"].lower()
                score = sum(1 for kw in query_keywords if kw in content)
                keyword_scores[doc_id] = score

        # 融合排序（向量分数权重 0.6 + 关键词分数权重 0.4）
        combined = []
        for i, doc_id in enumerate(vector_results["ids"][0]):
            vector_score = 1 - vector_results["distances"][0][i]  # distance -> similarity
            keyword_score = keyword_scores.get(doc_id, 0)
            max_kw = max(keyword_scores.values()) if keyword_scores else 1
            normalized_kw = keyword_score / max_kw if max_kw > 0 else 0
            combined_score = 0.6 * vector_score + 0.4 * normalized_kw
            combined.append({
                "id": doc_id,
                "score": combined_score,
                "metadata": vector_results["metadatas"][0][i]
            })

        combined.sort(key=lambda x: x["score"], reverse=True)
        return combined[:top_k]

    def search_with_filter(self, query: str, filters: dict, top_k: int = 10) -> list:
        """带元数据过滤的检索"""
        query_emb = get_text_embedding(query)
        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=top_k,
            where=filters
        )
        return results

    def rerank_results(self, query: str, candidates: list, top_k: int = 5) -> list:
        """用 LLM 对候选结果做重排序"""
        prompt = f"查询：{query}\n\n请按相关性对以下文档排序（最相关的排在前面）：\n"
        for i, c in enumerate(candidates):
            content = c["metadata"].get("content", c["metadata"].get("path", ""))
            prompt += f"\n{i + 1}. {content[:200]}"

        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        order = json.loads(response.choices[0].message.content)
        reordered = []
        for idx in order.get("order", []):
            if 0 <= idx < len(candidates):
                reordered.append(candidates[idx])
        return reordered[:top_k]

# 使用示例
rag = OptimizedMultimodalRAG()
results = rag.hybrid_search("红色连衣裙怎么搭配", top_k=5)
for r in results:
    print(f"  得分: {r['score']:.4f}, 类型: {r['metadata']['type']}")

filtered = rag.search_with_filter("安装步骤", filters={"category": "Text"}, top_k=5)
```

**要点**：
- 混合检索结合向量语义匹配和关键词精确匹配，两者互补
- Reranking 成本较高（每次调用 LLM），只对 Top-N 候选做重排序
- 常见错误：只做向量检索不做关键词匹配，导致精确术语查询效果差

### 练习三：评估题——评估系统效果

**思路**：构建测试集，从检索质量（Recall、Precision）和生成质量（准确性、完整性、图文一致性）两个维度分别评估。

**答案**：
```python
import json

class RAGEvaluator:
    """RAG 系统评估器"""

    def __init__(self, rag: MultimodalRAG):
        self.rag = rag

    def evaluate_retrieval(self, test_cases: list) -> dict:
        """评估检索质量"""
        precisions, recalls, f1s = [], [], []

        for case in test_cases:
            result = self.rag.ask(case["question"])
            source_ids = {s["source"] for s in result["sources"]}
            expected = set(case["expected_sources"])

            precision = len(source_ids & expected) / len(source_ids) if source_ids else 0
            recall = len(source_ids & expected) / len(expected) if expected else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

            precisions.append(precision)
            recalls.append(recall)
            f1s.append(f1)

        return {
            "precision": sum(precisions) / len(precisions),
            "recall": sum(recalls) / len(recalls),
            "f1": sum(f1s) / len(f1s)
        }

    def evaluate_generation(self, test_cases: list) -> dict:
        """评估生成质量（LLM-as-Judge）"""
        scores = {"accuracy": [], "completeness": [], "consistency": []}

        for case in test_cases:
            result = self.rag.ask(case["question"])

            eval_prompt = f"""请评估以下问答的质量（1-5分）：
问题：{case["question"]}
回答：{result["answer"]}
参考答案：{case["reference_answer"]}

请以 JSON 格式输出：{{"accuracy": N, "completeness": N, "consistency": N}}"""

            response = self.rag.llm.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": eval_prompt}],
                response_format={"type": "json_object"}
            )

            eval_result = json.loads(response.choices[0].message.content)
            for key in scores:
                scores[key].append(eval_result.get(key, 3))

        return {key: sum(vals) / len(vals) for key, vals in scores.items()}

    def generate_report(self, test_cases: list) -> str:
        """生成完整评估报告"""
        retrieval = self.evaluate_retrieval(test_cases)
        generation = self.evaluate_generation(test_cases)

        report = f"""# 多模态 RAG 评估报告

## 检索质量
- Precision: {retrieval["precision"]:.2f}
- Recall: {retrieval["recall"]:.2f}
- F1: {retrieval["f1"]:.2f}

## 生成质量
- 准确性: {generation["accuracy"]:.2f}/5
- 完整性: {generation["completeness"]:.2f}/5
- 图文一致性: {generation["consistency"]:.2f}/5

## 分析
- 检索表现：{"优秀" if retrieval["f1"] > 0.8 else "良好" if retrieval["f1"] > 0.6 else "需要改进"}
- 生成表现：{"优秀" if generation["accuracy"] > 4 else "良好" if generation["accuracy"] > 3 else "需要改进"}
"""
        return report

# 使用示例
evaluator = RAGEvaluator(rag)
test_cases = [
    {
        "question": "这款产品怎么安装？",
        "expected_sources": ["manual_ch3.pdf"],
        "reference_answer": "按照说明书第三章步骤安装..."
    }
]
report = evaluator.generate_report(test_cases)
print(report)
```

**要点**：
- 检索评估和生成评估必须分开，才能定位问题根源
- LLM-as-Judge 需要用比被评估系统更强的模型（如用 GPT-4o 评估 GPT-4o-mini 的输出）
- 常见错误：测试集太小（< 20 条）导致评估结果不具有统计意义

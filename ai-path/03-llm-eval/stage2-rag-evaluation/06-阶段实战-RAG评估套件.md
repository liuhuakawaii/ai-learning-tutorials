# 06 阶段实战：为知识工作台搭建 RAG 评估套件

> 前五课的检索评估、生成评估、端到端评估是散落的脚本。现在把它们整合成一条命令能跑完的评估套件。

## 目标

为 01-ai-app-course 的知识工作台搭建完整的 RAG 评估套件：一条命令跑完检索+生成+端到端评估，输出可操作的报告。

## 项目结构

```
rag-eval-suite/
├── dataset/
│   └── golden_set.json       # 评估数据集（带检索标注）
├── evaluators/
│   ├── retrieval.py          # 检索评估
│   ├── generation.py         # 生成评估
│   └── e2e.py                # 端到端评估
├── pipeline.py               # 评估 Pipeline
├── report.py                 # 报告生成
└── run_eval.py               # 入口
```

## 第一步：构建带检索标注的数据集

RAG 评估的数据集比普通 QA 评估多一个关键字段：`relevant_docs`——标注哪些文档应该被检索到。

```json
// dataset/golden_set.json
[
  {
    "id": "rag_001",
    "question": "如何配置 RAG 的向量数据库？",
    "ground_truth": "使用 Chroma 或 FAISS 作为向量存储，配置 embedding 模型和相似度阈值。",
    "relevant_docs": ["doc_chroma_setup", "doc_faiss_config", "doc_embedding_guide"],
    "difficulty": "medium",
    "category": "setup"
  },
  {
    "id": "rag_002",
    "question": "RAG 检索返回了不相关的文档怎么办？",
    "ground_truth": "可以调整相似度阈值、增加 Reranker、优化文档切分策略。",
    "relevant_docs": ["doc_reranker", "doc_chunking", "doc_threshold"],
    "difficulty": "hard",
    "category": "troubleshooting"
  },
  {
    "id": "rag_003",
    "question": "RAG 的 embedding 模型怎么选？",
    "ground_truth": "根据语言、领域和性能需求选择。中文场景推荐 text2vec 系列，英文推荐 OpenAI text-embedding-3。",
    "relevant_docs": ["doc_embedding_selection", "doc_model_comparison"],
    "difficulty": "medium",
    "category": "selection"
  }
]
```

## 第二步：检索评估器

```python
# evaluators/retrieval.py

from openai import OpenAI

class RetrievalEvaluator:
    def __init__(self, client: OpenAI):
        self.client = client

    def evaluate(self, question: str, retrieved_docs: list[dict], relevant_doc_ids: list[str]) -> dict:
        retrieved_ids = [doc["id"] for doc in retrieved_docs]
        relevant_set = set(relevant_doc_ids)
        retrieved_set = set(retrieved_ids)

        # Precision: 检索到的文档中有多少是相关的
        precision = len(retrieved_set & relevant_set) / len(retrieved_set) if retrieved_set else 0

        # Recall: 相关文档中有多少被检索到了
        recall = len(retrieved_set & relevant_set) / len(relevant_set) if relevant_set else 1

        # MRR: 第一个相关文档排在第几位
        mrr = 0
        for rank, doc_id in enumerate(retrieved_ids, 1):
            if doc_id in relevant_set:
                mrr = 1.0 / rank
                break

        # Context Relevancy: 用 LLM 评估检索片段与问题的相关性
        relevancy = self._context_relevancy(question, [doc["content"] for doc in retrieved_docs])

        return {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "mrr": round(mrr, 3),
            "relevancy": relevancy,
            "score": round((precision + recall + mrr + relevancy) / 4, 3),
        }

    def _context_relevancy(self, question: str, contexts: list[str]) -> float:
        scores = []
        for ctx in contexts:
            prompt = f"""评估以下文档与问题的相关程度（1-5分）。
问题：{question}
文档：{ctx}
请只输出数字。"""
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            scores.append(int(response.choices[0].message.content.strip()))
        return round(sum(scores) / len(scores) / 5.0, 3) if scores else 0
```

## 第三步：生成评估器

```python
# evaluators/generation.py

import json
from openai import OpenAI

class GenerationEvaluator:
    def __init__(self, client: OpenAI):
        self.client = client

    def evaluate(self, question: str, answer: str, contexts: list[str]) -> dict:
        faithfulness = self._faithfulness(contexts, answer)
        relevancy = self._answer_relevancy(question, answer)
        hallucination = self._hallucination_check(contexts, answer)

        scores = [
            faithfulness.get("score", 0),
            relevancy.get("score", 0),
            1 - hallucination.get("score", 0),
        ]

        return {
            "faithfulness": faithfulness,
            "relevancy": relevancy,
            "hallucination": hallucination,
            "overall_score": round(sum(scores) / len(scores), 3),
        }

    def _faithfulness(self, contexts: list[str], answer: str) -> dict:
        prompt = f"""检查回答是否忠实于参考资料。
参考资料：{' '.join(contexts)}
回答：{answer}
JSON：{{"score": 0-1, "unsupported": ["无依据的声明"]}}"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0, response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

    def _answer_relevancy(self, question: str, answer: str) -> dict:
        prompt = f"""评估回答与问题的相关程度。
问题：{question}
回答：{answer}
JSON：{{"score": 0-1, "missing_aspects": ["遗漏方面"], "irrelevant_info": ["无关信息"]}}"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0, response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

    def _hallucination_check(self, contexts: list[str], answer: str) -> dict:
        prompt = f"""检测回答中的幻觉。
参考资料：{' '.join(contexts)}
回答：{answer}
JSON：{{"score": 0-1 (0=无幻觉), "hallucinated_facts": ["幻觉1"]}}"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0, response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
```

## 第四步：Pipeline 和报告

```python
# pipeline.py

import json
import time
from pathlib import Path
from openai import OpenAI
from evaluators.retrieval import RetrievalEvaluator
from evaluators.generation import GenerationEvaluator

class RAGEvalSuite:
    def __init__(self, dataset_path: str):
        self.client = OpenAI()
        self.dataset = json.loads(Path(dataset_path).read_text(encoding="utf-8"))
        self.retrieval_eval = RetrievalEvaluator(self.client)
        self.generation_eval = GenerationEvaluator(self.client)

    def run(self, rag_fn) -> list[dict]:
        results = []
        for i, item in enumerate(self.dataset):
            print(f"[{i+1}/{len(self.dataset)}] {item['id']}: {item['question'][:40]}...")

            start = time.time()
            rag_result = rag_fn(item["question"])
            latency = time.time() - start

            retrieval = self.retrieval_eval.evaluate(
                item["question"], rag_result["retrieved_docs"], item["relevant_docs"]
            )
            generation = self.generation_eval.evaluate(
                item["question"], rag_result["answer"], rag_result["contexts"]
            )

            overall = round(retrieval["score"] * 0.4 + generation["overall_score"] * 0.6, 3)

            results.append({
                "id": item["id"],
                "question": item["question"],
                "retrieval": retrieval,
                "generation": generation,
                "overall": overall,
                "latency": round(latency, 2),
            })

        return results

    def report(self, results: list[dict]) -> str:
        avg_overall = sum(r["overall"] for r in results) / len(results)
        avg_retrieval = sum(r["retrieval"]["score"] for r in results) / len(results)
        avg_generation = sum(r["generation"]["overall_score"] for r in results) / len(results)

        report = f"""# RAG 评估报告

## 总体
- 综合评分：{avg_overall:.3f}
- 检索质量：{avg_retrieval:.3f}
- 生成质量：{avg_generation:.3f}

## 诊断
"""
        if avg_retrieval < 0.6:
            report += "- 检索质量偏低，优先优化检索策略（embedding、top_k、Reranker）\n"
        if avg_generation < 0.6:
            report += "- 生成质量偏低，优先优化 Prompt（忠实度约束、拒答策略）\n"

        report += "\n## 低分案例\n"
        for r in sorted(results, key=lambda x: x["overall"])[:3]:
            report += f"\n### {r['id']}（{r['overall']}）\n"
            report += f"- 检索：P={r['retrieval']['precision']} R={r['retrieval']['recall']}\n"
            report += f"- 生成：忠实度={r['generation']['faithfulness'].get('score', 'N/A')}\n"

        return report
```

## 第五步：运行

```python
# run_eval.py

from pipeline import RAGEvalSuite

def my_rag_pipeline(question: str) -> dict:
    """你的 RAG 系统——替换为实际实现"""
    # 这里调用你的 RAG pipeline
    # 返回格式：{"answer": "...", "contexts": ["..."], "retrieved_docs": [{"id": "...", "content": "..."}]}
    pass

def main():
    suite = RAGEvalSuite("dataset/golden_set.json")
    results = suite.run(my_rag_pipeline)
    report = suite.report(results)
    print(report)

if __name__ == "__main__":
    main()
```

## 评估结果怎么用

跑完评估后，按这个顺序看报告：

1. **先看总体分数**：综合评分 < 0.6 说明有大问题
2. **看检索 vs 生成的分差**：哪个低就先优化哪个
3. **看低分案例**：找到具体失败模式
4. **制定优化计划**：每个低分案例对应一个改进方向

优化后重新跑评估，对比分数变化。这就是评估驱动的优化循环。

## 常见问题

**评估套件搭完就束之高阁？** 评估的价值在于持续运行。每次 Prompt 改动或模型升级后都跑一遍。

**报告只有分数没有行动？** "生成质量 0.72"没有意义，必须告诉团队"哪个指标低、对应哪类问题、建议怎么优化"。

**评估数据集不更新？** 上线后用户问的问题类型会变化，评估集还是老数据，结果无法反映当前质量。

## 练习

1. 搭建完整的 RAG 评估套件，评估你的 RAG 系统
2. 根据评估结果优化 RAG 系统，再重新评估，对比改进效果
3. 将数据集扩展到 20 条，覆盖更多场景

## 阶段总结

你已经掌握了 RAG 系统的分离评估方法。下一阶段进入 Agent 系统评估——当评估对象从"检索+生成"变成"多步推理+工具调用+非确定性行为"时，方法论需要根本性的调整。

---

**下一课**: [Stage 3: Agent 评估的特殊性](../stage3-agent-evaluation/01-Agent评估的特殊性.md)

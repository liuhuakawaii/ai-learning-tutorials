# Stage 5 · Lesson 2: RAGAS 深度实战

> **时长**: 55 分钟 | **前置**: Lesson 1 完成
> **学习目标**:
> 1. 掌握 RAGAS 四大核心指标 (Faithfulness, Answer Relevancy, Context Precision, Context Recall)
> 2. 构建符合 RAGAS 要求的评估数据集
> 3. 执行批量评估并解读结果
> 4. 自定义 RAGAS 指标
> 5. 可视化评估结果

---

## 场景引入

你已经设计了 RAG 评估体系，但手动计算 Recall@K、编写 LLM 评估 Prompt、汇总评估结果的工作量巨大——每次改一个参数就要花半天跑评估。RAGAS（RAG Assessment）是一个开源的 RAG 评估框架，它把 Faithfulness、Answer Relevance、Context Precision、Context Recall 四大核心指标封装成了开箱即用的工具。用 RAGAS，你可以在几分钟内完成一次完整的 RAG 质量评估，而不是几天。

## 1. RAGAS 简介

RAGAS (Retrieval Augmented Generation Assessment) 是专门为 RAG 系统设计的评估框架。

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAGAS 评估流程                                │
│                                                                 │
│  ┌──────────┐                                                   │
│  │ 评估数据  │                                                   │
│  │ Question │                                                   │
│  │ Answer   │                                                   │
│  │ Contexts │                                                   │
│  │ Ground   │                                                   │
│  │ Truth    │                                                   │
│  └────┬─────┘                                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    RAGAS 引擎                              │  │
│  │                                                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│  │
│  │  │Faithfulness│ │  Answer    │ │  Context   │ │Context ││  │
│  │  │            │ │ Relevancy  │ │ Precision  │ │Recall  ││  │
│  │  │  回答是否   │ │ 回答与问题 │ │ 检索结果   │ │检索结果││  │
│  │  │  忠实于    │ │ 的相关性   │ │ 的精确度   │ │的召回率││  │
│  │  │  上下文    │ │            │ │            │ │        ││  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └───┬────┘│  │
│  │        │              │              │            │      │  │
│  │        ▼              ▼              ▼            ▼      │  │
│  │  ┌──────────────────────────────────────────────────────┐│  │
│  │  │              综合评分 (Aggregate Score)               ││  │
│  │  └──────────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────┘  │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ 评估报告  │                                                   │
│  │ • 各指标分数                                                  │
│  │ • 每条样本详情                                                │
│  │ • 可视化图表                                                  │
│  └──────────┘                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. RAGAS 四大核心指标

| 指标 | 评估维度 | 计算方式 | 理想值 | 常见陷阱 |
|------|---------|---------|--------|---------|
| **Faithfulness** | 回答忠实度 | 将回答拆分为声明，逐一验证是否有上下文支撑 | 1.0 | 上下文正确但回答编造了额外信息 |
| **Answer Relevancy** | 回答相关性 | 从回答反推可能的问题，计算与原问题的相似度 | 1.0 | 回答正确但答非所问 |
| **Context Precision** | 上下文精确度 | 相关文档在检索结果中的排名位置 | 1.0 | 检索到很多文档但相关文档排在后面 |
| **Context Recall** | 上下文召回率 | 标准答案中的声明在上下文中的覆盖率 | 1.0 | 检索结果遗漏了关键信息 |

### 2.1 Faithfulness 详解

```
┌─────────────────────────────────────────────────────────────┐
│                Faithfulness 计算过程                         │
│                                                             │
│  Question: "Python 的 GIL 是什么？"                         │
│                                                             │
│  Context: "GIL 是 Python 的全局解释器锁，它确保同一时刻      │
│           只有一个线程执行 Python 字节码。"                   │
│                                                             │
│  Answer: "GIL 是 Python 的全局解释器锁(GIL)。它是 CPython   │
│          解释器中的一个机制，确保同一时刻只有一个线程执行     │
│          Python 字节码。这意味着 Python 的多线程不能利用      │
│          多核 CPU 进行并行计算。"                             │
│                                                             │
│  Step 1: 拆分声明 (Claims)                                  │
│    Claim 1: "GIL 是全局解释器锁"                             │
│    Claim 2: "它是 CPython 解释器中的机制"                    │
│    Claim 3: "确保同一时刻只有一个线程执行字节码"             │
│    Claim 4: "多线程不能利用多核 CPU 并行计算"                │
│                                                             │
│  Step 2: 验证每个声明                                       │
│    Claim 1: ✅ 有上下文支撑                                  │
│    Claim 2: ⚠️ 上下文未提及 CPython (部分支撑)              │
│    Claim 3: ✅ 有上下文支撑                                  │
│    Claim 4: ❌ 上下文未提及多核 CPU (无支撑)                 │
│                                                             │
│  Faithfulness = 3/4 = 0.75                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Answer Relevancy 详解

```
┌─────────────────────────────────────────────────────────────┐
│              Answer Relevancy 计算过程                       │
│                                                             │
│  Question: "如何安装 Python？"                               │
│                                                             │
│  Answer: "Python 可以从 python.org 下载安装。安装时建议      │
│          勾选 'Add to PATH' 选项。Python 是一种解释型        │
│          编程语言，由 Guido van Rossum 创建。"               │
│                                                             │
│  Step 1: 从 Answer 生成可能的 Question                      │
│    Gen Q1: "如何下载安装 Python？"                           │
│    Gen Q2: "Python 安装时需要注意什么？"                     │
│    Gen Q3: "Python 是什么类型的编程语言？"                   │
│                                                             │
│  Step 2: 计算 Gen Questions 与 Original Question 的相似度    │
│    Sim(Gen Q1, Original) = 0.92                             │
│    Sim(Gen Q2, Original) = 0.75                             │
│    Sim(Gen Q3, Original) = 0.45                             │
│                                                             │
│  Answer Relevancy = mean(0.92, 0.75, 0.45) = 0.71          │
│                                                             │
│  ⚠️ 第三句关于"创建者"的信息降低了相关性                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. RAGAS 环境搭建与数据集格式

```python
"""
RAGAS 环境搭建与数据集格式
"""

# ============================================================
# 安装
# ============================================================
# pip install ragas datasets langchain langchain-openai

import os
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)


def build_ragas_dataset(
    questions: list,
    answers: list,
    contexts: list,
    ground_truths: list,
) -> Dataset:
    """
    构建 RAGAS 格式的数据集

    参数:
        questions: 用户问题列表
        answers: RAG 系统生成的回答列表
        contexts: 每个问题对应的检索上下文 (List[List[str]])
        ground_truths: 每个问题的标准答案 (List[str])

    返回:
        HuggingFace Dataset 对象
    """
    data = {
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    }
    return Dataset.from_dict(data)


# ============================================================
# 数据集格式示例
# ============================================================

sample_data = {
    "question": [
        "什么是 RAG？",
        "如何优化检索质量？",
        "向量数据库有哪些选择？",
    ],
    "answer": [
        "RAG 是 Retrieval-Augmented Generation 的缩写，是一种结合检索和生成的 AI 框架。",
        "可以通过混合检索、重排序、查询改写等方式优化检索质量。",
        "常见的向量数据库包括 Pinecone、Weaviate、Milvus、Chroma 等。",
    ],
    "contexts": [
        ["RAG (Retrieval-Augmented Generation) 是一种结合外部知识检索与大语言模型生成的技术框架。"],
        ["检索优化策略包括: 1) 混合检索(结合关键词和向量检索) 2) 重排序(使用交叉编码器重新排序) 3) 查询改写(使用 LLM 改写用户查询)"],
        ["主流向量数据库: Pinecone(云原生)、Weaviate(开源)、Milvus(高性能)、Chroma(轻量级)、Qdrant(Rust实现)"],
    ],
    "ground_truth": [
        "RAG (Retrieval-Augmented Generation) 是一种结合外部知识检索与大语言模型生成的技术框架，通过检索相关文档来增强模型的回答质量。",
        "检索优化策略包括混合检索、重排序和查询改写等方法。",
        "常见的向量数据库包括 Pinecone、Weaviate、Milvus、Chroma 和 Qdrant。",
    ],
}

dataset = build_ragas_dataset(**sample_data)
print(f"数据集大小: {len(dataset)}")
print(f"数据集字段: {dataset.column_names}")
print(f"第一条样本: {dataset[0]}")
```

---

## 4. 执行 RAGAS 评估

```python
"""
执行 RAGAS 评估 - 单次评估与批量评估
"""

import json
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from pathlib import Path


@dataclass
class RAGASEvalConfig:
    """RAGAS 评估配置"""
    metrics: list = field(default_factory=lambda: [
        "faithfulness",
        "answer_relevancy",
        "context_precision",
        "context_recall",
    ])
    llm_model: str = "gpt-4o-mini"
    embeddings_model: str = "text-embedding-3-small"
    max_workers: int = 4
    batch_size: int = 10


class RAGASEvaluator:
    """RAGAS 评估器"""

    def __init__(self, config: Optional[RAGASEvalConfig] = None):
        self.config = config or RAGASEvalConfig()
        self.results_history: List[Dict] = []

    def evaluate_single(
        self,
        question: str,
        answer: str,
        contexts: List[str],
        ground_truth: str,
    ) -> Dict[str, float]:
        """单条样本评估"""
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import (
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        )

        data = {
            "question": [question],
            "answer": [answer],
            "contexts": [contexts],
            "ground_truth": [ground_truth],
        }
        dataset = Dataset.from_dict(data)

        metrics_map = {
            "faithfulness": faithfulness,
            "answer_relevancy": answer_relevancy,
            "context_precision": context_precision,
            "context_recall": context_recall,
        }
        selected_metrics = [
            metrics_map[m] for m in self.config.metrics if m in metrics_map
        ]

        result = evaluate(
            dataset=dataset,
            metrics=selected_metrics,
        )
        return {m: result[m][0] for m in self.config.metrics if m in result}

    def evaluate_batch(
        self,
        questions: List[str],
        answers: List[str],
        contexts: List[List[str]],
        ground_truths: List[str],
        run_name: str = "batch_eval",
    ) -> Dict[str, Any]:
        """批量评估"""
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import (
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        )

        start_time = time.time()

        data = {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
            "ground_truth": ground_truths,
        }
        dataset = Dataset.from_dict(data)

        metrics_map = {
            "faithfulness": faithfulness,
            "answer_relevancy": answer_relevancy,
            "context_precision": context_precision,
            "context_recall": context_recall,
        }
        selected_metrics = [
            metrics_map[m] for m in self.config.metrics if m in metrics_map
        ]

        result = evaluate(
            dataset=dataset,
            metrics=selected_metrics,
        )

        duration = time.time() - start_time

        report = {
            "run_name": run_name,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset_size": len(questions),
            "duration_seconds": round(duration, 2),
            "aggregate_scores": {m: float(result[m]) for m in self.config.metrics if m in result},
            "per_sample_scores": self._extract_per_sample(result, len(questions)),
        }

        self.results_history.append(report)
        return report

    def _extract_per_sample(self, result, n: int) -> List[Dict]:
        """提取每条样本的分数"""
        per_sample = []
        for i in range(n):
            sample_scores = {}
            for metric in self.config.metrics:
                if metric in result:
                    try:
                        sample_scores[metric] = result[metric][i]
                    except (IndexError, TypeError):
                        sample_scores[metric] = None
            per_sample.append(sample_scores)
        return per_sample

    def compare_runs(self, run_names: List[str]) -> Dict[str, Any]:
        """对比多次评估结果"""
        comparison = {}
        for run in self.results_history:
            if run["run_name"] in run_names:
                comparison[run["run_name"]] = run["aggregate_scores"]
        return comparison

    def get_worst_samples(
        self,
        run_name: str,
        metric: str,
        n: int = 5,
    ) -> List[Dict]:
        """获取指定指标最差的样本"""
        for run in self.results_history:
            if run["run_name"] == run_name:
                sorted_samples = sorted(
                    run["per_sample_scores"],
                    key=lambda x: x.get(metric, 1.0),
                )
                return sorted_samples[:n]
        return []


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    evaluator = RAGASEvaluator(RAGASEvalConfig(
        metrics=["faithfulness", "answer_relevancy", "context_precision", "context_recall"],
    ))

    questions = ["什么是 RAG？", "如何优化检索？", "向量数据库有哪些？"]
    answers = [
        "RAG 是检索增强生成技术。",
        "可以通过混合检索优化。",
        "Pinecone、Milvus、Weaviate 等。",
    ]
    contexts = [
        ["RAG (Retrieval-Augmented Generation) 是一种结合检索和生成的技术。"],
        ["混合检索结合关键词和向量检索两种方式。"],
        ["主流向量数据库包括 Pinecone、Milvus、Weaviate。"],
    ]
    ground_truths = [
        "RAG 是一种结合检索和生成的 AI 框架。",
        "可以使用混合检索、重排序等方式优化。",
        "常见向量数据库有 Pinecone、Milvus、Weaviate。",
    ]

    report = evaluator.evaluate_batch(
        questions=questions,
        answers=answers,
        contexts=contexts,
        ground_truths=ground_truths,
        run_name="baseline_v1",
    )

    print(json.dumps(report["aggregate_scores"], indent=2))
```

---

## 5. 自定义 RAGAS 指标

```python
"""
自定义 RAGAS 指标
"""

from ragas.metrics import MetricWithLLM
from ragas.llms import llm_factory
from ragas.metrics.base import MetricType
from dataclasses import dataclass


@dataclass
class CustomFaithfulnessStrict(MetricWithLLM):
    """
    严格版 Faithfulness
    要求每个声明都必须有明确的上下文支撑，不允许模糊匹配
    """
    name: str = "faithfulness_strict"
    _required_columns: MetricType = MetricType.QUESTION | MetricType.ANSWER | MetricType.CONTEXTS

    def _get_score(self, response: str) -> float:
        """从 LLM 响应中提取分数"""
        try:
            if "YES" in response.upper():
                return 1.0
            elif "NO" in response.upper():
                return 0.0
            else:
                return 0.5
        except Exception:
            return 0.0

    async def _ascore(self, row: dict, callbacks=None) -> float:
        """异步评分"""
        question = row["question"]
        answer = row["answer"]
        contexts = row["contexts"]

        prompt = f"""You are a strict fact-checker. Evaluate if the answer is FULLY supported by the given context.

Question: {question}

Context:
{chr(10).join(f"- {c}" for c in contexts)}

Answer: {answer}

Instructions:
1. Extract EACH factual claim from the answer
2. Check if EACH claim has EXPLICIT support in the context
3. If ANY claim is not explicitly supported, the answer FAILS

Does the answer ONLY contain information explicitly stated in the context?
Reply with ONLY "YES" or "NO"."""

        llm = llm_factory(self.llm)
        response = await llm.agenerate(prompt)
        return self._get_score(response)


@dataclass
class AnswerCompleteness(MetricWithLLM):
    """
    回答完整性指标
    评估标准答案中的关键信息在回答中的覆盖率
    """
    name: str = "answer_completeness"
    _required_columns: MetricType = (
        MetricType.QUESTION | MetricType.ANSWER | MetricType.GROUND_TRUTH
    )

    async def _ascore(self, row: dict, callbacks=None) -> float:
        question = row["question"]
        answer = row["answer"]
        ground_truth = row["ground_truth"]

        prompt = f"""Evaluate how completely the answer covers the key information from the reference answer.

Question: {question}

Reference Answer: {ground_truth}

Candidate Answer: {answer}

Instructions:
1. List the key facts/information points from the Reference Answer
2. Check how many of these key points are covered in the Candidate Answer
3. Score from 0.0 (no coverage) to 1.0 (full coverage)

Return ONLY a float number between 0.0 and 1.0:"""

        llm = llm_factory(self.llm)
        response = await llm.agenerate(prompt)
        try:
            return float(response.strip())
        except ValueError:
            return 0.0


@dataclass
class ContextUsefulness(MetricWithLLM):
    """
    上下文有用性指标
    评估检索到的上下文对回答问题的实际帮助程度
    """
    name: str = "context_usefulness"
    _required_columns: MetricType = (
        MetricType.QUESTION | MetricType.ANSWER | MetricType.CONTEXTS
    )

    async def _ascore(self, row: dict, callbacks=None) -> float:
        question = row["question"]
        answer = row["answer"]
        contexts = row["contexts"]

        prompt = f"""Rate how useful the provided context is for answering the question.

Question: {question}

Context:
{chr(10).join(f"- {c}" for c in contexts)}

Answer: {answer}

Rate on a scale of 0.0 to 1.0:
- 0.0: Context is completely irrelevant
- 0.5: Context is partially relevant but missing key information
- 1.0: Context contains all necessary information to answer perfectly

Return ONLY a float number:"""

        llm = llm_factory(self.llm)
        response = await llm.agenerate(prompt)
        try:
            return float(response.strip())
        except ValueError:
            return 0.0


# ============================================================
# 使用自定义指标
# ============================================================

def run_with_custom_metrics(dataset):
    """使用自定义指标评估"""
    from ragas import evaluate

    custom_metrics = [
        CustomFaithfulnessStrict(),
        AnswerCompleteness(),
        ContextUsefulness(),
    ]

    result = evaluate(
        dataset=dataset,
        metrics=custom_metrics,
    )

    return result
```

---

## 6. RAGAS 结果可视化

```python
"""
RAGAS 评估结果可视化
"""

import json
from typing import Dict, List, Any
from pathlib import Path


class RAGASVisualizer:
    """RAGAS 结果可视化器"""

    def __init__(self, report: Dict[str, Any]):
        self.report = report
        self.aggregate = report.get("aggregate_scores", {})
        self.per_sample = report.get("per_sample_scores", [])

    def print_summary(self) -> str:
        """打印文本摘要"""
        lines = []
        lines.append("=" * 60)
        lines.append(f"  RAGAS 评估报告: {self.report.get('run_name', 'N/A')}")
        lines.append(f"  数据集大小: {self.report.get('dataset_size', 0)}")
        lines.append(f"  评估时间: {self.report.get('timestamp', 'N/A')}")
        lines.append("=" * 60)
        lines.append("")
        lines.append("  聚合指标:")
        lines.append("  " + "-" * 40)

        for metric, score in self.aggregate.items():
            bar_len = int(score * 30)
            bar = "█" * bar_len + "░" * (30 - bar_len)
            lines.append(f"  {metric:<25} {bar} {score:.4f}")

        lines.append("")
        lines.append("=" * 60)

        # 添加解读
        lines.append("")
        lines.append("  指标解读:")
        lines.append("  " + "-" * 40)
        for metric, score in self.aggregate.items():
            interpretation = self._interpret(metric, score)
            lines.append(f"  {metric}: {interpretation}")

        return "\n".join(lines)

    def _interpret(self, metric: str, score: float) -> str:
        """解读指标分数"""
        if score >= 0.9:
            level = "优秀 ✅"
        elif score >= 0.7:
            level = "良好 🟡"
        elif score >= 0.5:
            level = "一般 🟠"
        else:
            level = "需要改进 🔴"

        explanations = {
            "faithfulness": "回答忠实度",
            "answer_relevancy": "回答相关性",
            "context_precision": "上下文精确度",
            "context_recall": "上下文召回率",
        }
        name = explanations.get(metric, metric)
        return f"{name} {level} ({score:.2f})"

    def generate_ascii_radar(self) -> str:
        """生成 ASCII 雷达图"""
        metrics = list(self.aggregate.keys())
        scores = list(self.aggregate.values())
        n = len(metrics)

        if n == 0:
            return "  (无数据)"

        lines = []
        lines.append("  RAGAS 指标雷达图:")
        lines.append("")

        max_width = 40
        for metric, score in zip(metrics, scores):
            bar_len = int(score * max_width)
            bar = "█" * bar_len + "░" * (max_width - bar_len)
            lines.append(f"  {metric:<20} |{bar}| {score:.2f}")

        return "\n".join(lines)

    def generate_comparison_table(self, other_reports: List[Dict]) -> str:
        """生成对比表格"""
        all_runs = [self.report] + other_reports
        metrics = list(self.aggregate.keys())

        lines = []
        header = f"  {'Metric':<20}"
        for run in all_runs:
            header += f"  {run.get('run_name', 'N/A'):<12}"
        lines.append(header)
        lines.append("  " + "-" * (20 + 14 * len(all_runs)))

        for metric in metrics:
            row = f"  {metric:<20}"
            for run in all_runs:
                score = run.get("aggregate_scores", {}).get(metric, 0)
                row += f"  {score:<12.4f}"
            lines.append(row)

        return "\n".join(lines)

    def find_problematic_samples(
        self,
        metric: str,
        threshold: float = 0.5,
    ) -> List[Dict]:
        """找到指定指标低于阈值的问题样本"""
        problems = []
        for i, sample in enumerate(self.per_sample):
            score = sample.get(metric, 1.0)
            if score is not None and score < threshold:
                problems.append({"index": i, "score": score, **sample})
        return sorted(problems, key=lambda x: x["score"])

    def export_for_review(self, output_path: str) -> None:
        """导出评估结果供人工审核"""
        review_data = {
            "summary": self.aggregate,
            "samples": [],
        }
        for i, sample in enumerate(self.per_sample):
            review_data["samples"].append({
                "index": i,
                "question": self.report.get("questions", [])[i] if i < len(self.report.get("questions", [])) else "",
                "scores": sample,
                "needs_review": any(
                    v is not None and v < 0.5 for v in sample.values()
                ),
            })

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(review_data, f, ensure_ascii=False, indent=2)


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    sample_report = {
        "run_name": "baseline_v1",
        "timestamp": "2024-01-15 10:30:00",
        "dataset_size": 100,
        "aggregate_scores": {
            "faithfulness": 0.82,
            "answer_relevancy": 0.75,
            "context_precision": 0.68,
            "context_recall": 0.71,
        },
        "per_sample_scores": [
            {"faithfulness": 0.9, "answer_relevancy": 0.8, "context_precision": 0.7, "context_recall": 0.6},
            {"faithfulness": 0.3, "answer_relevancy": 0.5, "context_precision": 0.4, "context_recall": 0.3},
        ],
    }

    viz = RAGASVisualizer(sample_report)
    print(viz.print_summary())
    print()
    print(viz.generate_ascii_radar())

    problems = viz.find_problematic_samples("faithfulness", threshold=0.5)
    if problems:
        print(f"\n  ⚠️ 发现 {len(problems)} 个忠实度问题样本:")
        for p in problems:
            print(f"    样本 {p['index']}: faithfulness={p['score']:.2f}")
```

---

## 7. 批量评估最佳实践

```python
"""
RAGAS 批量评估最佳实践
"""

import asyncio
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class BatchEvalConfig:
    """批量评估配置"""
    batch_size: int = 20
    max_concurrent: int = 5
    retry_count: int = 3
    timeout_seconds: int = 300
    save_intermediate: bool = True


class BatchRAGASEvaluator:
    """批量 RAGAS 评估器"""

    def __init__(self, config: BatchEvalConfig = None):
        self.config = config or BatchEvalConfig()
        self.intermediate_results: List[Dict] = []

    async def evaluate_in_batches(
        self,
        dataset,
        metrics,
        output_dir: str = "batch_results",
    ) -> Dict[str, Any]:
        """分批评估大数据集"""
        import os
        os.makedirs(output_dir, exist_ok=True)

        total = len(dataset)
        batch_size = self.config.batch_size
        all_scores = {m.name: [] for m in metrics}

        for batch_idx in range(0, total, batch_size):
            batch_end = min(batch_idx + batch_size, total)
            batch = dataset.select(range(batch_idx, batch_end))

            print(f"  处理批次 {batch_idx // batch_size + 1}: "
                  f"样本 {batch_idx}-{batch_end}")

            from ragas import evaluate
            result = evaluate(
                dataset=batch,
                metrics=metrics,
            )

            for metric_name in all_scores:
                if metric_name in result:
                    all_scores[metric_name].extend(result[metric_name])

            if self.config.save_intermediate:
                intermediate = {
                    "batch_idx": batch_idx,
                    "scores": {k: float(result[k]) for k in all_scores if k in result},
                }
                self.intermediate_results.append(intermediate)

        # 计算聚合分数
        aggregate = {}
        for metric_name, scores in all_scores.items():
            valid_scores = [s for s in scores if s is not None]
            if valid_scores:
                aggregate[metric_name] = sum(valid_scores) / len(valid_scores)

        return {
            "aggregate": aggregate,
            "per_sample": all_scores,
            "batches_processed": (total + batch_size - 1) // batch_size,
        }


def estimate_cost(dataset_size: int, num_metrics: int = 4) -> Dict[str, Any]:
    """估算 RAGAS 评估的 API 成本"""
    # RAGAS 每条样本每个指标大约需要 2-3 次 LLM 调用
    calls_per_sample_per_metric = 2.5
    total_calls = dataset_size * num_metrics * calls_per_sample_per_metric

    # 假设每次调用约 1000 tokens 输入 + 100 tokens 输出
    input_tokens = total_calls * 1000
    output_tokens = total_calls * 100

    # GPT-4o-mini 价格 (示例)
    input_cost = input_tokens * 0.15 / 1_000_000
    output_cost = output_tokens * 0.60 / 1_000_000

    return {
        "dataset_size": dataset_size,
        "num_metrics": num_metrics,
        "estimated_llm_calls": int(total_calls),
        "estimated_input_tokens": int(input_tokens),
        "estimated_output_tokens": int(output_tokens),
        "estimated_cost_usd": round(input_cost + output_cost, 4),
        "estimated_time_minutes": round(total_calls / 60, 1),  # 假设 1 call/sec
    }
```

---

## 8. 常见误区

```
┌─────────────────────────────────────────────────────────────────┐
│                       常见错误                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ 错误1: contexts 格式错误                                     │
│     RAGAS 要求 contexts 是 List[List[str]]，不是 List[str]      │
│     ✅ 正确: [["context1", "context2"], ["context3"]]           │
│                                                                 │
│  ❌ 错误2: ground_truth 为空或缺失                               │
│     Context Recall 需要 ground_truth 字段                       │
│     ✅ 正确: 确保每条样本都有 ground_truth                       │
│                                                                 │
│  ❌ 错误3: 不设置 API 限制就跑大批量评估                         │
│     可能导致 API 限流或高额费用                                  │
│     ✅ 正确: 分批评估，设置合理的 batch_size 和 max_workers      │
│                                                                 │
│  ❌ 错误4: 只看聚合分数不看每条样本                              │
│     聚合分数可能掩盖个别严重问题                                 │
│     ✅ 正确: 分析分数分布，找出低分样本并定位原因                 │
│                                                                 │
│  ❌ 错误5: 评估数据集与实际分布不匹配                            │
│     评估数据集应反映真实用户查询的分布                           │
│     ✅ 正确: 从生产日志中采样构建评估数据集                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 工程建议

1. **RAGAS 评估数据集的质量决定评估结果**：RAGAS 依赖 ground truth 答案来计算指标。如果你的 ground truth 本身不准确，评估结果就毫无意义。建议先人工审核数据集质量。
2. **四大指标要结合业务场景解读**：Faithfulness 高但 Answer Relevance 低，说明系统回答得很忠实但答非所问。不同业务场景对各指标的权重不同，要根据实际需求调整关注重点。
3. **批量评估时注意 API 限流**：RAGAS 的 LLM-based 指标需要调用 LLM API，大规模评估时容易触发限流。建议设置合理的并发控制和重试机制。
4. **定期用 RAGAS 做回归测试**：每次配置变更或模型升级后，用同一份评估数据集跑 RAGAS，对比前后指标变化。这比凭直觉判断"变好了"更可靠。

---

## 10. 总结

```
┌─────────────────────────────────────────────────────────┐
│                   本课核心要点                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. RAGAS 四大指标各有侧重:                             │
│     • Faithfulness → 幻觉检测                           │
│     • Answer Relevancy → 答非所问检测                   │
│     • Context Precision → 检索精确度                    │
│     • Context Recall → 检索召回率                       │
│                                                         │
│  2. 数据集格式必须严格遵循 RAGAS 要求                   │
│  3. 自定义指标可以针对业务需求扩展评估维度               │
│  4. 批量评估要注意成本控制和 API 限制                    │
│  5. 结果分析要深入到每条样本，不能只看聚合分数           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 11. 练习

### 练习 1: RAGAS 基础评估 (基础)
使用 RAGAS 对你的 RAG 系统进行评估:
1. 准备 20 条评估样本
2. 计算四大核心指标
3. 输出评估报告

### 练习 2: 自定义指标 (进阶)
实现一个 `AnswerConciseness` 指标:
- 评估回答的简洁程度（是否包含冗余信息）
- 使用 LLM 判断回答中是否有与问题无关的内容
- 将其集成到 RAGAS 评估流程中

### 练习 3: 评估结果深度分析 (综合)
1. 对同一数据集运行两次评估（使用不同的 RAG 配置）
2. 对比两次结果，找出显著改善和退步的指标
3. 分析退步样本的共同特征
4. 生成包含可视化图表的完整评估报告

---

**上一课**: [01-RAG 评估体系设计](./01-RAG评估体系设计.md) |
**下一课**: [03-人工评估与标注](./03-人工评估与标注.md)

---

## 参考答案

### 练习 1: RAGAS 基础评估 (基础)

**思路**：构建符合 RAGAS 要求的数据集（question、answer、contexts、ground_truth 四个字段），然后调用 RAGAS 的 `evaluate` 函数计算四大核心指标。关键是 contexts 必须是 `List[List[str]]` 格式，每条样本的 ground_truth 不能为空。

**答案**：
```python
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)

questions = [
    "什么是 RAG？",
    "如何优化向量检索的性能？",
    "RAGAS 评估框架的核心指标有哪些？",
    "什么是 Embedding 模型？",
    "如何处理 RAG 中的幻觉问题？",
    "BM25 和向量检索有什么区别？",
    "如何选择合适的分块大小？",
    "什么是 Reranker？",
    "RAG 系统中如何做查询改写？",
    "向量数据库有哪些常见选择？",
    "如何评估检索质量？",
    "什么是混合检索？",
    "如何降低 RAG 的响应延迟？",
    "RAG 中的上下文窗口限制如何处理？",
    "如何实现多轮对话的 RAG？",
    "什么是 HyDE 检索策略？",
    "如何监控 RAG 系统的线上质量？",
    "RAG 和微调哪个更适合知识密集型任务？",
    "如何处理多语言 RAG 场景？",
    "什么是 Agentic RAG？",
]

answers = [
    "RAG 是检索增强生成技术，通过检索外部知识来增强 LLM 的回答质量。",
    "可以使用 HNSW 索引、PQ 量化压缩、元数据过滤等方式优化。",
    "RAGAS 的核心指标包括 Faithfulness、Answer Relevancy、Context Precision 和 Context Recall。",
    "Embedding 模型将文本转换为高维向量表示，用于语义相似度计算。",
    "可以通过 Prompt 约束、引用标注、Faithfulness 检测等方式处理幻觉。",
    "BM25 基于关键词匹配，向量检索基于语义相似度，两者互补。",
    "分块大小需要平衡信息完整性和检索精度，通常 200-500 token。",
    "Reranker 是对初步检索结果进行二次排序的模型，提升结果质量。",
    "查询改写使用 LLM 将用户原始查询优化为更适合检索的形式。",
    "常见的向量数据库包括 Pinecone、Milvus、Weaviate、Chroma、Qdrant。",
    "检索质量可通过 Recall@K、Precision@K、MRR 等指标评估。",
    "混合检索结合 BM25 关键词检索和向量语义检索，通过 RRF 融合结果。",
    "可以通过缓存、异步请求、减少 top_k、使用更快的模型来降低延迟。",
    "可以通过滑动窗口、摘要压缩、选择性上下文等策略处理上下文限制。",
    "多轮对话 RAG 需要将对话历史整合到查询中，维护会话上下文。",
    "HyDE 先让 LLM 生成假设性答案，再用该答案进行向量检索。",
    "可以通过持续评估、用户反馈收集、A/B 测试等方式监控线上质量。",
    "RAG 适合需要实时知识更新的场景，微调适合需要特定风格/格式的场景。",
    "多语言 RAG 需要使用多语言 Embedding 模型和跨语言检索策略。",
    "Agentic RAG 结合 Agent 能力，支持多步检索、自适应查询和工具调用。",
]

contexts = [
    ["RAG (Retrieval-Augmented Generation) 是一种结合外部知识检索与大语言模型生成的技术框架。"],
    ["向量检索优化策略包括 HNSW 索引、PQ 量化、元数据过滤预处理等。"],
    ["RAGAS 框架定义了四大核心指标：Faithfulness（忠实度）、Answer Relevancy（回答相关性）、Context Precision（上下文精确度）、Context Recall（上下文召回率）。"],
    ["Embedding 模型将文本映射到高维向量空间，使语义相似的文本在向量空间中距离更近。"],
    ["幻觉处理策略包括 Prompt 约束、引用标注、Faithfulness 检测、温度控制等。"],
    ["BM25 是经典的关键词检索算法，向量检索基于 Embedding 的语义相似度，混合检索结合两者优势。"],
    ["分块策略需要平衡信息完整性和检索精度，RecursiveCharacterTextSplitter 是常用工具。"],
    ["Reranker 使用交叉编码器对 query-document 对进行精细打分，重新排序检索结果。"],
    ["查询改写通过 LLM 将用户模糊查询转化为更精确的检索查询，提升检索命中率。"],
    ["主流向量数据库包括 Pinecone（云原生）、Milvus（高性能）、Weaviate（开源）、Chroma（轻量级）、Qdrant（Rust 实现）。"],
    ["检索质量评估指标包括 Recall@K（召回率）、Precision@K（精确率）、MRR（平均倒数排名）、NDCG（归一化折扣累积增益）。"],
    ["混合检索同时执行 BM25 和向量检索，通过 Reciprocal Rank Fusion (RRF) 合并结果。"],
    ["降低 RAG 延迟的方法包括缓存热门查询、异步并行检索、减少 top_k、使用更轻量的模型。"],
    ["上下文窗口限制可通过滑动窗口、摘要压缩、选择性上下文、Map-Reduce 等策略处理。"],
    ["多轮对话 RAG 需要维护会话历史，将前序对话整合到当前查询中进行检索。"],
    ["HyDE（Hypothetical Document Embeddings）先生成假设性答案文档，再用该文档进行向量检索，提升检索效果。"],
    ["线上质量监控包括持续评估、用户反馈收集、异常检测和 A/B 测试。"],
    ["RAG 适合知识频繁更新的场景，微调适合需要特定输出风格的场景，两者可结合使用。"],
    ["多语言 RAG 需要多语言 Embedding 模型（如 multilingual-e5）和跨语言检索策略。"],
    ["Agentic RAG 将 Agent 的推理和工具调用能力融入 RAG，支持多步检索和自适应策略。"],
]

ground_truths = [
    "RAG（Retrieval-Augmented Generation）是一种结合外部知识检索与大语言模型生成的技术框架，通过检索相关文档来增强模型回答质量。",
    "向量检索优化包括使用 HNSW 索引加速搜索、PQ 量化压缩减少内存占用、元数据过滤缩小检索范围。",
    "RAGAS 的四大核心指标是 Faithfulness、Answer Relevancy、Context Precision 和 Context Recall。",
    "Embedding 模型将文本转换为高维向量表示，使语义相似的文本在向量空间中距离更近。",
    "处理幻觉的方法包括 Prompt 约束、引用标注、Faithfulness 检测和降低温度参数。",
    "BM25 基于词频和逆文档频率进行关键词匹配，向量检索基于 Embedding 的语义相似度。",
    "分块大小通常设置为 200-500 token，需要平衡信息完整性和检索精度。",
    "Reranker 使用交叉编码器对检索结果进行二次排序，提升最终结果的相关性。",
    "查询改写使用 LLM 将用户原始查询转化为更适合检索的形式。",
    "常见向量数据库包括 Pinecone、Milvus、Weaviate、Chroma 和 Qdrant。",
    "检索质量可通过 Recall@K、Precision@K、MRR、NDCG 等指标评估。",
    "混合检索结合 BM25 和向量检索，通过 RRF 融合结果。",
    "降低延迟的方法包括缓存、异步请求、减少 top_k 和使用更快的模型。",
    "上下文窗口限制可通过滑动窗口、摘要压缩、选择性上下文等策略处理。",
    "多轮对话 RAG 需要将对话历史整合到查询中，维护会话上下文。",
    "HyDE 先生成假设性答案，再用该答案进行向量检索。",
    "线上质量监控包括持续评估、用户反馈、异常检测和 A/B 测试。",
    "RAG 适合知识频繁更新的场景，微调适合需要特定输出风格的场景。",
    "多语言 RAG 需要多语言 Embedding 模型和跨语言检索策略。",
    "Agentic RAG 结合 Agent 能力，支持多步检索、自适应查询和工具调用。",
]

dataset = Dataset.from_dict({
    "question": questions,
    "answer": answers,
    "contexts": contexts,
    "ground_truth": ground_truths,
})

result = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
)

print("=" * 50)
print("RAGAS 评估报告")
print("=" * 50)
for metric_name in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]:
    print(f"  {metric_name}: {result[metric_name]:.4f}")
print("=" * 50)
```

**要点**：
- RAGAS 的 contexts 字段必须是 `List[List[str]]`，即每个问题对应一个字符串列表，不能是 `List[str]`
- ground_truth 不能为空，Context Recall 指标依赖它来计算检索覆盖率
- 评估前建议先用小批量（5-10 条）测试，确认数据格式正确后再跑全量

---

### 练习 2: 自定义指标 (进阶)

**思路**：`AnswerConciseness` 指标需要评估回答是否包含冗余信息。实现方式是从回答中提取每个句子，判断它是否与问题相关。如果回答中包含大量与问题无关的内容，简洁度分数就低。使用 LLM 让它判断每句话是否对回答问题有贡献。

**答案**：
```python
from dataclasses import dataclass
from ragas.metrics import MetricWithLLM
from ragas.metrics.base import MetricType
from ragas.llms import llm_factory


@dataclass
class AnswerConciseness(MetricWithLLM):
    """回答简洁度指标：评估回答是否包含与问题无关的冗余信息"""
    name: str = "answer_conciseness"
    _required_columns: MetricType = MetricType.QUESTION | MetricType.ANSWER

    async def _ascore(self, row: dict, callbacks=None) -> float:
        question = row["question"]
        answer = row["answer"]

        prompt = f"""Evaluate the conciseness of the answer relative to the question.

Question: {question}
Answer: {answer}

Instructions:
1. Identify any information in the answer that is NOT directly relevant to answering the question
2. Consider: does the answer contain unnecessary background, tangential facts, or filler?
3. Score from 0.0 (very verbose/irrelevant content) to 1.0 (perfectly concise, every sentence serves the question)

Return ONLY a float number between 0.0 and 1.0:"""

        llm = llm_factory(self.llm)
        response = await llm.agenerate(prompt)
        try:
            return max(0.0, min(1.0, float(response.strip())))
        except ValueError:
            return 0.5


def run_conciseness_eval(dataset):
    from ragas import evaluate
    result = evaluate(
        dataset=dataset,
        metrics=[AnswerConciseness()],
    )
    return result
```

**要点**：
- 自定义指标需要继承 `MetricWithLLM`，实现异步的 `_ascore` 方法
- `_required_columns` 定义了该指标需要的数据列，`MetricType.QUESTION | MetricType.ANSWER` 表示只需要问题和回答
- LLM 返回的分数需要做 `max(0.0, min(1.0, ...))` 的边界处理，防止 LLM 返回越界值

---

### 练习 3: 评估结果深度分析 (综合)

**思路**：需要对同一数据集用两种 RAG 配置分别评估，然后对比聚合分数和每条样本分数。重点是找出退步的样本，分析它们的共同特征（如都属于某个类别、都是长查询等），最后生成包含可视化的报告。

**答案**：
```python
import json
from typing import Dict, List, Any
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall


def run_evaluation(questions, answers, contexts, ground_truths, config_name):
    dataset = Dataset.from_dict({
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    })
    result = evaluate(
        dataset=dataset,
        metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    )
    return {
        "config": config_name,
        "aggregate": {m: float(result[m]) for m in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]},
        "per_sample": {m: result[m] for m in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]},
    }


def compare_results(result_a, result_b):
    print("=" * 60)
    print(f"对比: {result_a['config']} vs {result_b['config']}")
    print("=" * 60)
    print(f"{'指标':<25} {'配置A':<10} {'配置B':<10} {'变化':<10}")
    print("-" * 60)

    improved, regressed = [], []
    for metric in result_a["aggregate"]:
        va = result_a["aggregate"][metric]
        vb = result_b["aggregate"][metric]
        diff = vb - va
        symbol = "+" if diff > 0 else ""
        print(f"  {metric:<23} {va:<10.4f} {vb:<10.4f} {symbol}{diff:.4f}")
        if diff > 0.02:
            improved.append(metric)
        elif diff < -0.02:
            regressed.append(metric)

    return improved, regressed


def analyze_regressed_samples(result_a, result_b, questions, threshold=0.1):
    problem_indices = []
    for metric in result_a["per_sample"]:
        scores_a = result_a["per_sample"][metric]
        scores_b = result_b["per_sample"][metric]
        for i in range(len(scores_a)):
            if scores_a[i] - scores_b[i] > threshold:
                problem_indices.append(i)

    problem_indices = sorted(set(problem_indices))
    print(f"\n退步样本分析 (共 {len(problem_indices)} 条):")
    print("-" * 40)
    for idx in problem_indices:
        print(f"  样本 {idx}: {questions[idx][:50]}...")
        for metric in result_a["per_sample"]:
            diff = result_a["per_sample"][metric][idx] - result_b["per_sample"][metric][idx]
            if diff > 0.05:
                print(f"    {metric}: {result_a['per_sample'][metric][idx]:.2f} → {result_b['per_sample'][metric][idx]:.2f} (↓{diff:.2f})")
    return problem_indices


def generate_report(result_a, result_b, questions, improved, regressed, problem_indices):
    report = {
        "summary": {
            "improved_metrics": improved,
            "regressed_metrics": regressed,
            "problem_sample_count": len(problem_indices),
        },
        "recommendations": [],
    }
    if regressed:
        for m in regressed:
            report["recommendations"].append(f"指标 {m} 退步，建议检查该配置下检索/生成的具体变化")
    if problem_indices:
        report["recommendations"].append(f"有 {len(problem_indices)} 条样本质量下降，建议逐条分析共性")
    if not regressed:
        report["recommendations"].append("所有指标无退步，配置B可安全上线")

    print("\n评估报告:")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


# 使用示例（需要替换为真实数据）
questions = ["什么是 RAG？", "如何优化检索？"]
answers_v1 = ["RAG 是检索增强生成技术。", "可以通过混合检索优化。"]
answers_v2 = ["RAG 是一种框架。", "使用向量检索优化。"]
contexts = [
    ["RAG 是一种结合检索和生成的技术框架。"],
    ["混合检索结合关键词和向量检索两种方式。"],
]
ground_truths = ["RAG 是结合检索和生成的 AI 框架。", "可以使用混合检索、重排序优化。"]

result_a = run_evaluation(questions, answers_v1, contexts, ground_truths, "配置A (默认)")
result_b = run_evaluation(questions, answers_v2, contexts, ground_truths, "配置B (新检索)")
improved, regressed = compare_results(result_a, result_b)
problem_indices = analyze_regressed_samples(result_a, result_b, questions)
generate_report(result_a, result_b, questions, improved, regressed, problem_indices)
```

**要点**：
- 对比分析的核心是逐指标比较聚合分数，再逐样本找出退步严重的 case
- 退步样本的共同特征分析需要人工介入：按查询类型、难度、长度等维度分组查看
- 报告必须包含可执行的建议，不能只说"某指标下降了"，要给出排查方向

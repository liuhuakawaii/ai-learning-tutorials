# Stage 5 · Lesson 2: RAGAS 深度实战

> **时长**: 55 分钟 | **前置**: Lesson 1 完成
> **学习目标**:
> 1. 掌握 RAGAS 四大核心指标 (Faithfulness, Answer Relevancy, Context Precision, Context Recall)
> 2. 构建符合 RAGAS 要求的评估数据集
> 3. 执行批量评估并解读结果
> 4. 自定义 RAGAS 指标
> 5. 可视化评估结果

---

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

## 8. 常见错误

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

## 9. 总结

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

## 10. 练习

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

"""评估模块

自动化评估 RAG 系统质量。

使用方法:
    python src/evaluate.py --dataset data/eval.jsonl --metrics faithfulness,relevancy
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class EvalSample:
    """评估样本"""

    def __init__(
        self,
        question: str,
        ground_truth: str,
        contexts: list[str],
        answer: str,
    ):
        self.question = question
        self.ground_truth = ground_truth
        self.contexts = contexts
        self.answer = answer

    @classmethod
    def from_dict(cls, data: dict) -> "EvalSample":
        return cls(
            question=data["question"],
            ground_truth=data["ground_truth"],
            contexts=data["contexts"],
            answer=data["answer"],
        )


class RAGASEvaluator:
    """RAGAS 评估器"""

    METRICS = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]

    def __init__(self, metrics: list[str] = None):
        self.metrics = metrics or self.METRICS

    def evaluate(self, samples: list[EvalSample]) -> dict:
        """运行 RAGAS 评估"""
        try:
            from ragas import evaluate
            from ragas.metrics import (
                faithfulness,
                answer_relevancy,
                context_precision,
                context_recall,
            )
            from datasets import Dataset

            metric_map = {
                "faithfulness": faithfulness,
                "answer_relevancy": answer_relevancy,
                "context_precision": context_precision,
                "context_recall": context_recall,
            }

            selected_metrics = [metric_map[m] for m in self.metrics if m in metric_map]

            data = {
                "question": [s.question for s in samples],
                "answer": [s.answer for s in samples],
                "contexts": [s.contexts for s in samples],
                "ground_truth": [s.ground_truth for s in samples],
            }
            dataset = Dataset.from_dict(data)

            result = evaluate(dataset, metrics=selected_metrics)
            return result

        except ImportError:
            logger.warning("RAGAS 未安装，使用简化评估")
            return self._simple_evaluate(samples)

    def _simple_evaluate(self, samples: list[EvalSample]) -> dict:
        """简化评估（无需 RAGAS）"""
        results = {
            "total_samples": len(samples),
            "metrics": {},
        }

        # 简单的关键词匹配评估
        if "faithfulness" in self.metrics:
            faithful_count = 0
            for sample in samples:
                # 检查答案是否基于上下文
                context_text = " ".join(sample.contexts).lower()
                answer_words = sample.answer.lower().split()
                supported = sum(1 for w in answer_words if w in context_text)
                if len(answer_words) > 0 and supported / len(answer_words) > 0.3:
                    faithful_count += 1
            results["metrics"]["faithfulness"] = faithful_count / len(samples)

        if "answer_relevancy" in self.metrics:
            relevancy_count = 0
            for sample in samples:
                question_words = set(sample.question.lower().split())
                answer_words = set(sample.answer.lower().split())
                overlap = len(question_words & answer_words)
                if overlap > 0:
                    relevancy_count += 1
            results["metrics"]["answer_relevancy"] = relevancy_count / len(samples)

        return results


class OfflineEvaluator:
    """离线评估器 - 不需要 LLM 调用"""

    def evaluate_retrieval(
        self,
        queries: list[str],
        retrieved_docs: list[list[str]],
        relevant_docs: list[list[str]],
        k: int = 5,
    ) -> dict:
        """评估检索质量"""
        recall_scores = []
        precision_scores = []
        mrr_scores = []

        for query, retrieved, relevant in zip(queries, retrieved_docs, relevant_docs):
            retrieved_at_k = retrieved[:k]
            relevant_set = set(relevant)

            # Recall@K
            hits = len(set(retrieved_at_k) & relevant_set)
            recall = hits / len(relevant_set) if relevant_set else 0
            recall_scores.append(recall)

            # Precision@K
            precision = hits / k if k > 0 else 0
            precision_scores.append(precision)

            # MRR
            mrr = 0
            for rank, doc in enumerate(retrieved_at_k, 1):
                if doc in relevant_set:
                    mrr = 1.0 / rank
                    break
            mrr_scores.append(mrr)

        return {
            f"recall@{k}": sum(recall_scores) / len(recall_scores),
            f"precision@{k}": sum(precision_scores) / len(precision_scores),
            "mrr": sum(mrr_scores) / len(mrr_scores),
        }


def load_eval_dataset(file_path: Path) -> list[EvalSample]:
    """加载评估数据集"""
    samples = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            data = json.loads(line.strip())
            samples.append(EvalSample.from_dict(data))
    return samples


def generate_report(results: dict, output_path: Path):
    """生成评估报告"""
    report = "# RAG 评估报告\n\n"
    report += f"## 概览\n\n"
    report += f"- 评估样本数: {results.get('total_samples', 'N/A')}\n\n"
    report += f"## 指标\n\n"
    report += "| 指标 | 分数 |\n"
    report += "|------|------|\n"

    metrics = results.get("metrics", results.get("scores", {}))
    for metric, score in metrics.items():
        report += f"| {metric} | {score:.4f} |\n"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report, encoding="utf-8")
    logger.info(f"评估报告已生成: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="RAG 评估工具")
    parser.add_argument("--dataset", required=True, help="评估数据集路径")
    parser.add_argument("--metrics", default="faithfulness,relevancy", help="评估指标")
    parser.add_argument("--output", default="reports/eval_report.md", help="报告输出路径")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"错误: 数据集 {dataset_path} 不存在")
        return

    metrics = args.metrics.split(",")
    samples = load_eval_dataset(dataset_path)
    print(f"加载 {len(samples)} 个评估样本")

    evaluator = RAGASEvaluator(metrics=metrics)
    results = evaluator.evaluate(samples)

    print(f"\n评估结果:")
    if isinstance(results, dict):
        for metric, score in results.get("metrics", {}).items():
            print(f"  {metric}: {score:.4f}")
    else:
        print(results)

    generate_report(
        results if isinstance(results, dict) else {"metrics": dict(results)},
        Path(args.output),
    )


if __name__ == "__main__":
    main()

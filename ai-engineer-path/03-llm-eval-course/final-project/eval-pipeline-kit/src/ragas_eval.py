"""RAGAS 评估脚本（Mock 模式）。

计算 Context Precision / Recall / Faithfulness 等 RAGAS 指标。
实际使用时替换为 ragas 库的真实评估。

用法:
    python src/ragas_eval.py
"""
import json
from pathlib import Path
from dataclasses import dataclass

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass
class RAGASMetrics:
    context_precision: float
    context_recall: float
    faithfulness: float
    answer_relevancy: float


def mock_ragas_eval(sample: dict) -> RAGASMetrics:
    """模拟 RAGAS 指标计算。"""
    ctx = sample.get("retrieved_contexts", [])
    answer = sample.get("answer", "")
    reference = sample.get("ground_truth", "")

    ctx_precision = min(1.0, len(ctx) / max(len(reference.split(".")), 1))
    ctx_recall = 0.8 if any(w in answer.lower() for w in reference.lower().split()[:3]) else 0.3
    faithfulness = 0.9 if len(answer) > 0 else 0.0
    answer_relevancy = 0.85 if len(answer) > 10 else 0.5

    return RAGASMetrics(
        context_precision=round(ctx_precision, 2),
        context_recall=round(ctx_recall, 2),
        faithfulness=round(faithfulness, 2),
        answer_relevancy=round(answer_relevancy, 2),
    )


def main():
    ds_path = DATA_DIR / "rag_samples.json"
    samples = json.loads(ds_path.read_text(encoding="utf-8"))

    print("RAGAS 评估结果")
    print("=" * 60)

    all_metrics = []
    for i, sample in enumerate(samples, 1):
        metrics = mock_ragas_eval(sample)
        all_metrics.append(metrics)
        print(f"\n样本 {i}: {sample.get('question', 'N/A')[:50]}...")
        print(f"  Context Precision: {metrics.context_precision}")
        print(f"  Context Recall:    {metrics.context_recall}")
        print(f"  Faithfulness:      {metrics.faithfulness}")
        print(f"  Answer Relevancy:  {metrics.answer_relevancy}")

    if all_metrics:
        print(f"\n{'='*60}")
        print("平均指标:")
        print(f"  Context Precision: {sum(m.context_precision for m in all_metrics) / len(all_metrics):.2f}")
        print(f"  Context Recall:    {sum(m.context_recall for m in all_metrics) / len(all_metrics):.2f}")
        print(f"  Faithfulness:      {sum(m.faithfulness for m in all_metrics) / len(all_metrics):.2f}")
        print(f"  Answer Relevancy:  {sum(m.answer_relevancy for m in all_metrics) / len(all_metrics):.2f}")


if __name__ == "__main__":
    main()

"""LLM-as-Judge 评估 pipeline（Mock 模式）。

用法:
    python src/eval_pipeline.py
    python src/eval_pipeline.py --dataset data/golden_dataset.json
"""
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass
class EvalResult:
    question: str
    expected: str
    actual: str
    score: float
    reason: str


@dataclass
class EvalReport:
    total: int = 0
    passed: int = 0
    failed: int = 0
    avg_score: float = 0.0
    results: list = field(default_factory=list)


def mock_llm_judge(question: str, expected: str, actual: str) -> tuple[float, str]:
    """模拟 LLM-as-Judge 打分。实际使用时替换为真实 API 调用。"""
    overlap = set(expected.lower().split()) & set(actual.lower().split())
    score = min(1.0, len(overlap) / max(len(expected.split()), 1))
    reason = f"关键词重叠 {len(overlap)} 个"
    return round(score, 2), reason


def run_eval(dataset_path: Path, threshold: float = 0.6) -> EvalReport:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    report = EvalReport()

    for item in dataset:
        actual = item.get("mock_answer", item["expected_answer"])
        score, reason = mock_llm_judge(
            item["question"], item["expected_answer"], actual
        )
        result = EvalResult(
            question=item["question"],
            expected=item["expected_answer"],
            actual=actual,
            score=score,
            reason=reason,
        )
        report.results.append(result)
        report.total += 1
        if score >= threshold:
            report.passed += 1
        else:
            report.failed += 1

    if report.total > 0:
        report.avg_score = round(
            sum(r.score for r in report.results) / report.total, 2
        )
    return report


def main():
    parser = argparse.ArgumentParser(description="LLM-as-Judge 评估 pipeline")
    parser.add_argument(
        "--dataset", type=Path, default=DATA_DIR / "golden_dataset.json"
    )
    parser.add_argument("--threshold", type=float, default=0.6)
    args = parser.parse_args()

    print(f"加载评估数据集: {args.dataset}")
    report = run_eval(args.dataset, args.threshold)

    print(f"\n{'='*50}")
    print(f"评估结果: {report.passed}/{report.total} 通过")
    print(f"平均分数: {report.avg_score}")
    print(f"{'='*50}")
    for r in report.results:
        status = "✓" if r.score >= args.threshold else "✗"
        print(f"  {status} [{r.score}] {r.question[:40]}... — {r.reason}")


if __name__ == "__main__":
    main()

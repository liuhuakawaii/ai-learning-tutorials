"""评估系统骨架。

学员需要根据 03-llm-eval-course 的知识完成实现。

提供 SQL 正确性评估、分析质量评估、报告质量评估的框架。
"""
import json
from pathlib import Path
from dataclasses import dataclass

EVAL_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "eval_dataset"


@dataclass
class EvalResult:
    query: str
    sql_correct: bool
    analysis_score: float
    report_score: float
    details: dict


def load_golden_dataset() -> list[dict]:
    ds_path = EVAL_DATA_DIR / "golden_dataset.json"
    if not ds_path.exists():
        return []
    return json.loads(ds_path.read_text(encoding="utf-8"))


def mock_eval_sql(generated_sql: str, expected_sql: str) -> bool:
    """模拟 SQL 正确性评估。"""
    return generated_sql.strip().lower() == expected_sql.strip().lower()


def mock_eval_quality(text: str, criteria: list[str]) -> float:
    """模拟质量评估。返回 0-1 分数。"""
    score = 0.0
    for criterion in criteria:
        if criterion.lower() in text.lower():
            score += 1.0 / len(criteria)
    return round(min(score, 1.0), 2)


def run_eval(results: list[dict]) -> list[EvalResult]:
    """运行评估 pipeline。"""
    golden = load_golden_dataset()
    eval_results = []

    for i, result in enumerate(results):
        expected = golden[i] if i < len(golden) else {}
        eval_results.append(EvalResult(
            query=result.get("query", ""),
            sql_correct=mock_eval_sql(
                result.get("sql", ""),
                expected.get("expected_sql", "")
            ),
            analysis_score=mock_eval_quality(
                result.get("analysis", ""),
                expected.get("analysis_criteria", [])
            ),
            report_score=mock_eval_quality(
                result.get("report", ""),
                expected.get("report_criteria", [])
            ),
            details={"expected": expected, "actual": result},
        ))

    return eval_results


if __name__ == "__main__":
    print("评估系统骨架")
    print(f"评估数据目录: {EVAL_DATA_DIR}")
    print("请根据 03-llm-eval-course 课程完成评估系统实现")

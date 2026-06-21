"""输出评估器 — 多策略评估 Prompt 输出质量."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from enum import Enum
from typing import Any


class MatchType(str, Enum):
    """匹配类型."""

    EXACT = "exact"
    CONTAINS = "contains"
    FUZZY = "fuzzy"
    REGEX = "regex"
    KEYWORD = "keyword"
    SEMANTIC = "semantic"


@dataclass
class EvalResult:
    """评估结果."""

    score: float
    passed: bool
    match_type: str
    details: dict[str, Any] = field(default_factory=dict)


class Evaluator:
    """多策略 Prompt 输出评估器.

    支持精确匹配、包含匹配、模糊匹配、正则匹配、关键词匹配。
    """

    def __init__(self, default_threshold: float = 0.8) -> None:
        """初始化评估器.

        Args:
            default_threshold: 默认通过阈值（0-1）
        """
        self._default_threshold = default_threshold
        self._evaluators: dict[str, Any] = {
            MatchType.EXACT: self._eval_exact,
            MatchType.CONTAINS: self._eval_contains,
            MatchType.FUZZY: self._eval_fuzzy,
            MatchType.REGEX: self._eval_regex,
            MatchType.KEYWORD: self._eval_keyword,
        }

    def evaluate(
        self,
        expected: str,
        actual: str,
        criteria: dict[str, Any] | None = None,
    ) -> EvalResult:
        """评估实际输出.

        Args:
            expected: 期望输出
            actual: 实际输出
            criteria: 评估标准，如 {"match_type": "fuzzy", "threshold": 0.9}

        Returns:
            评估结果
        """
        criteria = criteria or {}
        match_type = MatchType(criteria.get("match_type", MatchType.FUZZY))
        threshold = criteria.get("threshold", self._default_threshold)

        eval_fn = self._evaluators.get(match_type)
        if eval_fn is None:
            return EvalResult(
                score=0.0,
                passed=False,
                match_type=match_type.value,
                details={"error": f"不支持的匹配类型: {match_type.value}"},
            )

        result = eval_fn(expected, actual, criteria)
        result.passed = result.score >= threshold
        return result

    def multi_evaluate(
        self,
        expected: str,
        actual: str,
        criteria_list: list[dict[str, Any]],
    ) -> EvalResult:
        """多标准加权评估.

        Args:
            expected: 期望输出
            actual: 实际输出
            criteria_list: 多个评估标准及权重 [{"match_type": "exact", "weight": 0.5}, ...]

        Returns:
            加权平均评估结果
        """
        if not criteria_list:
            return self.evaluate(expected, actual)

        total_weight = sum(c.get("weight", 1.0) for c in criteria_list)
        weighted_score = 0.0
        all_details: dict[str, Any] = {}

        for criteria in criteria_list:
            weight = criteria.get("weight", 1.0)
            result = self.evaluate(expected, actual, criteria)
            weighted_score += result.score * weight
            all_details[result.match_type] = result.details

        final_score = weighted_score / total_weight if total_weight > 0 else 0.0

        return EvalResult(
            score=final_score,
            passed=final_score >= self._default_threshold,
            match_type="multi",
            details=all_details,
        )

    def _eval_exact(self, expected: str, actual: str, criteria: dict) -> EvalResult:
        """精确匹配."""
        match = expected.strip() == actual.strip()
        return EvalResult(
            score=1.0 if match else 0.0,
            passed=match,
            match_type=MatchType.EXACT.value,
        )

    def _eval_contains(self, expected: str, actual: str, criteria: dict) -> EvalResult:
        """包含匹配."""
        case_sensitive = criteria.get("case_sensitive", False)
        if case_sensitive:
            match = expected in actual
        else:
            match = expected.lower() in actual.lower()
        return EvalResult(
            score=1.0 if match else 0.0,
            passed=match,
            match_type=MatchType.CONTAINS.value,
        )

    def _eval_fuzzy(self, expected: str, actual: str, criteria: dict) -> EvalResult:
        """模糊匹配（基于序列相似度）."""
        ratio = SequenceMatcher(None, expected.strip(), actual.strip()).ratio()
        return EvalResult(
            score=ratio,
            passed=False,
            match_type=MatchType.FUZZY.value,
            details={"similarity": round(ratio, 4)},
        )

    def _eval_regex(self, expected: str, actual: str, criteria: dict) -> EvalResult:
        """正则匹配 — expected 作为正则表达式."""
        try:
            match = bool(re.search(expected, actual, re.DOTALL))
        except re.error as e:
            return EvalResult(
                score=0.0,
                passed=False,
                match_type=MatchType.REGEX.value,
                details={"error": f"正则表达式错误: {e}"},
            )
        return EvalResult(
            score=1.0 if match else 0.0,
            passed=match,
            match_type=MatchType.REGEX.value,
        )

    def _eval_keyword(self, expected: str, actual: str, criteria: dict) -> EvalResult:
        """关键词匹配 — 检查输出是否包含所有关键词."""
        keywords = criteria.get("keywords", expected.split())
        case_sensitive = criteria.get("case_sensitive", False)

        if not keywords:
            return EvalResult(score=1.0, passed=True, match_type=MatchType.KEYWORD.value)

        actual_check = actual if case_sensitive else actual.lower()
        matched = []
        missing = []

        for kw in keywords:
            kw_check = kw if case_sensitive else kw.lower()
            if kw_check in actual_check:
                matched.append(kw)
            else:
                missing.append(kw)

        score = len(matched) / len(keywords)
        return EvalResult(
            score=score,
            passed=False,
            match_type=MatchType.KEYWORD.value,
            details={"matched": matched, "missing": missing},
        )

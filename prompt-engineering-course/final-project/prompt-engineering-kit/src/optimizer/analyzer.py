"""Prompt 质量分析器 — 分析 Prompt 的长度、复杂度、Token 使用等指标."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AnalysisReport:
    """Prompt 分析报告."""

    prompt_text: str
    char_count: int
    word_count: int
    line_count: int
    sentence_count: int
    token_estimate: int
    token_cost_estimate: float
    clarity_score: float
    specificity_score: float
    structure_score: float
    overall_score: float
    issues: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)


class PromptAnalyzer:
    """Prompt 质量分析器.

    提供长度分析、Token 估算、清晰度评分、结构评分等功能。
    """

    COST_PER_1K_TOKENS = {
        "gpt-4o": 0.005,
        "gpt-4o-mini": 0.00015,
        "gpt-4-turbo": 0.01,
        "gpt-3.5-turbo": 0.0005,
        "claude-3-5-sonnet": 0.003,
        "claude-3-haiku": 0.00025,
    }

    AMBIGUOUS_WORDS = {
        "thing", "stuff", "something", "things", "it", "they",
        "good", "bad", "nice", "better", "best",
        "some", "many", "few", "several", "a lot",
        "maybe", "perhaps", "probably", "might",
        "etc", "and so on", "whatever",
    }

    STRUCTURAL_MARKERS = {
        "numbered": re.compile(r"^\d+[\.\)]\s", re.MULTILINE),
        "bullet": re.compile(r"^[-*•]\s", re.MULTILINE),
        "header": re.compile(r"^#{1,6}\s", re.MULTILINE),
        "step": re.compile(r"(?i)^step\s+\d", re.MULTILINE),
        "label": re.compile(r"^[\w\s]+:", re.MULTILINE),
    }

    def __init__(self, default_model: str = "gpt-4o-mini") -> None:
        self._default_model = default_model

    def analyze(self, prompt: str) -> AnalysisReport:
        """全面分析一个 Prompt.

        Args:
            prompt: Prompt 文本

        Returns:
            分析报告
        """
        char_count = len(prompt)
        words = prompt.split()
        word_count = len(words)
        lines = prompt.splitlines()
        line_count = len(lines)
        sentences = self._split_sentences(prompt)
        sentence_count = len(sentences)

        token_estimate = self._estimate_tokens(prompt)
        token_cost = self._estimate_cost(token_estimate, self._default_model)

        clarity_score = self._score_clarity(prompt, words, sentences)
        specificity_score = self._score_specificity(prompt, words)
        structure_score = self._score_structure(prompt)

        overall_score = (clarity_score * 0.4 + specificity_score * 0.3 + structure_score * 0.3)

        issues = self._find_issues(prompt, words, clarity_score, specificity_score, structure_score)

        return AnalysisReport(
            prompt_text=prompt,
            char_count=char_count,
            word_count=word_count,
            line_count=line_count,
            sentence_count=sentence_count,
            token_estimate=token_estimate,
            token_cost_estimate=token_cost,
            clarity_score=round(clarity_score, 3),
            specificity_score=round(specificity_score, 3),
            structure_score=round(structure_score, 3),
            overall_score=round(overall_score, 3),
            issues=issues,
            metrics={
                "avg_words_per_sentence": round(word_count / max(sentence_count, 1), 1),
                "avg_chars_per_word": round(char_count / max(word_count, 1), 1),
                "has_role_definition": self._has_role(prompt),
                "has_format_instruction": self._has_format_instruction(prompt),
                "has_examples": self._has_examples(prompt),
                "has_constraints": self._has_constraints(prompt),
            },
        )

    def estimate_tokens(self, text: str) -> int:
        """估算 Token 数（公开方法）."""
        return self._estimate_tokens(text)

    def estimate_cost(self, token_count: int, model: str | None = None) -> float:
        """估算 API 调用成本（美元）."""
        return self._estimate_cost(token_count, model or self._default_model)

    def _estimate_tokens(self, text: str) -> int:
        """估算 Token 数.

        粗略估算：英文约 4 字符/token，中文约 2 字符/token。
        """
        cjk_chars = len(re.findall(r"[\u4e00-\u9fff\u3400-\u4dbf]", text))
        other_chars = len(text) - cjk_chars
        return int(other_chars / 4 + cjk_chars / 2)

    def _estimate_cost(self, token_count: int, model: str) -> float:
        """估算成本（美元）."""
        rate = self.COST_PER_1K_TOKENS.get(model, 0.001)
        return round(token_count / 1000 * rate, 6)

    def _score_clarity(self, prompt: str, words: list[str], sentences: list[str]) -> float:
        """评分清晰度（0-1）."""
        score = 0.7

        ambiguous_count = sum(1 for w in words if w.lower() in self.AMBIGUOUS_WORDS)
        ambiguous_ratio = ambiguous_count / max(len(words), 1)
        score -= ambiguous_ratio * 0.5

        avg_sentence_len = len(words) / max(len(sentences), 1)
        if avg_sentence_len > 40:
            score -= 0.1
        if avg_sentence_len > 60:
            score -= 0.1

        negation_count = len(re.findall(r"\b(not|no|never|don't|doesn't|won't|can't)\b", prompt, re.I))
        if negation_count > 3:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _score_specificity(self, prompt: str, words: list[str]) -> float:
        """评分具体性（0-1）."""
        score = 0.5

        if self._has_role(prompt):
            score += 0.15
        if self._has_format_instruction(prompt):
            score += 0.15
        if self._has_examples(prompt):
            score += 0.1
        if self._has_constraints(prompt):
            score += 0.1

        numbers = len(re.findall(r"\b\d+", prompt))
        if numbers > 0:
            score += min(numbers * 0.02, 0.1)

        return max(0.0, min(1.0, score))

    def _score_structure(self, prompt: str) -> float:
        """评分结构化程度（0-1）."""
        score = 0.3
        for pattern in self.STRUCTURAL_MARKERS.values():
            matches = pattern.findall(prompt)
            if matches:
                score += min(len(matches) * 0.1, 0.2)

        has_sections = bool(re.search(r"\n\n", prompt))
        if has_sections:
            score += 0.1

        has_delimiters = bool(re.search(r"(---|===|```|<\w+>)", prompt))
        if has_delimiters:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _find_issues(
        self,
        prompt: str,
        words: list[str],
        clarity: float,
        specificity: float,
        structure: float,
    ) -> list[str]:
        """识别 Prompt 问题."""
        issues: list[str] = []

        if len(prompt) > 4000:
            issues.append(f"Prompt 过长 ({len(prompt)} 字符)，可能超出上下文窗口或增加成本")
        if len(prompt) < 20:
            issues.append("Prompt 过短，可能缺乏足够信息")

        ambiguous = [w for w in words if w.lower() in self.AMBIGUOUS_WORDS]
        if len(ambiguous) > 3:
            issues.append(f"存在 {len(ambiguous)} 个模糊词汇: {', '.join(set(ambiguous[:5]))}")

        if not self._has_role(prompt):
            issues.append("缺少角色定义（建议添加 'You are...' 或 System Prompt）")
        if not self._has_format_instruction(prompt):
            issues.append("缺少输出格式说明")
        if not self._has_constraints(prompt):
            issues.append("缺少约束条件")

        if clarity < 0.5:
            issues.append(f"清晰度偏低 ({clarity:.2f})，建议简化句子和消除歧义词")
        if specificity < 0.5:
            issues.append(f"具体性偏低 ({specificity:.2f})，建议添加角色、格式、示例")
        if structure < 0.4:
            issues.append(f"结构化偏低 ({structure:.2f})，建议使用编号、标题、分隔符")

        return issues

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        """分句."""
        sentences = re.split(r"[.!?。！？]\s+", text)
        return [s.strip() for s in sentences if s.strip()]

    @staticmethod
    def _has_role(prompt: str) -> bool:
        return bool(re.search(r"(?i)(you are|act as|role|as a|作为|你是|角色)", prompt))

    @staticmethod
    def _has_format_instruction(prompt: str) -> bool:
        return bool(re.search(r"(?i)(format|output|return|respond|json|xml|markdown|格式|输出|返回)", prompt))

    @staticmethod
    def _has_examples(prompt: str) -> bool:
        return bool(re.search(r"(?i)(example|e\.g\.|for instance|sample|例如|比如|示例)", prompt))

    @staticmethod
    def _has_constraints(prompt: str) -> bool:
        return bool(re.search(r"(?i)(must|should|do not|never|always|ensure|必须|不要|确保|限制)", prompt))

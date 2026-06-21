"""优化建议生成器 — 基于分析结果给出具体的优化建议."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .analyzer import AnalysisReport


class SuggestionPriority(str, Enum):
    """建议优先级."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SuggestionCategory(str, Enum):
    """建议类别."""

    CLARITY = "clarity"
    SPECIFICITY = "specificity"
    STRUCTURE = "structure"
    COST = "cost"
    SAFETY = "safety"


@dataclass
class Suggestion:
    """优化建议."""

    category: SuggestionCategory
    priority: SuggestionPriority
    title: str
    description: str
    example_before: str | None = None
    example_after: str | None = None
    estimated_improvement: float = 0.0


@dataclass
class OptimizationPlan:
    """优化计划 — 一组按优先级排序的建议."""

    report: AnalysisReport
    suggestions: list[Suggestion]
    estimated_token_reduction: int = 0
    estimated_score_improvement: float = 0.0

    @property
    def high_priority(self) -> list[Suggestion]:
        return [s for s in self.suggestions if s.priority == SuggestionPriority.HIGH]

    @property
    def medium_priority(self) -> list[Suggestion]:
        return [s for s in self.suggestions if s.priority == SuggestionPriority.MEDIUM]

    @property
    def low_priority(self) -> list[Suggestion]:
        return [s for s in self.suggestions if s.priority == SuggestionPriority.LOW]

    def summary(self) -> str:
        """生成优化计划摘要."""
        lines = [
            f"## 优化计划 (共 {len(self.suggestions)} 条建议)",
            f"\n当前综合评分: {self.report.overall_score:.3f}",
            f"预估优化后提升: +{self.estimated_score_improvement:.3f}",
        ]
        if self.estimated_token_reduction > 0:
            lines.append(f"预估 Token 减少: ~{self.estimated_token_reduction} tokens")

        for priority_label, items in [
            ("🔴 高优先级", self.high_priority),
            ("🟡 中优先级", self.medium_priority),
            ("🟢 低优先级", self.low_priority),
        ]:
            if items:
                lines.append(f"\n### {priority_label}")
                for s in items:
                    lines.append(f"- **{s.title}**: {s.description}")
        return "\n".join(lines)


class Suggester:
    """优化建议生成器.

    基于 Prompt 分析报告，生成具体的优化建议。
    """

    def generate_plan(self, report: AnalysisReport) -> OptimizationPlan:
        """生成优化计划.

        Args:
            report: Prompt 分析报告

        Returns:
            优化计划
        """
        suggestions: list[Suggestion] = []

        suggestions.extend(self._suggest_clarity(report))
        suggestions.extend(self._suggest_specificity(report))
        suggestions.extend(self._suggest_structure(report))
        suggestions.extend(self._suggest_cost(report))
        suggestions.extend(self._suggest_safety(report))

        suggestions.sort(key=lambda s: {
            SuggestionPriority.HIGH: 0,
            SuggestionPriority.MEDIUM: 1,
            SuggestionPriority.LOW: 2,
        }[s.priority])

        token_reduction = self._estimate_token_reduction(report, suggestions)
        score_improvement = min(sum(s.estimated_improvement for s in suggestions), 0.4)

        return OptimizationPlan(
            report=report,
            suggestions=suggestions,
            estimated_token_reduction=token_reduction,
            estimated_score_improvement=round(score_improvement, 3),
        )

    def _suggest_clarity(self, report: AnalysisReport) -> list[Suggestion]:
        """清晰度相关建议."""
        suggestions: list[Suggestion] = []

        if report.clarity_score < 0.6:
            suggestions.append(Suggestion(
                category=SuggestionCategory.CLARITY,
                priority=SuggestionPriority.HIGH,
                title="消除模糊词汇",
                description="将模糊的描述替换为具体、可衡量的表述",
                example_before="写一个好的介绍",
                example_after="写一个 100-150 字的产品介绍，包含核心功能和目标用户",
                estimated_improvement=0.1,
            ))

        if report.metrics.get("avg_words_per_sentence", 0) > 40:
            suggestions.append(Suggestion(
                category=SuggestionCategory.CLARITY,
                priority=SuggestionPriority.MEDIUM,
                title="拆分长句",
                description="将超过 40 词的长句拆分为多个短句，每句表达一个要点",
                estimated_improvement=0.05,
            ))

        return suggestions

    def _suggest_specificity(self, report: AnalysisReport) -> list[Suggestion]:
        """具体性相关建议."""
        suggestions: list[Suggestion] = []

        if not report.metrics.get("has_role_definition"):
            suggestions.append(Suggestion(
                category=SuggestionCategory.SPECIFICITY,
                priority=SuggestionPriority.HIGH,
                title="添加角色定义",
                description="在 Prompt 开头明确模型的角色和专业领域",
                example_before="帮我写一封邮件",
                example_after="你是一位专业的商务沟通顾问。帮我写一封跟进合作意向的邮件",
                estimated_improvement=0.08,
            ))

        if not report.metrics.get("has_format_instruction"):
            suggestions.append(Suggestion(
                category=SuggestionCategory.SPECIFICITY,
                priority=SuggestionPriority.HIGH,
                title="指定输出格式",
                description="明确指定期望的输出格式（JSON、Markdown、列表等）",
                estimated_improvement=0.06,
            ))

        if not report.metrics.get("has_examples"):
            suggestions.append(Suggestion(
                category=SuggestionCategory.SPECIFICITY,
                priority=SuggestionPriority.MEDIUM,
                title="添加示例",
                description="提供 1-2 个输入输出示例，减少歧义",
                estimated_improvement=0.05,
            ))

        if not report.metrics.get("has_constraints"):
            suggestions.append(Suggestion(
                category=SuggestionCategory.SPECIFICITY,
                priority=SuggestionPriority.MEDIUM,
                title="添加约束条件",
                description="明确限制条件，如长度、范围、排除项",
                estimated_improvement=0.04,
            ))

        return suggestions

    def _suggest_structure(self, report: AnalysisReport) -> list[Suggestion]:
        """结构化相关建议."""
        suggestions: list[Suggestion] = []

        if report.structure_score < 0.5:
            suggestions.append(Suggestion(
                category=SuggestionCategory.STRUCTURE,
                priority=SuggestionPriority.MEDIUM,
                title="使用结构化标记",
                description="用编号、标题、分隔符组织 Prompt，提高可读性",
                example_before="角色：翻译员。任务：翻译以下文本。格式：保持原文段落。注意：不要意译。",
                example_after="## 角色\n你是一名专业翻译员。\n\n## 任务\n翻译以下文本。\n\n## 格式要求\n保持原文段落结构。\n\n## 注意事项\n- 不要意译\n- 保留专业术语",
                estimated_improvement=0.06,
            ))

        if report.line_count > 1 and report.structure_score < 0.4:
            suggestions.append(Suggestion(
                category=SuggestionCategory.STRUCTURE,
                priority=SuggestionPriority.LOW,
                title="使用 XML 标签分隔",
                description="用 XML 标签（<context>、<task>、<output>）分隔不同部分",
                estimated_improvement=0.03,
            ))

        return suggestions

    def _suggest_cost(self, report: AnalysisReport) -> list[Suggestion]:
        """成本优化建议."""
        suggestions: list[Suggestion] = []

        if report.token_estimate > 1000:
            suggestions.append(Suggestion(
                category=SuggestionCategory.COST,
                priority=SuggestionPriority.MEDIUM,
                title="精简 Prompt",
                description=f"当前估算 {report.token_estimate} tokens，考虑移除冗余说明和不必要的上下文",
                estimated_improvement=0.02,
            ))

        if report.char_count > 3000:
            suggestions.append(Suggestion(
                category=SuggestionCategory.COST,
                priority=SuggestionPriority.LOW,
                title="压缩上下文",
                description="对长上下文使用摘要或关键信息提取，减少 Token 消耗",
                estimated_improvement=0.02,
            ))

        return suggestions

    def _suggest_safety(self, report: AnalysisReport) -> list[Suggestion]:
        """安全相关建议."""
        suggestions: list[Suggestion] = []

        if not any(kw in report.prompt_text.lower() for kw in ["安全", "sensitive", "隐私", "privacy", "安全边界"]):
            if report.char_count > 200:
                suggestions.append(Suggestion(
                    category=SuggestionCategory.SAFETY,
                    priority=SuggestionPriority.LOW,
                    title="添加安全边界",
                    description="考虑添加安全相关的约束，如拒绝敏感内容、限制输出范围",
                    estimated_improvement=0.01,
                ))

        return suggestions

    def _estimate_token_reduction(self, report: AnalysisReport, suggestions: list[Suggestion]) -> int:
        """预估 Token 减少量."""
        reduction = 0
        for s in suggestions:
            if s.category == SuggestionCategory.COST:
                reduction += int(report.token_estimate * 0.15)
        return reduction

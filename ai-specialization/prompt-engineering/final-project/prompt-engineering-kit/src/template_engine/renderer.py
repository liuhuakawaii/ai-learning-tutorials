"""Prompt 模板渲染引擎 — 将模板与变量渲染为最终 Prompt."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from jinja2 import Environment, BaseLoader, Undefined, StrictUndefined, TemplateError
from jinja2.exceptions import UndefinedError as JinjaUndefinedError


class _StrictUndefined(Undefined):
    """访问未定义变量时抛出明确错误."""

    def __str__(self) -> str:
        raise JinjaUndefinedError(f"变量 '{self._undefined_name}' 未定义且无默认值")

    def __iter__(self):
        raise JinjaUndefinedError(f"变量 '{self._undefined_name}' 未定义且无默认值")

    def __bool__(self) -> bool:
        return False


@dataclass
class RenderResult:
    """渲染结果."""

    content: str
    variables_used: dict[str, Any]
    metadata: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class PromptRenderer:
    """Prompt 模板渲染器.

    支持严格模式（缺少变量报错）和宽松模式（使用默认值）。
    """

    def __init__(self, strict: bool = True) -> None:
        self._strict = strict
        undefined_cls = StrictUndefined if strict else Undefined
        self._env = Environment(
            loader=BaseLoader(),
            undefined=undefined_cls,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self._env.filters["truncate_words"] = self._filter_truncate_words

    def render(
        self,
        template_str: str,
        variables: dict[str, Any] | None = None,
        metadata: dict[str, str] | None = None,
    ) -> RenderResult:
        """渲染模板.

        Args:
            template_str: Jinja2 模板字符串
            variables: 变量字典
            metadata: 模板元数据

        Returns:
            渲染结果

        Raises:
            UndefinedError: 严格模式下缺少必填变量
            TemplateError: 模板渲染错误
        """
        variables = variables or {}
        warnings: list[str] = []

        if not self._strict:
            template_vars = set(self._extract_variables(template_str))
            provided_vars = set(variables.keys())
            missing = template_vars - provided_vars
            if missing:
                warnings.append(f"以下变量未提供，将使用空值: {', '.join(sorted(missing))}")

        try:
            template = self._env.from_string(template_str)
            content = template.render(**variables)
        except TemplateError as e:
            raise TemplateError(f"模板渲染失败: {e}") from e

        return RenderResult(
            content=content.strip(),
            variables_used=variables,
            metadata=metadata or {},
            warnings=warnings,
        )

    def render_from_dict(
        self, template_str: str, data: dict[str, Any]
    ) -> RenderResult:
        """从字典渲染模板（变量和元数据在同一字典中）.

        元数据以 _meta_ 前缀区分。
        """
        metadata = {k.removeprefix("_meta_"): v for k, v in data.items() if k.startswith("_meta_")}
        variables = {k: v for k, v in data.items() if not k.startswith("_meta_")}
        return self.render(template_str, variables=variables, metadata=metadata)

    def batch_render(
        self,
        template_str: str,
        variable_sets: list[dict[str, Any]],
    ) -> list[RenderResult]:
        """批量渲染同一模板.

        Args:
            template_str: 模板字符串
            variable_sets: 多组变量

        Returns:
            渲染结果列表
        """
        return [self.render(template_str, vars_) for vars_ in variable_sets]

    def preview_variables(self, template_str: str) -> list[str]:
        """预览模板中的变量名（不渲染）."""
        return self._extract_variables(template_str)

    @staticmethod
    def _filter_truncate_words(value: str, length: int = 50, end: str = "...") -> str:
        """自定义 Jinja2 过滤器：按词截断."""
        words = value.split()
        if len(words) <= length:
            return value
        return " ".join(words[:length]) + end

    @staticmethod
    def _extract_variables(template_str: str) -> list[str]:
        """提取模板中的变量名."""
        import re
        return list(set(re.findall(r"\{\{\s*(\w+)", template_str)))

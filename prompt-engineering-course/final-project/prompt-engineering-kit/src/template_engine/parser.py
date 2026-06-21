"""Prompt 模板解析器 — 从字符串或文件加载并解析 Jinja2 模板."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from jinja2 import Environment, BaseLoader, TemplateSyntaxError, UndefinedError


@dataclass
class ParsedTemplate:
    """解析后的 Prompt 模板."""

    name: str
    source: str
    variables: list[str]
    required_variables: list[str]
    optional_variables: list[str]
    metadata: dict[str, str] = field(default_factory=dict)


class PromptParser:
    """解析 Prompt 模板，提取变量和元数据."""

    _METADATA_PATTERN = re.compile(r"{#\s*@(\w+)\s*:\s*(.+?)\s*#}")
    _VAR_PATTERN = re.compile(r"\{\{\s*(\w+)(?:\s*\|.*?)?\s*\}\}")
    _REQUIRED_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")
    _OPTIONAL_PATTERN = re.compile(r"\{\{\s*\w+\s*\|\s*default\(")

    def __init__(self) -> None:
        self._env = Environment(
            loader=BaseLoader(),
            undefined=UndefinedError,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def parse(self, template_str: str, name: str = "unnamed") -> ParsedTemplate:
        """解析模板字符串，提取变量和元数据.

        Args:
            template_str: Jinja2 模板字符串
            name: 模板名称

        Returns:
            解析后的模板对象

        Raises:
            TemplateSyntaxError: 模板语法错误
        """
        try:
            self._env.parse(template_str)
        except TemplateSyntaxError as e:
            raise TemplateSyntaxError(
                f"模板 '{name}' 语法错误: {e.message}", e.lineno
            ) from e

        metadata = self._extract_metadata(template_str)
        all_vars = self._extract_variables(template_str)
        required = self._extract_required(template_str, all_vars)
        optional = [v for v in all_vars if v not in required]

        return ParsedTemplate(
            name=name,
            source=template_str,
            variables=all_vars,
            required_variables=required,
            optional_variables=optional,
            metadata=metadata,
        )

    def parse_file(self, file_path: str | Path, name: str | None = None) -> ParsedTemplate:
        """从文件加载并解析模板.

        Args:
            file_path: 模板文件路径
            name: 模板名称（默认使用文件名）

        Returns:
            解析后的模板对象
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"模板文件不存在: {file_path}")

        template_name = name or path.stem
        content = path.read_text(encoding="utf-8")
        return self.parse(content, name=template_name)

    def validate(self, template_str: str, name: str = "unnamed") -> list[str]:
        """验证模板，返回错误列表（空列表表示无错误）.

        Args:
            template_str: 模板字符串
            name: 模板名称

        Returns:
            错误信息列表
        """
        errors: list[str] = []
        try:
            self._env.parse(template_str)
        except TemplateSyntaxError as e:
            errors.append(f"语法错误 (行 {e.lineno}): {e.message}")
        return errors

    def _extract_metadata(self, source: str) -> dict[str, str]:
        """从模板注释中提取元数据."""
        return dict(self._METADATA_PATTERN.findall(source))

    def _extract_variables(self, source: str) -> list[str]:
        """提取模板中所有变量名（去重保序）."""
        seen: set[str] = set()
        result: list[str] = []
        for match in self._VAR_PATTERN.finditer(source):
            var_name = match.group(1)
            if var_name not in seen:
                seen.add(var_name)
                result.append(var_name)
        return result

    def _extract_required(self, source: str, all_vars: list[str]) -> list[str]:
        """识别没有 default 过滤器的必填变量."""
        optional_set = set(self._OPTIONAL_PATTERN.findall(source))
        required_by_pattern = set(self._REQUIRED_PATTERN.findall(source))
        required = required_by_pattern - optional_set
        return [v for v in all_vars if v in required]

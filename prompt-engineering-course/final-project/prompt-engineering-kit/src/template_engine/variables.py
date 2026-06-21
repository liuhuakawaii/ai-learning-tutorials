"""变量管理与验证 — 定义 Prompt 模板中的变量类型和约束."""

from __future__ import annotations

from enum import Enum
from typing import Any, Callable

from pydantic import BaseModel, Field


class VariableType(str, Enum):
    """支持的变量类型."""

    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    LIST = "list"
    CHOICE = "choice"


class Variable(BaseModel):
    """Prompt 模板变量定义.

    定义变量的名称、类型、默认值、约束和描述。
    """

    name: str
    type: VariableType = VariableType.STRING
    description: str = ""
    default: Any = None
    required: bool = True
    choices: list[Any] | None = None
    min_length: int | None = None
    max_length: int | None = None
    min_value: float | None = None
    max_value: float | None = None
    pattern: str | None = None

    def validate_value(self, value: Any) -> tuple[bool, str | None]:
        """验证变量值是否符合约束.

        Returns:
            (is_valid, error_message)
        """
        if value is None:
            if self.required and self.default is None:
                return False, f"变量 '{self.name}' 是必填项"
            return True, None

        type_ok, type_err = self._validate_type(value)
        if not type_ok:
            return False, type_err

        constraint_ok, constraint_err = self._validate_constraints(value)
        if not constraint_ok:
            return False, constraint_err

        return True, None

    def _validate_type(self, value: Any) -> tuple[bool, str | None]:
        """验证值类型."""
        match self.type:
            case VariableType.STRING:
                if not isinstance(value, str):
                    return False, f"变量 '{self.name}' 需要字符串类型，得到 {type(value).__name__}"
            case VariableType.INTEGER:
                if not isinstance(value, int) or isinstance(value, bool):
                    return False, f"变量 '{self.name}' 需要整数类型"
            case VariableType.FLOAT:
                if not isinstance(value, (int, float)) or isinstance(value, bool):
                    return False, f"变量 '{self.name}' 需要数值类型"
            case VariableType.BOOLEAN:
                if not isinstance(value, bool):
                    return False, f"变量 '{self.name}' 需要布尔类型"
            case VariableType.LIST:
                if not isinstance(value, list):
                    return False, f"变量 '{self.name}' 需要列表类型"
            case VariableType.CHOICE:
                if self.choices and value not in self.choices:
                    return False, f"变量 '{self.name}' 的值 '{value}' 不在可选项 {self.choices} 中"
        return True, None

    def _validate_constraints(self, value: Any) -> tuple[bool, str | None]:
        """验证值约束."""
        if isinstance(value, str):
            if self.min_length is not None and len(value) < self.min_length:
                return False, f"变量 '{self.name}' 长度不能少于 {self.min_length}"
            if self.max_length is not None and len(value) > self.max_length:
                return False, f"变量 '{self.name}' 长度不能超过 {self.max_length}"
            if self.pattern is not None:
                import re
                if not re.match(self.pattern, value):
                    return False, f"变量 '{self.name}' 不匹配模式 '{self.pattern}'"

        if isinstance(value, (int, float)):
            if self.min_value is not None and value < self.min_value:
                return False, f"变量 '{self.name}' 不能小于 {self.min_value}"
            if self.max_value is not None and value > self.max_value:
                return False, f"变量 '{self.name}' 不能大于 {self.max_value}"

        if isinstance(value, list):
            if self.min_length is not None and len(value) < self.min_length:
                return False, f"变量 '{self.name}' 元素数不能少于 {self.min_length}"
            if self.max_length is not None and len(value) > self.max_length:
                return False, f"变量 '{self.name}' 元素数不能超过 {self.max_length}"

        return True, None

    def get_effective_value(self, value: Any) -> Any:
        """获取有效值（如果值为 None 则返回默认值）."""
        if value is None:
            return self.default
        return value


class VariableRegistry:
    """变量注册表 — 管理一组变量定义."""

    def __init__(self) -> None:
        self._variables: dict[str, Variable] = {}

    def register(self, variable: Variable) -> None:
        """注册一个变量."""
        self._variables[variable.name] = variable

    def register_many(self, variables: list[Variable]) -> None:
        """批量注册变量."""
        for var in variables:
            self.register(var)

    def get(self, name: str) -> Variable | None:
        """获取变量定义."""
        return self._variables.get(name)

    def list_all(self) -> list[Variable]:
        """列出所有变量."""
        return list(self._variables.values())

    def list_required(self) -> list[Variable]:
        """列出所有必填变量."""
        return [v for v in self._variables.values() if v.required]

    def list_optional(self) -> list[Variable]:
        """列出所有可选变量."""
        return [v for v in self._variables.values() if not v.required]

    def validate_all(self, values: dict[str, Any]) -> dict[str, str | None]:
        """验证所有变量值.

        Returns:
            {变量名: 错误信息} — 只包含验证失败的项
        """
        errors: dict[str, str | None] = {}
        for name, var in self._variables.items():
            value = values.get(name)
            is_valid, error = var.validate_value(value)
            if not is_valid:
                errors[name] = error
        return errors

    def apply_defaults(self, values: dict[str, Any]) -> dict[str, Any]:
        """为缺失的变量填充默认值.

        Returns:
            填充后的变量字典
        """
        result = dict(values)
        for name, var in self._variables.items():
            if name not in result and var.default is not None:
                result[name] = var.default
        return result

    def to_template_context(self, values: dict[str, Any]) -> dict[str, Any]:
        """将变量值转为模板渲染上下文（填充默认值 + 类型转换）."""
        context = self.apply_defaults(values)
        for name, var in self._variables.items():
            if name in context:
                context[name] = var.get_effective_value(context[name])
        return context

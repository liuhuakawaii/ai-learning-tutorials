"""测试运行器 — 定义和运行 Prompt 测试用例."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from pydantic import BaseModel


class TestStatus(str, Enum):
    """测试状态."""

    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class TestResult:
    """单个测试用例的运行结果."""

    test_id: str
    status: TestStatus
    actual_output: str
    expected_output: str
    score: float
    duration_ms: float
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class TestSuiteResult:
    """测试套件运行结果."""

    suite_name: str
    results: list[TestResult]
    total_duration_ms: float

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.PASSED)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.FAILED)

    @property
    def errors(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.ERROR)

    @property
    def pass_rate(self) -> float:
        return self.passed / self.total if self.total > 0 else 0.0

    @property
    def average_score(self) -> float:
        if not self.results:
            return 0.0
        return sum(r.score for r in self.results) / self.total


class TestCase(BaseModel):
    """Prompt 测试用例定义."""

    id: str
    name: str
    prompt: str
    variables: dict[str, Any] = {}
    expected_output: str = ""
    eval_criteria: dict[str, Any] = {}
    tags: list[str] = []
    timeout_seconds: float = 30.0


class TestSuite(BaseModel):
    """测试套件 — 一组相关的测试用例."""

    name: str
    description: str = ""
    test_cases: list[TestCase] = []
    setup_prompt: str | None = None
    teardown_prompt: str | None = None

    def add_case(self, test_case: TestCase) -> None:
        """添加测试用例."""
        self.test_cases.append(test_case)

    def filter_by_tag(self, tag: str) -> list[TestCase]:
        """按标签筛选测试用例."""
        return [tc for tc in self.test_cases if tag in tc.tags]


class TestRunner:
    """Prompt 测试运行器.

    通过可注入的执行函数运行测试用例并收集结果。
    """

    def __init__(
        self,
        execute_fn: Callable[[str, dict[str, Any]], str],
    ) -> None:
        """初始化测试运行器.

        Args:
            execute_fn: 执行函数，接收 (prompt, variables) 返回模型输出字符串
        """
        self._execute_fn = execute_fn
        self._evaluator: Any = None

    def set_evaluator(self, evaluator: Any) -> None:
        """设置评估器."""
        self._evaluator = evaluator

    def run_case(self, test_case: TestCase) -> TestResult:
        """运行单个测试用例.

        Args:
            test_case: 测试用例

        Returns:
            测试结果
        """
        start = time.perf_counter()
        try:
            actual_output = self._execute_fn(test_case.prompt, test_case.variables)
            duration_ms = (time.perf_counter() - start) * 1000

            score = 0.0
            status = TestStatus.SKIPPED
            details: dict[str, Any] = {}

            if self._evaluator is not None:
                eval_result = self._evaluator.evaluate(
                    expected=test_case.expected_output,
                    actual=actual_output,
                    criteria=test_case.eval_criteria,
                )
                score = eval_result.score
                status = TestStatus.PASSED if eval_result.passed else TestStatus.FAILED
                details = eval_result.details
            elif test_case.expected_output:
                passed = actual_output.strip() == test_case.expected_output.strip()
                score = 1.0 if passed else 0.0
                status = TestStatus.PASSED if passed else TestStatus.FAILED

            return TestResult(
                test_id=test_case.id,
                status=status,
                actual_output=actual_output,
                expected_output=test_case.expected_output,
                score=score,
                duration_ms=duration_ms,
                details=details,
            )
        except Exception as e:
            duration_ms = (time.perf_counter() - start) * 1000
            return TestResult(
                test_id=test_case.id,
                status=TestStatus.ERROR,
                actual_output="",
                expected_output=test_case.expected_output,
                score=0.0,
                duration_ms=duration_ms,
                error=str(e),
            )

    def run_suite(self, suite: TestSuite) -> TestSuiteResult:
        """运行整个测试套件.

        Args:
            suite: 测试套件

        Returns:
            套件运行结果
        """
        start = time.perf_counter()
        results: list[TestResult] = []

        for test_case in suite.test_cases:
            result = self.run_case(test_case)
            results.append(result)

        total_duration = (time.perf_counter() - start) * 1000

        return TestSuiteResult(
            suite_name=suite.name,
            results=results,
            total_duration_ms=total_duration,
        )

    def run_suites(self, suites: list[TestSuite]) -> list[TestSuiteResult]:
        """运行多个测试套件."""
        return [self.run_suite(suite) for suite in suites]

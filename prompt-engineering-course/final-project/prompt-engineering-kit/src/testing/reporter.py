"""测试报告生成器 — 将测试结果渲染为 Markdown 或 HTML 报告."""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any

from .runner import TestSuiteResult, TestStatus


class Reporter:
    """测试报告生成器.

    支持 Markdown 和 HTML 两种输出格式。
    """

    def __init__(self, output_dir: str | Path = "reports") -> None:
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    def generate_markdown(self, suite_result: TestSuiteResult) -> str:
        """生成 Markdown 格式的测试报告.

        Args:
            suite_result: 测试套件结果

        Returns:
            Markdown 字符串
        """
        lines: list[str] = []
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        lines.append(f"# 测试报告: {suite_result.suite_name}")
        lines.append(f"\n> 生成时间: {timestamp}\n")

        lines.append("## 概览\n")
        lines.append(f"| 指标 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 总用例数 | {suite_result.total} |")
        lines.append(f"| 通过 | {suite_result.passed} |")
        lines.append(f"| 失败 | {suite_result.failed} |")
        lines.append(f"| 错误 | {suite_result.errors} |")
        lines.append(f"| 通过率 | {suite_result.pass_rate:.1%} |")
        lines.append(f"| 平均分 | {suite_result.average_score:.3f} |")
        lines.append(f"| 总耗时 | {suite_result.total_duration_ms:.0f}ms |")
        lines.append("")

        lines.append("## 详细结果\n")
        lines.append("| # | 用例ID | 状态 | 分数 | 耗时 |")
        lines.append("|---|--------|------|------|------|")

        for i, result in enumerate(suite_result.results, 1):
            status_icon = self._status_icon(result.status)
            lines.append(
                f"| {i} | {result.test_id} | {status_icon} | {result.score:.3f} | {result.duration_ms:.0f}ms |"
            )
        lines.append("")

        failed_results = [
            r for r in suite_result.results
            if r.status in (TestStatus.FAILED, TestStatus.ERROR)
        ]
        if failed_results:
            lines.append("## 失败详情\n")
            for result in failed_results:
                lines.append(f"### {result.test_id}\n")
                lines.append(f"- **状态**: {self._status_icon(result.status)}")
                lines.append(f"- **分数**: {result.score:.3f}")
                if result.error:
                    lines.append(f"- **错误**: `{result.error}`")
                lines.append(f"- **期望输出**:\n```\n{result.expected_output}\n```")
                lines.append(f"- **实际输出**:\n```\n{result.actual_output}\n```")
                if result.details:
                    lines.append(f"- **详情**: `{result.details}`")
                lines.append("")

        return "\n".join(lines)

    def generate_html(self, suite_result: TestSuiteResult) -> str:
        """生成 HTML 格式的测试报告.

        Args:
            suite_result: 测试套件结果

        Returns:
            HTML 字符串
        """
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        rows = ""
        for i, result in enumerate(suite_result.results, 1):
            status_class = result.status.value
            status_icon = self._status_icon(result.status)
            rows += f"""
            <tr class="{status_class}">
                <td>{i}</td>
                <td>{result.test_id}</td>
                <td>{status_icon}</td>
                <td>{result.score:.3f}</td>
                <td>{result.duration_ms:.0f}ms</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>测试报告: {suite_result.suite_name}</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }}
        h1 {{ color: #1a1a1a; }}
        .summary {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }}
        .card {{ background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; }}
        .card .value {{ font-size: 2em; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
        tr.passed td {{ background: #e6ffe6; }}
        tr.failed td {{ background: #ffe6e6; }}
        tr.error td {{ background: #fff3e6; }}
    </style>
</head>
<body>
    <h1>测试报告: {suite_result.suite_name}</h1>
    <p>生成时间: {timestamp}</p>
    <div class="summary">
        <div class="card"><div class="value">{suite_result.total}</div><div>总用例</div></div>
        <div class="card"><div class="value">{suite_result.passed}</div><div>通过</div></div>
        <div class="card"><div class="value">{suite_result.failed}</div><div>失败</div></div>
        <div class="card"><div class="value">{suite_result.pass_rate:.1%}</div><div>通过率</div></div>
    </div>
    <table>
        <thead><tr><th>#</th><th>用例ID</th><th>状态</th><th>分数</th><th>耗时</th></tr></thead>
        <tbody>{rows}</tbody>
    </table>
</body>
</html>"""

    def save_report(
        self,
        suite_result: TestSuiteResult,
        fmt: str = "markdown",
    ) -> Path:
        """保存报告到文件.

        Args:
            suite_result: 测试结果
            fmt: 格式 ("markdown" 或 "html")

        Returns:
            保存的文件路径
        """
        if fmt == "html":
            content = self.generate_html(suite_result)
            ext = ".html"
        else:
            content = self.generate_markdown(suite_result)
            ext = ".md"

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{suite_result.suite_name}_{timestamp}{ext}"
        filepath = self._output_dir / filename
        filepath.write_text(content, encoding="utf-8")
        return filepath

    @staticmethod
    def _status_icon(status: TestStatus) -> str:
        """状态图标."""
        match status:
            case TestStatus.PASSED:
                return "✅ 通过"
            case TestStatus.FAILED:
                return "❌ 失败"
            case TestStatus.ERROR:
                return "⚠️ 错误"
            case TestStatus.SKIPPED:
                return "⏭️ 跳过"

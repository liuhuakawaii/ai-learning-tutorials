"""监控仪表盘 — 在终端中展示 Prompt 监控数据的可视化面板."""

from __future__ import annotations

from typing import Any

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    from rich.columns import Columns
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

from .tracker import Tracker, AlertSeverity


class Dashboard:
    """终端监控仪表盘.

    使用 Rich 库在终端中渲染监控数据。
    """

    def __init__(self, tracker: Tracker) -> None:
        self._tracker = tracker
        self._console = Console() if HAS_RICH else None

    def render_summary(self, prompt_id: str | None = None) -> str:
        """渲染汇总统计面板.

        Args:
            prompt_id: 指定 Prompt ID（None 表示全部）

        Returns:
            渲染后的字符串
        """
        summary = self._tracker.get_summary(prompt_id)

        if summary.get("total_calls", 0) == 0:
            return "暂无监控数据"

        if not HAS_RICH:
            return self._render_plain_summary(summary)

        title = f"📊 Prompt 监控面板 — {prompt_id or '全部'}"
        table = Table(title=title, show_header=True, header_style="bold cyan")
        table.add_column("指标", style="dim")
        table.add_column("值", justify="right")

        table.add_row("总调用次数", str(summary["total_calls"]))
        table.add_row("成功次数", str(summary["success_count"]))
        table.add_row("失败次数", str(summary["failure_count"]))
        table.add_row("成功率", f"{summary['success_rate']:.1%}")
        table.add_row("─────────", "─────────")
        table.add_row("平均延迟", f"{summary['latency_avg_ms']:.0f}ms")
        table.add_row("P50 延迟", f"{summary['latency_p50_ms']:.0f}ms")
        table.add_row("P95 延迟", f"{summary['latency_p95_ms']:.0f}ms")
        table.add_row("P99 延迟", f"{summary['latency_p99_ms']:.0f}ms")
        table.add_row("─────────", "─────────")
        table.add_row("平均输入 Token", f"{summary['input_tokens_avg']:.0f}")
        table.add_row("平均输出 Token", f"{summary['output_tokens_avg']:.0f}")
        table.add_row("总 Token 消耗", f"{summary['total_tokens']:,}")

        if summary.get("error_types"):
            table.add_row("─────────", "─────────")
            for err_type, count in summary["error_types"].items():
                table.add_row(f"错误: {err_type}", str(count))

        self._console.print(table)
        return ""

    def render_alerts(self, limit: int = 10) -> str:
        """渲染告警面板.

        Args:
            limit: 显示条数

        Returns:
            渲染后的字符串
        """
        alerts = self._tracker.get_alerts(limit=limit)

        if not alerts:
            return "✅ 无告警"

        if not HAS_RICH:
            return self._render_plain_alerts(alerts)

        table = Table(title="🚨 告警列表", show_header=True, header_style="bold red")
        table.add_column("级别", width=8)
        table.add_column("规则", width=20)
        table.add_column("消息")
        table.add_column("时间", width=20)

        severity_icons = {
            AlertSeverity.INFO: "ℹ️",
            AlertSeverity.WARNING: "⚠️",
            AlertSeverity.CRITICAL: "🔴",
        }

        for alert in reversed(alerts):
            icon = severity_icons.get(alert.severity, "")
            table.add_row(
                icon,
                alert.rule_name,
                alert.message,
                alert.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            )

        self._console.print(table)
        return ""

    def render_prompt_ranking(self, by: str = "latency_avg_ms", top_n: int = 10) -> str:
        """渲染 Prompt 排名.

        Args:
            by: 排序指标
            top_n: 显示前 N 名

        Returns:
            渲染后的字符串
        """
        rankings = self._tracker.get_prompt_ranking(by=by)[:top_n]

        if not rankings:
            return "暂无数据"

        if not HAS_RICH:
            return self._render_plain_ranking(rankings, by)

        metric_labels = {
            "latency_avg_ms": "平均延迟",
            "success_rate": "成功率",
            "total_calls": "调用次数",
        }

        table = Table(
            title=f"📈 Prompt 排名 (按 {metric_labels.get(by, by)})",
            show_header=True,
            header_style="bold green",
        )
        table.add_column("#", width=4)
        table.add_column("Prompt ID", width=20)
        table.add_column("调用次数", justify="right")
        table.add_column("成功率", justify="right")
        table.add_column("平均延迟", justify="right")
        table.add_column("总 Token", justify="right")

        for i, item in enumerate(rankings, 1):
            table.add_row(
                str(i),
                item.get("prompt_id", "N/A"),
                str(item.get("total_calls", 0)),
                f"{item.get('success_rate', 0):.1%}",
                f"{item.get('latency_avg_ms', 0):.0f}ms",
                f"{item.get('total_tokens', 0):,}",
            )

        self._console.print(table)
        return ""

    def render_trend(self, prompt_id: str, metric: str = "latency_ms", window: int = 20) -> str:
        """渲染趋势图（ASCII 简易版）.

        Args:
            prompt_id: Prompt ID
            metric: 指标名
            window: 数据窗口

        Returns:
            ASCII 趋势图字符串
        """
        trend = self._tracker.get_trend(prompt_id, metric=metric, window=window)

        if not trend.values:
            return f"暂无 {prompt_id} 的 {metric} 数据"

        metric_labels = {
            "latency_ms": "延迟 (ms)",
            "input_tokens": "输入 Token",
            "output_tokens": "输出 Token",
            "total_tokens": "总 Token",
        }
        label = metric_labels.get(metric, metric)
        values = trend.values

        max_val = max(values) if values else 1
        min_val = min(values) if values else 0
        avg_val = sum(values) / len(values) if values else 0

        lines = [f"\n📈 {prompt_id} — {label} 趋势 (最近 {len(values)} 次)\n"]

        height = 10
        width = min(len(values), 50)
        step = max(1, len(values) // width)
        sampled = values[::step][:width]

        if max_val == min_val:
            normalized = [5] * len(sampled)
        else:
            normalized = [int((v - min_val) / (max_val - min_val) * (height - 1)) for v in sampled]

        for row in range(height - 1, -1, -1):
            bar_line = ""
            for val in normalized:
                if val >= row:
                    bar_line += "█"
                else:
                    bar_line += " "
            if row == height - 1:
                bar_line += f"  ← {max_val:.1f}"
            elif row == 0:
                bar_line += f"  ← {min_val:.1f}"
            elif row == height // 2:
                bar_line += f"  ← avg {avg_val:.1f}"
            lines.append(f"  {bar_line}")

        lines.append("  " + "─" * width)
        lines.append(f"  最小: {min_val:.1f}  平均: {avg_val:.1f}  最大: {max_val:.1f}")

        return "\n".join(lines)

    def render_full(self, prompt_id: str | None = None) -> None:
        """渲染完整仪表盘."""
        if self._console:
            self._console.clear()

        self.render_summary(prompt_id)
        print()
        self.render_alerts()
        print()
        self.render_prompt_ranking()

        if prompt_id:
            print()
            print(self.render_trend(prompt_id))

    def _render_plain_summary(self, summary: dict[str, Any]) -> str:
        """无 Rich 时的纯文本汇总."""
        lines = [
            f"=== Prompt 监控面板 ===",
            f"总调用: {summary['total_calls']}",
            f"成功/失败: {summary['success_count']}/{summary['failure_count']}",
            f"成功率: {summary['success_rate']:.1%}",
            f"平均延迟: {summary['latency_avg_ms']:.0f}ms",
            f"P95 延迟: {summary['latency_p95_ms']:.0f}ms",
            f"总 Token: {summary['total_tokens']:,}",
        ]
        return "\n".join(lines)

    def _render_plain_alerts(self, alerts: list) -> str:
        """无 Rich 时的纯文本告警."""
        lines = ["=== 告警列表 ==="]
        for a in alerts[-10:]:
            lines.append(f"[{a.severity.value}] {a.rule_name}: {a.message}")
        return "\n".join(lines)

    def _render_plain_ranking(self, rankings: list[dict], by: str) -> str:
        """无 Rich 时的纯文本排名."""
        lines = [f"=== Prompt 排名 (按 {by}) ==="]
        for i, item in enumerate(rankings, 1):
            lines.append(f"  {i}. {item.get('prompt_id', 'N/A')} — {item.get(by, 'N/A')}")
        return "\n".join(lines)

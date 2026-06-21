"""运行追踪器 — 记录 Prompt 调用数据，支持告警和趋势分析."""

from __future__ import annotations

import time
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable


class AlertSeverity(str, Enum):
    """告警级别."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class TrackRecord:
    """单次 Prompt 调用记录."""

    prompt_id: str
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    success: bool
    timestamp: datetime
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass
class AlertRule:
    """告警规则."""

    name: str
    condition: str
    threshold: float
    severity: AlertSeverity
    callback: Callable[[str, float, AlertSeverity], None] | None = None


@dataclass
class Alert:
    """告警事件."""

    rule_name: str
    severity: AlertSeverity
    message: str
    value: float
    timestamp: datetime


@dataclass
class TrendData:
    """趋势数据."""

    metric: str
    timestamps: list[datetime]
    values: list[float]


class Tracker:
    """Prompt 运行追踪器.

    记录每次调用的关键指标，支持告警规则和趋势分析。
    """

    def __init__(self) -> None:
        self._records: list[TrackRecord] = []
        self._alert_rules: list[AlertRule] = []
        self._alerts: list[Alert] = []
        self._prompt_stats: dict[str, list[TrackRecord]] = defaultdict(list)

    def record(
        self,
        prompt_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float,
        success: bool,
        error: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> TrackRecord:
        """记录一次 Prompt 调用.

        Returns:
            创建的记录
        """
        rec = TrackRecord(
            prompt_id=prompt_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            success=success,
            timestamp=datetime.now(timezone.utc),
            error=error,
            metadata=metadata or {},
        )
        self._records.append(rec)
        self._prompt_stats[prompt_id].append(rec)
        self._check_alerts(rec)
        return rec

    def add_alert_rule(self, rule: AlertRule) -> None:
        """添加告警规则."""
        self._alert_rules.append(rule)

    def get_alerts(
        self,
        severity: AlertSeverity | None = None,
        limit: int = 50,
    ) -> list[Alert]:
        """获取告警事件."""
        filtered = self._alerts
        if severity:
            filtered = [a for a in filtered if a.severity == severity]
        return filtered[-limit:]

    def get_records(
        self,
        prompt_id: str | None = None,
        limit: int = 100,
    ) -> list[TrackRecord]:
        """获取调用记录."""
        if prompt_id:
            return self._prompt_stats.get(prompt_id, [])[-limit:]
        return self._records[-limit:]

    def get_summary(self, prompt_id: str | None = None) -> dict[str, Any]:
        """获取汇总统计.

        Args:
            prompt_id: 指定 Prompt ID（None 表示全部）

        Returns:
            统计指标字典
        """
        records = self._prompt_stats[prompt_id] if prompt_id else self._records
        if not records:
            return {"total_calls": 0}

        latencies = [r.latency_ms for r in records]
        successes = [r for r in records if r.success]
        failures = [r for r in records if not r.success]
        input_tokens = [r.input_tokens for r in records]
        output_tokens = [r.output_tokens for r in records]

        return {
            "total_calls": len(records),
            "success_count": len(successes),
            "failure_count": len(failures),
            "success_rate": len(successes) / len(records),
            "latency_avg_ms": round(statistics.mean(latencies), 2),
            "latency_p50_ms": round(statistics.median(latencies), 2),
            "latency_p95_ms": round(self._percentile(latencies, 95), 2),
            "latency_p99_ms": round(self._percentile(latencies, 99), 2),
            "input_tokens_avg": round(statistics.mean(input_tokens), 1),
            "output_tokens_avg": round(statistics.mean(output_tokens), 1),
            "total_tokens": sum(r.total_tokens for r in records),
            "error_types": self._count_errors(failures),
        }

    def get_prompt_ranking(self, by: str = "latency_avg_ms") -> list[dict[str, Any]]:
        """获取 Prompt 排名.

        Args:
            by: 排序指标 ("latency_avg_ms", "success_rate", "total_calls")

        Returns:
            排名列表
        """
        rankings = []
        for prompt_id, records in self._prompt_stats.items():
            if not records:
                continue
            summary = self.get_summary(prompt_id)
            summary["prompt_id"] = prompt_id
            rankings.append(summary)

        reverse = by != "latency_avg_ms"
        rankings.sort(key=lambda x: x.get(by, 0), reverse=reverse)
        return rankings

    def get_trend(
        self,
        prompt_id: str,
        metric: str = "latency_ms",
        window: int = 20,
    ) -> TrendData:
        """获取趋势数据.

        Args:
            prompt_id: Prompt ID
            metric: 指标名 ("latency_ms", "input_tokens", "output_tokens")
            window: 数据窗口大小

        Returns:
            趋势数据
        """
        records = self._prompt_stats.get(prompt_id, [])[-window:]
        timestamps = [r.timestamp for r in records]

        match metric:
            case "latency_ms":
                values = [r.latency_ms for r in records]
            case "input_tokens":
                values = [float(r.input_tokens) for r in records]
            case "output_tokens":
                values = [float(r.output_tokens) for r in records]
            case "total_tokens":
                values = [float(r.total_tokens) for r in records]
            case _:
                values = [0.0] * len(records)

        return TrendData(metric=metric, timestamps=timestamps, values=values)

    def _check_alerts(self, record: TrackRecord) -> None:
        """检查告警规则."""
        for rule in self._alert_rules:
            value = self._extract_metric(record, rule.condition)
            if value is not None and value > rule.threshold:
                alert = Alert(
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=f"[{rule.name}] {rule.condition}={value:.2f} 超过阈值 {rule.threshold}",
                    value=value,
                    timestamp=record.timestamp,
                )
                self._alerts.append(alert)
                if rule.callback:
                    rule.callback(rule.name, value, rule.severity)

    @staticmethod
    def _extract_metric(record: TrackRecord, condition: str) -> float | None:
        """从记录中提取指标值."""
        match condition:
            case "latency_ms":
                return record.latency_ms
            case "total_tokens":
                return float(record.total_tokens)
            case "input_tokens":
                return float(record.input_tokens)
            case "output_tokens":
                return float(record.output_tokens)
            case _:
                return None

    @staticmethod
    def _percentile(data: list[float], percentile: int) -> float:
        """计算百分位数."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        k = (len(sorted_data) - 1) * percentile / 100
        f = int(k)
        c = f + 1
        if c >= len(sorted_data):
            return sorted_data[-1]
        return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])

    @staticmethod
    def _count_errors(failures: list[TrackRecord]) -> dict[str, int]:
        """统计错误类型."""
        counts: dict[str, int] = {}
        for f in failures:
            err = f.error or "unknown"
            counts[err] = counts.get(err, 0) + 1
        return counts

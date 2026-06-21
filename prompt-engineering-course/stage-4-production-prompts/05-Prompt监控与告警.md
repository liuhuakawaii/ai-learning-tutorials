# 05 - Prompt 监控与告警

> **课程定位**：Stage 4 生产级 Prompt 工程 · 第 5 课
> **前置要求**：完成 Stage 1-4，了解 Prometheus/Grafana 基本概念
> **预计时长**：90 分钟

---

## 学习目标

1. 理解 Prompt 系统的关键监控指标
2. 掌握质量追踪与异常检测方法
3. 实现多维度指标收集系统
4. 构建告警规则引擎
5. 设计监控仪表盘数据接口

---

## 1. 监控架构全景

```
┌────────────────────────────────────────────────────────────────────┐
│                    Prompt 监控架构                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │ API 调用  │───▶│  指标收集器   │───▶│  时序存储    │             │
│  └──────────┘    └──────────────┘    └──────┬───────┘             │
│                         │                    │                     │
│                         ▼                    ▼                     │
│                  ┌──────────────┐    ┌──────────────┐             │
│                  │  质量评估器   │    │  告警引擎    │             │
│                  └──────────────┘    └──────┬───────┘             │
│                         │                    │                     │
│                         ▼                    ▼                     │
│                  ┌──────────────┐    ┌──────────────┐             │
│                  │  异常检测器   │    │  通知渠道    │             │
│                  └──────────────┘    │  (邮件/钉钉) │             │
│                                      └──────────────┘             │
│                         │                                          │
│                         ▼                                          │
│                  ┌──────────────────────────────┐                 │
│                  │        监控仪表盘             │                 │
│                  │  实时指标 / 趋势图 / 告警历史  │                 │
│                  └──────────────────────────────┘                 │
│                                                                    │
│  关键指标: 延迟 / Token用量 / 成本 / 质量分 / 错误率 / 缓存命中率  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. 指标收集系统

```python
"""
metrics_collector.py
Prompt 指标收集系统
"""

import time
import json
import threading
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
from datetime import datetime, timedelta
from enum import Enum


class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


@dataclass
class MetricPoint:
    """单个指标数据点"""
    name: str
    value: float
    timestamp: float
    labels: Dict[str, str] = field(default_factory=dict)
    metric_type: MetricType = MetricType.GAUGE


@dataclass
class CallMetrics:
    """单次 API 调用指标"""
    request_id: str
    model: str
    prompt_name: str
    start_time: float
    end_time: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost: float = 0.0
    status: str = "success"
    error_message: str = ""
    cache_hit: bool = False
    cache_layer: str = ""
    quality_score: float = 0.0
    user_feedback: Optional[int] = None  # 1-5 评分

    @property
    def latency_ms(self) -> float:
        return (self.end_time - self.start_time) * 1000

    @property
    def tokens_per_second(self) -> float:
        duration = self.end_time - self.start_time
        if duration <= 0:
            return 0
        return self.output_tokens / duration


class MetricsCollector:
    """指标收集器"""

    def __init__(self, retention_hours: int = 24):
        self.retention_hours = retention_hours
        self._metrics: List[MetricPoint] = []
        self._call_logs: List[CallMetrics] = []
        self._lock = threading.Lock()
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)

    def record_call(self, call: CallMetrics):
        """记录一次 API 调用"""
        with self._lock:
            self._call_logs.append(call)

            labels = {"model": call.model, "prompt": call.prompt_name}

            # 计数器
            self._counters["total_calls"] += 1
            self._counters[f"calls.{call.model}"] += 1
            if call.status == "error":
                self._counters["total_errors"] += 1
            if call.cache_hit:
                self._counters["cache_hits"] += 1

            # 仪表盘
            self._gauges["last_latency_ms"] = call.latency_ms
            self._gauges["last_tokens"] = call.total_tokens

            # 直方图
            self._histograms["latency_ms"].append(call.latency_ms)
            self._histograms["input_tokens"].append(call.input_tokens)
            self._histograms["cost"].append(call.cost)

    def increment(self, name: str, value: float = 1.0,
                  labels: Dict[str, str] = None):
        """递增计数器"""
        key = self._label_key(name, labels)
        with self._lock:
            self._counters[key] += value

    def set_gauge(self, name: str, value: float,
                  labels: Dict[str, str] = None):
        """设置仪表值"""
        key = self._label_key(name, labels)
        with self._lock:
            self._gauges[key] = value

    def observe(self, name: str, value: float,
                labels: Dict[str, str] = None):
        """记录直方图观测值"""
        key = self._label_key(name, labels)
        with self._lock:
            self._histograms[key].append(value)

    def _label_key(self, name: str, labels: Optional[Dict]) -> str:
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def get_summary(self, window_minutes: int = 60) -> Dict:
        """获取时间窗口内的汇总指标"""
        cutoff = time.time() - (window_minutes * 60)

        with self._lock:
            recent_calls = [c for c in self._call_logs if c.start_time >= cutoff]

        if not recent_calls:
            return {"error": "no data in window"}

        total = len(recent_calls)
        errors = sum(1 for c in recent_calls if c.status == "error")
        cache_hits = sum(1 for c in recent_calls if c.cache_hit)

        latencies = [c.latency_ms for c in recent_calls]
        costs = [c.cost for c in recent_calls]
        tokens = [c.total_tokens for c in recent_calls]

        return {
            "window_minutes": window_minutes,
            "total_calls": total,
            "error_rate": f"{errors / total:.2%}",
            "cache_hit_rate": f"{cache_hits / total:.2%}",
            "latency": {
                "avg_ms": f"{sum(latencies) / len(latencies):.1f}",
                "p50_ms": f"{sorted(latencies)[total // 2]:.1f}",
                "p95_ms": f"{sorted(latencies)[int(total * 0.95)]:.1f}",
                "p99_ms": f"{sorted(latencies)[int(total * 0.99)]:.1f}",
                "max_ms": f"{max(latencies):.1f}",
            },
            "cost": {
                "total": f"${sum(costs):.4f}",
                "avg": f"${sum(costs) / total:.6f}",
            },
            "tokens": {
                "total": sum(tokens),
                "avg": f"{sum(tokens) / total:.0f}",
            },
        }

    def get_model_breakdown(self) -> Dict:
        """按模型分组统计"""
        breakdown = defaultdict(lambda: {
            "calls": 0, "errors": 0, "total_cost": 0.0,
            "total_tokens": 0, "latencies": []
        })

        for call in self._call_logs:
            m = breakdown[call.model]
            m["calls"] += 1
            if call.status == "error":
                m["errors"] += 1
            m["total_cost"] += call.cost
            m["total_tokens"] += call.total_tokens
            m["latencies"].append(call.latency_ms)

        result = {}
        for model, data in breakdown.items():
            lats = data["latencies"]
            result[model] = {
                "calls": data["calls"],
                "error_rate": f"{data['errors'] / data['calls']:.2%}",
                "total_cost": f"${data['total_cost']:.4f}",
                "avg_latency_ms": f"{sum(lats) / len(lats):.1f}" if lats else "N/A",
            }

        return result


# 使用示例
if __name__ == "__main__":
    collector = MetricsCollector()

    # 模拟调用记录
    for i in range(10):
        call = CallMetrics(
            request_id=f"req-{i}",
            model="gpt-4o-mini" if i % 2 == 0 else "claude-3-5-sonnet",
            prompt_name="customer_service",
            start_time=time.time() - (10 - i),
            end_time=time.time() - (10 - i) + 0.5,
            input_tokens=100 + i * 10,
            output_tokens=200 + i * 5,
            total_tokens=300 + i * 15,
            cost=0.001 * (i + 1),
            status="success" if i != 7 else "error",
            cache_hit=i in (2, 5, 8),
        )
        collector.record_call(call)

    print("=== 汇总 (60分钟窗口) ===")
    print(json.dumps(collector.get_summary(60), indent=2))

    print("\n=== 模型分组 ===")
    print(json.dumps(collector.get_model_breakdown(), indent=2))
```

---

## 3. 质量追踪系统

```python
"""
quality_tracker.py
Prompt 质量追踪与评分系统
"""

import time
import json
import statistics
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class QualityScore:
    """质量评分"""
    relevance: float = 0.0      # 相关性 0-1
    accuracy: float = 0.0       # 准确性 0-1
    completeness: float = 0.0   # 完整性 0-1
    format_score: float = 0.0   # 格式符合度 0-1
    safety_score: float = 0.0   # 安全性 0-1

    @property
    def overall(self) -> float:
        weights = {
            "relevance": 0.3,
            "accuracy": 0.3,
            "completeness": 0.2,
            "format_score": 0.1,
            "safety_score": 0.1,
        }
        return (
            self.relevance * weights["relevance"] +
            self.accuracy * weights["accuracy"] +
            self.completeness * weights["completeness"] +
            self.format_score * weights["format_score"] +
            self.safety_score * weights["safety_score"]
        )


@dataclass
class QualityRecord:
    """质量记录"""
    request_id: str
    prompt_name: str
    model: str
    timestamp: float
    score: QualityScore
    user_feedback: Optional[int] = None
    auto_evaluated: bool = True


class QualityTracker:
    """质量追踪器"""

    def __init__(self):
        self._records: List[QualityRecord] = []
        self._prompt_baselines: Dict[str, List[float]] = defaultdict(list)

    def record(self, record: QualityRecord):
        """记录质量评分"""
        self._records.append(record)
        self._prompt_baselines[record.prompt_name].append(record.score.overall)

    def auto_evaluate(self, request_id: str, prompt_name: str,
                      model: str, input_text: str,
                      output_text: str) -> QualityScore:
        """自动质量评估"""
        score = QualityScore()

        # 相关性：输出是否包含输入关键词
        input_words = set(input_text.lower().split())
        output_words = set(output_text.lower().split())
        overlap = input_words & output_words
        score.relevance = min(len(overlap) / max(len(input_words), 1), 1.0)

        # 完整性：输出长度是否合理
        output_len = len(output_text)
        if output_len < 50:
            score.completeness = 0.3
        elif output_len < 200:
            score.completeness = 0.7
        else:
            score.completeness = 1.0

        # 格式：是否包含结构化元素
        has_structure = any(c in output_text for c in ["\n", "1.", "-", "•", "|"])
        score.format_score = 0.8 if has_structure else 0.5

        # 安全性：是否包含敏感信息
        import re
        has_sensitive = bool(re.search(
            r'(password|api.?key|token|secret)\s*[:=]\s*\S+',
            output_text, re.IGNORECASE
        ))
        score.safety_score = 0.0 if has_sensitive else 1.0

        # 准确性：基于输出一致性
        score.accuracy = 0.7  # 默认，实际应由人工或 LLM 评估

        record = QualityRecord(
            request_id=request_id,
            prompt_name=prompt_name,
            model=model,
            timestamp=time.time(),
            score=score,
        )
        self.record(record)
        return score

    def get_prompt_quality_trend(self, prompt_name: str,
                                  hours: int = 24) -> Dict:
        """获取 Prompt 质量趋势"""
        cutoff = time.time() - (hours * 3600)
        records = [
            r for r in self._records
            if r.prompt_name == prompt_name and r.timestamp >= cutoff
        ]

        if not records:
            return {"error": "no data"}

        scores = [r.score.overall for r in records]

        return {
            "prompt_name": prompt_name,
            "sample_count": len(records),
            "avg_score": f"{statistics.mean(scores):.3f}",
            "median_score": f"{statistics.median(scores):.3f}",
            "std_dev": f"{statistics.stdev(scores):.3f}" if len(scores) > 1 else "N/A",
            "min_score": f"{min(scores):.3f}",
            "max_score": f"{max(scores):.3f}",
            "trend": self._calculate_trend(scores),
        }

    def _calculate_trend(self, scores: List[float]) -> str:
        """计算趋势方向"""
        if len(scores) < 3:
            return "insufficient_data"
        first_half = statistics.mean(scores[:len(scores) // 2])
        second_half = statistics.mean(scores[len(scores) // 2:])
        diff = second_half - first_half
        if diff > 0.05:
            return "improving"
        elif diff < -0.05:
            return "degrading"
        return "stable"

    def detect_quality_anomalies(self, prompt_name: str,
                                  threshold: float = 0.2) -> List[Dict]:
        """检测质量异常"""
        baseline = self._prompt_baselines.get(prompt_name, [])
        if len(baseline) < 10:
            return []

        avg = statistics.mean(baseline)
        anomalies = []

        for record in self._records:
            if record.prompt_name != prompt_name:
                continue
            deviation = abs(record.score.overall - avg)
            if deviation > threshold:
                anomalies.append({
                    "request_id": record.request_id,
                    "score": f"{record.score.overall:.3f}",
                    "baseline_avg": f"{avg:.3f}",
                    "deviation": f"{deviation:.3f}",
                    "timestamp": record.timestamp,
                })

        return anomalies


# 使用示例
if __name__ == "__main__":
    tracker = QualityTracker()

    # 模拟质量记录
    for i in range(20):
        score = QualityScore(
            relevance=0.7 + (i * 0.01),
            accuracy=0.8,
            completeness=0.9 if i > 10 else 0.5,
            format_score=0.7,
            safety_score=1.0,
        )
        tracker.record(QualityRecord(
            request_id=f"req-{i}",
            prompt_name="customer_service",
            model="gpt-4o-mini",
            timestamp=time.time() - (20 - i) * 60,
            score=score,
        ))

    trend = tracker.get_prompt_quality_trend("customer_service", hours=1)
    print("质量趋势:")
    print(json.dumps(trend, indent=2, ensure_ascii=False))

    anomalies = tracker.detect_quality_anomalies("customer_service")
    print(f"\n异常记录数: {len(anomalies)}")
```

---

## 4. 告警引擎

```python
"""
alert_engine.py
告警规则引擎
"""

import time
import json
from typing import Dict, List, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict


class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(Enum):
    PENDING = "pending"
    FIRING = "firing"
    RESOLVED = "resolved"


@dataclass
class AlertRule:
    """告警规则"""
    name: str
    description: str
    severity: AlertSeverity
    condition: Callable[[Dict], bool]
    message_template: str
    cooldown_seconds: int = 300
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class Alert:
    """告警实例"""
    rule_name: str
    severity: AlertSeverity
    status: AlertStatus
    message: str
    triggered_at: float
    resolved_at: Optional[float] = None
    labels: Dict[str, str] = field(default_factory=dict)
    metadata: Dict = field(default_factory=dict)


class AlertEngine:
    """告警引擎"""

    def __init__(self):
        self._rules: Dict[str, AlertRule] = {}
        self._active_alerts: Dict[str, Alert] = {}
        self._alert_history: List[Alert] = []
        self._last_fired: Dict[str, float] = {}
        self._notification_handlers: List[Callable] = []

    def register_rule(self, rule: AlertRule):
        """注册告警规则"""
        self._rules[rule.name] = rule

    def add_notification_handler(self, handler: Callable):
        """添加通知处理器"""
        self._notification_handlers.append(handler)

    def evaluate(self, metrics: Dict):
        """评估所有规则"""
        for name, rule in self._rules.items():
            try:
                should_fire = rule.condition(metrics)
            except Exception as e:
                print(f"规则 {name} 评估失败: {e}")
                continue

            if should_fire:
                self._fire_alert(rule, metrics)
            elif name in self._active_alerts:
                self._resolve_alert(name)

    def _fire_alert(self, rule: AlertRule, metrics: Dict):
        """触发告警"""
        # 检查冷却期
        last = self._last_fired.get(rule.name, 0)
        if time.time() - last < rule.cooldown_seconds:
            return

        message = rule.message_template.format(**metrics)

        alert = Alert(
            rule_name=rule.name,
            severity=rule.severity,
            status=AlertStatus.FIRING,
            message=message,
            triggered_at=time.time(),
            labels=rule.labels,
            metadata=metrics,
        )

        self._active_alerts[rule.name] = alert
        self._alert_history.append(alert)
        self._last_fired[rule.name] = time.time()

        # 发送通知
        for handler in self._notification_handlers:
            try:
                handler(alert)
            except Exception as e:
                print(f"通知发送失败: {e}")

    def _resolve_alert(self, rule_name: str):
        """解决告警"""
        alert = self._active_alerts.pop(rule_name, None)
        if alert:
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = time.time()

    def get_active_alerts(self) -> List[Alert]:
        """获取活跃告警"""
        return list(self._active_alerts.values())

    def get_alert_history(self, hours: int = 24) -> List[Alert]:
        """获取告警历史"""
        cutoff = time.time() - (hours * 3600)
        return [a for a in self._alert_history if a.triggered_at >= cutoff]

    def stats(self) -> Dict:
        """告警统计"""
        return {
            "active_alerts": len(self._active_alerts),
            "total_rules": len(self._rules),
            "history_24h": len(self.get_alert_history(24)),
            "by_severity": {
                s.value: sum(1 for a in self._active_alerts.values()
                            if a.severity == s)
                for s in AlertSeverity
            },
        }


# 预定义告警规则
def create_default_rules() -> List[AlertRule]:
    """创建默认告警规则"""
    return [
        AlertRule(
            name="high_error_rate",
            description="错误率超过阈值",
            severity=AlertSeverity.CRITICAL,
            condition=lambda m: float(m.get("error_rate", "0%").strip("%")) > 5,
            message_template="错误率告警: 当前错误率 {error_rate}，超过 5% 阈值",
            cooldown_seconds=300,
        ),
        AlertRule(
            name="high_latency",
            description="P95 延迟过高",
            severity=AlertSeverity.WARNING,
            condition=lambda m: float(m.get("latency", {}).get("p95_ms", "0")) > 5000,
            message_template="延迟告警: P95 延迟 {latency[p95_ms]}ms，超过 5000ms",
            cooldown_seconds=600,
        ),
        AlertRule(
            name="high_cost",
            description="小时成本过高",
            severity=AlertSeverity.WARNING,
            condition=lambda m: float(m.get("cost", {}).get("total", "$0").strip("$")) > 10,
            message_template="成本告警: 小时成本 {cost[total]}，超过 $10",
            cooldown_seconds=1800,
        ),
        AlertRule(
            name="low_cache_hit",
            description="缓存命中率过低",
            severity=AlertSeverity.INFO,
            condition=lambda m: float(m.get("cache_hit_rate", "0%").strip("%")) < 10,
            message_template="缓存告警: 命中率 {cache_hit_rate}，低于 10%",
            cooldown_seconds=3600,
        ),
    ]


# 通知处理器
def console_notifier(alert: Alert):
    """控制台通知"""
    print(f"\n{'='*50}")
    print(f"[{alert.severity.value.upper()}] {alert.rule_name}")
    print(f"消息: {alert.message}")
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(alert.triggered_at))}")
    print(f"{'='*50}\n")


def webhook_notifier(webhook_url: str) -> Callable:
    """Webhook 通知工厂"""
    def handler(alert: Alert):
        payload = {
            "rule": alert.rule_name,
            "severity": alert.severity.value,
            "message": alert.message,
            "timestamp": alert.triggered_at,
        }
        print(f"发送 Webhook: {json.dumps(payload, ensure_ascii=False)}")
        # requests.post(webhook_url, json=payload)
    return handler


# 使用示例
if __name__ == "__main__":
    engine = AlertEngine()

    for rule in create_default_rules():
        engine.register_rule(rule)

    engine.add_notification_handler(console_notifier)

    # 模拟正常指标
    normal_metrics = {
        "error_rate": "1%",
        "latency": {"p95_ms": "2000"},
        "cost": {"total": "$5.00"},
        "cache_hit_rate": "30%",
    }
    engine.evaluate(normal_metrics)
    print(f"正常指标后: {engine.stats()}")

    # 模拟异常指标
    bad_metrics = {
        "error_rate": "8%",
        "latency": {"p95_ms": "8000"},
        "cost": {"total": "$15.00"},
        "cache_hit_rate": "5%",
    }
    engine.evaluate(bad_metrics)
    print(f"异常指标后: {engine.stats()}")
```

---

## 5. 监控仪表盘接口

```python
"""
monitoring_dashboard.py
监控仪表盘数据接口
"""

import json
import time
from typing import Dict, List
from dataclasses import dataclass


class MonitoringDashboard:
    """监控仪表盘数据服务"""

    def __init__(self, metrics_collector, quality_tracker, alert_engine):
        self.metrics = metrics_collector
        self.quality = quality_tracker
        self.alerts = alert_engine

    def get_overview(self) -> Dict:
        """获取总览数据"""
        summary = self.metrics.get_summary(60)
        active_alerts = self.alerts.get_active_alerts()

        return {
            "timestamp": time.time(),
            "status": "healthy" if len(active_alerts) == 0 else "degraded",
            "active_alerts": len(active_alerts),
            "calls_1h": summary.get("total_calls", 0),
            "error_rate": summary.get("error_rate", "0%"),
            "avg_latency": summary.get("latency", {}).get("avg_ms", "N/A"),
            "cost_1h": summary.get("cost", {}).get("total", "$0"),
            "cache_hit_rate": summary.get("cache_hit_rate", "0%"),
        }

    def get_model_comparison(self) -> Dict:
        """获取模型对比数据"""
        return self.metrics.get_model_breakdown()

    def get_quality_dashboard(self, prompt_name: str) -> Dict:
        """获取质量仪表盘数据"""
        trend = self.quality.get_prompt_quality_trend(prompt_name, hours=24)
        anomalies = self.quality.detect_quality_anomalies(prompt_name)

        return {
            "prompt_name": prompt_name,
            "quality_trend": trend,
            "anomaly_count": len(anomalies),
            "recent_anomalies": anomalies[:5],
        }

    def get_alert_panel(self) -> Dict:
        """获取告警面板数据"""
        active = self.alerts.get_active_alerts()
        history = self.alerts.get_alert_history(24)

        return {
            "active_count": len(active),
            "active_alerts": [
                {
                    "rule": a.rule_name,
                    "severity": a.severity.value,
                    "message": a.message,
                    "since": time.time() - a.triggered_at,
                }
                for a in active
            ],
            "history_24h": len(history),
            "stats": self.alerts.stats(),
        }

    def export_prometheus(self) -> str:
        """导出 Prometheus 格式指标"""
        summary = self.metrics.get_summary(60)
        lines = []

        lines.append(f"# HELP prompt_calls_total Total API calls")
        lines.append(f"# TYPE prompt_calls_total counter")
        lines.append(f'prompt_calls_total {summary.get("total_calls", 0)}')

        latency = summary.get("latency", {})
        lines.append(f"# HELP prompt_latency_ms Request latency in milliseconds")
        lines.append(f"# TYPE prompt_latency_ms gauge")
        lines.append(f'prompt_latency_ms{{quantile="avg"}} {latency.get("avg_ms", 0)}')
        lines.append(f'prompt_latency_ms{{quantile="p95"}} {latency.get("p95_ms", 0)}')

        return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    # 模拟各组件
    from metrics_collector import MetricsCollector
    from quality_tracker import QualityTracker
    from alert_engine import AlertEngine, create_default_rules, console_notifier

    collector = MetricsCollector()
    tracker = QualityTracker()
    engine = AlertEngine()

    for rule in create_default_rules():
        engine.register_rule(rule)
    engine.add_notification_handler(console_notifier)

    dashboard = MonitoringDashboard(collector, tracker, engine)

    # 获取仪表盘数据
    overview = dashboard.get_overview()
    print("=== 总览 ===")
    print(json.dumps(overview, indent=2))

    prometheus = dashboard.export_prometheus()
    print("\n=== Prometheus 格式 ===")
    print(prometheus)
```

---

## 6. 告警规则对照表

| 指标 | 警告阈值 | 严重阈值 | 检查间隔 | 说明 |
|------|---------|---------|---------|------|
| 错误率 | > 3% | > 5% | 1 分钟 | 含超时和 API 错误 |
| P95 延迟 | > 3s | > 5s | 1 分钟 | 流式为 TTFT |
| 小时成本 | > $10 | > $50 | 5 分钟 | 按预算设置 |
| 缓存命中率 | < 10% | < 5% | 10 分钟 | 精确+语义合并 |
| 质量分 | < 0.6 | < 0.4 | 5 分钟 | 自动评估均值 |
| Token 用量 | > 100K/h | > 500K/h | 5 分钟 | 含输入输出 |

---

## 7. 常见错误

### ❌ 错误 1：监控粒度太粗

```python
# 错误：只监控总错误率，看不到具体是哪个 Prompt 有问题
total_errors / total_calls

# 正确：按 prompt_name 和 model 分组监控
errors_by_prompt[prompt] / calls_by_prompt[prompt]
```

### ❌ 错误 2：告警冷却期设置不当

```python
# 错误：没有冷却期，每分钟都发告警通知
cooldown_seconds = 0

# 正确：根据告警级别设置合理冷却期
cooldown_seconds = {"info": 3600, "warning": 600, "critical": 300}
```

### ❌ 错误 3：只做指标收集不做分析

```python
# 错误：收集了大量指标但没有分析和告警
collector.record(metrics)  # 然后就没了

# 正确：指标 → 分析 → 告警 → 行动
collector.record(metrics)
alerts = engine.evaluate(collector.get_summary())
if alerts:
    notify(alerts)
```

---

## 总结

Prompt 监控的核心是**全链路可观测**：从 API 调用到质量评分，从成本统计到异常告警。关键是建立合理的告警阈值和冷却机制，确保团队能及时响应问题而不会被告警淹没。

---

## 练习

### 练习 1：自定义指标
扩展 `MetricsCollector`，添加按用户分组的 Token 用量统计和 Top-N 用户排行。

### 练习 2：告警聚合器
实现一个 `AlertAggregator`，将短时间内的多条相似告警合并为一条汇总通知。

### 练习 3：健康检查端点
实现一个 `/health` 端点，返回系统健康状态（健康/降级/不可用），供负载均衡器使用。


---

**下一课**: [阶段实战：部署生产级 Prompt](./06-阶段实战-部署生产级Prompt.md)

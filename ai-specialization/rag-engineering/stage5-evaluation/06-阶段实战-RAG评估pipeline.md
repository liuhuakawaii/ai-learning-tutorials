# Stage 5 · Lesson 6: 阶段实战 — RAG 评估 Pipeline

> **时长**: 90 分钟 | **前置**: Lesson 1-5 全部完成
> **学习目标**:
> 1. 构建完整的 RAG 评估 Pipeline
> 2. 集成自动化评估与人工评估
> 3. 生成结构化评估报告
> 4. 设置持续评估与告警机制

---

## 场景引入

经过前五节课的学习，你已经掌握了评估体系设计、RAGAS 自动评估、人工评估标注、A/B 测试和持续优化闭环。现在需要把这些零散的工具和方法整合成一个完整的、可自动运行的评估 Pipeline——从评估数据集准备到指标计算、报告生成、异常告警，全流程自动化。你的目标是：每次代码提交自动触发评估，每次评估自动输出报告，每次指标下降自动触发告警。

## 1. 实战项目概述

```
┌─────────────────────────────────────────────────────────────────┐
│              RAG 评估 Pipeline 实战项目                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    输入层                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ 评估数据集│  │ RAG 系统  │  │ 人工标注  │               │  │
│  │  │ (JSON)   │  │ (API)    │  │ (可选)   │               │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘               │  │
│  └───────┼──────────────┼──────────────┼────────────────────┘  │
│          │              │              │                        │
│          ▼              ▼              ▼                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    评估引擎                               │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ RAGAS 自动  │  │ 自定义指标  │  │ 人工评估   │         │  │
│  │  │ 评估       │  │ 计算       │  │ 集成       │         │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │  │
│  │        │               │               │                 │  │
│  │        └───────────────┼───────────────┘                 │  │
│  │                        ▼                                 │  │
│  │               ┌──────────────┐                           │  │
│  │               │  结果聚合    │                           │  │
│  │               └──────┬───────┘                           │  │
│  └──────────────────────┼───────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    输出层                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ 评估报告  │  │ 告警通知  │  │ 趋势分析  │               │  │
│  │  │ (HTML)   │  │ (Webhook)│  │ (Dashboard)│              │  │
│  │  └──────────┘  └──────────┘  └──────────┘               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 完整评估 Pipeline 实现

```python
"""
RAG 评估 Pipeline — 完整实现
集成数据集管理、RAGAS 评估、自定义指标、报告生成和告警
"""

import json
import hashlib
import time
import os
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from pathlib import Path
from enum import Enum
import numpy as np


# ============================================================
# 1. 数据集管理
# ============================================================

@dataclass
class EvalSample:
    """评估样本"""
    sample_id: str
    query: str
    ground_truth: str
    contexts: List[str] = field(default_factory=list)
    relevant_doc_ids: List[str] = field(default_factory=list)
    difficulty: str = "medium"
    category: str = "general"
    metadata: Dict[str, Any] = field(default_factory=dict)


class DatasetManager:
    """评估数据集管理器"""

    def __init__(self, storage_dir: str = "eval_datasets"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_dataset(
        self,
        name: str,
        samples: List[EvalSample],
        description: str = "",
    ) -> str:
        """创建并保存评估数据集"""
        dataset_id = hashlib.md5(f"{name}:{time.time()}".encode()).hexdigest()[:10]
        dataset = {
            "dataset_id": dataset_id,
            "name": name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "size": len(samples),
            "samples": [asdict(s) for s in samples],
            "statistics": self._compute_statistics(samples),
        }

        path = self.storage_dir / f"{dataset_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)

        return dataset_id

    def load_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """加载数据集"""
        path = self.storage_dir / f"{dataset_id}.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_datasets(self) -> List[Dict[str, Any]]:
        """列出所有数据集"""
        datasets = []
        for path in self.storage_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                datasets.append({
                    "dataset_id": data["dataset_id"],
                    "name": data["name"],
                    "size": data["size"],
                    "created_at": data["created_at"],
                })
        return sorted(datasets, key=lambda x: x["created_at"], reverse=True)

    def _compute_statistics(self, samples: List[EvalSample]) -> Dict[str, Any]:
        """计算数据集统计信息"""
        difficulties = {}
        categories = {}
        for s in samples:
            difficulties[s.difficulty] = difficulties.get(s.difficulty, 0) + 1
            categories[s.category] = categories.get(s.category, 0) + 1

        return {
            "total": len(samples),
            "difficulty_distribution": difficulties,
            "category_distribution": categories,
            "avg_query_length": np.mean([len(s.query) for s in samples]) if samples else 0,
            "avg_answer_length": np.mean([len(s.ground_truth) for s in samples]) if samples else 0,
        }

    def merge_datasets(self, dataset_ids: List[str], name: str) -> str:
        """合并多个数据集"""
        all_samples = []
        for did in dataset_ids:
            data = self.load_dataset(did)
            for s in data["samples"]:
                all_samples.append(EvalSample(**s))
        return self.create_dataset(name, all_samples)


# ============================================================
# 2. RAG 系统接口
# ============================================================

@dataclass
class RAGResponse:
    """RAG 系统响应"""
    answer: str
    contexts: List[str]
    retrieved_doc_ids: List[str]
    latency_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class RAGSystemInterface:
    """RAG 系统接口 (适配器模式)"""

    def __init__(self, system: Any, system_name: str = "default"):
        self.system = system
        self.system_name = system_name

    def query(self, question: str) -> RAGResponse:
        """执行查询"""
        start_time = time.time()

        try:
            result = self.system.query(question)
            latency = (time.time() - start_time) * 1000

            return RAGResponse(
                answer=result.get("answer", ""),
                contexts=result.get("contexts", []),
                retrieved_doc_ids=result.get("retrieved_doc_ids", []),
                latency_ms=latency,
            )
        except Exception as e:
            return RAGResponse(
                answer="",
                contexts=[],
                retrieved_doc_ids=[],
                latency_ms=(time.time() - start_time) * 1000,
                metadata={"error": str(e)},
            )

    def batch_query(self, questions: List[str]) -> List[RAGResponse]:
        """批量查询"""
        return [self.query(q) for q in questions]


# ============================================================
# 3. 评估指标计算
# ============================================================

@dataclass
class MetricResult:
    """单个指标结果"""
    metric_name: str
    value: float
    per_sample_values: List[float] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


class MetricsCalculator:
    """评估指标计算器"""

    def __init__(self, llm_client: Optional[Any] = None):
        self.llm_client = llm_client

    def compute_all(
        self,
        queries: List[str],
        answers: List[str],
        contexts_list: List[List[str]],
        ground_truths: List[str],
    ) -> Dict[str, MetricResult]:
        """计算所有指标"""
        results = {}

        # 1. 基础指标
        results["answer_length"] = self._metric_answer_length(answers)
        results["context_count"] = self._metric_context_count(contexts_list)

        # 2. 基于规则的指标
        results["query_coverage"] = self._metric_query_coverage(queries, answers)
        results["answer_completeness"] = self._metric_completeness(answers, ground_truths)

        # 3. LLM 评估指标 (如果有 LLM 客户端)
        if self.llm_client:
            results["faithfulness"] = self._metric_faithfulness(answers, contexts_list)
            results["answer_relevancy"] = self._metric_relevancy(queries, answers)
            results["context_quality"] = self._metric_context_quality(queries, contexts_list)

        return results

    def _metric_answer_length(self, answers: List[str]) -> MetricResult:
        """回答长度统计"""
        lengths = [len(a) for a in answers]
        return MetricResult(
            metric_name="answer_length",
            value=float(np.mean(lengths)),
            per_sample_values=[float(l) for l in lengths],
            details={"min": min(lengths), "max": max(lengths), "std": float(np.std(lengths))},
        )

    def _metric_context_count(self, contexts_list: List[List[str]]) -> MetricResult:
        """上下文数量统计"""
        counts = [len(ctx) for ctx in contexts_list]
        return MetricResult(
            metric_name="context_count",
            value=float(np.mean(counts)),
            per_sample_values=[float(c) for c in counts],
        )

    def _metric_query_coverage(self, queries: List[str], answers: List[str]) -> MetricResult:
        """查询覆盖率: 回答中包含查询关键词的比例"""
        scores = []
        for q, a in zip(queries, answers):
            q_words = set(q.lower().split())
            a_words = set(a.lower().split())
            if not q_words:
                scores.append(1.0)
            else:
                overlap = len(q_words & a_words)
                scores.append(overlap / len(q_words))
        return MetricResult(
            metric_name="query_coverage",
            value=float(np.mean(scores)),
            per_sample_values=scores,
        )

    def _metric_completeness(self, answers: List[str], ground_truths: List[str]) -> MetricResult:
        """完整性: 回答覆盖标准答案关键信息的比例"""
        scores = []
        for a, gt in zip(answers, ground_truths):
            gt_words = set(gt.lower().split())
            a_words = set(a.lower().split())
            if not gt_words:
                scores.append(1.0)
            else:
                overlap = len(gt_words & a_words)
                scores.append(overlap / len(gt_words))
        return MetricResult(
            metric_name="answer_completeness",
            value=float(np.mean(scores)),
            per_sample_values=scores,
        )

    def _metric_faithfulness(self, answers: List[str], contexts_list: List[List[str]]) -> MetricResult:
        """忠实度: 使用 LLM 评估回答是否基于上下文"""
        scores = []
        for answer, contexts in zip(answers, contexts_list):
            prompt = f"""Rate whether the answer is faithful to the given context (0.0-1.0).

Context: {' '.join(contexts[:3])}
Answer: {answer}

Return ONLY a float number:"""
            try:
                response = self.llm_client.generate(prompt)
                score = float(response.strip())
                scores.append(max(0.0, min(1.0, score)))
            except Exception:
                scores.append(0.5)

        return MetricResult(
            metric_name="faithfulness",
            value=float(np.mean(scores)),
            per_sample_values=scores,
        )

    def _metric_relevancy(self, queries: List[str], answers: List[str]) -> MetricResult:
        """相关性: 使用 LLM 评估回答与问题的相关程度"""
        scores = []
        for query, answer in zip(queries, answers):
            prompt = f"""Rate the relevance of the answer to the question (0.0-1.0).

Question: {query}
Answer: {answer}

Return ONLY a float number:"""
            try:
                response = self.llm_client.generate(prompt)
                score = float(response.strip())
                scores.append(max(0.0, min(1.0, score)))
            except Exception:
                scores.append(0.5)

        return MetricResult(
            metric_name="answer_relevancy",
            value=float(np.mean(scores)),
            per_sample_values=scores,
        )

    def _metric_context_quality(self, queries: List[str], contexts_list: List[List[str]]) -> MetricResult:
        """上下文质量: 使用 LLM 评估检索到的上下文对回答问题的帮助程度"""
        scores = []
        for query, contexts in zip(queries, contexts_list):
            prompt = f"""Rate how useful the context is for answering the question (0.0-1.0).

Question: {query}
Context: {' '.join(contexts[:3])}

Return ONLY a float number:"""
            try:
                response = self.llm_client.generate(prompt)
                score = float(response.strip())
                scores.append(max(0.0, min(1.0, score)))
            except Exception:
                scores.append(0.5)

        return MetricResult(
            metric_name="context_quality",
            value=float(np.mean(scores)),
            per_sample_values=scores,
        )


# ============================================================
# 4. 报告生成
# ============================================================

class ReportGenerator:
    """评估报告生成器"""

    def __init__(self, output_dir: str = "eval_reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(
        self,
        run_id: str,
        dataset_name: str,
        system_name: str,
        metrics: Dict[str, MetricResult],
        samples: List[Dict],
        rag_responses: List[RAGResponse],
        duration_seconds: float,
    ) -> str:
        """生成完整评估报告"""
        report = {
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "dataset_name": dataset_name,
            "system_name": system_name,
            "duration_seconds": round(duration_seconds, 2),
            "summary": {
                name: {
                    "value": round(m.value, 4),
                    "details": m.details,
                }
                for name, m in metrics.items()
            },
            "per_sample_results": self._build_per_sample(
                samples, rag_responses, metrics
            ),
        }

        # 保存 JSON 报告
        json_path = self.output_dir / f"{run_id}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # 生成 Markdown 报告
        md_path = self.output_dir / f"{run_id}.md"
        md_content = self._generate_markdown(report)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        return str(json_path)

    def _build_per_sample(
        self,
        samples: List[Dict],
        responses: List[RAGResponse],
        metrics: Dict[str, MetricResult],
    ) -> List[Dict]:
        """构建每条样本的详细结果"""
        results = []
        for i, (sample, resp) in enumerate(zip(samples, responses)):
            sample_result = {
                "index": i,
                "query": sample.get("query", ""),
                "expected_answer": sample.get("ground_truth", ""),
                "actual_answer": resp.answer,
                "latency_ms": resp.latency_ms,
                "error": resp.metadata.get("error"),
                "metrics": {},
            }
            for name, metric in metrics.items():
                if i < len(metric.per_sample_values):
                    sample_result["metrics"][name] = round(metric.per_sample_values[i], 4)
            results.append(sample_result)
        return results

    def _generate_markdown(self, report: Dict) -> str:
        """生成 Markdown 格式报告"""
        lines = []
        lines.append(f"# RAG 评估报告")
        lines.append(f"")
        lines.append(f"- **运行 ID**: {report['run_id']}")
        lines.append(f"- **时间**: {report['timestamp']}")
        lines.append(f"- **数据集**: {report['dataset_name']}")
        lines.append(f"- **系统**: {report['system_name']}")
        lines.append(f"- **耗时**: {report['duration_seconds']}s")
        lines.append(f"")
        lines.append(f"## 指标汇总")
        lines.append(f"")
        lines.append(f"| 指标 | 值 |")
        lines.append(f"|------|-----|")
        for name, data in report["summary"].items():
            lines.append(f"| {name} | {data['value']:.4f} |")

        lines.append(f"")
        lines.append(f"## 问题样本")
        lines.append(f"")
        problem_samples = [
            s for s in report["per_sample_results"]
            if s.get("error") or any(v < 0.5 for v in s.get("metrics", {}).values())
        ]
        if problem_samples:
            for s in problem_samples[:10]:
                lines.append(f"### 样本 {s['index']}")
                lines.append(f"- **查询**: {s['query']}")
                lines.append(f"- **期望**: {s['expected_answer'][:100]}...")
                lines.append(f"- **实际**: {s['actual_answer'][:100]}...")
                if s.get("error"):
                    lines.append(f"- **错误**: {s['error']}")
                lines.append(f"")
        else:
            lines.append("未发现严重问题样本。")

        return "\n".join(lines)


# ============================================================
# 5. 告警系统
# ============================================================

@dataclass
class AlertRule:
    """告警规则"""
    rule_id: str
    metric_name: str
    condition: str           # "below", "above", "change_pct"
    threshold: float
    severity: str = "warning"  # info, warning, critical
    enabled: bool = True


class AlertSystem:
    """告警系统"""

    def __init__(self, webhook_url: Optional[str] = None):
        self.rules: List[AlertRule] = []
        self.webhook_url = webhook_url
        self.alert_history: List[Dict] = []

    def add_rule(self, rule: AlertRule) -> None:
        """添加告警规则"""
        self.rules.append(rule)

    def check(
        self,
        current_metrics: Dict[str, float],
        baseline_metrics: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """检查是否触发告警"""
        alerts = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            current_value = current_metrics.get(rule.metric_name)
            if current_value is None:
                continue

            triggered = False
            message = ""

            if rule.condition == "below" and current_value < rule.threshold:
                triggered = True
                message = f"{rule.metric_name} = {current_value:.4f} 低于阈值 {rule.threshold}"

            elif rule.condition == "above" and current_value > rule.threshold:
                triggered = True
                message = f"{rule.metric_name} = {current_value:.4f} 高于阈值 {rule.threshold}"

            elif rule.condition == "change_pct" and baseline_metrics:
                baseline_value = baseline_metrics.get(rule.metric_name)
                if baseline_value and baseline_value != 0:
                    change_pct = (current_value - baseline_value) / abs(baseline_value) * 100
                    if abs(change_pct) > rule.threshold:
                        triggered = True
                        direction = "上升" if change_pct > 0 else "下降"
                        message = f"{rule.metric_name} {direction} {abs(change_pct):.1f}% (阈值: {rule.threshold}%)"

            if triggered:
                alert = {
                    "rule_id": rule.rule_id,
                    "metric": rule.metric_name,
                    "severity": rule.severity,
                    "message": message,
                    "current_value": current_value,
                    "threshold": rule.threshold,
                    "timestamp": datetime.now().isoformat(),
                }
                alerts.append(alert)
                self.alert_history.append(alert)

        # 发送通知
        if alerts and self.webhook_url:
            self._send_notification(alerts)

        return alerts

    def _send_notification(self, alerts: List[Dict]) -> None:
        """发送告警通知"""
        # 实际实现中调用 webhook
        for alert in alerts:
            print(f"[ALERT] [{alert['severity'].upper()}] {alert['message']}")

    def setup_default_rules(self) -> None:
        """设置默认告警规则"""
        self.add_rule(AlertRule(
            rule_id="faithfulness_low",
            metric_name="faithfulness",
            condition="below",
            threshold=0.6,
            severity="critical",
        ))
        self.add_rule(AlertRule(
            rule_id="relevancy_low",
            metric_name="answer_relevancy",
            condition="below",
            threshold=0.5,
            severity="warning",
        ))
        self.add_rule(AlertRule(
            rule_id="latency_high",
            metric_name="avg_latency_ms",
            condition="above",
            threshold=5000,
            severity="warning",
        ))
        self.add_rule(AlertRule(
            rule_id="quality_regression",
            metric_name="faithfulness",
            condition="change_pct",
            threshold=10.0,
            severity="critical",
        ))


# ============================================================
# 6. 主 Pipeline
# ============================================================

class RAGEvalPipeline:
    """RAG 评估主 Pipeline"""

    def __init__(
        self,
        rag_system: RAGSystemInterface,
        dataset_manager: DatasetManager,
        metrics_calculator: MetricsCalculator,
        report_generator: ReportGenerator,
        alert_system: Optional[AlertSystem] = None,
    ):
        self.rag_system = rag_system
        self.dataset_manager = dataset_manager
        self.metrics_calculator = metrics_calculator
        self.report_generator = report_generator
        self.alert_system = alert_system
        self.run_history: List[Dict] = []

    def run(
        self,
        dataset_id: str,
        run_name: str = "",
        sample_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """执行完整评估 Pipeline"""
        start_time = time.time()
        run_id = f"eval_{int(start_time)}"

        print(f"[Pipeline] 开始评估: {run_id}")
        print(f"[Pipeline] 系统: {self.rag_system.system_name}")

        # Step 1: 加载数据集
        print("[Pipeline] Step 1/5: 加载数据集...")
        dataset = self.dataset_manager.load_dataset(dataset_id)
        samples = dataset["samples"]
        if sample_limit:
            samples = samples[:sample_limit]
        print(f"[Pipeline] 数据集大小: {len(samples)}")

        # Step 2: 执行 RAG 查询
        print("[Pipeline] Step 2/5: 执行 RAG 查询...")
        queries = [s["query"] for s in samples]
        responses = self.rag_system.batch_query(queries)
        print(f"[Pipeline] 查询完成，成功: {sum(1 for r in responses if not r.metadata.get('error'))}")

        # Step 3: 计算指标
        print("[Pipeline] Step 3/5: 计算评估指标...")
        metrics = self.metrics_calculator.compute_all(
            queries=queries,
            answers=[r.answer for r in responses],
            contexts_list=[r.contexts for r in responses],
            ground_truths=[s["ground_truth"] for s in samples],
        )
        print(f"[Pipeline] 指标计算完成: {list(metrics.keys())}")

        # Step 4: 生成报告
        print("[Pipeline] Step 4/5: 生成评估报告...")
        duration = time.time() - start_time
        report_path = self.report_generator.generate(
            run_id=run_id,
            dataset_name=dataset.get("name", dataset_id),
            system_name=self.rag_system.system_name,
            metrics=metrics,
            samples=samples,
            rag_responses=responses,
            duration_seconds=duration,
        )
        print(f"[Pipeline] 报告已保存: {report_path}")

        # Step 5: 检查告警
        if self.alert_system:
            print("[Pipeline] Step 5/5: 检查告警规则...")
            current_metrics = {name: m.value for name, m in metrics.items()}
            baseline = self._get_baseline_metrics()
            alerts = self.alert_system.check(current_metrics, baseline)
            if alerts:
                print(f"[Pipeline] ⚠️ 触发 {len(alerts)} 条告警!")
                for a in alerts:
                    print(f"  [{a['severity']}] {a['message']}")
            else:
                print("[Pipeline] ✅ 未触发告警")

        # 汇总结果
        result = {
            "run_id": run_id,
            "dataset_id": dataset_id,
            "system_name": self.rag_system.system_name,
            "dataset_size": len(samples),
            "duration_seconds": round(duration, 2),
            "metrics": {name: round(m.value, 4) for name, m in metrics.items()},
            "report_path": report_path,
            "timestamp": datetime.now().isoformat(),
        }
        self.run_history.append(result)

        # 打印汇总
        print("\n" + "=" * 50)
        print(f"  评估完成: {run_id}")
        print(f"  耗时: {duration:.1f}s | 样本: {len(samples)}")
        print("-" * 50)
        for name, value in result["metrics"].items():
            bar_len = int(value * 30)
            bar = "█" * bar_len + "░" * (30 - bar_len)
            print(f"  {name:<25} {bar} {value:.4f}")
        print("=" * 50)

        return result

    def compare_runs(self, run_ids: List[str]) -> Dict[str, Any]:
        """对比多次评估结果"""
        comparison = {}
        for run in self.run_history:
            if run["run_id"] in run_ids:
                comparison[run["run_id"]] = {
                    "metrics": run["metrics"],
                    "timestamp": run["timestamp"],
                }
        return comparison

    def get_trend(self, metric_name: str) -> List[Dict]:
        """获取指标趋势"""
        return [
            {
                "run_id": r["run_id"],
                "value": r["metrics"].get(metric_name),
                "timestamp": r["timestamp"],
            }
            for r in self.run_history
            if metric_name in r.get("metrics", {})
        ]

    def _get_baseline_metrics(self) -> Optional[Dict[str, float]]:
        """获取基线指标 (上一次运行)"""
        if len(self.run_history) >= 2:
            return self.run_history[-2].get("metrics")
        return None


# ============================================================
# 7. 使用示例
# ============================================================

if __name__ == "__main__":
    # 模拟 RAG 系统
    class MockRAGSystem:
        def query(self, question: str) -> dict:
            return {
                "answer": f"这是关于 '{question[:20]}' 的回答...",
                "contexts": ["相关上下文内容..."],
                "retrieved_doc_ids": ["doc_001"],
            }

    # 创建组件
    dataset_mgr = DatasetManager()
    rag_interface = RAGSystemInterface(MockRAGSystem(), system_name="MockRAG")
    calculator = MetricsCalculator()
    reporter = ReportGenerator()

    # 配置告警
    alerter = AlertSystem()
    alerter.setup_default_rules()

    # 创建 Pipeline
    pipeline = RAGEvalPipeline(
        rag_system=rag_interface,
        dataset_manager=dataset_mgr,
        metrics_calculator=calculator,
        report_generator=reporter,
        alert_system=alerter,
    )

    # 创建测试数据集
    test_samples = [
        EvalSample(
            sample_id=f"sample_{i}",
            query=f"测试问题 {i}: 什么是 RAG？",
            ground_truth=f"RAG 是检索增强生成技术...",
            contexts=["RAG 是一种结合检索和生成的技术框架..."],
            difficulty="easy",
            category="concept",
        )
        for i in range(5)
    ]
    dataset_id = dataset_mgr.create_dataset("test_eval", test_samples, "测试评估数据集")
    print(f"数据集已创建: {dataset_id}")

    # 运行评估
    result = pipeline.run(dataset_id, run_name="baseline_test")
    print(f"\n评估结果: {json.dumps(result['metrics'], indent=2)}")
```

---

## 3. 持续评估设置

```python
"""
持续评估调度器
定期运行评估 Pipeline，监控 RAG 系统质量
"""

import time
import threading
from typing import Optional, Callable
from datetime import datetime


class ContinuousEvaluator:
    """持续评估调度器"""

    def __init__(
        self,
        pipeline: Any,  # RAGEvalPipeline
        dataset_id: str,
        interval_hours: float = 24,
        on_alert: Optional[Callable] = None,
    ):
        self.pipeline = pipeline
        self.dataset_id = dataset_id
        self.interval_hours = interval_hours
        self.on_alert = on_alert
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """启动持续评估"""
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[持续评估] 已启动，间隔 {self.interval_hours} 小时")

    def stop(self) -> None:
        """停止持续评估"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[持续评估] 已停止")

    def _run_loop(self) -> None:
        """评估循环"""
        while self._running:
            try:
                print(f"\n[持续评估] 开始新一轮评估: {datetime.now().isoformat()}")
                result = self.pipeline.run(self.dataset_id, run_name="scheduled")
                print(f"[持续评估] 评估完成: {result['run_id']}")
            except Exception as e:
                print(f"[持续评估] 评估失败: {e}")

            # 等待下一次评估
            wait_seconds = self.interval_hours * 3600
            for _ in range(int(wait_seconds)):
                if not self._running:
                    break
                time.sleep(1)

    def run_once(self) -> dict:
        """手动触发一次评估"""
        return self.pipeline.run(self.dataset_id, run_name="manual")
```

---

## 4. 常见误区

```
┌─────────────────────────────────────────────────────────────────┐
│                       常见错误                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ 错误1: Pipeline 过于复杂                                     │
│     把所有逻辑塞到一个类里，难以维护                              │
│     ✅ 正确: 遵循单一职责，每个组件做一件事                       │
│                                                                 │
│  ❌ 错误2: 不处理异常                                            │
│     RAG 查询失败导致整个 Pipeline 崩溃                           │
│     ✅ 正确: 每个步骤都有异常处理和降级方案                       │
│                                                                 │
│  ❌ 错误3: 评估结果不持久化                                      │
│     每次运行后结果丢失，无法追踪趋势                              │
│     ✅ 正确: 所有评估结果都要保存，支持历史对比                   │
│                                                                 │
│  ❌ 错误4: 告警规则太松或太紧                                    │
│     太松: 问题发现不及时                                         │
│     太紧: 告警疲劳，忽略真正的问题                                │
│     ✅ 正确: 根据历史数据设定合理阈值，定期调整                   │
│                                                                 │
│  ❌ 错误5: 忽略评估 Pipeline 本身的性能                          │
│     评估耗时太长，无法频繁执行                                    │
│     ✅ 正确: 优化评估性能，支持采样评估                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 工程建议

1. **评估 Pipeline 要能独立运行**：不依赖于 RAG 系统的运行状态。RAG 系统挂了，评估 Pipeline 应该仍然能用历史数据生成报告。
2. **评估报告要可追溯**：每次评估都要记录代码版本、配置参数、评估数据集版本。没有这些信息，不同时间的评估结果无法对比。
3. **告警要有分级机制**：指标轻微下降发 Slack 通知，严重下降发邮件+短信，关键指标崩溃直接触发回滚。不同级别的告警对应不同的响应流程。
4. **持续评估的频率要平衡成本和时效性**：每天跑一次全量评估可能成本太高，每周一次可能发现不了及时问题。建议关键指标每天监控，完整评估每周一次。

---

## 6. 总结

```
┌─────────────────────────────────────────────────────────┐
│                   本课核心要点                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 评估 Pipeline = 数据集管理 + RAG 查询 + 指标计算    │
│     + 报告生成 + 告警                                   │
│  2. 组件化设计: 每个模块独立可替换                       │
│  3. 持续评估: 定时运行 + 自动告警                       │
│  4. 趋势追踪: 每次运行结果持久化，支持历史对比          │
│  5. 实战要点: 异常处理、性能优化、告警调优              │
│                                                         │
│  核心公式:                                              │
│  评估 Pipeline = f(数据集, RAG, 指标, 报告, 告警)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 练习

### 练习 1: 数据集管理器 (基础)
实现一个 `DatasetManager`:
1. 支持创建、加载、列出评估数据集
2. 计算数据集统计信息 (难度分布、类别分布)
3. 支持合并多个数据集
4. 持久化为 JSON 文件

### 练习 2: 完整评估 Pipeline (进阶)
构建完整的 RAG 评估 Pipeline:
1. 集成 RAGAS 或自定义指标计算
2. 实现报告生成 (JSON + Markdown)
3. 添加告警规则 (至少 3 条)
4. 对同一批样本运行两次评估，对比结果

### 练习 3: 持续评估系统 (综合)
构建一个持续评估系统:
1. 实现 `ContinuousEvaluator`，支持定时评估
2. 实现趋势追踪 (指标随时间变化)
3. 实现基线对比 (当前 vs 上一次)
4. 实现告警通知 (控制台输出即可)
5. 模拟 3 次评估运行，验证趋势和告警功能

---

**上一课**: [05-持续优化闭环](./05-持续优化闭环.md) |
**本课为 Stage 5 最后一课** |
**课程完成**: 🎉 恭喜完成 RAG 工程化全部课程！

---

## 参考答案

### 练习 1: 数据集管理器 (基础)

**思路**：数据集管理器负责评估数据集的生命周期管理：创建、加载、列出、合并。核心设计点是每个数据集有唯一 ID（基于名称和时间戳的哈希），保存为独立 JSON 文件，同时计算统计信息（难度分布、类别分布）便于快速了解数据集特征。

**答案**：
```python
import json
import hashlib
import time
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any
from datetime import datetime
from pathlib import Path


@dataclass
class EvalSample:
    sample_id: str
    query: str
    ground_truth: str
    contexts: List[str] = field(default_factory=list)
    relevant_doc_ids: List[str] = field(default_factory=list)
    difficulty: str = "medium"
    category: str = "general"


class DatasetManager:
    def __init__(self, storage_dir="eval_datasets"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_dataset(self, name, samples, description=""):
        dataset_id = hashlib.md5(f"{name}:{time.time()}".encode()).hexdigest()[:10]
        dataset = {
            "dataset_id": dataset_id,
            "name": name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "size": len(samples),
            "samples": [asdict(s) for s in samples],
            "statistics": self._compute_statistics(samples),
        }
        path = self.storage_dir / f"{dataset_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)
        return dataset_id

    def load_dataset(self, dataset_id):
        path = self.storage_dir / f"{dataset_id}.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_datasets(self):
        datasets = []
        for path in self.storage_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                datasets.append({
                    "dataset_id": data["dataset_id"],
                    "name": data["name"],
                    "size": data["size"],
                    "created_at": data["created_at"],
                })
        return sorted(datasets, key=lambda x: x["created_at"], reverse=True)

    def _compute_statistics(self, samples):
        difficulties = {}
        categories = {}
        for s in samples:
            d = s.difficulty if hasattr(s, "difficulty") else s.get("difficulty", "unknown")
            c = s.category if hasattr(s, "category") else s.get("category", "unknown")
            difficulties[d] = difficulties.get(d, 0) + 1
            categories[c] = categories.get(c, 0) + 1
        return {
            "total": len(samples),
            "difficulty_distribution": difficulties,
            "category_distribution": categories,
        }

    def merge_datasets(self, dataset_ids, name):
        all_samples = []
        for did in dataset_ids:
            data = self.load_dataset(did)
            for s in data["samples"]:
                all_samples.append(EvalSample(**s))
        return self.create_dataset(name, all_samples)


# 测试
manager = DatasetManager("test_datasets")

samples_a = [
    EvalSample("s1", "什么是 RAG？", "RAG 是检索增强生成技术", difficulty="easy", category="concept"),
    EvalSample("s2", "如何优化检索？", "混合检索和重排序", difficulty="medium", category="operation"),
]
samples_b = [
    EvalSample("s3", "什么是向量数据库？", "专门存储高维向量的数据库", difficulty="easy", category="concept"),
]

id_a = manager.create_dataset("概念与操作", samples_a, "基础概念和操作类问题")
id_b = manager.create_dataset("数据库知识", samples_b, "向量数据库相关")
print(f"数据集 A: {id_a}, 数据集 B: {id_b}")

merged_id = manager.merge_datasets([id_a, id_b], "合并数据集")
merged = manager.load_dataset(merged_id)
print(f"合并后: {merged['size']} 条样本")
print(f"统计: {json.dumps(merged['statistics'], indent=2, ensure_ascii=False)}")

datasets = manager.list_datasets()
print(f"\n所有数据集 ({len(datasets)} 个):")
for d in datasets:
    print(f"  {d['name']}: {d['size']} 条, 创建于 {d['created_at'][:19]}")
```

**要点**：
- 数据集 ID 基于名称和时间戳的 MD5 哈希，保证唯一性且可重现
- `_compute_statistics` 兼容 dataclass 和 dict 两种输入，提升灵活性
- `merge_datasets` 加载多个数据集后重建样本列表，自动计算合并后的统计信息

---

### 练习 2: 完整评估 Pipeline (进阶)

**思路**：完整 Pipeline 需要五个组件配合：数据集管理器提供数据、RAG 系统接口执行查询、指标计算器评估质量、报告生成器输出结果、告警系统监控异常。关键是每个组件独立可替换，Pipeline 主类只负责编排。

**答案**：
```python
import json
import time
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path


@dataclass
class MetricResult:
    metric_name: str
    value: float
    per_sample_values: List[float] = field(default_factory=list)


class MetricsCalculator:
    def compute_all(self, queries, answers, contexts_list, ground_truths):
        results = {}
        results["query_coverage"] = self._query_coverage(queries, answers)
        results["answer_completeness"] = self._completeness(answers, ground_truths)
        results["answer_length"] = self._answer_length(answers)
        return results

    def _query_coverage(self, queries, answers):
        scores = []
        for q, a in zip(queries, answers):
            q_words = set(q.lower().split())
            a_words = set(a.lower().split())
            scores.append(len(q_words & a_words) / max(len(q_words), 1))
        return MetricResult("query_coverage", float(np.mean(scores)), scores)

    def _completeness(self, answers, ground_truths):
        scores = []
        for a, g in zip(answers, ground_truths):
            g_words = set(g.lower().split())
            a_words = set(a.lower().split())
            scores.append(len(g_words & a_words) / max(len(g_words), 1))
        return MetricResult("answer_completeness", float(np.mean(scores)), scores)

    def _answer_length(self, answers):
        lengths = [len(a) for a in answers]
        return MetricResult("answer_length", float(np.mean(lengths)), [float(l) for l in lengths])


class AlertSystem:
    def __init__(self):
        self.rules = []
        self.alert_history = []

    def add_rule(self, rule_id, metric_name, condition, threshold, severity="warning"):
        self.rules.append({
            "rule_id": rule_id, "metric_name": metric_name,
            "condition": condition, "threshold": threshold, "severity": severity,
        })

    def check(self, current_metrics, baseline_metrics=None):
        alerts = []
        for rule in self.rules:
            value = current_metrics.get(rule["metric_name"])
            if value is None:
                continue
            triggered = False
            if rule["condition"] == "below" and value < rule["threshold"]:
                triggered = True
                msg = f"{rule['metric_name']}={value:.4f} 低于 {rule['threshold']}"
            elif rule["condition"] == "above" and value > rule["threshold"]:
                triggered = True
                msg = f"{rule['metric_name']}={value:.4f} 高于 {rule['threshold']}"
            elif rule["condition"] == "change_pct" and baseline_metrics:
                base = baseline_metrics.get(rule["metric_name"])
                if base and base != 0:
                    pct = (value - base) / abs(base) * 100
                    if abs(pct) > rule["threshold"]:
                        triggered = True
                        direction = "上升" if pct > 0 else "下降"
                        msg = f"{rule['metric_name']} {direction} {abs(pct):.1f}%"
            if triggered:
                alerts.append({"rule_id": rule["rule_id"], "severity": rule["severity"], "message": msg})
                self.alert_history.append(alerts[-1])
        return alerts

    def setup_default_rules(self):
        self.add_rule("coverage_low", "query_coverage", "below", 0.3, "critical")
        self.add_rule("completeness_low", "answer_completeness", "below", 0.4, "warning")
        self.add_rule("quality_regression", "answer_completeness", "change_pct", 15.0, "critical")


class SimpleRAGEvalPipeline:
    def __init__(self, rag_system, calculator, alert_system=None):
        self.rag = rag_system
        self.calculator = calculator
        self.alert_system = alert_system
        self.run_history = []

    def run(self, eval_dataset, run_name=""):
        start = time.time()
        run_id = f"eval_{int(start)}"

        queries = [s["query"] for s in eval_dataset]
        responses = [self.rag.query(q) for q in queries]

        metrics = self.calculator.compute_all(
            queries=queries,
            answers=[r["answer"] for r in responses],
            contexts_list=[r.get("contexts", []) for r in responses],
            ground_truths=[s["ground_truth"] for s in eval_dataset],
        )

        metric_dict = {name: round(m.value, 4) for name, m in metrics.items()}
        alerts = []
        if self.alert_system:
            baseline = self.run_history[-1]["metrics"] if self.run_history else None
            alerts = self.alert_system.check(metric_dict, baseline)

        result = {
            "run_id": run_id,
            "run_name": run_name,
            "metrics": metric_dict,
            "alerts": alerts,
            "duration": round(time.time() - start, 2),
            "timestamp": datetime.now().isoformat(),
        }
        self.run_history.append(result)

        print(f"评估完成: {run_id} ({run_name})")
        for name, value in metric_dict.items():
            print(f"  {name}: {value:.4f}")
        if alerts:
            for a in alerts:
                print(f"  ⚠️ [{a['severity']}] {a['message']}")
        return result


# 测试
class MockRAG:
    def query(self, q):
        return {"answer": f"关于'{q}'的回答", "contexts": ["..."]}

pipeline = SimpleRAGEvalPipeline(
    rag_system=MockRAG(),
    calculator=MetricsCalculator(),
    alert_system=AlertSystem(),
)
pipeline.alert_system.setup_default_rules()

dataset = [
    {"query": "什么是 RAG？", "ground_truth": "RAG 是检索增强生成"},
    {"query": "如何优化检索？", "ground_truth": "混合检索和重排序"},
]

r1 = pipeline.run(dataset, "baseline")
r2 = pipeline.run(dataset, "v2")
print(f"\n告警历史: {pipeline.alert_system.alert_history}")
```

**要点**：
- Pipeline 组件化：MetricsCalculator、AlertSystem 各自独立，可以单独替换或升级
- 告警系统支持三种条件：低于阈值（below）、高于阈值（above）、百分比变化（change_pct）
- 基线对比使用上一次运行的指标（`self.run_history[-1]`），实现逐次回归检测

---

### 练习 3: 持续评估系统 (综合)

**思路**：持续评估系统需要定时触发评估 Pipeline，追踪指标趋势，对比基线，并在指标异常时触发告警。核心是 `ContinuousEvaluator` 类负责调度，支持手动触发和定时运行两种模式。

**答案**：
```python
import json
import time
import threading
import numpy as np
from typing import Optional, Callable, List, Dict, Any
from datetime import datetime
from pathlib import Path


class ContinuousEvaluator:
    def __init__(self, pipeline, dataset_id, interval_hours=24, on_alert=None):
        self.pipeline = pipeline
        self.dataset_id = dataset_id
        self.interval_hours = interval_hours
        self.on_alert = on_alert
        self._running = False
        self._thread = None

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[持续评估] 已启动，间隔 {self.interval_hours} 小时")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[持续评估] 已停止")

    def _run_loop(self):
        while self._running:
            try:
                result = self.pipeline.run(self.dataset_id, run_name="scheduled")
                if result.get("alerts") and self.on_alert:
                    self.on_alert(result["alerts"])
            except Exception as e:
                print(f"[持续评估] 失败: {e}")
            wait = int(self.interval_hours * 3600)
            for _ in range(wait):
                if not self._running:
                    break
                time.sleep(1)

    def run_once(self):
        return self.pipeline.run(self.dataset_id, run_name="manual")


class TrendTracker:
    def __init__(self):
        self.history: List[Dict] = []

    def add_run(self, run_result):
        self.history.append({
            "run_id": run_result["run_id"],
            "metrics": run_result["metrics"],
            "timestamp": run_result.get("timestamp", datetime.now().isoformat()),
        })

    def get_trend(self, metric_name):
        return [
            {"run_id": r["run_id"], "value": r["metrics"].get(metric_name),
             "timestamp": r["timestamp"]}
            for r in self.history
            if metric_name in r.get("metrics", {})
        ]

    def print_trends(self):
        if not self.history:
            print("无历史数据")
            return
        all_metrics = set()
        for r in self.history:
            all_metrics.update(r["metrics"].keys())

        print("=" * 60)
        print("指标趋势")
        print("=" * 60)
        for metric in sorted(all_metrics):
            trend = self.get_trend(metric)
            values = [t["value"] for t in trend if t["value"] is not None]
            if not values:
                continue
            direction = "↑" if values[-1] > values[0] else "↓" if values[-1] < values[0] else "→"
            print(f"  {metric}: {' → '.join(f'{v:.4f}' for v in values)} {direction}")
        print("=" * 60)


class BaselineComparator:
    def __init__(self):
        self.baselines: Dict[str, Dict[str, float]] = {}

    def set_baseline(self, run_id, metrics):
        self.baselines[run_id] = metrics

    def compare(self, current_metrics, baseline_run_id=None):
        if baseline_run_id and baseline_run_id in self.baselines:
            baseline = self.baselines[baseline_run_id]
        else:
            latest = list(self.baselines.values())[-1] if self.baselines else {}
            baseline = latest

        comparison = {}
        for metric, value in current_metrics.items():
            base_value = baseline.get(metric)
            if base_value is not None and base_value != 0:
                change_pct = (value - base_value) / abs(base_value) * 100
                comparison[metric] = {
                    "current": value,
                    "baseline": base_value,
                    "change_pct": round(change_pct, 2),
                    "direction": "上升" if change_pct > 0 else "下降" if change_pct < 0 else "持平",
                }
        return comparison


# 模拟 3 次评估运行
class MockPipeline:
    def __init__(self):
        self.call_count = 0

    def run(self, dataset_id, run_name=""):
        self.call_count += 1
        np.random.seed(42 + self.call_count)
        base_completeness = 0.65 + self.call_count * 0.05
        metrics = {
            "query_coverage": round(0.7 + np.random.normal(0, 0.05), 4),
            "answer_completeness": round(base_completeness + np.random.normal(0, 0.03), 4),
        }
        alerts = []
        if metrics["answer_completeness"] < 0.6:
            alerts.append({"severity": "critical", "message": "完整性过低"})
        return {
            "run_id": f"eval_{self.call_count}",
            "metrics": metrics,
            "alerts": alerts,
            "timestamp": datetime.now().isoformat(),
        }


pipeline = MockPipeline()
tracker = TrendTracker()
comparator = BaselineComparator()
alert_log = []

def on_alert(alerts):
    for a in alerts:
        alert_log.append(a)
        print(f"  🔔 告警: [{a['severity']}] {a['message']}")

evaluator = ContinuousEvaluator(pipeline, "dataset_001", on_alert=on_alert)

print("模拟 3 次评估运行:")
print("=" * 50)
for i in range(3):
    result = evaluator.run_once()
    tracker.add_run(result)
    if i == 0:
        comparator.set_baseline(result["run_id"], result["metrics"])
    comparison = comparator.compare(result["metrics"])
    print(f"\n第 {i+1} 次评估:")
    for metric, data in comparison.items():
        print(f"  {metric}: {data['current']:.4f} (基线: {data['baseline']:.4f}, {data['direction']} {abs(data['change_pct']):.1f}%)")

print("\n" + "=" * 50)
tracker.print_trends()
print(f"\n告警记录: {len(alert_log)} 条")
```

**要点**：
- `ContinuousEvaluator` 支持定时运行（`start` 启动后台线程）和手动触发（`run_once`），两种模式互补
- `TrendTracker` 记录每次运行的指标，`print_trends` 展示指标随时间的变化方向
- `BaselineComparator` 支持指定基线版本或自动使用最新一次运行作为基线，检测回归

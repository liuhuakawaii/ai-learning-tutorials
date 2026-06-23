# 阶段实战：构建 RAG 评估 Pipeline

> Stage 5 · Capstone | 前置：Lesson 1-5 完成 | 时长：90 分钟

把评估体系、RAGAS、自定义指标整合成可自动运行的 Pipeline。代码提交自动触发评估，指标下降自动告警。

## 你要完成的事

- 构建完整评估 Pipeline（数据 → 评估 → 报告）
- 集成 RAGAS 和自定义指标
- 实现 CI 集成

## 1. 评估数据集

```python
import json
from dataclasses import dataclass

@dataclass
class EvalCase:
    question: str
    ground_truth: str
    category: str = "general"
    difficulty: str = "medium"

class EvalDataset:
    def __init__(self, path):
        with open(path, "r", encoding="utf-8") as f:
            self.cases = [EvalCase(**item) for item in json.load(f)]

    def filter(self, category=None, difficulty=None):
        cases = self.cases
        if category:
            cases = [c for c in cases if c.category == category]
        if difficulty:
            cases = [c for c in cases if c.difficulty == difficulty]
        return cases
```

## 2. RAGAS 评估

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset

def run_ragas_eval(eval_cases, rag_fn):
    questions, answers, contexts, truths = [], [], [], []
    for case in eval_cases:
        result = rag_fn(case.question)
        questions.append(case.question)
        answers.append(result["answer"])
        contexts.append([c["text"] for c in result["contexts"]])
        truths.append(case.ground_truth)

    dataset = Dataset.from_dict({
        "question": questions, "answer": answers,
        "contexts": contexts, "ground_truth": truths
    })
    result = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_precision, context_recall])
    return {k: result[k] for k in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]}
```

## 3. 自定义指标

```python
import time, statistics

def measure_latency(rag_fn, questions):
    latencies = []
    for q in questions:
        start = time.time()
        rag_fn(q)
        latencies.append((time.time() - start) * 1000)
    return {
        "p50": statistics.median(latencies),
        "p95": sorted(latencies)[int(len(latencies) * 0.95)],
        "mean": statistics.mean(latencies)
    }

def measure_cost(rag_fn, questions):
    total_in, total_out = 0, 0
    for q in questions:
        result = rag_fn(q)
        if "usage" in result:
            total_in += result["usage"]["prompt_tokens"]
            total_out += result["usage"]["completion_tokens"]
    cost = total_in / 1000 * 0.00015 + total_out / 1000 * 0.0006
    return {"total_input_tokens": total_in, "total_output_tokens": total_out,
            "estimated_cost_usd": cost, "avg_cost_per_query": cost / len(questions)}
```

## 4. 报告生成

```python
from datetime import datetime

class EvalReport:
    def __init__(self, config, ragas_scores, latency, cost):
        self.config = config
        self.ragas_scores = ragas_scores
        self.latency = latency
        self.cost = cost
        self.timestamp = datetime.now().isoformat()
        self.alerts = []

    def check_thresholds(self, thresholds):
        for metric, threshold in thresholds.items():
            if metric in self.ragas_scores and self.ragas_scores[metric] < threshold:
                self.alerts.append(f"⚠️ {metric}: {self.ragas_scores[metric]:.3f} < {threshold}")
            elif metric == "p95_latency_ms" and self.latency["p95"] > threshold:
                self.alerts.append(f"⚠️ P95: {self.latency['p95']:.0f}ms > {threshold}ms")

    def to_markdown(self):
        lines = ["# RAG 评估报告", f"**时间**: {self.timestamp}", "",
                 "## RAGAS 指标", "| 指标 | 分数 |", "|------|------|"]
        for k, v in self.ragas_scores.items():
            lines.append(f"| {k} | {v:.3f} |")
        lines.extend(["", "## 延迟", f"P50: {self.latency['p50']:.0f}ms | P95: {self.latency['p95']:.0f}ms",
                      "", "## 成本", f"估算: ${self.cost['estimated_cost_usd']:.4f}"])
        if self.alerts:
            lines.extend(["", "## 告警"] + [f"- {a}" for a in self.alerts])
        return "\n".join(lines)
```

## 5. 完整 Pipeline

```python
class EvalPipeline:
    def __init__(self, dataset_path, rag_fn, config):
        self.dataset = EvalDataset(dataset_path)
        self.rag_fn = rag_fn
        self.config = config

    def run(self, thresholds=None):
        questions = [c.question for c in self.dataset.cases]
        ragas_scores = run_ragas_eval(self.dataset.cases, self.rag_fn)
        latency = measure_latency(self.rag_fn, questions)
        cost = measure_cost(self.rag_fn, questions)

        report = EvalReport(self.config, ragas_scores, latency, cost)
        if thresholds:
            report.check_thresholds(thresholds)
        return report

if __name__ == "__main__":
    from app.rag_engine import RAGEngine
    engine = RAGEngine()
    pipeline = EvalPipeline(
        dataset_path="eval_data/qa_pairs.json",
        rag_fn=lambda q: engine.query_sync(q),
        config={"chunk_size": 512, "top_k": 5, "model": "gpt-4o-mini"}
    )
    report = pipeline.run(thresholds={"faithfulness": 0.7, "context_recall": 0.6, "p95_latency_ms": 5000})
    with open("reports/eval_report.md", "w", encoding="utf-8") as f:
        f.write(report.to_markdown())
    print(report.to_markdown())
    if report.alerts:
        print("\n🚨 触发告警！")
```

## 6. CI 集成

```yaml
# .github/workflows/eval.yml
name: RAG Evaluation
on:
  pull_request:
    paths: ['app/**', 'eval_data/**']
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: '3.12'}
      - run: pip install -r requirements.txt
      - run: python eval/pipeline.py
        env: {OPENAI_API_KEY: "${{ secrets.OPENAI_API_KEY }}"}
      - uses: actions/upload-artifact@v4
        with: {name: eval-report, path: reports/}
      - name: Check thresholds
        run: if grep -q "告警" reports/eval_report.md; then exit 1; fi
```

## 练习

### 练习一：运行完整 Pipeline

对你的系统跑一次评估，输出报告，验证告警。

### 练习二：分维度分析

按 `category` 输出指标，找最薄弱维度：

```python
def run_by_dimension(self):
    results = {}
    for cat in set(c.category for c in self.dataset.cases):
        cases = self.dataset.filter(category=cat)
        if cases:
            results[cat] = run_ragas_eval(cases, self.rag_fn)
    return results
```

### 练习三：趋势跟踪

每次评估结果保存到 `reports/history/`，写脚本输出趋势：

```python
from pathlib import Path
def print_trend(dir="reports/history"):
    for p in sorted(Path(dir).glob("eval_*.json")):
        with open(p, encoding="utf-8") as f:
            r = json.load(f)
        print(f"{r['timestamp'][:10]}  Faith={r['ragas_scores']['faithfulness']:.3f}  "
              f"Recall={r['ragas_scores']['context_recall']:.3f}")
```

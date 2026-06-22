# 01 CI/CD 集成——在部署流水线中加入自动化 Eval 门禁

> 代码有 CI/CD，AI 应用也要有。自动化评估是质量的最后一道防线。

## 场景引入

你的团队上线了一个 RAG 问答系统，开发阶段测试都通过了，但上线后用户反馈回答质量明显下降。事后复盘发现，一次检索策略的微调导致了忠实度指标从 0.85 掉到了 0.65，而整个部署流程中没有任何自动化评估环节来拦截这类回归。如果 CI/CD 流水线里有一个评估门禁，这次质量事故完全可以避免。

## 学习目标

- 掌握将评估集成到 CI/CD 的方法
- 学会设置质量门禁
- 建立自动化评估流程

---

## 一、CI/CD 集成架构

```
代码提交
    │
    ▼
┌─────────────────────────────────────────┐
│  CI Pipeline                            │
│                                         │
│  1. 代码检查（lint, typecheck）          │
│  2. 单元测试                             │
│  3. 构建                                 │
│  4. 自动化评估 ← AI 应用特有             │
│     ├── 运行评估数据集                   │
│     ├── 检查质量指标                     │
│     └── 质量门禁判断                     │
│  5. 部署（如果通过）                     │
│                                         │
└─────────────────────────────────────────┘
```

---

## 二、评估脚本

```python
# scripts/run_eval_gate.py

import sys
import json
from pipeline import RAGEvalSuite

def main():
    # 加载配置
    with open("eval_config.json") as f:
        config = json.load(f)
    
    # 初始化评估套件
    suite = RAGEvalSuite(config)
    
    # 加载评估数据集
    with open(config["dataset_path"]) as f:
        dataset = json.load(f)
    
    # 运行评估
    results = suite.run_batch(dataset, get_rag_answer)
    
    # 检查门禁
    report = suite.generate_report(results)
    
    # 检查各项指标
    gates = {
        "quality_score": report["avg_quality"] >= config["thresholds"]["quality"],
        "latency": report["avg_latency"] <= config["thresholds"]["latency"],
        "success_rate": report["success_rate"] >= config["thresholds"]["success_rate"],
    }
    
    # 输出结果
    print("\n=== 评估门禁结果 ===")
    for gate, passed in gates.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {gate}")
    
    # 如果有失败，退出码非 0
    if not all(gates.values()):
        print("\n❌ 评估门禁未通过，请检查并优化后重试")
        sys.exit(1)
    
    print("\n✅ 评估门禁通过，可以部署")
    sys.exit(0)

if __name__ == "__main__":
    main()
```

---

## 三、GitHub Actions 集成

```yaml
# .github/workflows/eval.yml

name: AI Application Evaluation

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: python scripts/run_eval_gate.py
      
      - name: Upload evaluation report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: reports/
```

---

## 四、门禁配置

```json
{
  "thresholds": {
    "quality": 0.75,
    "latency": 5.0,
    "success_rate": 0.95,
    "faithfulness": 0.8,
    "hallucination_rate": 0.1
  },
  "dataset_path": "eval/golden_set.json",
  "model": "gpt-4o-mini",
  "fail_on_regression": true,
  "regression_threshold": 0.05
}
```

---

## 常见误区

1. **把 CI 评估当成"跑一遍就行"**：很多团队第一次集成评估时，只跑几条测试用例就认为够了。CI 评估的数据集必须覆盖核心场景和边界情况，否则门禁形同虚设。

2. **门禁阈值设置后从不调整**：随着业务发展和数据分布变化，早期设的阈值可能变得过松或过严。阈值需要定期回顾和校准，建议每月审视一次门禁指标与线上实际质量的对应关系。

3. **评估失败后只看通过率，不看具体失败用例**：门禁拦截了问题只是第一步，如果不分析具体哪些用例退化、退化原因是什么，门禁就只是在"卡"而不是在"帮"。

4. **评估脚本和应用代码使用不同的依赖版本**：CI 环境和本地环境的依赖差异会导致评估结果不一致，确保评估脚本的依赖版本与生产环境保持一致。

## 工程建议

1. **评估数据集纳入版本管理**：将 golden set 和评估配置与代码放在同一个仓库，确保评估数据和应用代码同步变更，避免数据与代码版本不匹配。

2. **门禁分层设计**：区分"阻断门禁"和"警告门禁"。质量指标跌破红线必须阻断部署，而轻微下降可以标记警告、允许部署但在 Dashboard 高亮，给团队修复的缓冲期。

3. **评估报告归档留痕**：每次 CI 评估的报告都应归档（上传 artifact 或写入数据库），方便回溯任意版本的评估结果，也为后续的基线对比提供数据基础。

4. **控制评估时间和成本**：CI 流水线有时间预算，评估不能太慢。对数据集做分层采样——核心用例每次都跑，边缘用例按比例抽样，在评估覆盖率和 CI 速度之间找平衡。

---

## 小结

```
本课核心要点：

1. 自动化评估是 AI 应用 CI/CD 的必要环节
2. 设置质量门禁，不通过不能部署
3. 用 GitHub Actions 等 CI 工具集成评估
4. 门禁阈值要合理，太严会阻碍开发，太松会放过问题

---

**下一课**: [02 A/B 测试框架——Prompt / 模型 / 参数的对比实验设计](./02-AB测试框架.md)
```

---

## 练习

1. **CI 题**：为你的 AI 应用配置 GitHub Actions 评估流水线。

2. **门禁题**：设计合理的质量门禁阈值。

3. **测试题**：模拟一次评估门禁失败，验证 CI 流程。

---

## 参考答案

### 练习一

**思路**：GitHub Actions 流水线需要包含安装依赖、运行评估脚本、检查门禁阈值、上传报告四个步骤。关键是评估脚本的退出码决定是否阻断部署。

**答案**：

```yaml
# .github/workflows/ai-eval-gate.yml
name: AI 应用评估门禁

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 安装 Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 安装依赖
        run: pip install -r requirements.txt

      - name: 运行评估
        id: eval
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
        run: python scripts/run_eval_gate.py

      - name: 上传评估报告
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-report-${{ github.sha }}
          path: reports/
          retention-days: 30

      - name: 评论 PR（仅 PR 时）
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('reports/eval_summary.md', 'utf8');
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## AI 评估报告\n\n${report}`
            });
```

```python
# scripts/run_eval_gate.py
import sys
import json
from pathlib import Path


def main():
    config_path = Path("eval_config.json")
    if not config_path.exists():
        print("❌ 找不到 eval_config.json")
        sys.exit(1)

    with open(config_path) as f:
        config = json.load(f)

    # 模拟评估运行
    report = run_evaluation(config)

    # 检查门禁
    gates = check_gates(report, config["thresholds"])

    # 输出结果
    print("\n=== 评估门禁结果 ===")
    all_passed = True
    for gate_name, result in gates.items():
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} {gate_name}: {result['value']:.3f} (阈值: {result['threshold']})")
        if not result["passed"]:
            all_passed = False

    # 保存报告
    Path("reports").mkdir(exist_ok=True)
    with open("reports/eval_summary.md", "w") as f:
        f.write(format_report(gates))

    if not all_passed:
        print("\n❌ 评估门禁未通过，请检查并优化后重试")
        sys.exit(1)

    print("\n✅ 评估门禁通过，可以部署")
    sys.exit(0)


def run_evaluation(config):
    return {
        "avg_quality": 0.78,
        "avg_latency": 3.2,
        "success_rate": 0.96,
        "faithfulness": 0.82,
        "hallucination_rate": 0.08,
    }


def check_gates(report, thresholds):
    gates = {}
    for metric, threshold in thresholds.items():
        value = report.get(metric, 0)
        if metric == "latency" or metric == "hallucination_rate":
            passed = value <= threshold
        else:
            passed = value >= threshold
        gates[metric] = {"value": value, "threshold": threshold, "passed": passed}
    return gates


def format_report(gates):
    lines = ["| 指标 | 值 | 阈值 | 结果 |", "|------|------|------|------|"]
    for name, r in gates.items():
        status = "✅" if r["passed"] else "❌"
        lines.append(f"| {name} | {r['value']:.3f} | {r['threshold']} | {status} |")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
```

**要点**：
- 评估脚本的退出码（`sys.exit(1)`）是阻断部署的关键——CI 非零退出码会阻止后续步骤
- 评估报告应上传为 artifact 并在 PR 中自动评论，方便团队查看
- 常见错误：评估脚本只打印结果但始终返回 0，导致门禁永远"通过"

### 练习二

**思路**：门禁阈值需要基于历史数据设定，不能拍脑袋。先收集一周的基线数据，用均值-2倍标准差作为初始阈值，运行稳定后再逐步收紧。

**答案**：

```python
import json
import numpy as np


def design_quality_gates(baseline_data: list[dict]) -> dict:
    """基于基线数据设计质量门禁阈值"""

    metrics = {}
    for item in baseline_data:
        for key, value in item.items():
            if isinstance(value, (int, float)):
                metrics.setdefault(key, []).append(value)

    thresholds = {}
    for metric, values in metrics.items():
        mean = np.mean(values)
        std = np.std(values)

        # 根据指标类型决定阈值方向
        if metric in ["latency", "hallucination_rate"]:
            # 越低越好的指标：用 均值 + 2倍标准差
            threshold = round(mean + 2 * std, 3)
            direction = "<="
        else:
            # 越高越好的指标：用 均值 - 2倍标准差
            threshold = round(mean - 2 * std, 3)
            direction = ">="

        thresholds[metric] = {
            "threshold": threshold,
            "direction": direction,
            "baseline_mean": round(mean, 3),
            "baseline_std": round(std, 3),
        }

    # 添加业务硬性红线
    hard_redlines = {
        "faithfulness": {"min": 0.70, "reason": "忠实度低于 0.70 存在严重幻觉风险"},
        "success_rate": {"min": 0.90, "reason": "成功率低于 90% 系统不可用"},
        "hallucination_rate": {"max": 0.15, "reason": "幻觉率超过 15% 不可上线"},
    }

    return {
        "data_driven_thresholds": thresholds,
        "hard_redlines": hard_redlines,
        "config": {
            "thresholds": {
                k: v["threshold"] for k, v in thresholds.items()
            },
            "regression_threshold": 0.05,
            "fail_on_regression": True,
        },
    }


# 模拟基线数据
baseline = [
    {"avg_quality": 0.82, "faithfulness": 0.85, "latency": 3.5, "success_rate": 0.97, "hallucination_rate": 0.06},
    {"avg_quality": 0.79, "faithfulness": 0.83, "latency": 4.0, "success_rate": 0.95, "hallucination_rate": 0.08},
    {"avg_quality": 0.81, "faithfulness": 0.84, "latency": 3.8, "success_rate": 0.96, "hallucination_rate": 0.07},
    {"avg_quality": 0.83, "faithfulness": 0.86, "latency": 3.2, "success_rate": 0.98, "hallucination_rate": 0.05},
    {"avg_quality": 0.80, "faithfulness": 0.82, "latency": 4.1, "success_rate": 0.94, "hallucination_rate": 0.09},
    {"avg_quality": 0.78, "faithfulness": 0.81, "latency": 3.6, "success_rate": 0.96, "hallucination_rate": 0.07},
    {"avg_quality": 0.84, "faithfulness": 0.87, "latency": 3.3, "success_rate": 0.97, "hallucination_rate": 0.05},
]

result = design_quality_gates(baseline)
print("=== 数据驱动的门禁阈值 ===\n")
for metric, info in result["data_driven_thresholds"].items():
    print(f"{metric}: {info['direction']} {info['threshold']} (基线均值: {info['baseline_mean']}, 标准差: {info['baseline_std']})")

print("\n=== 硬性红线 ===")
for metric, rule in result["hard_redlines"].items():
    print(f"{metric}: {rule}")
```

**要点**：
- 阈值应基于基线数据的均值±2倍标准差设定，而非拍脑袋
- 硬性红线（如忠实度 < 0.70 不可上线）应独立于数据驱动阈值，作为不可突破的底线
- 常见错误：阈值设完后从不调整，随着业务迭代和数据分布变化，阈值需要定期校准

### 练习三

**思路**：模拟一次评估门禁失败，验证 CI 流程能否正确阻断部署、生成失败报告、在 PR 中评论。关键是验证退出码非 0 时 CI 是否真的阻断了。

**答案**：

```python
import sys
import json
from pathlib import Path


def simulate_gate_failure():
    """模拟一次评估门禁失败场景"""

    # 模拟一次质量下降的评估结果
    failed_report = {
        "avg_quality": 0.68,        # 低于阈值 0.75
        "faithfulness": 0.65,       # 低于阈值 0.80
        "latency": 3.5,             # 正常
        "success_rate": 0.96,       # 正常
        "hallucination_rate": 0.12, # 低于阈值 0.10 → 高于阈值，失败
    }

    thresholds = {
        "avg_quality": 0.75,
        "faithfulness": 0.80,
        "latency": 5.0,
        "success_rate": 0.95,
        "hallucination_rate": 0.10,
    }

    print("=== 模拟评估门禁失败 ===\n")
    print("评估结果:")
    all_passed = True
    failed_gates = []

    for metric, value in failed_report.items():
        threshold = thresholds.get(metric)
        if threshold is None:
            continue

        if metric in ["latency", "hallucination_rate"]:
            passed = value <= threshold
        else:
            passed = value >= threshold

        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} {metric}: {value} (阈值: {threshold})")

        if not passed:
            all_passed = False
            failed_gates.append({
                "metric": metric,
                "value": value,
                "threshold": threshold,
                "gap": abs(value - threshold),
            })

    print(f"\n门禁结果: {'✅ 通过' if all_passed else '❌ 失败'}")

    if failed_gates:
        print(f"\n失败详情 ({len(failed_gates)} 项):")
        for g in failed_gates:
            print(f"  - {g['metric']}: 当前 {g['value']}, 阈值 {g['threshold']}, 差距 {g['gap']:.3f}")

        # 生成失败报告
        Path("reports").mkdir(exist_ok=True)
        report_content = {
            "status": "FAILED",
            "failed_gates": failed_gates,
            "full_report": failed_report,
            "recommendation": "请修复以下问题后重新提交:\n" +
                              "\n".join(f"  - {g['metric']} 需要从 {g['value']} 提升到 {g['threshold']}" for g in failed_gates),
        }
        with open("reports/eval_failure.json", "w") as f:
            json.dump(report_content, f, indent=2, ensure_ascii=False)

        print("\n失败报告已保存到 reports/eval_failure.json")
        print("CI 流程应以退出码 1 终止，阻断部署")
        return 1  # 模拟 sys.exit(1)

    return 0


exit_code = simulate_gate_failure()
print(f"\n退出码: {exit_code}")
```

**要点**：
- 模拟失败的关键是验证 CI 流程的三个环节：退出码非 0 阻断部署、生成失败报告、在 PR 中评论失败原因
- 失败报告应包含具体的失败指标和差距，让开发者知道需要优化到什么程度
- 常见错误：只输出"门禁失败"但不说明哪个指标失败、差距多少，导致开发者不知道从何下手

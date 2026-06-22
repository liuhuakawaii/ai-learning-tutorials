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

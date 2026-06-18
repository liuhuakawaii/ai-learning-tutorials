# 01 CI/CD 集成——在部署流水线中加入自动化 Eval 门禁

> 代码有 CI/CD，AI 应用也要有。自动化评估是质量的最后一道防线。

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

## 小结

```
本课核心要点：

1. 自动化评估是 AI 应用 CI/CD 的必要环节
2. 设置质量门禁，不通过不能部署
3. 用 GitHub Actions 等 CI 工具集成评估
4. 门禁阈值要合理，太严会阻碍开发，太松会放过问题

下一课：A/B 测试框架——Prompt / 模型 / 参数的对比实验设计。
```

---

## 练习

1. **CI 题**：为你的 AI 应用配置 GitHub Actions 评估流水线。

2. **门禁题**：设计合理的质量门禁阈值。

3. **测试题**：模拟一次评估门禁失败，验证 CI 流程。

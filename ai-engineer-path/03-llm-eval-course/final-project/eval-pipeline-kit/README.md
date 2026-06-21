# Eval Pipeline Kit

LLM 评估 pipeline 练习工具包。提供离线可验证的评估流程，先稳定评估工程能力，后续替换为真实 API 调用。

## 快速开始

```bash
pip install -r requirements.txt
python scripts/check.py
python src/eval_pipeline.py
python src/ragas_eval.py
```

## 目录结构

```
eval-pipeline-kit/
├── src/
│   ├── eval_pipeline.py    # LLM-as-Judge 评估 pipeline
│   ├── ragas_eval.py       # RAGAS 指标计算
│   └── dashboard.py        # Streamlit 可视化 Dashboard
├── data/
│   ├── golden_dataset.json # 评估数据集
│   └── rag_samples.json    # RAG 评估样本
├── scripts/
│   └── check.py            # 结构验证脚本
├── reports/
│   ├── stage1-eval-basics.md
│   ├── stage2-rag-eval.md
│   ├── stage3-agent-eval.md
│   ├── stage4-observability.md
│   └── stage5-continuous-eval.md
└── requirements.txt
```

## 学习路径

1. 阶段一：理解 `eval_pipeline.py` 的评估逻辑，修改评估指标
2. 阶段二：运行 `ragas_eval.py`，分析 RAG 质量指标
3. 阶段三：扩展 Agent 评估逻辑
4. 阶段四：启动 `dashboard.py` 查看评估可视化
5. 阶段五：集成 CI/CD，实现评估门禁

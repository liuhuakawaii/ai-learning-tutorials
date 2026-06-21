# Research Assistant Kit

多 Agent 研究助手练习工具包。基于 LangGraph 的 Supervisor + Sequential 编排模式，支持 Mock 模式运行。

## 快速开始

```bash
pip install -r requirements.txt
python scripts/check.py
python src/main.py --mock
```

## 目录结构

```
research-assistant-kit/
├── src/
│   ├── main.py              # 入口，支持 --mock 和 --topic 参数
│   ├── agents/
│   │   ├── searcher.py      # 搜索 Agent
│   │   ├── analyzer.py      # 分析 Agent
│   │   ├── writer.py        # 写作 Agent
│   │   └── reviewer.py      # 审核 Agent
│   ├── graph.py             # LangGraph 工作流定义
│   └── memory.py            # 短期/长期记忆管理
├── data/
│   └── sample_results.json  # Mock 搜索结果
├── scripts/
│   └── check.py             # 结构验证
├── reports/
│   ├── stage1-orchestration.md
│   ├── stage2-langgraph.md
│   ├── stage3-communication.md
│   ├── stage4-human-loop.md
│   └── stage5-production.md
└── requirements.txt
```

## 学习路径

1. 阶段一：理解 `agents/` 下每个 Agent 的职责
2. 阶段二：阅读 `graph.py`，修改 LangGraph 图结构
3. 阶段三：扩展 `memory.py`，实现长期记忆
4. 阶段四：在 `graph.py` 中添加人类审批节点
5. 阶段五：Docker 化部署，添加监控

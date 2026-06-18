# AI 数据分析平台 - 后端

> 多 Agent 驱动的智能数据分析平台

## 技术栈

- **Web 框架**: FastAPI
- **Agent 编排**: LangGraph
- **数据库**: SQLite (可升级到 PostgreSQL)
- **可观测性**: Langfuse (可选)
- **评估**: 自定义评估框架

## 快速启动

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python scripts/seed_db.py

# 启动服务
python -m uvicorn backend.main:app --reload --port 8000
```

## 项目结构

```
backend/
├── main.py              # FastAPI 入口
├── config.py            # 配置
├── agents/              # Agent 定义
│   ├── query_agent.py   # 查询 Agent
│   ├── analysis_agent.py # 分析 Agent
│   ├── visualization_agent.py # 可视化 Agent
│   └── report_agent.py  # 报告 Agent
├── api/                 # API 路由
│   ├── chat.py          # 对话 API
│   ├── data.py          # 数据 API
│   └── eval.py          # 评估 API
├── mcp_servers/         # MCP Server
│   └── database_server.py
├── eval/                # 评估系统
│   ├── eval_pipeline.py
│   └── metrics.py
└── data/                # 数据
    └── sample.db        # 示例数据库
```

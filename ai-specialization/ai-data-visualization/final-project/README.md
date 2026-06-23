# AI 数据报表系统

AI 驱动的数据报表系统，支持自然语言查询数据库（NL2SQL）、智能图表推荐、数据叙事和自动报表生成。

## 技术栈

- **前端**：React + TypeScript
- **后端**：FastAPI（Python）
- **NL2SQL**：SQLCoder / Vanna / LLM API
- **图表**：ECharts / AntV
- **数据库**：MySQL / PostgreSQL / ClickHouse / CSV
- **部署**：Docker Compose

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && pip install -r requirements.txt

# 配置环境变量
cp .env.example .env

# 初始化示例数据
python scripts/seed_data.py

# 启动
docker-compose up -d

# 或分别启动
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

## 功能说明

| 功能 | 说明 |
|------|------|
| 自然语言查询 | 输入问题 → 自动生成 SQL → 返回表格 + 图表 |
| 多轮追问 | "按地区拆分" → 追加筛选条件 |
| 图表推荐 | 根据数据类型自动选择折线/柱状/饼图 |
| Dashboard | 拖拽布局，筛选器联动 |
| 数据叙事 | AI 检测异常，生成分析摘要 |
| 自动报表 | 日报/周报/月报定时生成，多渠道推送 |

## 安全

- SQL 只允许 SELECT，禁止 DDL/DML
- 查询超时限制
- 结果行数上限

## 项目结构

```
├── frontend/               # React + TypeScript
│   └── src/
│       ├── components/     # 图表、对话框、Dashboard
│       ├── pages/          # 功能页面
│       └── services/       # API 调用
├── backend/                # FastAPI
│   └── app/
│       ├── api/            # REST API
│       ├── services/       # NL2SQL、图表、叙事、报表
│       └── models/         # 数据模型
├── prompts/                # Prompt 模板
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```

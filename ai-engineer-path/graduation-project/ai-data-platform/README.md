# AI 数据分析平台

> 多 Agent 驱动的智能数据分析平台 - 毕业项目

## 项目简介

这是一个面向业务人员的 AI 数据分析平台。用户通过自然语言提出分析需求，多个 AI Agent 协作完成数据查询、分析、可视化和报告生成。

## 核心特性

- **自然语言查询**：用中文提问，AI 自动生成 SQL 并执行
- **多 Agent 协作**：查询 Agent → 分析 Agent → 可视化 Agent → 报告 Agent
- **数据可视化**：自动生成柱状图、折线图、饼图、散点图
- **结构化报告**：生成包含摘要、分析、建议的完整报告
- **文件上传**：支持 CSV、Excel 文件上传并分析

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS |
| 后端 | FastAPI + Python 3.12 |
| Agent | LangGraph + LangChain |
| 数据库 | SQLite (可升级到 PostgreSQL) |
| 可视化 | Recharts |
| AI | OpenAI GPT-4o-mini |

## 快速启动

### 方式一：本地运行

```bash
# 1. 安装后端依赖
cd backend
pip install -r requirements.txt

# 2. 初始化数据库
python -m backend.data.seed

# 3. 启动后端
python -m uvicorn backend.main:app --reload --port 8000

# 4. 安装前端依赖
cd frontend
npm install

# 5. 启动前端
npm run dev
```

### 方式二：Docker 运行

```bash
# 设置 OpenAI API Key
export OPENAI_API_KEY=your-api-key

# 启动服务
docker-compose up -d
```

## 使用说明

1. 打开浏览器访问 `http://localhost:3000`
2. 在输入框中用中文提问，例如：
   - "各部门的预算和人数是多少？"
   - "哪个地区的销售额最高？"
   - "最近半年的销售趋势如何？"
3. AI 会自动生成 SQL、执行查询、分析数据、生成可视化图表和报告

## 示例查询

- 各部门的预算和人数是多少？
- 哪个地区的销售额最高？
- 最近半年的销售趋势如何？
- 员工绩效评分分布情况
- 各产品的销售对比
- 哪些项目还在进行中？

## 项目结构

```
ai-data-platform/
├── backend/                # FastAPI 后端
│   ├── agents/            # Agent 定义
│   │   └── orchestrator.py # LangGraph 编排
│   ├── api/               # API 路由
│   │   ├── chat.py        # 对话 API
│   │   ├── data.py        # 数据 API
│   │   └── eval.py        # 评估 API
│   ├── data/              # 数据
│   │   └── seed.py        # 数据库初始化
│   ├── main.py            # FastAPI 入口
│   ├── config.py          # 配置
│   └── requirements.txt   # Python 依赖
├── frontend/              # Next.js 前端
│   ├── app/               # 页面
│   │   ├── layout.tsx     # 布局
│   │   ├── page.tsx       # 主页面
│   │   └── globals.css    # 全局样式
│   ├── package.json       # Node 依赖
│   └── tailwind.config.js # Tailwind 配置
├── docker-compose.yml     # Docker 编排
└── README.md              # 项目说明
```

## 验收标准

- [x] 用户能用自然语言提出数据查询需求
- [x] 系统返回分析结果
- [x] 至少 3 个 Agent 协作完成分析任务
- [x] 数据可视化图表
- [x] 结构化分析报告
- [x] 文件上传支持

## 许可证

MIT

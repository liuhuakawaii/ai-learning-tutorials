# 量化回测系统

A 股量化回测系统，支持因子计算、策略回测、风险分析和报告生成。

## 技术栈

- **前端**：Vue 3 + TypeScript
- **后端**：FastAPI（Python）
- **数据源**：Tushare / AKShare
- **回测**：VectorBT / Backtrader
- **因子**：Alphalens + Pandas
- **存储**：ClickHouse / SQLite
- **部署**：Docker Compose

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 填入 Tushare Token（如使用 Tushare 数据源）

# 启动
docker-compose up -d

# 或分别启动
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

## 功能模块

| 模块 | 说明 |
|------|------|
| 数据管理 | A 股日线/分钟线采集、清洗、存储 |
| 因子研究 | 预设因子库 + 自定义因子 + IC/IR 评估 |
| 策略编辑 | 可视化配置 + Python 脚本 |
| 回测引擎 | 手续费/滑点/冲击成本 + 基准对比 |
| 风险分析 | 夏普/回撤/VaR/归因分析 |
| 模拟交易 | 信号生成 + 持仓追踪 |

## 预设策略

- `strategies/multi_factor.py`：多因子选股
- `strategies/trend_following.py`：趋势跟踪
- `strategies/mean_reversion.py`：均值回归

## 项目结构

```
├── frontend/               # Vue 3 + TypeScript
│   └── src/
├── backend/                # FastAPI
│   └── app/
│       ├── api/            # REST API
│       ├── services/       # 数据、因子、回测、风控
│       └── models/         # 数据模型
├── strategies/             # 预设策略
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```

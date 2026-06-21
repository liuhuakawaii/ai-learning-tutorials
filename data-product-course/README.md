# 从零到一：数据产品化实战课程

> 把采集、清洗、存储、API、可视化和自动化串成一个真实数据产品，而不是停留在“写个脚本抓数据”。

## 适合谁

- 已学过 Python 爬虫，想把数据做成可用产品
- 有前端基础，想做数据看板、监控系统、分析工具
- 想掌握 ETL、数据质量、API 和 Dashboard 的完整链路

## 学完能做什么

- 设计稳定的数据采集与清洗流程
- 建立可查询、可追溯、可更新的数据仓库
- 用 FastAPI 提供数据接口
- 用前端图表做筛选、趋势、对比和导出
- 让采集任务定时运行并可监控

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python + TypeScript |
| 数据处理 | pandas |
| API | FastAPI |
| 数据库 | PostgreSQL / SQLite |
| 前端 | React / Next.js |
| 可视化 | ECharts / Plotly |
| 调度 | cron / GitHub Actions / APScheduler |
| 部署 | Docker |

## 贯穿项目

本课程使用 `Market Insight Dashboard` 作为贯穿项目。

> **关于 demo 技术栈的说明**：课程讲义以 Python（pandas、FastAPI）为主，但内置 demo 使用 Node.js 实现（原生 HTTP + 纯 JS ETL），目的是零依赖、一行命令即可运行。学员在学完第二、三阶段后，应自行用 Python + pandas + FastAPI 重建 demo 的 ETL 和 API 层，作为学习验证。

仓库内置一个最小可运行闭环：

```bash
cd data-product-course/final-project/market-insight-demo
npm run check
npm run etl
npm start
```

打开：

- Dashboard：http://localhost:4180/
- API 总览：http://localhost:4180/api/summary
- 质量报告：http://localhost:4180/api/quality

它覆盖 CSV 原始数据、清洗、质量规则、指标生成、API 查询和 Dashboard 展示。后续阶段可以逐步替换为 PostgreSQL、FastAPI、调度和部署。

## 学习路线

### 第一阶段：数据产品基础

1. 数据产品和普通爬虫脚本的区别
2. 指标、维度、事实表和宽表
3. 数据源评估：公开 API、文件、网页、手工导入
4. 数据采集协议：频率、增量、失败重试
5. 数据字典：字段含义、类型、单位
6. 数据生命周期：原始、清洗、聚合、展示
7. 阶段实战：数据源调研报告

### 第二阶段：ETL 与数据质量

1. Extract：采集、读取、导入
2. Transform：清洗、去重、标准化
3. Load：入库、更新、幂等
4. 数据质量规则：非空、唯一、范围、枚举
5. 异常数据处理：隔离、修复、回放
6. 日志与批次号：每次处理都可追踪
7. 阶段实战：招聘数据 ETL

### 第三阶段：存储与 API

1. SQLite 到 PostgreSQL 的迁移思路
2. 表设计：raw、clean、metrics
3. 索引、分页和查询性能
4. FastAPI 路由、参数、响应模型
5. 筛选、排序、聚合接口
6. API 缓存与限流
7. 阶段实战：数据查询 API

### 第四阶段：Dashboard 与可视化

1. Dashboard 信息架构
2. 指标卡、趋势图、分布图、对比表
3. 筛选器设计：时间、分类、关键词
4. 图表交互：hover、zoom、drilldown
5. 空状态、加载态、错误态
6. 导出 CSV / 图片 / 报告
7. 阶段实战：数据分析看板

### 第五阶段：自动化与运营

1. 定时任务与手动触发
2. 增量更新与断点续跑
3. 任务状态：queued、running、failed、done
4. 告警：采集失败、数据异常、延迟过高
5. 权限：公开看板与内部看板
6. Docker 化与部署
7. 阶段实战：自动化数据产品上线

## 最终项目

**Market Insight Dashboard：市场数据洞察平台**

功能包括：

- 定时采集公开数据或导入 CSV
- 清洗、去重、入库、生成指标
- FastAPI 提供查询接口
- Web Dashboard 展示趋势、排名、对比和详情
- 任务日志、数据质量报告、导出能力

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 数据项目最重要的是可追溯，不是图表炫。
2. 每个字段都要有来源、类型、单位和更新时间。
3. 不要等项目最后才处理脏数据，第二阶段就建立质量规则。

## 参考官方文档

- FastAPI：https://fastapi.tiangolo.com/
- pandas：https://pandas.pydata.org/docs/
- Plotly JavaScript：https://plotly.com/javascript/


# 02 - 数据探索 Agent

> 让 AI 像数据分析师一样自主探索数据——不只是回答问题，而是主动发现洞察。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 4: 企业级数据产品 |
| 前置课程 | 01 - 对话式 BI 架构 |
| 预计时长 | 2 小时 |
| 难度等级 | ⭐⭐⭐⭐ |

---

## 场景引入

周一早上九点，数据分析师小张收到一封邮件："上季度各区域销售数据有没有异常？帮我看一下，今天下班前给结论。"

小张打开公司的数据仓库，面对的是上百张表、数千个字段。他需要先确认表结构，再逐步编写 SQL：先看整体趋势，发现华东区 3 月份下降明显，再按产品线拆分，再看库存和退货率，再交叉验证……整个过程需要执行二三十条查询，每一步的结论都决定下一步的方向。

这个过程有两个显著特点：第一，它是**探索性的**——小张事先不知道答案在哪里，需要根据中间结果不断调整方向；第二，它是**多步推理的**——每一步的结果都影响下一步的决策，不是简单的一问一答。

传统 BI 工具的设计哲学是"你问我答"：用户提出一个明确的问题，系统返回一个明确的答案。但真实的数据分析场景中，最有价值的洞察往往藏在"我没问到的地方"。数据探索 Agent 的目标就是让 AI 像一个有经验的分析师那样，自主规划探索路径、执行分析、评估结果、决定下一步。

这不仅仅是"把对话式 BI 升级一下"。对话式 BI 的核心是意图理解和 SQL 生成，而数据探索 Agent 的核心是**规划和推理**。两者的架构差异，就像导航软件和自动驾驶的差异——前者告诉你怎么走，后者自己决定怎么走。

## 学习目标

完成本课学习后，你将能够：

1. 理解数据探索 Agent 与传统 BI、对话式 BI 的本质区别
2. 掌握 ReAct 和 Plan-and-Execute 两种 Agent 推理架构的设计思路
3. 设计 Agent 的工具集：SQL 执行、统计计算、可视化生成、异常检测
4. 实现假设驱动和数据驱动两种探索策略
5. 构建洞察评估与排序系统，让 Agent 能判断"什么值得关注"
6. 完成一个能自主探索数据库并输出分析报告的 AI Agent

## 一、数据探索 Agent 与传统 BI 的区别

在深入架构之前，需要先弄清楚数据探索 Agent 到底"新"在哪里。很多人会把它和对话式 BI 混淆，但两者的底层逻辑完全不同。

### 1.1 三种模式的对比

```
┌─────────────────────────────────────────────────────────────────┐
│                    三种数据分析模式对比                           │
│                                                                 │
│  模式          交互方式        推理深度      自主性              │
│  ─────────────────────────────────────────────────────────────  │
│  传统 BI       拖拽筛选器      单步          完全被动            │
│  对话式 BI     自然语言问答    单步          被动响应            │
│  探索 Agent    给定目标        多步推理      主动探索            │
│                                                                 │
│  传统 BI:  用户 → 筛选器 → SQL → 结果 → 用户判断               │
│  对话式BI: 用户 → 问题 → NL2SQL → 结果 → 用户再问              │
│  探索Agent:用户 → 目标 → Agent自主规划+执行+评估 → 洞察报告     │
└─────────────────────────────────────────────────────────────────┘
```

传统 BI 的工作流是：用户拖拽筛选器 → 系统生成 SQL → 返回结果 → 用户自己判断。整个过程中，"判断下一步看什么"完全依赖用户的分析能力。

对话式 BI 降低了交互门槛——用户用自然语言提问，系统自动生成 SQL。但它本质上仍然是单步的：问一个答一个，上下文管理只解决了"指代消解"（"上个月"指的是哪个月），并没有解决"下一步应该看什么"的问题。

数据探索 Agent 的核心差异在于：它会**自主决定探索路径**。给定一个分析目标（"找出上季度的异常"），Agent 会自己规划一系列查询，根据中间结果动态调整方向，最终输出结构化的洞察报告。

### 1.2 Agent 的核心能力

一个合格的数据探索 Agent 需要具备四种能力：

**规划能力**：给定一个模糊的分析目标，能拆解成具体的分析步骤。比如"分析异常"可以拆解为：看整体趋势 → 找异常时间点 → 按维度拆分 → 交叉验证 → 形成结论。

**执行能力**：能调用各种工具完成具体的分析操作——执行 SQL、计算统计量、生成图表、检测异常。

**评估能力**：能判断中间结果是否有价值。一条查询返回的数据是"正常波动"还是"显著异常"？一个发现是"值得深入"还是"可以跳过"？

**终止能力**：知道什么时候该停下来。探索不能无限进行，Agent 需要判断"我已经收集到足够的信息来回答原始问题了"。

## 二、Agent 推理架构

Agent 的"大脑"是推理架构——它决定了 Agent 如何思考、如何决策。目前主流的架构有两种：ReAct 和 Plan-and-Execute。

### 2.1 ReAct 架构

ReAct（Reasoning + Acting）是最经典的 Agent 架构，由 Yao et al. 在 2022 年提出。核心思想是每一步都包含"思考"和"行动"两个阶段，形成一个循环：

```
┌──────────────────────────────────────────────┐
│              ReAct 循环                       │
│                                              │
│   ┌──────────┐                               │
│   │  观察     │  ← 上一步的执行结果           │
│   └────┬─────┘                               │
│        │                                     │
│   ┌────▼─────┐                               │
│   │  思考     │  LLM 分析当前状态             │
│   │ (Reason) │  "3月销售额下降，需按区域拆分"  │
│   └────┬─────┘                               │
│        │                                     │
│   ┌────▼─────┐                               │
│   │  行动     │  调用工具执行操作              │
│   │ (Act)    │  execute_sql("SELECT ...")     │
│   └────┬─────┘                               │
│        │                                     │
│        └──────────→ 回到"观察" ──────────────┘
│                                              │
│   终止条件: 思考阶段决定"已完成"               │
└──────────────────────────────────────────────┘
```

ReAct 的优点是简单、灵活，每一步都可以根据最新结果调整方向。缺点是缺乏全局视野——Agent 可能会"走一步看一步"，在复杂分析中偏离目标。

### 2.2 Plan-and-Execute 架构

Plan-and-Execute 架构把"规划"和"执行"分离成两个阶段：

```
┌─────────────────────────────────────────────────────┐
│           Plan-and-Execute 架构                      │
│                                                     │
│   ┌───────────────────────────────────────────────┐ │
│   │  Planner（规划器）                             │ │
│   │                                               │ │
│   │  输入: "分析上季度销售异常"                     │ │
│   │                                               │ │
│   │  输出:                                        │ │
│   │    Step 1: 查询季度整体销售趋势                 │ │
│   │    Step 2: 按区域拆分，找异常区域               │ │
│   │    Step 3: 对异常区域按产品线拆分               │ │
│   │    Step 4: 检查异常产品的库存和退货率           │ │
│   │    Step 5: 汇总洞察，生成报告                   │ │
│   └───────────────────┬───────────────────────────┘ │
│                       │                             │
│   ┌───────────────────▼───────────────────────────┐ │
│   │  Executor（执行器）                            │ │
│   │                                               │ │
│   │  逐个执行计划中的步骤                           │ │
│   │  每步执行后评估结果                             │ │
│   │  如果发现新问题，可以请求 Planner 修订计划      │ │
│   └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

这种架构的优点是有全局视野——先想好要做什么，再逐步执行。缺点是不够灵活——如果执行过程中发现了计划外的重要线索，需要额外的机制来修订计划。

### 2.3 混合架构

实际工程中，最实用的方案是混合架构：用 Plan-and-Execute 做顶层规划，用 ReAct 做每个步骤内的具体执行。这样既有全局视野，又有局部灵活性。

```
用户目标: "分析上季度销售异常"
        │
        ▼
┌─────────────────────┐
│  Planner            │  生成高层计划
│  Step 1: 整体趋势   │
│  Step 2: 区域拆分   │
│  Step 3: 产品拆分   │
│  Step 4: 交叉验证   │
│  Step 5: 生成报告   │
└─────────┬───────────┘
          │
          ▼  逐个执行
┌─────────────────────┐
│  Step 2 的 ReAct:   │
│  思考: 需要看各区域  │
│  行动: 执行区域SQL   │
│  观察: 华东下降30%   │
│  思考: 华东是异常点   │
│  行动: 华东月度趋势   │
│  观察: 3月断崖下跌    │
│  → Step 2 完成       │
└─────────────────────┘
```

## 三、工具系统设计

Agent 的推理能力再强，也需要通过工具来与数据交互。工具系统的设计直接决定了 Agent 的能力边界。

### 3.1 核心工具集

一个数据探索 Agent 至少需要以下四类工具：

```
┌───────────────────────────────────────────────────────┐
│                 Agent 工具集                           │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  SQL 工具    │  │  统计工具    │  │  可视化工具   │ │
│  │             │  │             │  │              │ │
│  │ execute_sql │  │ correlation │  │ line_chart   │ │
│  │ list_tables │  │ distribution│  │ bar_chart    │ │
│  │ describe_tbl│  │ outlier_det │  │ scatter_plot │ │
│  │ sample_data │  │ trend_fit   │  │ heatmap      │ │
│  └─────────────┘  └─────────────┘  └──────────────┘ │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │  元数据工具  │  │  洞察工具    │                    │
│  │             │  │             │                    │
│  │ list_tables │  │ summarize   │                    │
│  │ get_schema  │  │ compare     │                    │
│  │ get_samples │  │ rank_insight│                    │
│  └─────────────┘  └─────────────┘                    │
└───────────────────────────────────────────────────────┘
```

### 3.2 工具的安全边界

Agent 有自主执行 SQL 的能力，这意味着它有可能执行危险操作。必须在工具层面设置硬性边界：

**只读原则**：Agent 只能执行 SELECT 查询，任何写操作（INSERT、UPDATE、DELETE、DROP）必须被拦截。

**资源限制**：每条查询必须有超时限制（比如 30 秒）和结果行数限制（比如 10000 行），防止 Agent 执行全表扫描拖垮数据库。

**查询审计**：Agent 执行的每一条 SQL 都必须记录到审计日志，包括执行时间、返回行数、执行耗时。

```python
class SafeSQLTool:
    """带安全边界的 SQL 执行工具"""

    FORBIDDEN_KEYWORDS = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"}
    MAX_ROWS = 10000
    TIMEOUT_SECONDS = 30

    def execute(self, sql: str) -> dict:
        normalized = sql.strip().upper()
        for keyword in self.FORBIDDEN_KEYWORDS:
            if keyword in normalized:
                return {"error": f"安全拦截: 禁止执行 {keyword} 操作"}

        if "LIMIT" not in normalized:
            sql = f"{sql.rstrip(';')} LIMIT {self.MAX_ROWS}"

        return self._run_with_timeout(sql, self.TIMEOUT_SECONDS)
```

## 四、探索策略

Agent 拿到分析目标后，需要决定"从哪里开始看"和"下一步看什么"。这就是探索策略的问题。

### 4.1 假设驱动 vs 数据驱动

```
┌──────────────────────────────────────────────────────────┐
│                  两种探索策略                              │
│                                                          │
│  假设驱动 (Hypothesis-Driven)                            │
│  ────────────────────────────                            │
│  路径: 假设 → 验证 → 修正假设 → 再验证 → 结论            │
│  例子: "我怀疑华东区下降是因为电子产品线"                  │
│        → 查华东电子产品线数据                             │
│        → 确认下降 → 进一步查库存                          │
│  优点: 聚焦、高效、可解释                                 │
│  缺点: 可能错过假设之外的重要发现                         │
│                                                          │
│  数据驱动 (Data-Driven)                                  │
│  ──────────────────────                                  │
│  路径: 扫描全貌 → 发现异常 → 深入分析 → 结论              │
│  例子: 不预设假设，先看所有区域×产品线的热力图              │
│        → 发现华东电子产品线是最大异常点                    │
│        → 深入分析该交叉点                                 │
│  优点: 不会遗漏、可能发现意外洞察                         │
│  缺点: 探索空间大、计算成本高、可能跑偏                   │
│                                                          │
│  实践建议: 先数据驱动扫全貌，再假设驱动做深入              │
└──────────────────────────────────────────────────────────┘
```

假设驱动适合有明确业务背景的分析场景。比如业务方说"我怀疑最近客户流失率上升是因为竞品降价"，Agent 可以直接沿着这个假设去验证。

数据驱动适合开放式探索。比如"分析一下上季度有什么异常"，Agent 没有明确假设，需要先扫描全貌再聚焦。

### 4.2 深度优先 vs 广度优先

在多步探索中，Agent 面临一个选择：是把一个方向挖透再换方向（深度优先），还是先把所有方向都看一遍再决定深入哪里（广度优先）。

深度优先的好处是能快速找到根因，坏处是可能在错误的方向上浪费太多时间。广度优先的好处是全局视野好，坏处是每个方向都浅尝辄止。

工程实践中的建议是**广度优先做第一轮扫描，深度优先做第二轮深入**。先用聚合查询扫一遍所有维度，找到异常信号最多的维度组合，再对这个组合做深度钻取。

## 五、洞察评估系统

Agent 在探索过程中会产生大量中间结果。不是所有结果都值得关注——需要一个系统来评估每个发现的价值。

### 5.1 洞察的类型

```
┌───────────────────────────────────────────────┐
│            洞察类型与价值权重                   │
│                                               │
│  类型              价值权重    示例             │
│  ───────────────────────────────────────────  │
│  异常值 (Outlier)    0.9      某区域销量暴跌    │
│  趋势变化 (Trend)    0.8      连续3月下降       │
│  相关性 (Corr)       0.7      广告投入与转化率   │
│  分布偏移 (Shift)    0.6      客户年龄结构变化   │
│  基准比较 (Benchmark) 0.5     低于行业均值       │
└───────────────────────────────────────────────┘
```

### 5.2 洞察排序公式

一个简单但有效的洞察排序公式：

```
洞察分数 = 异常度 × 影响面 × 可解释性

其中:
  异常度 = |当前值 - 基准值| / 标准差    (统计上有多不正常)
  影响面 = 受影响的业务量 / 总业务量      (影响范围有多大)
  可解释性 = 1.0 (默认)                  (是否能给出合理解释)
```

比如，华东区电子产品线 3 月份销售额下降 30%：
- 异常度 = 30% / 10% (历史波动标准差) = 3.0
- 影响面 = 华东电子产品线占总销售额的 15% = 0.15
- 可解释性 = 1.0（发现有库存下降的对应数据）

洞察分数 = 3.0 × 0.15 × 1.0 = 0.45

Agent 可以设定一个阈值，只有分数超过阈值的洞察才会出现在最终报告中。

## 六、代码实战：构建数据探索 Agent

接下来我们实现一个完整的数据探索 Agent。这个 Agent 能接收分析目标，自主探索数据库，输出结构化的洞察报告。

### 6.1 项目结构

```
data-exploration-agent/
├── requirements.txt
├── agent.py              # Agent 主循环
├── tools.py              # 工具系统
├── planner.py            # 规划器
├── insight_evaluator.py  # 洞察评估
├── report_generator.py   # 报告生成
└── demo.py               # 演示脚本
```

### 6.2 requirements.txt

```
openai>=1.0.0
pandas>=2.0.0
numpy>=1.24.0
matplotlib>=3.7.0
tabulate>=0.9.0
```

### 6.3 tools.py - 工具系统

```python
"""工具系统：为 Agent 提供数据查询、统计分析、可视化等能力"""

import sqlite3
import json
import os
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    data: Any = None
    message: str = ""
    metadata: dict = field(default_factory=dict)


class SQLTool:
    """SQL 查询工具 - 只读，带安全边界"""

    FORBIDDEN_KEYWORDS = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"}
    MAX_ROWS = 10000
    TIMEOUT_SECONDS = 30

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.query_history: list[dict] = []

    def execute_sql(self, sql: str) -> ToolResult:
        normalized = sql.strip().upper()
        for keyword in self.FORBIDDEN_KEYWORDS:
            if keyword in normalized.split():
                return ToolResult(False, message=f"安全拦截: 禁止执行 {keyword} 操作")

        if "LIMIT" not in normalized:
            sql = sql.rstrip(";") + f" LIMIT {self.MAX_ROWS}"

        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute(f"PRAGMA busy_timeout = {self.TIMEOUT_SECONDS * 1000}")
            df = pd.read_sql_query(sql, conn)
            conn.close()

            self.query_history.append({
                "sql": sql,
                "rows": len(df),
                "columns": list(df.columns),
            })

            return ToolResult(
                True,
                data=df,
                message=f"查询成功，返回 {len(df)} 行 × {len(df.columns)} 列",
                metadata={"columns": list(df.columns), "dtypes": {c: str(d) for c, d in df.dtypes.items()}},
            )
        except Exception as exc:
            return ToolResult(False, message=f"SQL 执行失败: {exc}")

    def list_tables(self) -> ToolResult:
        return self.execute_sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")

    def describe_table(self, table_name: str) -> ToolResult:
        safe_name = table_name.replace('"', '""')
        return self.execute_sql(f"PRAGMA table_info(\"{safe_name}\")")

    def sample_table(self, table_name: str, n: int = 5) -> ToolResult:
        safe_name = table_name.replace('"', '""')
        return self.execute_sql(f"SELECT * FROM \"{safe_name}\" LIMIT {n}")


class StatisticsTool:
    """统计分析工具"""

    @staticmethod
    def compute_correlation(df: pd.DataFrame, col_a: str, col_b: str) -> ToolResult:
        if col_a not in df.columns or col_b not in df.columns:
            return ToolResult(False, message=f"列名不存在: {col_a} 或 {col_b}")
        try:
            corr = df[col_a].corr(df[col_b])
            return ToolResult(True, data={"correlation": round(corr, 4)}, message=f"相关系数: {corr:.4f}")
        except Exception as exc:
            return ToolResult(False, message=f"相关性计算失败: {exc}")

    @staticmethod
    def detect_outliers(df: pd.DataFrame, column: str, threshold: float = 2.0) -> ToolResult:
        if column not in df.columns:
            return ToolResult(False, message=f"列名不存在: {column}")
        try:
            values = pd.to_numeric(df[column], errors="coerce").dropna()
            mean_val = values.mean()
            std_val = values.std()
            if std_val == 0:
                return ToolResult(True, data={"outliers": []}, message="标准差为0，无异常值")

            z_scores = ((values - mean_val) / std_val).abs()
            outlier_mask = z_scores > threshold
            outlier_indices = values[outlier_mask].index.tolist()

            return ToolResult(
                True,
                data={
                    "outlier_count": len(outlier_indices),
                    "outlier_indices": outlier_indices[:20],
                    "mean": round(mean_val, 4),
                    "std": round(std_val, 4),
                },
                message=f"检测到 {len(outlier_indices)} 个异常值 (z-score > {threshold})",
            )
        except Exception as exc:
            return ToolResult(False, message=f"异常检测失败: {exc}")

    @staticmethod
    def compute_distribution(df: pd.DataFrame, column: str, bins: int = 10) -> ToolResult:
        if column not in df.columns:
            return ToolResult(False, message=f"列名不存在: {column}")
        try:
            values = pd.to_numeric(df[column], errors="coerce").dropna()
            hist, edges = np.histogram(values, bins=bins)
            return ToolResult(
                True,
                data={
                    "histogram": hist.tolist(),
                    "bin_edges": [round(e, 2) for e in edges],
                    "mean": round(values.mean(), 4),
                    "median": round(values.median(), 4),
                    "std": round(values.std(), 4),
                    "skewness": round(values.skew(), 4),
                },
                message=f"分布统计完成: 均值={values.mean():.2f}, 中位数={values.median():.2f}",
            )
        except Exception as exc:
            return ToolResult(False, message=f"分布计算失败: {exc}")


class VisualizationTool:
    """可视化工具"""

    def __init__(self, output_dir: str = "charts"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.chart_count = 0

    def line_chart(self, df: pd.DataFrame, x: str, y: str, title: str = "") -> ToolResult:
        if x not in df.columns or y not in df.columns:
            return ToolResult(False, message=f"列名不存在: {x} 或 {y}")
        try:
            fig, ax = plt.subplots(figsize=(10, 5))
            x_data = df[x]
            y_data = pd.to_numeric(df[y], errors="coerce")
            ax.plot(x_data, y_data, marker="o", linewidth=2, color="#2563eb")
            ax.set_xlabel(x)
            ax.set_ylabel(y)
            ax.set_title(title or f"{y} over {x}")
            ax.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.tight_layout()

            self.chart_count += 1
            path = os.path.join(self.output_dir, f"chart_{self.chart_count:03d}.png")
            fig.savefig(path, dpi=120, bbox_inches="tight")
            plt.close(fig)

            return ToolResult(True, data={"chart_path": path}, message=f"折线图已保存: {path}")
        except Exception as exc:
            return ToolResult(False, message=f"折线图生成失败: {exc}")

    def bar_chart(self, df: pd.DataFrame, x: str, y: str, title: str = "") -> ToolResult:
        if x not in df.columns or y not in df.columns:
            return ToolResult(False, message=f"列名不存在: {x} 或 {y}")
        try:
            fig, ax = plt.subplots(figsize=(10, 5))
            x_data = df[x].astype(str)
            y_data = pd.to_numeric(df[y], errors="coerce")
            colors = ["#ef4444" if v < 0 else "#2563eb" for v in y_data]
            ax.bar(x_data, y_data, color=colors, alpha=0.85)
            ax.set_xlabel(x)
            ax.set_ylabel(y)
            ax.set_title(title or f"{y} by {x}")
            ax.grid(True, axis="y", alpha=0.3)
            plt.xticks(rotation=45)
            plt.tight_layout()

            self.chart_count += 1
            path = os.path.join(self.output_dir, f"chart_{self.chart_count:03d}.png")
            fig.savefig(path, dpi=120, bbox_inches="tight")
            plt.close(fig)

            return ToolResult(True, data={"chart_path": path}, message=f"柱状图已保存: {path}")
        except Exception as exc:
            return ToolResult(False, message=f"柱状图生成失败: {exc}")

    def heatmap(self, df: pd.DataFrame, title: str = "") -> ToolResult:
        try:
            numeric_df = df.select_dtypes(include=[np.number])
            if numeric_df.empty:
                return ToolResult(False, message="没有数值列可供绘制热力图")

            fig, ax = plt.subplots(figsize=(max(8, len(numeric_df.columns)), max(6, len(numeric_df.columns) * 0.8)))
            corr_matrix = numeric_df.corr()
            im = ax.imshow(corr_matrix, cmap="RdBu_r", vmin=-1, vmax=1)
            ax.set_xticks(range(len(corr_matrix.columns)))
            ax.set_yticks(range(len(corr_matrix.columns)))
            ax.set_xticklabels(corr_matrix.columns, rotation=45, ha="right")
            ax.set_yticklabels(corr_matrix.columns)
            fig.colorbar(im, ax=ax, shrink=0.8)
            ax.set_title(title or "Correlation Heatmap")
            plt.tight_layout()

            self.chart_count += 1
            path = os.path.join(self.output_dir, f"chart_{self.chart_count:03d}.png")
            fig.savefig(path, dpi=120, bbox_inches="tight")
            plt.close(fig)

            return ToolResult(True, data={"chart_path": path}, message=f"热力图已保存: {path}")
        except Exception as exc:
            return ToolResult(False, message=f"热力图生成失败: {exc}")
```

### 6.4 insight_evaluator.py - 洞察评估系统

```python
"""洞察评估系统：评估每个发现的价值，生成排序后的洞察列表"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class Insight:
    """单条洞察"""
    category: str           # 类型: outlier / trend / correlation / distribution_shift / benchmark
    title: str              # 标题
    description: str        # 详细描述
    severity: float         # 异常度 0-1
    impact: float           # 影响面 0-1
    explainability: float   # 可解释性 0-1
    supporting_data: dict = field(default_factory=dict)
    score: float = 0.0

    def compute_score(self):
        self.score = round(self.severity * self.impact * self.explainability, 4)
        return self.score


class InsightEvaluator:
    """洞察评估与排序"""

    CATEGORY_WEIGHTS = {
        "outlier": 0.9,
        "trend_change": 0.8,
        "correlation": 0.7,
        "distribution_shift": 0.6,
        "benchmark": 0.5,
    }

    def __init__(self):
        self.insights: list[Insight] = []

    def add_insight(self, insight: Insight) -> None:
        insight.compute_score()
        self.insights.append(insight)

    def create_outlier_insight(
        self,
        dimension: str,
        metric: str,
        outlier_value: float,
        expected_value: float,
        std: float,
        affected_volume_ratio: float,
    ) -> Insight:
        if std == 0:
            severity = 1.0 if outlier_value != expected_value else 0.0
        else:
            severity = min(abs(outlier_value - expected_value) / std / 3.0, 1.0)

        return Insight(
            category="outlier",
            title=f"{dimension} 的 {metric} 出现异常",
            description=(
                f"{dimension} = {outlier_value} 显著偏离期望值 {expected_value:.2f} "
                f"(标准差: {std:.2f})，影响业务量占比 {affected_volume_ratio:.1%}"
            ),
            severity=severity,
            impact=affected_volume_ratio,
            explainability=1.0,
            supporting_data={
                "dimension": dimension,
                "metric": metric,
                "outlier_value": outlier_value,
                "expected_value": expected_value,
                "std": std,
            },
        )

    def create_trend_insight(
        self,
        metric: str,
        periods: list[str],
        values: list[float],
        change_rate: float,
    ) -> Insight:
        severity = min(abs(change_rate) / 0.3, 1.0)

        direction = "下降" if change_rate < 0 else "上升"
        return Insight(
            category="trend_change",
            title=f"{metric} 呈现持续{direction}趋势",
            description=(
                f"{metric} 在 {periods[0]} 到 {periods[-1]} 期间 "
                f"{direction}了 {abs(change_rate):.1%}"
            ),
            severity=severity,
            impact=0.5,
            explainability=1.0,
            supporting_data={
                "metric": metric,
                "periods": periods,
                "values": values,
                "change_rate": change_rate,
            },
        )

    def get_ranked_insights(self, top_n: int = 10) -> list[Insight]:
        sorted_insights = sorted(self.insights, key=lambda i: i.score, reverse=True)
        return sorted_insights[:top_n]

    def to_report(self, top_n: int = 10) -> str:
        ranked = self.get_ranked_insights(top_n)
        if not ranked:
            return "## 洞察报告\n\n未发现显著洞察。\n"

        lines = ["## 洞察报告\n"]
        for i, insight in enumerate(ranked, 1):
            lines.append(f"### {i}. {insight.title}\n")
            lines.append(f"- **类型**: {insight.category}")
            lines.append(f"- **严重度**: {insight.severity:.2f}")
            lines.append(f"- **影响面**: {insight.impact:.2%}")
            lines.append(f"- **综合评分**: {insight.score:.4f}")
            lines.append(f"- **描述**: {insight.description}\n")
        return "\n".join(lines)
```

### 6.5 planner.py - 规划器

```python
"""规划器：根据分析目标生成探索计划，并支持动态修订"""

import json
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PlanStep:
    """计划中的一个步骤"""
    step_id: int
    description: str
    tool: str
    params: dict = field(default_factory=dict)
    status: str = "pending"        # pending / running / done / failed / skipped
    result_summary: str = ""
    insight_score: float = 0.0


@dataclass
class ExplorationPlan:
    """完整的探索计划"""
    goal: str
    steps: list[PlanStep] = field(default_factory=list)
    current_step: int = 0

    def get_next_pending(self) -> Optional[PlanStep]:
        for step in self.steps:
            if step.status == "pending":
                return step
        return None

    def mark_current_done(self, result_summary: str, insight_score: float = 0.0):
        if self.current_step < len(self.steps):
            self.steps[self.current_step].status = "done"
            self.steps[self.current_step].result_summary = result_summary
            self.steps[self.current_step].insight_score = insight_score
            self.current_step += 1

    def mark_current_failed(self, reason: str):
        if self.current_step < len(self.steps):
            self.steps[self.current_step].status = "failed"
            self.steps[self.current_step].result_summary = reason
            self.current_step += 1

    def insert_step_after_current(self, step: PlanStep):
        insert_idx = self.current_step + 1
        step.step_id = insert_idx
        self.steps.insert(insert_idx, step)
        for i in range(insert_idx + 1, len(self.steps)):
            self.steps[i].step_id = i

    def to_string(self) -> str:
        lines = [f"分析目标: {self.goal}\n", "探索计划:\n"]
        for step in self.steps:
            status_icon = {"pending": "⏳", "running": "🔄", "done": "✅", "failed": "❌", "skipped": "⏭️"}.get(step.status, "?")
            lines.append(f"  {step.step_id}. [{status_icon}] {step.description}")
            if step.result_summary:
                lines.append(f"     结果: {step.result_summary}")
        return "\n".join(lines)


class DynamicPlanner:
    """动态规划器：根据探索过程中的发现调整计划"""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def create_initial_plan(self, goal: str, table_info: dict[str, list[str]]) -> ExplorationPlan:
        plan = ExplorationPlan(goal=goal)

        tables = list(table_info.keys())
        first_table = tables[0] if tables else "unknown"

        plan.steps = [
            PlanStep(1, "查看数据库中的所有表", "list_tables"),
            PlanStep(2, f"查看 {first_table} 的表结构", "describe_table", {"table": first_table}),
            PlanStep(3, f"查看 {first_table} 的样本数据", "sample_table", {"table": first_table, "n": 10}),
            PlanStep(4, f"统计 {first_table} 的数值列分布", "distribution", {"table": first_table}),
            PlanStep(5, f"检测 {first_table} 中的异常值", "outlier_detection", {"table": first_table}),
            PlanStep(6, "生成相关性热力图", "heatmap", {"table": first_table}),
            PlanStep(7, "汇总洞察并生成报告", "summarize"),
        ]

        return plan

    def suggest_next_step(self, plan: ExplorationPlan, last_result: str) -> Optional[PlanStep]:
        if "异常" in last_result or "outlier" in last_result.lower():
            return PlanStep(
                step_id=len(plan.steps) + 1,
                description=f"深入分析发现的异常点: {last_result[:60]}",
                tool="drill_down",
                params={"context": last_result[:200]},
            )
        return None
```

### 6.6 agent.py - Agent 主循环

```python
"""数据探索 Agent 主循环：协调规划器、工具系统和洞察评估器"""

import os
import json
import sqlite3
from dataclasses import dataclass, field

import pandas as pd
import numpy as np

from tools import SQLTool, StatisticsTool, VisualizationTool, ToolResult
from planner import DynamicPlanner, ExplorationPlan, PlanStep
from insight_evaluator import InsightEvaluator, Insight


@dataclass
class AgentConfig:
    db_path: str = "demo_sales.db"
    chart_dir: str = "charts"
    max_steps: int = 15
    insight_threshold: float = 0.1


class DataExplorationAgent:
    """数据探索 Agent：自主探索数据库并输出洞察报告"""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.sql_tool = SQLTool(config.db_path)
        self.stats_tool = StatisticsTool()
        self.viz_tool = VisualizationTool(config.chart_dir)
        self.planner = DynamicPlanner()
        self.evaluator = InsightEvaluator()
        self.execution_log: list[dict] = []

    def get_table_info(self) -> dict[str, list[str]]:
        result = self.sql_tool.list_tables()
        if not result.success:
            return {}
        table_names = result.data["name"].tolist()
        info = {}
        for tname in table_names:
            desc = self.sql_tool.describe_table(tname)
            if desc.success:
                info[tname] = desc.data["name"].tolist()
        return info

    def execute_step(self, step: PlanStep, plan: ExplorationPlan) -> str:
        tool_name = step.tool
        params = step.params

        if tool_name == "list_tables":
            result = self.sql_tool.list_tables()
            if result.success:
                tables = result.data["name"].tolist()
                return f"数据库中共有 {len(tables)} 张表: {', '.join(tables)}"
            return f"失败: {result.message}"

        elif tool_name == "describe_table":
            table = params.get("table", "")
            result = self.sql_tool.describe_table(table)
            if result.success:
                cols = result.data.to_dict("records")
                col_desc = [f"{c['name']}({c['type']})" for c in cols]
                return f"表 {table} 的字段: {', '.join(col_desc)}"
            return f"失败: {result.message}"

        elif tool_name == "sample_table":
            table = params.get("table", "")
            n = params.get("n", 5)
            result = self.sql_tool.sample_table(table, n)
            if result.success:
                return f"样本数据 ({len(result.data)} 行):\n{result.data.to_string(index=False)}"
            return f"失败: {result.message}"

        elif tool_name == "distribution":
            table = params.get("table", "")
            sample_result = self.sql_tool.sample_table(table, 10000)
            if not sample_result.success:
                return f"获取数据失败: {sample_result.message}"

            df = sample_result.data
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if not numeric_cols:
                return f"表 {table} 中没有数值列"

            summaries = []
            for col in numeric_cols[:5]:
                dist_result = self.stats_tool.compute_distribution(df, col)
                if dist_result.success:
                    d = dist_result.data
                    summaries.append(
                        f"  {col}: 均值={d['mean']:.2f}, 中位数={d['median']:.2f}, "
                        f"标准差={d['std']:.2f}, 偏度={d['skewness']:.2f}"
                    )
                    if abs(d["skewness"]) > 1.5:
                        insight = Insight(
                            category="distribution_shift",
                            title=f"{col} 分布严重偏斜",
                            description=f"{col} 的偏度为 {d['skewness']:.2f}，分布明显不对称",
                            severity=min(abs(d["skewness"]) / 3.0, 1.0),
                            impact=0.4,
                            explainability=0.8,
                        )
                        self.evaluator.add_insight(insight)

            return f"表 {table} 的数值列分布:\n" + "\n".join(summaries)

        elif tool_name == "outlier_detection":
            table = params.get("table", "")
            sample_result = self.sql_tool.sample_table(table, 10000)
            if not sample_result.success:
                return f"获取数据失败: {sample_result.message}"

            df = sample_result.data
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if not numeric_cols:
                return f"表 {table} 中没有数值列"

            findings = []
            for col in numeric_cols[:5]:
                out_result = self.stats_tool.detect_outliers(df, col)
                if out_result.success and out_result.data["outlier_count"] > 0:
                    count = out_result.data["outlier_count"]
                    findings.append(f"  {col}: {count} 个异常值")

                    insight = self.evaluator.create_outlier_insight(
                        dimension=col,
                        metric=col,
                        outlier_value=out_result.data["mean"] + 2 * out_result.data["std"],
                        expected_value=out_result.data["mean"],
                        std=out_result.data["std"],
                        affected_volume_ratio=count / max(len(df), 1),
                    )
                    self.evaluator.add_insight(insight)

            if findings:
                return f"表 {table} 的异常检测结果:\n" + "\n".join(findings)
            return f"表 {table} 未检测到显著异常值"

        elif tool_name == "heatmap":
            table = params.get("table", "")
            sample_result = self.sql_tool.sample_table(table, 10000)
            if not sample_result.success:
                return f"获取数据失败: {sample_result.message}"

            df = sample_result.data
            numeric_df = df.select_dtypes(include=[np.number])
            if len(numeric_df.columns) < 2:
                return "数值列不足2个，无法生成热力图"

            viz_result = self.viz_tool.heatmap(numeric_df, title=f"{table} 相关性热力图")
            if viz_result.success:
                corr = numeric_df.corr()
                strong_corrs = []
                for i in range(len(corr.columns)):
                    for j in range(i + 1, len(corr.columns)):
                        c = corr.iloc[i, j]
                        if abs(c) > 0.7:
                            strong_corrs.append(f"  {corr.columns[i]} ↔ {corr.columns[j]}: {c:.3f}")
                            insight = Insight(
                                category="correlation",
                                title=f"{corr.columns[i]} 与 {corr.columns[j]} 高度相关",
                                description=f"相关系数 {c:.3f}",
                                severity=min(abs(c), 1.0),
                                impact=0.5,
                                explainability=0.8,
                            )
                            self.evaluator.add_insight(insight)

                msg = f"热力图已生成: {viz_result.data['chart_path']}"
                if strong_corrs:
                    msg += f"\n发现强相关关系:\n" + "\n".join(strong_corrs)
                return msg
            return f"热力图生成失败: {viz_result.message}"

        elif tool_name == "summarize":
            return self.evaluator.to_report()

        elif tool_name == "drill_down":
            context = params.get("context", "")
            return f"深度分析上下文: {context[:500]}"

        return f"未知工具: {tool_name}"

    def run(self, goal: str) -> str:
        table_info = self.get_table_info()
        if not table_info:
            return "错误: 无法获取数据库表信息"

        plan = self.planner.create_initial_plan(goal, table_info)

        print(f"\n{'='*60}")
        print(f"数据探索 Agent 启动")
        print(f"分析目标: {goal}")
        print(f"{'='*60}")
        print(plan.to_string())
        print()

        steps_executed = 0
        while steps_executed < self.config.max_steps:
            step = plan.get_next_pending()
            if step is None:
                break

            step.status = "running"
            print(f"\n▶ 执行步骤 {step.step_id}: {step.description}")

            result_text = self.execute_step(step, plan)
            print(f"  结果: {result_text[:200]}{'...' if len(result_text) > 200 else ''}")

            self.execution_log.append({
                "step": step.step_id,
                "description": step.description,
                "tool": step.tool,
                "result": result_text,
            })

            insight_score = max(
                (i.score for i in self.evaluator.insights[-5:]),
                default=0.0,
            )
            plan.mark_current_done(result_text[:200], insight_score)

            new_step = self.planner.suggest_next_step(plan, result_text)
            if new_step:
                plan.insert_step_after_current(new_step)
                print(f"  → 发现新线索，插入步骤: {new_step.description}")

            steps_executed += 1

        report = self._generate_final_report(goal, plan)
        print(f"\n{'='*60}")
        print("探索完成！")
        print(f"总步骤: {steps_executed}")
        print(f"发现洞察: {len(self.evaluator.insights)}")
        print(f"生成图表: {self.viz_tool.chart_count}")
        print(f"{'='*60}\n")
        print(report)

        return report

    def _generate_final_report(self, goal: str, plan: ExplorationPlan) -> str:
        lines = [
            f"# 数据探索报告\n",
            f"**分析目标**: {goal}\n",
            f"## 执行摘要\n",
            f"共执行 {len(self.execution_log)} 个分析步骤，",
            f"发现 {len(self.evaluator.insights)} 条洞察，",
            f"生成 {self.viz_tool.chart_count} 张可视化图表。\n",
            self.evaluator.to_report(),
            f"\n## 分析过程\n",
        ]
        for log in self.execution_log:
            lines.append(f"### 步骤 {log['step']}: {log['description']}")
            lines.append(f"工具: `{log['tool']}`\n")
            lines.append(f"结果: {log['result'][:300]}\n")

        return "\n".join(lines)
```

### 6.7 demo.py - 演示脚本

```python
"""演示脚本：创建模拟销售数据库，运行数据探索 Agent"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

import numpy as np

from agent import DataExplorationAgent, AgentConfig


def create_demo_database(db_path: str = "demo_sales.db") -> None:
    """创建一个包含模拟销售数据的 SQLite 数据库"""

    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE sales_orders (
            order_id INTEGER PRIMARY KEY,
            order_date TEXT,
            region TEXT,
            product_category TEXT,
            product_name TEXT,
            quantity INTEGER,
            unit_price REAL,
            total_amount REAL,
            customer_type TEXT,
            discount_rate REAL
        )
    """)

    regions = ["华东", "华南", "华北", "西南", "华中"]
    categories = ["电子产品", "家居用品", "食品饮料", "服装鞋帽", "办公用品"]
    customer_types = ["企业客户", "个人消费者", "渠道商"]

    random.seed(42)
    np.random.seed(42)

    base_date = datetime(2024, 1, 1)
    orders = []
    order_id = 1

    for month in range(12):
        current_date = base_date + timedelta(days=month * 30)
        for _ in range(random.randint(80, 120)):
            region = random.choice(regions)
            category = random.choice(categories)
            customer_type = random.choice(customer_types)
            quantity = random.randint(1, 50)
            base_price = {"电子产品": 2000, "家居用品": 500, "食品饮料": 50, "服装鞋帽": 300, "办公用品": 150}
            unit_price = base_price[category] * random.uniform(0.7, 1.3)
            discount = random.uniform(0.8, 1.0)

            if region == "华东" and category == "电子产品" and month >= 2 and month <= 4:
                quantity = max(1, quantity // 3)
                unit_price *= 0.9

            total = round(quantity * unit_price * discount, 2)

            orders.append((
                order_id,
                (current_date + timedelta(days=random.randint(0, 29))).strftime("%Y-%m-%d"),
                region, category,
                f"{category}_{random.choice(['A', 'B', 'C'])}",
                quantity, round(unit_price, 2), total, customer_type, round(discount, 4),
            ))
            order_id += 1

    cursor.executemany(
        "INSERT INTO sales_orders VALUES (?,?,?,?,?,?,?,?,?,?)",
        orders,
    )

    cursor.execute("""
        CREATE TABLE inventory (
            product_name TEXT,
            region TEXT,
            stock_quantity INTEGER,
            reorder_level INTEGER,
            last_restock_date TEXT
        )
    """)

    inventory = []
    for product in ["电子产品_A", "电子产品_B", "电子产品_C", "家居用品_A", "食品饮料_A"]:
        for region in regions:
            stock = random.randint(100, 1000)
            if region == "华东" and "电子产品" in product:
                stock = random.randint(10, 50)
            inventory.append((product, region, stock, 100, "2024-03-15"))

    cursor.executemany("INSERT INTO inventory VALUES (?,?,?,?,?)", inventory)
    conn.commit()
    conn.close()

    print(f"演示数据库已创建: {db_path}")
    print(f"  - sales_orders: {len(orders)} 条订单记录")
    print(f"  - inventory: {len(inventory)} 条库存记录")


def main():
    db_path = "demo_sales.db"

    print("=" * 60)
    print("数据探索 Agent 演示")
    print("=" * 60)

    create_demo_database(db_path)

    config = AgentConfig(db_path=db_path, chart_dir="charts", max_steps=10)
    agent = DataExplorationAgent(config)

    goal = "分析上季度销售数据，找出异常和值得关注的趋势"
    report = agent.run(goal)

    output_path = "exploration_report.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\n报告已保存到: {output_path}")


if __name__ == "__main__":
    main()
```

## 七、常见误区

### 误区一：Agent 可以完全替代数据分析师

很多人认为有了数据探索 Agent 就不需要数据分析师了。实际情况是，Agent 擅长的是**大规模扫描和异常检测**——它能在几分钟内扫遍上百个维度组合，找到统计上显著的异常点。但它不擅长**业务语义理解**——为什么华东区电子产品线在 3 月份下降？是因为供应链问题、竞品冲击还是季节性因素？这些判断需要业务知识和行业经验。

Agent 的正确定位是分析师的"侦察兵"：它快速扫描战场，标记值得关注的区域，但最终的判断和决策仍然需要人来做。

### 误区二：探索步骤越多越好

有人认为 Agent 探索的步骤越多，分析就越全面。实际上，探索是有成本的——每一步都消耗计算资源和时间，而且过多的步骤会让最终报告变得冗长，反而淹没真正有价值的洞察。

正确的做法是设置**探索预算**（比如最多 15 步），并通过洞察评估系统动态决定是否继续。如果连续两步都没有产生高价值洞察，Agent 应该主动终止探索，而不是机械地执行完所有计划步骤。

### 误区三：异常检测用 z-score 就够了

z-score（标准分数）是最常用的异常检测方法，但它有一个隐含假设：数据服从正态分布。在真实的业务数据中，很多指标的分布是偏斜的（比如销售额、用户活跃度），这时候 z-score 的阈值判断就不准确了。

对于偏斜分布，应该使用 IQR（四分位距）方法或者基于百分位数的异常检测。对于时间序列数据，还需要考虑季节性因素——12 月份的销售额比 11 月份高 50%，可能只是正常的节日效应，而不是异常。

### 误区四：把 Agent 的中间推理过程直接展示给用户

Agent 的推理过程包含大量中间 SQL、统计结果和临时判断。如果把这些原始过程直接推给用户，信息过载会让用户无所适从。

正确的做法是**双层输出**：面向用户的是一份精炼的洞察报告（只包含高价值发现），面向开发者的是一份完整的执行日志（包含所有中间步骤，用于调试和审计）。

## 小结与练习

### 小结

1. 数据探索 Agent 与对话式 BI 的本质区别在于**自主性**——Agent 能独立规划和执行多步分析，而不是被动响应单个问题
2. ReAct 架构适合简单探索，Plan-and-Execute 适合复杂分析，混合架构（顶层规划 + 局部 ReAct）是工程实践中的最佳选择
3. 工具系统的设计要遵循**安全第一**原则：只读查询、资源限制、查询审计是三个必须有的安全边界
4. 探索策略中，假设驱动聚焦高效但可能遗漏，数据驱动全面但成本高，实际应用中应**先广度扫描再深度钻取**
5. 洞察评估系统是 Agent 的"判断力"来源——通过异常度 × 影响面 × 可解释性的公式，可以自动过滤低价值发现

### 练习

#### 练习一：扩展 Agent 的统计工具

当前的 `StatisticsTool` 只有相关性计算、异常检测和分布统计三个功能。请为其添加一个 `detect_trend_change` 方法，能够检测时间序列数据中的趋势变化点（比如连续 3 个月下降）。

要求：
- 输入：一个 DataFrame、日期列名、指标列名
- 输出：趋势变化点的位置和变化幅度
- 使用滑动窗口方法，窗口大小可配置

#### 练习二：实现查询缓存

当前的 `SQLTool` 每次执行查询都会访问数据库。请为其添加查询缓存功能，避免重复执行相同的 SQL 查询。

要求：
- 使用 SQL 语句的哈希值作为缓存键
- 缓存大小可配置（LRU 淘汰策略）
- 提供清除缓存的方法
- 缓存命中时在 ToolResult 的 metadata 中标记

#### 练习三：为 Agent 添加多表关联探索能力

当前的 Agent 只能逐表分析。请修改 `planner.py` 的 `create_initial_plan` 方法，使其能够自动识别表之间的关联关系（通过外键或相同列名），并生成包含 JOIN 查询的探索计划。

要求：
- 自动检测表之间的关联列
- 在计划中加入跨表分析步骤
- 生成的 JOIN SQL 必须是安全的（只读）

---

## 参考答案

### 练习一：扩展统计工具

**思路**：使用滑动窗口计算局部趋势，通过比较相邻窗口的斜率来检测趋势变化点。对时间序列数据先按日期排序，然后在每个窗口位置拟合线性趋势，比较前后窗口的斜率差异。

**答案**：

```python
class StatisticsToolExtended(StatisticsTool):

    @staticmethod
    def detect_trend_change(
        df: pd.DataFrame,
        date_col: str,
        metric_col: str,
        window_size: int = 3,
        slope_threshold: float = 0.1,
    ) -> ToolResult:
        if date_col not in df.columns or metric_col not in df.columns:
            return ToolResult(False, message=f"列名不存在: {date_col} 或 {metric_col}")

        try:
            sorted_df = df.sort_values(date_col).reset_index(drop=True)
            values = pd.to_numeric(sorted_df[metric_col], errors="coerce").dropna()

            if len(values) < window_size * 2:
                return ToolResult(False, message=f"数据量不足: 需要至少 {window_size * 2} 条记录")

            def compute_slope(series: pd.Series) -> float:
                x = np.arange(len(series))
                coeffs = np.polyfit(x, series.values, 1)
                return coeffs[0]

            change_points = []
            for i in range(window_size, len(values) - window_size):
                before = values.iloc[i - window_size:i]
                after = values.iloc[i:i + window_size]
                slope_before = compute_slope(before)
                slope_after = compute_slope(after)
                slope_diff = abs(slope_after - slope_before)

                if slope_diff > slope_threshold:
                    change_rate = (after.mean() - before.mean()) / max(before.mean(), 0.001)
                    change_points.append({
                        "position": i,
                        "date": str(sorted_df[date_col].iloc[i]),
                        "slope_before": round(slope_before, 4),
                        "slope_after": round(slope_after, 4),
                        "slope_diff": round(slope_diff, 4),
                        "change_rate": round(change_rate, 4),
                    })

            return ToolResult(
                True,
                data={"change_points": change_points, "total_checked": len(values) - window_size * 2},
                message=f"检测到 {len(change_points)} 个趋势变化点",
            )
        except Exception as exc:
            return ToolResult(False, message=f"趋势检测失败: {exc}")
```

**要点**：
- 先按日期排序确保时间序列的正确性
- 使用 `np.polyfit` 计算线性拟合斜率
- 比较相邻窗口的斜率差异来判断趋势变化
- `change_rate` 提供了变化幅度的直观度量

### 练习二：实现查询缓存

**思路**：使用 Python 的 `functools.lru_cache` 不适用于动态 SQL 字符串，因此自行实现一个基于字典的 LRU 缓存。用 SQL 字符串的哈希值作为键，查询结果 DataFrame 作为值。

**答案**：

```python
import hashlib
from collections import OrderedDict


class CachedSQLTool(SQLTool):

    def __init__(self, db_path: str, cache_size: int = 100):
        super().__init__(db_path)
        self.cache_size = cache_size
        self._cache: OrderedDict[str, ToolResult] = OrderedDict()
        self.cache_hits = 0
        self.cache_misses = 0

    def _sql_hash(self, sql: str) -> str:
        normalized = " ".join(sql.strip().split()).lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def execute_sql(self, sql: str) -> ToolResult:
        cache_key = self._sql_hash(sql)

        if cache_key in self._cache:
            self._cache.move_to_end(cache_key)
            self.cache_hits += 1
            cached_result = self._cache[cache_key]
            return ToolResult(
                success=cached_result.success,
                data=cached_result.data.copy() if cached_result.data is not None else None,
                message=cached_result.message + " [缓存命中]",
                metadata={**cached_result.metadata, "cache_hit": True},
            )

        self.cache_misses += 1
        result = super().execute_sql(sql)

        if result.success:
            self._cache[cache_key] = result
            if len(self._cache) > self.cache_size:
                self._cache.popitem(last=False)

        return result

    def clear_cache(self) -> None:
        self._cache.clear()
        self.cache_hits = 0
        self.cache_misses = 0

    def get_cache_stats(self) -> dict:
        total = self.cache_hits + self.cache_misses
        return {
            "size": len(self._cache),
            "max_size": self.cache_size,
            "hits": self.cache_hits,
            "misses": self.cache_misses,
            "hit_rate": round(self.cache_hits / max(total, 1), 4),
        }
```

**要点**：
- SQL 规范化（去除多余空格、统一大小写）确保语义相同的查询命中同一缓存
- 使用 `OrderedDict` 实现 LRU 淘汰：每次命中时 `move_to_end`，容量超限时 `popitem(last=False)` 淘汰最久未使用的
- 缓存命中时返回数据的副本，避免调用方修改缓存中的原始数据
- `cache_hit` 标记放在 metadata 中，方便上层逻辑判断

### 练习三：多表关联探索

**思路**：通过比较不同表的列名，找到名称相同的列作为潜在关联键。在生成计划时，当发现两张表有相同列名时，自动加入 JOIN 查询步骤。

**答案**：

```python
class SmartPlanner(DynamicPlanner):

    def detect_join_keys(self, table_info: dict[str, list[str]]) -> list[tuple[str, str, str]]:
        join_keys = []
        tables = list(table_info.keys())

        for i in range(len(tables)):
            for j in range(i + 1, len(tables)):
                t1, t2 = tables[i], tables[j]
                common_cols = set(table_info[t1]) & set(table_info[t2])
                for col in common_cols:
                    if col not in ("id", "created_at", "updated_at"):
                        join_keys.append((t1, t2, col))

        return join_keys

    def create_initial_plan(self, goal: str, table_info: dict[str, list[str]]) -> ExplorationPlan:
        plan = super().create_initial_plan(goal, table_info)

        join_keys = self.detect_join_keys(table_info)
        if not join_keys:
            return plan

        cross_table_step = PlanStep(
            step_id=len(plan.steps) + 1,
            description=f"跨表关联分析: 发现 {len(join_keys)} 个潜在关联",
            tool="cross_table_analysis",
            params={"join_keys": join_keys},
        )

        insert_pos = min(4, len(plan.steps))
        plan.steps.insert(insert_pos, cross_table_step)
        for i in range(insert_pos, len(plan.steps)):
            plan.steps[i].step_id = i + 1

        return plan
```

**要点**：
- `detect_join_keys` 通过集合交集找到同名列，排除通用字段（id、时间戳等）避免误关联
- 跨表分析步骤插入到计划的中间位置（采样之后、深入分析之前），确保 Agent 先了解各表结构再做关联
- `join_keys` 是一个列表，支持多对多表关联场景

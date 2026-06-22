# 05 质量 Dashboard——实时展示评估指标、趋势、异常告警

> 数据不展示就等于没有。质量 Dashboard 让你一眼看到 AI 应用的健康状况。

## 场景引入

你的团队每天跑自动化评估，忠实度、相关性、幻觉率等分数都存在数据库里。但当产品经理问"最近一周质量怎么样"时，你只能打开 Jupyter Notebook 跑一段 SQL，导出 CSV，再画个图。而当你终于把图表发过去，产品经理又问"昨天下午那批低分案例具体是什么问题"——你又得再跑一轮查询。评估数据如果不被持续展示和实时告警，就等于躺在硬盘里的死数据。

## 学习目标

- 掌握质量 Dashboard 的设计方法
- 学会实时展示评估指标和趋势
- 建立异常告警机制

---

## 一、Dashboard 设计

### 1.1 核心指标卡片

```python
class QualityDashboard:
    """质量 Dashboard"""
    
    def __init__(self, langfuse_client):
        self.langfuse = langfuse_client
    
    def get_overview(self) -> dict:
        """获取概览数据"""
        return {
            "total_requests": self._get_total_requests(),
            "avg_quality_score": self._get_avg_quality(),
            "success_rate": self._get_success_rate(),
            "avg_latency": self._get_avg_latency(),
            "daily_cost": self._get_daily_cost(),
            "hallucination_rate": self._get_hallucination_rate()
        }
    
    def get_trends(self, days: int = 7) -> dict:
        """获取趋势数据"""
        return {
            "quality_trend": self._get_quality_trend(days),
            "latency_trend": self._get_latency_trend(days),
            "cost_trend": self._get_cost_trend(days),
            "volume_trend": self._get_volume_trend(days)
        }
    
    def get_alerts(self) -> list[dict]:
        """获取告警"""
        alerts = []
        
        # 质量下降告警
        recent_quality = self._get_recent_quality()
        if recent_quality < 0.7:
            alerts.append({
                "type": "quality_drop",
                "severity": "high",
                "message": f"质量评分下降至 {recent_quality:.2f}",
                "timestamp": datetime.now().isoformat()
            })
        
        # 延迟告警
        recent_latency = self._get_recent_latency()
        if recent_latency > 5.0:
            alerts.append({
                "type": "high_latency",
                "severity": "medium",
                "message": f"平均延迟上升至 {recent_latency:.2f}s",
                "timestamp": datetime.now().isoformat()
            })
        
        # 成本告警
        daily_cost = self._get_daily_cost()
        if daily_cost > 100:
            alerts.append({
                "type": "high_cost",
                "severity": "medium",
                "message": f"日成本达到 ${daily_cost:.2f}",
                "timestamp": datetime.now().isoformat()
            })
        
        return alerts
```

### 1.2 告警规则

```python
class AlertRules:
    """告警规则"""
    
    rules = [
        {
            "name": "quality_drop",
            "metric": "quality_score",
            "condition": "< 0.7",
            "severity": "high",
            "message": "质量评分低于阈值"
        },
        {
            "name": "high_latency",
            "metric": "avg_latency",
            "condition": "> 5.0",
            "severity": "medium",
            "message": "平均延迟超过 5 秒"
        },
        {
            "name": "high_cost",
            "metric": "daily_cost",
            "condition": "> 100",
            "severity": "medium",
            "message": "日成本超过 $100"
        },
        {
            "name": "hallucination_spike",
            "metric": "hallucination_rate",
            "condition": "> 0.1",
            "severity": "high",
            "message": "幻觉率超过 10%"
        }
    ]
```

---

## 二、Streamlit Dashboard 实现

```python
import streamlit as st
import plotly.graph_objects as go

def render_dashboard():
    """渲染 Dashboard"""
    
    st.title("AI 应用质量 Dashboard")
    
    # 概览卡片
    overview = dashboard.get_overview()
    
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("总请求数", overview["total_requests"])
    col2.metric("质量评分", f"{overview['avg_quality_score']:.2f}")
    col3.metric("成功率", f"{overview['success_rate']:.1%}")
    col4.metric("日成本", f"${overview['daily_cost']:.2f}")
    
    # 趋势图
    trends = dashboard.get_trends(7)
    
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=trends["quality_trend"]["dates"],
        y=trends["quality_trend"]["values"],
        mode='lines+markers',
        name='质量评分'
    ))
    st.plotly_chart(fig)
    
    # 告警
    alerts = dashboard.get_alerts()
    if alerts:
        st.warning("⚠️ 活跃告警")
        for alert in alerts:
            st.error(f"{alert['message']} ({alert['timestamp']})")
    
    # 低分案例
    st.subheader("低分案例")
    low_scores = get_low_score_cases()
    for case in low_scores:
        with st.expander(f"{case['question'][:50]}... - 评分: {case['score']}"):
            st.write(f"**问题**: {case['question']}")
            st.write(f"**回答**: {case['answer']}")
            st.write(f"**评分**: {case['score']}/5")

if __name__ == "__main__":
    render_dashboard()
```

---

## 三、Next.js Dashboard 实现

```typescript
// components/Dashboard.tsx

export function Dashboard() {
  const { data: overview } = useQuery('overview', fetchOverview);
  const { data: trends } = useQuery('trends', fetchTrends);
  const { data: alerts } = useQuery('alerts', fetchAlerts);

  return (
    <div className="dashboard">
      {/* 概览卡片 */}
      <div className="overview-cards">
        <MetricCard title="总请求数" value={overview?.totalRequests} />
        <MetricCard title="质量评分" value={overview?.avgQuality?.toFixed(2)} />
        <MetricCard title="成功率" value={`${(overview?.successRate * 100).toFixed(1)}%`} />
        <MetricCard title="日成本" value={`$${overview?.dailyCost?.toFixed(2)}`} />
      </div>

      {/* 趋势图 */}
      <div className="charts">
        <LineChart data={trends?.qualityTrend} title="质量趋势" />
        <LineChart data={trends?.latencyTrend} title="延迟趋势" />
      </div>

      {/* 告警 */}
      {alerts?.length > 0 && (
        <div className="alerts">
          {alerts.map(alert => (
            <Alert key={alert.id} severity={alert.severity}>
              {alert.message}
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 常见误区

1. **Dashboard 堆满指标但没有行动指引**：放了 20 个图表，每个都好看，但没人知道看到哪个数字变红了该干什么。Dashboard 的核心不是"展示数据"，而是"驱动决策"。每个指标旁边都应该有阈值线和触发条件。

2. **只看聚合指标不看个体案例**：平均质量分 4.2/5 看起来不错，但可能有 5% 的案例评分只有 1/5，这些低分案例才是用户投诉的来源。Dashboard 必须支持从聚合指标下钻到具体的低分 Trace。

3. **告警规则设完就不管了**：上线时设的阈值随着业务迭代早已过时——模型升级后质量基线提高了，但告警阈值还是老的。需要定期回顾和调整告警规则，建议每月 review 一次。

4. **把 Dashboard 当报告工具**：Dashboard 是实时监控工具，不是周报生成器。如果团队只在周会上看一眼 Dashboard，那它就退化成了静态报告。正确用法是每天花 5 分钟扫一眼，发现异常立即排查。

## 工程建议

1. **Dashboard 按"总-分-个体"三层设计**：第一层是健康概览（4-6 个关键指标卡片），第二层是趋势和分布图（质量趋势、延迟分布、成本走势），第三层是可交互的低分案例列表。用户从上往下逐层下钻，30 秒内能定位到问题。

2. **告警规则用数据驱动而非直觉**：上线初期不设静态阈值，先收集两周数据计算均值和标准差，用"均值 ± 2 倍标准差"作为动态阈值。运行稳定后再逐步收紧为静态阈值。这样避免了"拍脑袋设 0.7 结果正常波动就天天响"的问题。

3. **在 Dashboard 中嵌入"可操作链接"**：每个告警卡片直接链接到对应的 Langfuse Trace 页面，每个低分案例直接展示 Prompt 版本和检索结果。缩短从"发现问题"到"定位根因"的路径，不要让工程师再去其他系统手动搜索。

4. **设置 Dashboard 的"值班看板"模式**：在团队工位的大屏上循环展示核心指标和活跃告警。值班人员 5 分钟扫一眼就能掌握全局，发现异常立即处理。这比"等告警推送"更主动，能提前发现趋势性问题。

## 小结

```
本课核心要点：

1. Dashboard 核心：概览卡片、趋势图、告警列表
2. 实时监控质量、延迟、成本三个维度
3. 异常告警要分级（high/medium/low）
4. 低分案例要可追溯、可分析

---

**下一课**: [06 阶段实战——搭建完整的 AI 应用可观测性平台](./06-阶段实战-可观测性平台.md)
```

---

## 练习

1. **Dashboard 题**：用 Streamlit 或 Next.js 搭建一个质量 Dashboard。

2. **告警题**：设计 3 条告警规则，并实现告警触发逻辑。

3. **分析题**：从 Dashboard 中发现一个质量问题，并分析原因。

---

## 参考答案

### 练习一

**思路**：用 Streamlit 快速搭建 Dashboard，包含概览卡片、趋势图和告警列表三层。核心是用 `st.metric` 展示关键指标，用 Plotly 画趋势图，用 `st.expander` 展示低分案例。

**答案**：

```python
import streamlit as st
import plotly.graph_objects as go
from datetime import datetime, timedelta
import random


def generate_mock_data(days: int = 7) -> dict:
    """生成模拟数据"""
    dates = [(datetime.now() - timedelta(days=i)).strftime("%m-%d") for i in range(days)]
    dates.reverse()
    return {
        "dates": dates,
        "quality": [round(0.75 + random.uniform(-0.1, 0.1), 2) for _ in range(days)],
        "latency_p50": [round(1.5 + random.uniform(-0.3, 0.3), 2) for _ in range(days)],
        "latency_p95": [round(4.0 + random.uniform(-1.0, 1.0), 2) for _ in range(days)],
        "cost": [round(80 + random.uniform(-20, 20), 2) for _ in range(days)],
        "request_count": [random.randint(400, 600) for _ in range(days)],
    }


def render_quality_dashboard():
    st.set_page_config(page_title="AI 质量 Dashboard", layout="wide")
    st.title("AI 应用质量监控 Dashboard")

    data = generate_mock_data(7)
    latest = {k: v[-1] for k, v in data.items() if isinstance(v, list) and v}

    # 第一层：概览卡片
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("今日请求数", latest["request_count"])
    col2.metric("质量评分", f"{latest['quality']:.2f}",
                delta=f"{latest['quality'] - data['quality'][-2]:.2f}")
    col3.metric("P95 延迟", f"{latest['latency_p95']:.1f}s",
                delta=f"{latest['latency_p95'] - data['latency_p95'][-2]:.1f}s")
    col4.metric("日成本", f"${latest['cost']:.2f}",
                delta=f"${latest['cost'] - data['cost'][-2]:.2f}")

    # 第二层：趋势图
    tab1, tab2, tab3 = st.tabs(["质量趋势", "延迟分布", "成本走势"])

    with tab1:
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=data["dates"], y=data["quality"],
            mode="lines+markers", name="质量评分",
            line=dict(color="#2196F3"),
        ))
        fig.add_hline(y=0.75, line_dash="dash", line_color="red",
                      annotation_text="告警阈值 0.75")
        fig.update_layout(yaxis_range=[0.5, 1.0], height=350)
        st.plotly_chart(fig, use_container_width=True)

    with tab2:
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=data["dates"], y=data["latency_p50"],
            mode="lines+markers", name="P50", line=dict(color="#4CAF50"),
        ))
        fig.add_trace(go.Scatter(
            x=data["dates"], y=data["latency_p95"],
            mode="lines+markers", name="P95", line=dict(color="#FF9800"),
        ))
        fig.add_hline(y=5.0, line_dash="dash", line_color="red",
                      annotation_text="告警阈值 5s")
        fig.update_layout(height=350)
        st.plotly_chart(fig, use_container_width=True)

    with tab3:
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=data["dates"], y=data["cost"],
            name="日成本", marker_color="#9C27B0",
        ))
        fig.add_hline(y=100, line_dash="dash", line_color="red",
                      annotation_text="预算 $100")
        fig.update_layout(height=350)
        st.plotly_chart(fig, use_container_width=True)

    # 第三层：告警与低分案例
    st.subheader("活跃告警")
    if latest["quality"] < 0.75:
        st.error(f"⚠️ 质量评分 {latest['quality']:.2f} 低于阈值 0.75")
    if latest["latency_p95"] > 5.0:
        st.warning(f"⚠️ P95 延迟 {latest['latency_p95']:.1f}s 超过阈值 5s")
    if latest["quality"] >= 0.75 and latest["latency_p95"] <= 5.0:
        st.success("✅ 所有指标正常")

    st.subheader("低分案例（最近 24h）")
    low_score_cases = [
        {"question": "如何配置 OAuth2.0？", "answer": "OAuth2.0 配置需要...", "score": 2},
        {"question": "API 限流策略是什么？", "answer": "API 限流...", "score": 3},
    ]
    for case in low_score_cases:
        with st.expander(f"评分 {case['score']}/5 - {case['question'][:50]}"):
            st.write(f"**问题**: {case['question']}")
            st.write(f"**回答**: {case['answer']}")
            st.write(f"**评分**: {case['score']}/5")


if __name__ == "__main__":
    render_quality_dashboard()
```

**要点**：
- Dashboard 按"总-分-个体"三层设计：概览卡片 → 趋势图 → 低分案例，用户 30 秒内能定位问题
- 每个趋势图都要有阈值线，否则看到数字变化却不知道是否需要行动
- 常见错误：Dashboard 堆满好看但没有行动指引的图表，核心是"驱动决策"而非"展示数据"

### 练习二

**思路**：告警规则需要覆盖质量、性能、成本三个维度，每条规则有明确的指标、条件、严重级别和通知渠道。关键是用动态阈值（基于历史数据的均值±标准差）而非静态阈值。

**答案**：

```python
import json
from datetime import datetime
from typing import Callable


class AlertRule:
    def __init__(self, name: str, metric: str, condition: Callable,
                 severity: str, message_template: str):
        self.name = name
        self.metric = metric
        self.condition = condition
        self.severity = severity
        self.message_template = message_template

    def evaluate(self, metrics: dict) -> dict | None:
        value = metrics.get(self.metric)
        if value is None:
            return None
        if self.condition(value):
            return {
                "rule": self.name,
                "metric": self.metric,
                "value": value,
                "severity": self.severity,
                "message": self.message_template.format(value=value),
                "timestamp": datetime.now().isoformat(),
            }
        return None


class AlertEngine:
    def __init__(self):
        self.rules: list[AlertRule] = []
        self.alert_history: list[dict] = []

    def add_rule(self, rule: AlertRule):
        self.rules.append(rule)

    def evaluate_all(self, metrics: dict) -> list[dict]:
        triggered = []
        for rule in self.rules:
            alert = rule.evaluate(metrics)
            if alert:
                triggered.append(alert)
                self.alert_history.append(alert)
        return triggered

    def get_active_alerts(self) -> list[dict]:
        return self.alert_history[-10:]


# 设计 3 条告警规则
engine = AlertEngine()

# 规则 1：质量下降告警（高严重级别）
engine.add_rule(AlertRule(
    name="quality_drop",
    metric="avg_quality_score",
    condition=lambda v: v < 0.7,
    severity="high",
    message_template="质量评分下降至 {value:.2f}，低于阈值 0.70，需要排查",
))

# 规则 2：P95 延迟告警（中严重级别）
engine.add_rule(AlertRule(
    name="high_latency_p95",
    metric="latency_p95_seconds",
    condition=lambda v: v > 5.0,
    severity="medium",
    message_template="P95 延迟上升至 {value:.1f}s，超过阈值 5.0s",
))

# 规则 3：日成本告警（中严重级别）
engine.add_rule(AlertRule(
    name="daily_cost_exceeded",
    metric="daily_cost_usd",
    condition=lambda v: v > 100,
    severity="medium",
    message_template="日成本达到 ${value:.2f}，超过预算 $100",
))

# 模拟评估
current_metrics = {
    "avg_quality_score": 0.65,
    "latency_p95_seconds": 6.2,
    "daily_cost_usd": 85.0,
}

triggered = engine.evaluate_all(current_metrics)
if triggered:
    for alert in triggered:
        icon = "🔴" if alert["severity"] == "high" else "🟡"
        print(f"{icon} [{alert['severity'].upper()}] {alert['message']}")
else:
    print("✅ 所有指标正常，无告警")
```

**要点**：
- 3 条告警规则覆盖质量（high）、性能（medium）、成本（medium）三个维度
- 告警条件使用 Callable 而非字符串，更灵活——可以实现动态阈值、同比环比等复杂逻辑
- 常见错误：告警规则设完就不管了，需要每月 review 一次阈值是否仍然合理

### 练习三

**思路**：从 Dashboard 发现质量问题后，需要下钻到具体的 Trace 和低分案例，分析是检索问题、Prompt 问题还是模型问题。关键是建立"指标→Trace→根因"的排查路径。

**答案**：

```python
def diagnose_quality_issue() -> dict:
    """从 Dashboard 发现质量问题并分析根因"""

    # 步骤 1：从 Dashboard 发现异常
    dashboard_observation = {
        "metric": "avg_quality_score",
        "current_value": 0.65,
        "previous_value": 0.82,
        "change": -0.17,
        "trend": "连续 3 天下降",
    }

    # 步骤 2：下钻到具体 Trace
    low_score_traces = [
        {
            "trace_id": "trace_001",
            "question": "如何配置 OAuth2.0？",
            "answer": "OAuth2.0 需要...",
            "quality_score": 2,
            "faithfulness": 0.9,
            "relevancy": 0.3,
            "context_precision": 0.4,
            "context_recall": 0.8,
        },
        {
            "trace_id": "trace_002",
            "question": "API 限流策略怎么实现？",
            "answer": "限流可以用...",
            "quality_score": 3,
            "faithfulness": 0.85,
            "relevancy": 0.5,
            "context_precision": 0.5,
            "context_recall": 0.7,
        },
        {
            "trace_id": "trace_003",
            "question": "数据库连接池配置",
            "answer": "连接池配置...",
            "quality_score": 2,
            "faithfulness": 0.95,
            "relevancy": 0.2,
            "context_precision": 0.3,
            "context_recall": 0.9,
        },
    ]

    # 步骤 3：分析根因
    avg_faithfulness = sum(t["faithfulness"] for t in low_score_traces) / len(low_score_traces)
    avg_relevancy = sum(t["relevancy"] for t in low_score_traces) / len(low_score_traces)
    avg_precision = sum(t["context_precision"] for t in low_score_traces) / len(low_score_traces)
    avg_recall = sum(t["context_recall"] for t in low_score_traces) / len(low_score_traces)

    diagnosis = {
        "observation": dashboard_observation,
        "affected_traces": len(low_score_traces),
        "avg_metrics": {
            "faithfulness": round(avg_faithfulness, 2),
            "relevancy": round(avg_relevancy, 2),
            "context_precision": round(avg_precision, 2),
            "context_recall": round(avg_recall, 2),
        },
        "root_cause": "",
        "fix_suggestion": "",
    }

    # 诊断逻辑
    if avg_faithfulness > 0.8 and avg_relevancy < 0.5:
        diagnosis["root_cause"] = "检索问题——检索到了文档但不是用户需要的（precision 低）"
        diagnosis["fix_suggestion"] = "优化检索策略：1. 添加查询重写 2. 提高重排序权重 3. 添加元数据过滤"
    elif avg_faithfulness < 0.7:
        diagnosis["root_cause"] = "幻觉问题——模型生成了不基于上下文的内容"
        diagnosis["fix_suggestion"] = "优化 Prompt：1. 强化'基于参考资料回答'指令 2. 添加'无法回答'兜底"
    else:
        diagnosis["root_cause"] = "综合问题——需要进一步拆分分析"
        diagnosis["fix_suggestion"] = "逐条分析低分 Trace，找出共性模式"

    print("=== 质量问题诊断 ===\n")
    print(f"现象: {dashboard_observation['metric']} 从 {dashboard_observation['previous_value']} 下降到 {dashboard_observation['current_value']}")
    print(f"趋势: {dashboard_observation['trend']}")
    print(f"受影响 Trace 数: {diagnosis['affected_traces']}")
    print(f"\n低分案例平均指标:")
    for k, v in diagnosis["avg_metrics"].items():
        print(f"  {k}: {v}")
    print(f"\n根因: {diagnosis['root_cause']}")
    print(f"修复建议: {diagnosis['fix_suggestion']}")

    return diagnosis


diagnose_quality_issue()
```

**要点**：
- 质量问题排查的关键路径：Dashboard 异常 → 下钻到具体 Trace → 分析各维度指标 → 定位根因
- 忠实度高但相关性低 = 检索问题；忠实度低 = 幻觉问题；两者都低 = 需要进一步拆分
- 常见错误：只看质量总分下降就急着改 Prompt，但实际根因可能是检索策略变更导致召回了不相关的文档

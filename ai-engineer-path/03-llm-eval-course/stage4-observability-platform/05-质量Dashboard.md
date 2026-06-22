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

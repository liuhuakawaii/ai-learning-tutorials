# Grafana 可视化

## 场景引入

Prometheus 存储了大量指标数据，但直接在 Prometheus UI 中查看 PromQL 查询结果不够直观。你需要一个可视化工具：用折线图展示 QPS 趋势、用仪表盘显示错误率、用热力图展示延迟分布。Grafana 是 K8s 生态中最主流的可视化工具，支持多种数据源和丰富的图表类型。

## 学习目标

1. 了解 Grafana 的核心概念和架构
2. 掌握数据源配置
3. 学会设计 Dashboard 和 Panel
4. 掌握常用的可视化图表类型
5. 学会使用变量实现动态 Dashboard

## Grafana 核心概念

- **Data Source**：数据源，如 Prometheus、Loki、Elasticsearch
- **Dashboard**：仪表盘，包含多个 Panel
- **Panel**：单个图表，包含查询和可视化配置
- **Variable**：变量，实现 Dashboard 的动态筛选

## 访问 Grafana

```bash
# 如果使用 kube-prometheus-stack 安装
kubectl port-forward svc/prometheus-grafana -n monitoring 3000:80

# 默认账号：admin
# 密码：安装时设置的值，或查看 Secret
kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d
```

## 数据源配置

kube-prometheus-stack 自动配置了 Prometheus 作为数据源。手动配置：

```yaml
# Grafana 数据源配置
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus-kube-prometheus-prometheus:9090
    isDefault: true
    editable: false
```

## 设计 Dashboard

### Dashboard 设计原则

1. **分层设计**：概览层 → 服务层 → 实例层
2. **从用户视角出发**：先看用户体验指标（延迟、错误率），再看系统指标
3. **使用合适的图表类型**：趋势用折线图、状态用仪表盘、分布用热力图
4. **设置合理的刷新间隔**：不要太频繁（浪费资源），不要太慢（信息滞后）

### 推荐的 Dashboard 层次

```
概览层（Overview）
├── 总 QPS
├── 总错误率
├── P50/P95/P99 延迟
└── 资源使用概况

服务层（Service）
├── 每个服务的 QPS
├── 每个服务的错误率
├── 每个服务的延迟
└── 每个服务的 Pod 状态

实例层（Instance）
├── 单个 Pod 的 CPU/内存
├── 单个 Pod 的网络
├── 单个 Pod 的日志
└── 单个 Pod 的重启历史
```

## Panel 类型

### Time Series（时序图）

最常用的图表类型，展示指标随时间的变化趋势。

```json
{
  "type": "timeseries",
  "title": "HTTP Requests per Second",
  "targets": [
    {
      "expr": "sum by (status) (rate(http_requests_total{namespace=\"$namespace\"}[5m]))",
      "legendFormat": "{{status}}"
    }
  ]
}
```

### Gauge（仪表盘）

展示单个数值的当前状态，适合展示百分比或比率。

```json
{
  "type": "gauge",
  "title": "Error Rate",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "thresholds": {
        "steps": [
          {"value": 0, "color": "green"},
          {"value": 1, "color": "yellow"},
          {"value": 5, "color": "red"}
        ]
      }
    }
  }
}
```

### Stat（统计值）

展示单个数值，支持趋势箭头和 sparkline。

### Table（表格）

展示多行多列数据，适合展示 Top N 列表。

### Heatmap（热力图）

展示数据分布，适合展示延迟分布。

## 变量（Variables）

变量让 Dashboard 支持动态筛选，一个 Dashboard 适配多个环境或服务。

### 创建变量

```json
// 在 Dashboard Settings → Variables 中添加
{
  "name": "namespace",
  "type": "query",
  "query": "label_values(kube_pod_info, namespace)",
  "refresh": 2,
  "sort": 1
}
```

### 使用变量

```promql
# 在 PromQL 中使用 $namespace 变量
sum(rate(http_requests_total{namespace="$namespace"}[5m]))

# 多选变量
sum(rate(http_requests_total{namespace=~"$namespace"}[5m]))

# 在 legend 中使用变量
{{pod}} - {{container}}
```

## 常用 Dashboard

### K8s 集群概览

```json
{
  "panels": [
    {
      "title": "集群 CPU 使用率",
      "expr": "sum(rate(container_cpu_usage_seconds_total{namespace!=\"\"}[5m])) / sum(machine_cpu_cores) * 100"
    },
    {
      "title": "集群内存使用率",
      "expr": "sum(container_memory_working_set_bytes{namespace!=\"\"}) / sum(machine_memory_bytes) * 100"
    },
    {
      "title": "运行中的 Pod 数量",
      "expr": "count(kube_pod_status_phase{phase=\"Running\"})"
    },
    {
      "title": "未就绪的 Pod",
      "expr": "count(kube_pod_status_ready{condition=\"false\"} == 1)"
    }
  ]
}
```

### 应用 Dashboard

```json
{
  "panels": [
    {
      "title": "QPS",
      "expr": "sum(rate(http_requests_total{namespace=\"$namespace\"}[5m]))"
    },
    {
      "title": "错误率",
      "expr": "sum(rate(http_requests_total{namespace=\"$namespace\", status=~\"5..\"}[5m])) / sum(rate(http_requests_total{namespace=\"$namespace\"}[5m])) * 100"
    },
    {
      "title": "P99 延迟",
      "expr": "histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{namespace=\"$namespace\"}[5m])))"
    },
    {
      "title": "Pod CPU 使用",
      "expr": "sum by (pod) (rate(container_cpu_usage_seconds_total{namespace=\"$namespace\", container!=\"\"}[5m]))"
    }
  ]
}
```

## 导入社区 Dashboard

Grafana 社区有大量现成的 Dashboard：

```bash
# 常用的 Dashboard ID
# 315 - Kubernetes cluster monitoring
# 6417 - Kubernetes cluster (Prometheus)
# 13770 - Kubernetes pods
```

在 Grafana UI 中：Dashboards → Import → 输入 ID → Load

## 常见误区

**误区一："一个 Dashboard 展示所有指标"**

一个 Dashboard 应该有明确的主题。集群概览、应用监控、Node 详情应该分开。

**误区二："Grafana 可以告警"**

Grafana 支持告警，但 K8s 环境中推荐用 Prometheus + Alertmanager。Grafana 主要用于可视化。

**误区三："Dashboard 做好就不管了"**

Dashboard 应该随应用演进持续更新。新增的指标、变更的标签都需要同步更新 Dashboard。

## 工程建议

1. **使用变量实现通用 Dashboard**：一个 Dashboard 适配所有环境
2. **设置合理的刷新间隔**：概览 30s，详情 10s
3. **导入社区 Dashboard 作为起点**：不要从零开始
4. **Dashboard as Code**：用 JSON 文件管理 Dashboard，纳入 Git 版本控制
5. **定期审查 Dashboard**：删除不再使用的 Panel

## 小结

- Grafana 是 K8s 生态中最主流的可视化工具
- Data Source → Dashboard → Panel 是核心层次结构
- 变量实现动态筛选，一个 Dashboard 适配多环境
- 社区有大量现成 Dashboard 可以直接使用
- Dashboard 应该分层设计：概览 → 服务 → 实例

## 练习

### 练习一：创建应用 Dashboard

在 Grafana 中创建一个应用监控 Dashboard，包含：QPS、错误率、P99 延迟、Pod CPU 使用。

### 练习二：变量配置

为 Dashboard 添加 namespace 变量，实现一个 Dashboard 监控所有命名空间的应用。

---

## 参考答案

### 练习一

**答案**：

在 Grafana UI 中：
1. 创建新 Dashboard
2. 添加 4 个 Panel
3. 每个 Panel 设置对应的 PromQL 查询
4. 设置合适的图表类型和阈值颜色

### 练习二

**答案**：

1. 进入 Dashboard Settings → Variables
2. 添加变量：name=namespace, type=query, query=label_values(kube_pod_info, namespace)
3. 在所有 Panel 的 PromQL 中使用 `$namespace`
4. 验证切换 namespace 时图表自动更新

**要点**：
- 变量的 query 应该使用 `label_values` 函数
- 使用 `=~` 正则匹配支持多选
- 设置 refresh=2 让变量在 Dashboard 加载时自动刷新

# Prometheus 监控

## 场景引入

你的应用已经部署到生产环境了。某天用户反馈"系统很慢"，你登录 K8s 集群，发现某个 Pod 的 CPU 使用率飙到了 100%，但你不知道是什么时候开始的、是什么请求触发的。你甚至不确定这个问题是持续性的还是偶发的。

没有监控系统，你就像在黑暗中开车。Prometheus 是 K8s 生态中最主流的监控系统，它负责采集指标数据、存储时序数据、执行告警规则。

## 学习目标

1. 理解 Prometheus 的架构和工作原理
2. 掌握指标类型：Counter、Gauge、Histogram
3. 学会使用 PromQL 查询指标
4. 掌握告警规则的配置
5. 学会在 K8s 中部署 Prometheus

## Prometheus 架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  应用/metrics │────►│  Prometheus  │────►│  Grafana     │
│  端点        │     │  Server      │     │  可视化      │
└──────────────┘     │              │     └──────────────┘
                     │  - 采集      │
┌──────────────┐     │  - 存储      │     ┌──────────────┐
│ kube-state-  │────►│  - 查询      │────►│ Alertmanager │
│ metrics      │     │  - 告警规则  │     │ 告警通知     │
└──────────────┘     └──────────────┘     └──────────────┘
```

核心组件：
- **Prometheus Server**：采集、存储、查询指标
- **Exporters**：将各种系统的指标暴露为 Prometheus 格式
- **Alertmanager**：接收告警并发送通知（邮件、Slack、PagerDuty）
- **Grafana**：指标可视化

## 指标类型

### Counter（计数器）

只增不减的计数器，适用于请求数、错误数、字节数等。

```python
# 应用代码中暴露 Counter 指标
from prometheus_client import Counter

REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

@app.route('/api/users')
def get_users():
    REQUEST_COUNT.labels(method='GET', endpoint='/api/users', status='200').inc()
    return jsonify(users)
```

```
# Prometheus 采集到的数据
http_requests_total{method="GET", endpoint="/api/users", status="200"} 1234
http_requests_total{method="POST", endpoint="/api/users", status="201"} 56
```

### Gauge（仪表盘）

可增可减的数值，适用于温度、内存使用、当前连接数等。

```python
from prometheus_client import Gauge

IN_PROGRESS = Gauge('inprogress_requests', 'Number of in-progress requests')

@app.route('/api/slow')
def slow_endpoint():
    IN_PROGRESS.inc()
    # 处理请求...
    IN_PROGRESS.dec()
    return result
```

### Histogram（直方图）

统计数值分布，适用于请求延迟、响应大小等。

```python
from prometheus_client import Histogram

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 5]
)
```

```
# Histogram 生成的指标
http_request_duration_seconds_bucket{le="0.01"} 100
http_request_duration_seconds_bucket{le="0.05"} 200
http_request_duration_seconds_bucket{le="0.1"} 350
http_request_duration_seconds_bucket{le="0.5"} 400
http_request_duration_seconds_bucket{le="1"} 410
http_request_duration_seconds_bucket{le="5"} 415
http_request_duration_seconds_bucket{le="+Inf"} 415
http_request_duration_seconds_sum 50.5
http_request_duration_seconds_count 415
```

## 在 K8s 中部署 Prometheus

### 使用 kube-prometheus-stack

```bash
# 添加 Helm 仓库
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 安装 kube-prometheus-stack（包含 Prometheus + Grafana + Alertmanager）
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=15d \
  --set grafana.adminPassword=admin123
```

### 访问 Prometheus UI

```bash
kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n monitoring 9090:9090
```

## PromQL 查询

### 基本查询

```promql
# 查询所有 http_requests_total 指标
http_requests_total

# 按标签过滤
http_requests_total{method="GET"}

# 正则匹配
http_requests_total{endpoint=~"/api/.*"}

# 排除
http_requests_total{method!="OPTIONS"}
```

### 速率和增长率

```promql
# 每秒请求速率（过去 5 分钟）
rate(http_requests_total[5m])

# 每秒错误率
rate(http_requests_total{status=~"5.."}[5m])

# 错误率占比
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

### 聚合查询

```promql
# 总 QPS
sum(rate(http_requests_total[5m]))

# 按 endpoint 分组的 QPS
sum by (endpoint) (rate(http_requests_total[5m]))

# 按 namespace 分组的内存使用
sum by (namespace) (container_memory_usage_bytes)

# P99 延迟
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# P95 延迟
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### K8s 相关查询

```promql
# Node CPU 使用率
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Pod 内存使用
container_memory_usage_bytes{namespace="default", container!=""}

# Pod 重启次数
kube_pod_container_status_restarts_total{namespace="default"}

# 未就绪的 Pod
kube_pod_status_ready{condition="false"} == 1
```

## 告警规则

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: app-alerts
  namespace: monitoring
spec:
  groups:
    - name: app.rules
      rules:
        # 高错误率告警
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status=~"5.."}[5m])
            / rate(http_requests_total[5m]) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "高错误率：{{ $value | humanizePercentage }}"
            description: "过去 5 分钟错误率超过 5%"

        # 高延迟告警
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "P99 延迟过高：{{ $value }}s"

        # Pod 重启告警
        - alert: PodRestarting
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 3
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod 频繁重启：{{ $labels.pod }}"

        # Node 磁盘空间不足
        - alert: NodeDiskSpaceLow
          expr: |
            (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Node 磁盘空间不足：{{ $labels.instance }}"
```

## 常见误区

**误区一："监控就是看 CPU 和内存"**

应用层面的指标（QPS、错误率、延迟）比基础设施指标更重要。用户感知到的"慢"是延迟，不是 CPU 使用率。

**误区二："Prometheus 数据需要永久保留"**

Prometheus 是短期存储，通常保留 15-30 天。长期存储用 Thanos 或 Cortex。

**误区三："所有指标都要采集"**

高基数（high cardinality）指标会消耗大量存储和查询资源。避免使用用户 ID、请求 ID 等作为标签。

## 工程建议

1. **监控四大黄金信号**：延迟、流量、错误率、饱和度
2. **设置合理的告警阈值**：避免告警疲劳
3. **使用 Recording Rules**：预计算常用查询，提升查询性能
4. **标签设计要合理**：避免高基数标签
5. **Prometheus 本身也需要监控**：监控 Prometheus 的存储、采集延迟

## 小结

- Prometheus 通过 Pull 模式采集指标，存储为时序数据
- 三种指标类型：Counter（只增）、Gauge（可变）、Histogram（分布）
- PromQL 支持丰富的查询和聚合操作
- 告警规则基于 PromQL 表达式，通过 Alertmanager 发送通知
- kube-prometheus-stack 是 K8s 中部署 Prometheus 的推荐方式

## 练习

### 练习一：Prometheus 部署

在本地集群部署 kube-prometheus-stack，并查询基本的集群指标。

### 练习二：PromQL 查询

编写 PromQL 查询以下指标：
1. 每个 Node 的 CPU 使用率
2. 每个命名空间的 Pod 数量
3. kube-system 中 Pod 的重启次数

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 安装
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# 2. 访问
kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n monitoring 9090:9090

# 3. 查询基本指标
# 在 Prometheus UI 中输入：
# up
# node_cpu_seconds_total
# container_memory_usage_bytes
```

### 练习二

**答案**：

```promql
# 1. Node CPU 使用率
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 2. 每个命名空间的 Pod 数量
count by (namespace) (kube_pod_info)

# 3. kube-system 中 Pod 的重启次数
increase(kube_pod_container_status_restarts_total{namespace="kube-system"}[1h])
```

**要点**：
- CPU 使用率需要从 idle 指标反算
- `count by` 用于分组计数
- `increase` 计算时间窗口内的增量

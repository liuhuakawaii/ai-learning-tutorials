# Prometheus 监控

> 前置知识：K8s 核心资源（Stage 1-2）

## 一个没有监控的生产环境

你的应用部署到生产环境了。某天用户反馈"系统很慢"，你登上 K8s 集群：

```bash
kubectl top pods
# 发现某个 Pod 的 CPU 使用率 100%
```

但你不知道：是什么时候开始的？是哪个请求触发的？这个问题是持续性的还是偶发的？其他指标（内存、网络、磁盘）有没有异常？

没有监控系统，你就像在黑暗中开车——只能等撞了才知道前面有障碍物。

Prometheus 是 K8s 生态中最主流的监控系统。它做的事情：采集指标数据、存储时序数据、执行告警规则。

## Prometheus 架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Application │────→│  Prometheus  │────→│   Grafana    │
│  /metrics    │     │  (采集+存储)  │     │  (可视化)     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Alertmanager│
                     │  (告警通知)   │
                     └──────────────┘
```

工作流程：
1. 应用暴露 `/metrics` 端点
2. Prometheus 定期拉取（pull）指标
3. 指标存储在时序数据库中
4. Grafana 查询指标并可视化
5. Alertmanager 根据规则发送告警

## 指标类型

Prometheus 有四种指标类型，最常用的是前三种：

### Counter（计数器）

只增不减的累计值。

```
http_requests_total{method="GET", path="/api/users"} 1234
```

适合：请求总数、错误总数、处理的消息数。

### Gauge（仪表盘）

可增可减的当前值。

```
node_memory_usage_bytes 1073741824
```

适合：当前内存使用、当前连接数、队列长度。

### Histogram（直方图）

统计值的分布。

```
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="0.5"} 200
http_request_duration_seconds_bucket{le="1.0"} 240
```

适合：请求延迟分布、响应大小分布。可以算 P50、P95、P99。

## PromQL 基础

```promql
# 查询某个指标
http_requests_total

# 带标签过滤
http_requests_total{method="GET"}

# 计算速率（每秒请求数）
rate(http_requests_total[5m])

# 计算 P99 延迟
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# 内存使用率
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
```

## 在 K8s 中部署 Prometheus

最简单的方式是用 kube-prometheus-stack Helm Chart：

```bash
# 添加 Helm 仓库
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 安装
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# 验证
kubectl get pods -n monitoring
# 应该看到：prometheus、grafana、alertmanager
```

## 告警规则

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: app-alerts
  namespace: monitoring
spec:
  groups:
    - name: app
      rules:
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status=~"5.."}[5m])
            / rate(http_requests_total[5m]) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "错误率超过 5%"

        - alert: HighMemoryUsage
          expr: |
            container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "内存使用率超过 90%"
```

`for: 5m` 表示条件持续 5 分钟才触发告警，避免瞬时波动导致误报。

## 练习

### 练习一：部署 Prometheus

用 kube-prometheus-stack 在你的本地集群部署 Prometheus。用 `kubectl port-forward` 访问 Grafana（默认端口 3000，账号 admin/prom-operator）。

### 练习二：自定义指标

在你的应用中添加一个自定义 Counter 指标 `app_orders_total`，暴露在 `/metrics` 端点。配置 Prometheus 采集这个端点，在 Grafana 中展示。

### 练习三：告警规则

写一条告警规则：当 Pod 重启次数在 10 分钟内超过 3 次时触发告警。

---

## 参考答案

### 练习一

```bash
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
# 访问 http://localhost:3000，admin/prom-operator
```

### 练习二

```typescript
import { Counter, register } from 'prom-client';

const ordersTotal = new Counter({
  name: 'app_orders_total',
  help: 'Total number of orders',
  labelNames: ['status'],
});

app.post('/orders', (req, res) => {
  // ... 创建订单逻辑
  ordersTotal.inc({ status: 'success' });
  res.json({ orderId: '...' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 练习三

```yaml
- alert: FrequentPodRestarts
  expr: increase(kube_pod_container_status_restarts_total[10m]) > 3
  for: 0m
  labels:
    severity: warning
  annotations:
    summary: "Pod {{ $labels.pod }} restarted more than 3 times in 10 minutes"
```

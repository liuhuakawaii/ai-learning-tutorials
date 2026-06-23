# Serverless on K8s

> 前置知识：Deployment、Service、HPA（Stage 1-2）

## 一个资源浪费的场景

你的团队有一个图片处理服务。平时几乎没流量，但每天凌晨批量处理时会突发大量请求。

按固定副本数部署？白天 3 个 Pod 空转，浪费资源。只部署 1 个？凌晨扛不住流量。

你想要一种方案：没流量时缩到 0 个 Pod，有请求时自动启动，用完再缩回 0。

这就是 Serverless 的核心理念——你不用关心"服务器"，只关心代码。Knative 是 K8s 上最成熟的 Serverless 平台。

## Knative 架构

Knative 由两个核心组件组成：

```
Knative Serving：请求驱动的自动扩缩容
  ├── 缩容到 0（没有请求时 Pod 被完全移除）
  ├── 按请求数扩缩容（不是按 CPU/内存）
  └── 流量切分（金丝雀发布）

Knative Eventing：事件驱动
  ├── 事件源（Kafka、GitHub、定时器等）
  ├── 事件路由（Channel、Subscription）
  └── 事件处理（Broker、Trigger）
```

## Knative Serving 核心概念

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: image-processor
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/min-scale: "0"    # 没流量时缩到 0
        autoscaling.knative.dev/max-scale: "10"   # 最多 10 个 Pod
        autoscaling.knative.dev/target: "5"       # 每个 Pod 处理 5 个并发请求
    spec:
      containers:
        - image: ghcr.io/myorg/image-processor:latest
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
```

```
请求来了 → Knative 检查有没有 Pod
  ├── 有 Pod → 直接路由到 Pod
  └── 没有 Pod（缩容到 0）→ 启动新 Pod → 路由
      └── 启动时间：冷启动约 2-5 秒
```

## 安装 Knative

```bash
# 安装 Knative Serving
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-crds.yaml
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-core.yaml

# 安装网络层（Kourier）
kubectl apply -f https://github.com/knative/net-kourier/releases/latest/download/kourier.yaml

# 配置 DNS（使用 sslip.io，本地开发用）
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-default-domain.yaml

# 验证
kubectl get pods -n knative-serving
```

## 部署和测试

```bash
# 部署 Knative Service
kubectl apply -f service.yaml

# 查看
kubectl get ksvc
# NAME               URL                                           READY
# image-processor    http://image-processor.default.127.0.0.1.sslip.io   True

# 测试
curl http://image-processor.default.127.0.0.1.sslip.io

# 观察自动扩缩容
kubectl get pods -w
# 没有请求时：0 个 Pod
# 发送请求后：1 个 Pod 启动
# 持续发送：Pod 数量增加
# 停止请求：Pod 逐步缩回 0
```

## 冷启动问题

缩容到 0 的代价是冷启动——第一个请求需要等 Pod 启动，延迟 2-5 秒。

```
解决方案：

1. 设置 min-scale: "1"
   └── 代价：始终有一个 Pod 在运行，有资源成本

2. 使用 Init Container 预热
   └── 在 Pod 启动时预加载模型、建立连接池

3. 使用 Provisioned Concurrency（Knative 不原生支持，需要自定义）
   └── 预先启动 N 个 Pod，但不接收流量，需要时立即切换
```

## Serverless 的适用场景

```
适合：
  ✓ 流量波动大的服务（白天忙晚上闲）
  ✓ 事件驱动的任务（文件上传后处理、消息队列消费）
  ✓ 批处理任务（定时执行，执行完就释放）
  ✓ 开发/测试环境（不用时自动释放资源）

不适合：
  ✗ 低延迟要求的服务（冷启动 2-5 秒不可接受）
  ✗ 长时间运行的任务（有超时限制）
  ✗ 有状态服务（Pod 随时可能被销毁）
  ✗ 稳定流量的服务（不如固定副本数划算）
```

## 练习

### 练习一：部署 Knative Service

部署一个简单的 HTTP 服务到 Knative。验证：没流量时 Pod 数量为 0，有请求时自动启动。

### 练习二：冷启动优化

对比 `min-scale: "0"` 和 `min-scale: "1"` 的首次请求延迟。记录冷启动时间。

### 练习三：流量切分

部署两个版本的 Knative Service，配置流量切分：v1 承担 90%，v2 承担 10%。验证请求确实按比例分配。

---

## 参考答案

### 练习一

```bash
kubectl apply -f service.yaml
kubectl get ksvc
kubectl get pods   # 0 个 Pod
curl http://image-processor.default.127.0.0.1.sslip.io
kubectl get pods   # 1 个 Pod 启动
# 等待 5 分钟不发请求
kubectl get pods   # 0 个 Pod（缩容到 0）
```

### 练习二

```bash
# min-scale: "0" 的冷启动
time curl http://service.default.127.0.0.1.sslip.io
# 首次请求：2-5 秒（冷启动）

# min-scale: "1" 的首次请求
time curl http://service.default.127.0.0.1.sslip.io
# 首次请求：< 1 秒（Pod 已在运行）
```

### 练习三

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - image: ghcr.io/myorg/my-app:v1
---
apiVersion: serving.knative.dev/v1
kind: Revision
metadata:
  name: my-app-v2
spec:
  containers:
    - image: ghcr.io/myorg/my-app:v2
---
# 在 Service 中配置流量分配
# 通过 kubectl 命令：
# kubectl ksvc update my-app --traffic @latest=90 --traffic my-app-v2=10
```

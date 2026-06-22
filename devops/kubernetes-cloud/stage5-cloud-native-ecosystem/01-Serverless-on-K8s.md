# Serverless on K8s

## 场景引入

你的团队有一个图片处理服务，平时几乎没流量，但每天凌晨批量处理时会突发大量请求。按固定副本数部署，白天资源浪费，凌晨又不够用。你想要一种方案：没流量时缩到 0 个 Pod，有请求时自动启动，用完再缩回 0。

这就是 Serverless 的核心理念——你不用关心"服务器"，只关心代码。Knative 是 K8s 上最成熟的 Serverless 平台，它在 K8s 之上提供了自动扩缩容（包括缩容到 0）和事件驱动能力。

## 学习目标

1. 理解 Serverless 在 K8s 上的定位和价值
2. 掌握 Knative Serving 的核心概念
3. 学会配置自动扩缩容（包括缩容到 0）
4. 了解 Knative Eventing 的基本用法
5. 理解 Serverless 的适用场景和局限性

## Knative 架构

Knative 由两个核心组件组成：

- **Serving**：请求驱动的工作负载，支持自动扩缩容到 0
- **Eventing**：事件驱动的工作负载，支持事件的生产和消费

```
┌─────────────────────────────────────────┐
│                Knative                   │
│                                          │
│  ┌──────────────┐    ┌──────────────┐   │
│  │  Serving     │    │  Eventing    │   │
│  │  - Service   │    │  - Broker    │   │
│  │  - Route     │    │  - Trigger   │   │
│  │  - Revision  │    │  - Channel   │   │
│  └──────┬───────┘    └──────────────┘   │
│         │                                │
│  ┌──────▼──────────────────────────────┐│
│  │          Kubernetes                  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## 安装 Knative

### 安装 Serving

```bash
# 安装 Knative Serving CRD
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-crds.yaml

# 安装 Knative Serving 核心组件
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-core.yaml

# 安装网络层（Kourier，轻量级 Ingress）
kubectl apply -f https://github.com/knative/net-kourier/releases/latest/download/kourier.yaml

# 配置 Knative 使用 Kourier
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

# 验证安装
kubectl get pods -n knative-serving
```

### 安装 Eventing

```bash
# 安装 Knative Eventing CRD
kubectl apply -f https://github.com/knative/eventing/releases/latest/download/eventing-crds.yaml

# 安装 Knative Eventing 核心组件
kubectl apply -f https://github.com/knative/eventing/releases/latest/download/eventing-core.yaml

# 安装 In-Memory Channel（开发用）
kubectl apply -f https://github.com/knative/eventing/releases/latest/download/in-memory-channel.yaml
```

## Knative Serving 核心概念

### Knative Service

Knative Service 是最上层的抽象，它自动管理 Route 和 Revision。

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: hello
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
    spec:
      containers:
        - image: gcr.io/knative-samples/helloworld-go
          ports:
            - containerPort: 8080
          env:
            - name: TARGET
              value: "World"
```

```bash
# 创建 Service
kubectl apply -f hello-service.yaml

# 查看 Service
kubectl get ksvc
# NAME     URL                                           LATESTCREATED   LATESTREADY    READY
# hello    http://hello.default.example.com              hello-00001     hello-00001    True

# 访问 Service
curl http://hello.default.example.com
```

### Revision

每次修改 Knative Service 的 template，都会创建一个新的 Revision。

```bash
# 查看所有 Revision
kubectl get revisions

# 回滚到指定 Revision
kubectl apply -f - <<EOF
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: hello
spec:
  template:
    metadata:
      name: hello-00001    # 指定 Revision 名称
    spec:
      containers:
        - image: gcr.io/knative-samples/helloworld-go
EOF
```

### Route

Route 将流量分配到不同的 Revision。

```yaml
apiVersion: serving.knative.dev/v1
kind: Route
metadata:
  name: hello
spec:
  traffic:
    - revisionName: hello-00001
      percent: 80
    - revisionName: hello-00002
      percent: 20
```

## 自动扩缩容配置

### 缩容到 0

```yaml
metadata:
  annotations:
    autoscaling.knative.dev/minScale: "0"     # 没流量时缩到 0
    autoscaling.knative.dev/maxScale: "10"    # 最多 10 个 Pod
    autoscaling.knative.dev/target: "100"     # 每个 Pod 处理 100 并发
```

缩容到 0 的工作原理：
```
1. 没有请求 → 等待窗口期（默认 30s）
2. 窗口期过后 → 缩容到 0
3. 新请求到达 → Activator 接管请求
4. Knative 启动 Pod → 等待 Pod 就绪
5. 将请求转发到 Pod → 用户感知到冷启动延迟
```

### 冷启动优化

```yaml
metadata:
  annotations:
    # 保留至少 1 个 Pod，避免冷启动
    autoscaling.knative.dev/minScale: "1"
    # 使用更小的容器加速启动
    # 预热连接
```

冷启动的影响：
- Java 应用可能需要 5-10 秒
- Go/Python 应用通常 1-2 秒
- 使用 `minScale: 1` 可以完全避免冷启动

## Knative Eventing

### 事件源（Event Source）

```yaml
# ApiServerSource：监听 K8s 事件
apiVersion: sources.knative.dev/v1
kind: ApiServerSource
metadata:
  name: k8s-events
spec:
  serviceAccountName: events-sa
  mode: Resource
  resources:
    - apiVersion: v1
      kind: Event
  sink:
    ref:
      apiVersion: eventing.knative.dev/v1
      kind: Broker
      name: default
```

### Trigger（事件过滤）

```yaml
apiVersion: eventing.knative.dev/v1
kind: Trigger
metadata:
  name: my-trigger
spec:
  broker: default
  filter:
    attributes:
      type: dev.knative.apiserver.resource.add
      kind: Pod
  subscriber:
    ref:
      apiVersion: serving.knative.dev/v1
      kind: Service
      name: event-handler
```

## 适用场景

| 场景 | 是否适合 Serverless |
|------|-------------------|
| 请求驱动的 API | 非常适合 |
| 事件处理 | 非常适合 |
| 定时任务 | 适合（结合 CronJob） |
| 长时间运行的任务 | 不适合 |
| WebSocket 长连接 | 不适合 |
| 高并发低延迟 | 不太适合（冷启动） |

## 常见误区

**误区一："Serverless 就是不需要服务器"**

Serverless 仍然运行在 K8s 上，只是你不用管理底层基础设施。Knative 帮你处理扩缩容和路由。

**误区二："Serverless 比 Deployment 便宜"**

低流量时确实更省钱（缩容到 0），但冷启动带来的延迟可能影响用户体验。需要根据实际流量模式选择。

**误区三："所有应用都应该 Serverless"**

有状态服务、长连接、低延迟要求的应用不适合 Serverless。

## 工程建议

1. **合理设置 minScale**：对延迟敏感的服务设置 `minScale: 1`
2. **优化容器启动时间**：使用轻量级基础镜像，减少初始化逻辑
3. **监控冷启动次数和延迟**
4. **使用流量分割进行渐进式发布**

## 小结

- Knative 是 K8s 上最成熟的 Serverless 平台
- Serving 提供请求驱动的自动扩缩容（含缩容到 0）
- Eventing 提供事件驱动的编程模型
- 适合请求驱动、低流量、突发流量的场景
- 冷启动是 Serverless 的主要代价

## 练习

### 练习一：部署 Knative Service

在本地集群安装 Knative Serving，并部署一个 hello-world 应用。

### 练习二：扩缩容测试

配置 Knative Service 的扩缩容参数，观察从 0 到 1 的冷启动过程。

---

## 参考答案

### 练习一

**答案**：

```bash
# 安装 Knative Serving
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-crds.yaml
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-core.yaml
kubectl apply -f https://github.com/knative/net-kourier/releases/latest/download/kourier.yaml

# 创建 Service
kubectl apply -f - <<EOF
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: hello
spec:
  template:
    spec:
      containers:
        - image: gcr.io/knative-samples/helloworld-go
          env:
            - name: TARGET
              value: "Knative"
EOF

# 验证
kubectl get ksvc
```

### 练习二

**答案**：

```bash
# 1. 配置 minScale: 0
kubectl annotate ksvc hello autoscaling.knative.dev/minScale="0"

# 2. 等待 Pod 缩容到 0
kubectl get pods -w
# 会看到 Pod 逐渐减少到 0

# 3. 发送请求，观察冷启动
time curl http://hello.default.example.com
# 第一次请求会有冷启动延迟

# 4. 查看 Pod 启动
kubectl get pods -w
# 会看到新 Pod 被创建
```

**要点**：
- 冷启动延迟取决于容器启动时间
- Go 应用冷启动通常 1-2 秒
- 设置 minScale: 1 可以避免冷启动

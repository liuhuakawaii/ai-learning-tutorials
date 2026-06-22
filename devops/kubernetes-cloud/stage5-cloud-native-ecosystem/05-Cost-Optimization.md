# Cost Optimization

## 场景引入

你的 K8s 集群每月云账单在增长，但你不确定钱花在了哪里。某个团队的开发环境 Pod 请求了 8 CPU、16GB 内存，但实际只用了 0.5 CPU 和 512MB。另一个团队的 Job 运行完后 Pod 没有清理，一直占着资源。你需要一种方式来分析和优化 K8s 集群的资源成本。

## 学习目标

1. 理解 K8s 成本的构成
2. 学会分析资源使用率和浪费
3. 掌握资源优化的方法
4. 了解 Spot/Preemptible 实例的使用
5. 学会使用成本分析工具

## K8s 成本构成

```
K8s 集群成本
├── 计算成本（60-70%）
│   ├── Node 实例
│   ├── GPU 实例
│   └── 自动扩缩容
├── 存储成本（15-20%）
│   ├── PV/PVC
│   ├── 镜像存储
│   └── etcd 存储
├── 网络成本（10-15%）
│   ├── 负载均衡器
│   ├── 数据传输
│   └── Ingress
└── 管理成本（5-10%）
    ├── 托管服务费
    └── 监控/日志存储
```

## 资源使用率分析

### 查看资源请求 vs 实际使用

```bash
# 安装 metrics-server（如果还没有）
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 查看 Node 资源使用
kubectl top nodes

# 查看 Pod 资源使用
kubectl top pods -A --sort-by=cpu
kubectl top pods -A --sort-by=memory
```

### 计算资源浪费

```bash
# 获取 Pod 的 requests
kubectl get pods -A -o json | jq '.items[] | {
  name: .metadata.name,
  namespace: .metadata.namespace,
  cpu_request: .spec.containers[0].resources.requests.cpu,
  memory_request: .spec.containers[0].resources.requests.memory
}'

# 对比实际使用
kubectl top pods -A
```

资源浪费率 = (requests - 实际使用) / requests × 100%

### 常见浪费模式

```
1. 过度请求：Pod requests 远高于实际使用
2. 闲置 Pod：Running 但没有流量的 Pod
3. 未清理的 Job：已完成但未删除的 Job/Pod
4. 过大的 PV：请求了 100GB 但只用了 5GB
5. 空闲 Node：Node 上只有很少的 Pod
```

## 资源优化

### Right-sizing

根据实际使用情况调整 requests 和 limits。

```yaml
# 优化前
resources:
  requests:
    cpu: "1"
    memory: "2Gi"
  limits:
    cpu: "2"
    memory: "4Gi"

# 优化后（基于实际使用量的 P95）
resources:
  requests:
    cpu: "250m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "1Gi"
```

### VPA（Vertical Pod Autoscaler）

VPA 自动调整 Pod 的资源请求。

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Off"    # Off 模式只推荐，不自动修改
  resourcePolicy:
    containerPolicies:
      - containerName: app
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 2
          memory: 4Gi
```

VPA 模式：
- **Off**：只推荐，不自动修改（推荐先用这个）
- **Auto**：自动更新 Pod（会导致 Pod 重启）
- **Initial**：只在 Pod 创建时设置

### ResourceQuota

限制 Namespace 的资源使用上限。

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    pods: "50"
```

### LimitRange

设置默认的资源请求，防止忘记配置。

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: dev
spec:
  limits:
    - default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      type: Container
```

## Spot/Preemptible 实例

Spot 实例（AWS）、Preemptible 实例（GCP）比按需实例便宜 60-90%，但可能被回收。

### 使用 Spot 实例

```yaml
# 使用 nodeSelector 选择 Spot Node
spec:
  nodeSelector:
    node.kubernetes.io/instance-type: spot
  tolerations:
    - key: "spot"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

### Spot 实例适用场景

| 场景 | 是否适合 Spot |
|------|-------------|
| 无状态 Web 服务 | 适合（配合 HPA） |
| 批处理 Job | 非常适合 |
| 有状态服务 | 不适合 |
| 低延迟服务 | 不太适合 |
| 开发/测试环境 | 非常适合 |

### 混合使用策略

```
生产环境：
  - 核心服务：按需实例（保证可用性）
  - 非核心服务：Spot 实例（降低成本）
  - 比例：70% 按需 + 30% Spot

开发环境：
  - 全部使用 Spot 实例
  - 配合 Cluster Autoscaler 缩容空闲 Node
```

## Cluster Autoscaler

Cluster Autoscaler 根据 Pod 调度需求自动扩缩 Node 数量。

```yaml
# Cluster Autoscaler 配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
        - name: cluster-autoscaler
          image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
          command:
            - ./cluster-autoscaler
            - --v=4
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/my-cluster
```

## 成本分析工具

### Kubecost

```bash
# 安装 Kubecost
helm repo add kubecost https://kubecost.github.io/cost-analyzer/
helm install kubecost kubecost/cost-analyzer \
  --namespace kubecost \
  --create-namespace

# 访问 UI
kubectl port-forward svc/kubecost-cost-analyzer -n kubecost 9090:9090
```

### OpenCost

OpenCost 是 CNCF 沙箱项目，开源的成本监控工具。

```bash
# 安装 OpenCost
kubectl apply -f https://raw.githubusercontent.com/opencost/opencost/develop/kubernetes/opencost.yaml
```

## 常见误区

**误区一："降低 requests 就能省钱"**

降低 requests 不会直接减少账单，但能让调度器更高效地利用 Node，间接减少需要的 Node 数量。

**误区二："Spot 实例不可靠"**

配合 HPA 和 Pod Disruption Budget，Spot 实例可以用于大部分无状态工作负载。

**误区三："成本优化是一次性工作"**

成本优化需要持续进行。应用的资源使用会变化，需要定期审查和调整。

## 工程建议

1. **先监控再优化**：了解资源使用模式后再调整
2. **设置 ResourceQuota**：防止资源滥用
3. **开发环境用 Spot 实例**：节省 60-90% 成本
4. **定期清理无用资源**：完成的 Job、空的 PV、不用的 Service
5. **使用 Kubecost 分配成本**：让团队对自己的资源使用负责

## 小结

- K8s 成本主要由计算、存储、网络三部分组成
- 资源优化：right-sizing、VPA 推荐、ResourceQuota 限制
- Spot 实例可以大幅降低成本，适合无状态和批处理工作负载
- Cluster Autoscaler 自动调整 Node 数量
- 成本优化需要持续监控和调整

## 练习

### 练习一：资源分析

分析当前集群的资源使用情况，找出资源浪费最严重的 5 个 Pod。

### 练习二：ResourceQuota 配置

为一个团队的命名空间配置 ResourceQuota，限制总 CPU 和内存使用。

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 获取所有 Pod 的 requests
kubectl get pods -A -o json | jq -r '
  .items[] |
  select(.spec.containers[0].resources.requests != null) |
  [.metadata.namespace, .metadata.name,
   .spec.containers[0].resources.requests.cpu,
   .spec.containers[0].resources.requests.memory] |
  @tsv' > pod-requests.tsv

# 2. 获取实际使用
kubectl top pods -A --no-headers > pod-usage.tsv

# 3. 对比分析
# 重点关注：requests 远高于实际使用的 Pod
# 例如：requests 1 CPU 但实际使用 50m（浪费 95%）
```

### 练习二

**答案**：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "8"
    requests.memory: "16Gi"
    limits.cpu: "16"
    limits.memory: "32Gi"
    pods: "30"
    services: "10"
    persistentvolumeclaims: "10"
```

```yaml
# 配合 LimitRange 设置默认值
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-a
spec:
  limits:
    - default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: 2
        memory: 4Gi
      type: Container
```

**要点**：
- ResourceQuota 限制 Namespace 总量
- LimitRange 设置单个容器的默认值和上限
- 两者配合使用，既防止资源滥用又避免忘记配置

# Deployment 与 ReplicaSet

## 场景引入

你在 Stage 1 已经学会了直接创建 Pod。但直接管理 Pod 有一个致命问题：Pod 挂了就没了。你需要手动重新创建，手动管理副本数量，手动处理版本升级。这在生产环境中完全不可接受。

Deployment 和 ReplicaSet 是 K8s 为你解决这个问题的抽象层。你告诉 Deployment "我要 3 个 nginx:1.25 副本"，它会自动创建 ReplicaSet，ReplicaSet 再创建 3 个 Pod。当 Pod 挂了自动补上，当你更新镜像自动滚动替换。

## 学习目标

1. 理解 Deployment、ReplicaSet、Pod 三者的关系
2. 掌握滚动更新的原理和配置
3. 学会使用 kubectl rollout 管理版本
4. 理解 HPA 自动扩缩容的工作原理
5. 掌握 Deployment 的回滚操作

## Deployment 与 ReplicaSet 的关系

```
Deployment
  └── ReplicaSet (revision 1)    ← 旧版本
       ├── Pod 1
       ├── Pod 2
       └── Pod 3
  └── ReplicaSet (revision 2)    ← 当前版本
       ├── Pod 4
       ├── Pod 5
       └── Pod 6
```

- **Deployment**：管理 ReplicaSet，控制部署策略（滚动更新、重建等）
- **ReplicaSet**：确保指定数量的 Pod 副本始终运行
- **Pod**：实际运行的容器实例

你永远不应该直接操作 ReplicaSet，所有操作都应该通过 Deployment 进行。

## 创建 Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1    # 更新过程中最多有几个 Pod 不可用
      maxSurge: 1          # 更新过程中最多比期望数量多几个 Pod
  template:
    metadata:
      labels:
        app: web-api
        version: v1
    spec:
      containers:
        - name: api
          image: my-app:1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
```

```bash
kubectl apply -f deployment.yaml
kubectl get deploy,rs,pods
```

## 滚动更新

当你修改 Deployment 的 Pod template（比如更新镜像版本），Deployment Controller 自动执行滚动更新。

### 更新镜像

```bash
# 方式一：命令式更新
kubectl set image deployment/web-api api=my-app:2.0.0

# 方式二：声明式更新（推荐）
# 修改 deployment.yaml 中的 image: my-app:2.0.0
kubectl apply -f deployment.yaml
```

### 滚动更新过程

```
时间线：
T0: ReplicaSet v1 有 3 个 Pod
T1: 创建 ReplicaSet v2，启动 1 个新 Pod（maxSurge=1）
T2: 新 Pod 通过 Readiness Probe
T3: 从 ReplicaSet v1 中删除 1 个旧 Pod（maxUnavailable=1）
T4: ReplicaSet v2 再启动 1 个新 Pod
T5: 新 Pod 通过 Readiness Probe
T6: 从 ReplicaSet v1 中删除 1 个旧 Pod
...直到所有 Pod 都替换完成

整个过程中，可用 Pod 数量始终 ≥ 2（replicas - maxUnavailable）
```

### maxSurge 和 maxUnavailable

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多多出 1 个 Pod（总共 4 个）
    maxUnavailable: 1  # 最多少 1 个 Pod（最少 2 个可用）
```

不同配置的效果（replicas=3）：

| maxSurge | maxUnavailable | 更新速度 | 可用性保证 |
|----------|---------------|---------|----------|
| 1 | 0 | 慢 | 零停机 |
| 1 | 1 | 中等 | 至少 2 个可用 |
| 3 | 0 | 快 | 零停机（需要更多资源） |
| 0 | 1 | 慢 | 至少 2 个可用 |

## 版本管理与回滚

### 查看更新历史

```bash
# 查看 Deployment 的更新历史
kubectl rollout history deployment/web-api

# 输出：
# deployment.apps/web-api
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>

# 添加变更注解
kubectl annotate deployment/web-api kubernetes.io/change-cause="Update to v2.0.0"
```

### 回滚操作

```bash
# 回滚到上一个版本
kubectl rollout undo deployment/web-api

# 回滚到指定版本
kubectl rollout undo deployment/web-api --to-revision=1

# 查看回滚状态
kubectl rollout status deployment/web-api

# 暂停更新（用于多字段修改后一次性生效）
kubectl rollout pause deployment/web-api
# 做多处修改...
kubectl rollout resume deployment/web-api
```

### 回滚的原理

回滚不是"撤销操作"，而是"创建一个与旧版本相同的 ReplicaSet"：

```
回滚前：
  ReplicaSet v1 (image: 1.0.0) — 0 个 Pod
  ReplicaSet v2 (image: 2.0.0) — 3 个 Pod

kubectl rollout undo --to-revision=1 后：
  ReplicaSet v2 (image: 2.0.0) — 0 个 Pod
  ReplicaSet v3 (image: 1.0.0) — 3 个 Pod  ← 新的 revision，但用的是 v1 的配置
```

## HPA 自动扩缩容

HPA（Horizontal Pod Autoscaler）根据 CPU、内存或自定义指标自动调整 Pod 副本数。

### 前置条件

HPA 需要 metrics-server 提供资源指标：

```bash
# 安装 metrics-server（如果还没有）
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### 创建 HPA

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

```bash
kubectl apply -f hpa.yaml

# 查看 HPA 状态
kubectl get hpa
kubectl describe hpa web-api-hpa

# 通过命令式创建（简单场景）
kubectl autoscale deployment web-api --cpu-percent=70 --min=2 --max=10
```

### HPA 工作原理

```
每 15 秒（默认）：
1. 从 metrics-server 获取 Pod 的 CPU/内存使用率
2. 计算平均使用率：所有 Pod 的 CPU 使用率之和 / Pod 数量
3. 如果平均使用率 > 目标值（70%）→ 扩容
4. 如果平均使用率 < 目标值 → 缩容

扩容公式：
desiredReplicas = ceil(currentReplicas * (currentMetricValue / desiredMetricValue))

示例：
当前 3 个 Pod，平均 CPU 使用率 90%，目标 70%
desiredReplicas = ceil(3 * (90/70)) = ceil(3.86) = 4
```

### behavior 配置

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 60    # 扩容前等待 60 秒观察
    policies:
      - type: Pods
        value: 2                       # 每次最多扩 2 个 Pod
        periodSeconds: 60              # 每 60 秒最多扩一次
  scaleDown:
    stabilizationWindowSeconds: 300   # 缩容前等待 5 分钟观察
    policies:
      - type: Pods
        value: 1                       # 每次最多缩 1 个 Pod
        periodSeconds: 120             # 每 120 秒最多缩一次
```

扩容快、缩容慢是最佳实践，避免流量波动导致频繁扩缩。

## Deployment 常用操作

```bash
# 查看 Deployment 状态
kubectl get deploy web-api
kubectl describe deploy web-api

# 查看 ReplicaSet
kubectl get rs -l app=web-api

# 手动扩容/缩容
kubectl scale deployment web-api --replicas=5

# 查看滚动更新状态
kubectl rollout status deployment/web-api

# 暂停/恢复 Deployment
kubectl rollout pause deployment/web-api
kubectl rollout resume deployment/web-api

# 删除 Deployment（会同时删除 ReplicaSet 和 Pod）
kubectl delete deployment web-api
```

## 常见误区

**误区一："直接操作 ReplicaSet 来管理 Pod"**

永远不要直接操作 ReplicaSet。所有副本管理、更新、回滚都通过 Deployment 进行。直接操作 ReplicaSet 会被 Deployment Controller 覆盖。

**误区二："HPA 和手动 scale 可以同时使用"**

HPA 会覆盖手动设置的 replicas。如果你手动 `scale` 到 10，HPA 可能下一次计算就把它改回 3。两者不要同时使用。

**误区三："回滚会恢复所有状态"**

回滚只恢复 Pod template（镜像、环境变量等），不会恢复 ConfigMap、Secret 中的数据。如果配置文件也改了，需要同时回滚配置。

## 工程建议

1. **始终配置 Readiness Probe**：滚动更新依赖 Readiness Probe 判断新 Pod 是否就绪
2. **设置合理的 maxSurge 和 maxUnavailable**：零停机部署至少设置 maxUnavailable=0
3. **生产环境必须配置 HPA**：但要注意设置 minReplicas 和合理的缩容冷却时间
4. **保留足够的旧 ReplicaSet**：`revisionHistoryLimit` 默认保留 10 个，足够回滚使用
5. **使用声明式管理**：修改 YAML 文件后 `kubectl apply`，而不是 `kubectl set image`

## 小结

- Deployment 管理 ReplicaSet，ReplicaSet 管理 Pod
- 滚动更新通过 maxSurge 和 maxUnavailable 控制更新策略
- 回滚是创建旧版本的 ReplicaSet，不是撤销操作
- HPA 根据指标自动扩缩容，扩容快缩容慢是最佳实践
- 所有操作都应该通过 Deployment 进行，不要直接操作 ReplicaSet

## 练习

### 练习一：滚动更新实践

创建一个 Deployment（nginx:1.25，3 副本），然后：
1. 更新镜像到 nginx:1.26
2. 观察滚动更新过程
3. 查看更新历史
4. 回滚到 nginx:1.25

### 练习二：HPA 配置

为一个 Deployment 配置 HPA：
- CPU 目标利用率 60%
- 最小 2 副本，最大 8 副本
- 扩容时每次最多增加 2 个 Pod
- 缩容时每次最多减少 1 个 Pod，冷却 5 分钟

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 创建 Deployment
kubectl create deployment web --image=nginx:1.25 --replicas=3

# 2. 更新镜像
kubectl set image deployment/web nginx=nginx:1.26

# 3. 观察更新过程
kubectl rollout status deployment/web
kubectl get rs -l app=web -w
# 你会看到新 ReplicaSet 的 Pod 数逐渐增加，旧 ReplicaSet 的 Pod 逐渐减少

# 4. 查看更新历史
kubectl rollout history deployment/web

# 5. 回滚
kubectl rollout undo deployment/web
# 验证
kubectl get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}'
# 应该显示 nginx:1.25
```

**要点**：
- `set image` 是命令式操作，临时使用可以
- 生产环境应该修改 YAML 后 `kubectl apply`
- 回滚会创建新的 revision

### 练习二

**答案**：

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 8
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

**要点**：
- scaleDown 的 stabilizationWindow 300 秒 = 5 分钟冷却
- 扩容策略比缩容更激进，符合"扩容快缩容慢"原则
- 需要 metrics-server 已安装才能工作

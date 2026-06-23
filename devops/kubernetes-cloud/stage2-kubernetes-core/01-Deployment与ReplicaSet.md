# Deployment 与 ReplicaSet

> 前置知识：Pod 基础、kubectl 操作（Stage 1）

## 直接管理 Pod 的代价

你在 Stage 1 学会了直接创建 Pod。但直接管理 Pod 有一个致命问题：Pod 挂了就没了。

```bash
kubectl run my-app --image=nginx:1.25
kubectl get pods
# my-app   1/1   Running   0   10s

# 模拟 Pod 崩溃
kubectl delete pod my-app
kubectl get pods
# No resources found
# Pod 没了，没有人帮你重建
```

在生产环境中这不可接受。你需要一种机制：Pod 挂了自动补上，需要扩容自动创建，需要更新自动替换。

Deployment 和 ReplicaSet 就是来做这件事的。

## 三者的关系

```
Deployment（你写的）
  └── ReplicaSet（K8s 自动创建）
        ├── Pod 1
        ├── Pod 2
        └── Pod 3

Deployment 管理 ReplicaSet
ReplicaSet 管理 Pod
你不直接管理 Pod
```

你只需要和 Deployment 打交道。ReplicaSet 是 Deployment 的内部实现——你几乎不需要直接操作它。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3                    # 保持 3 个副本
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:1.25
          resources:
            limits:
              memory: "128Mi"
              cpu: "250m"
```

```bash
kubectl apply -f deployment.yaml
kubectl get deployments
# NAME     READY   UP-TO-DATE   AVAILABLE   AGE
# my-app   3/3     3            3           10s

kubectl get replicasets
# NAME               DESIRED   CURRENT   READY   AGE
# my-app-7d4f8b9c6   3         3         3       10s

kubectl get pods
# NAME                     READY   STATUS    RESTARTS   AGE
# my-app-7d4f8b9c6-abc1   1/1     Running   0          10s
# my-app-7d4f8b9c6-def2   1/1     Running   0          10s
# my-app-7d4f8b9c6-ghi3   1/1     Running   0          10s
```

## 自动恢复

```bash
# 删除一个 Pod
kubectl delete pod my-app-7d4f8b9c6-abc1

# 立刻查看
kubectl get pods
# ReplicaSet 发现只有 2 个 Pod，自动创建了第 3 个
# NAME                     READY   STATUS              RESTARTS   AGE
# my-app-7d4f8b9c6-abc1   1/1     Terminating         0          1m
# my-app-7d4f8b9c6-def2   1/1     Running             0          1m
# my-app-7d4f8b9c6-ghi3   1/1     Running             0          1m
# my-app-7d4f8b9c6-jkl4   0/1     ContainerCreating   0          2s
```

这就是声明式管理的威力：你声明了"要 3 个副本"，K8s 会持续保证现实和声明一致。

## 滚动更新

```bash
# 更新镜像版本
kubectl set image deployment/my-app my-app=nginx:1.26

# 观察更新过程
kubectl rollout status deployment/my-app
# Waiting for deployment "my-app" rollout to finish: 1 out of 3 new replicas...
# Waiting for deployment "my-app" rollout to finish: 2 out of 3 new replicas...
# deployment "my-app" successfully rolled out
```

滚动更新的过程：

```
旧 ReplicaSet (nginx:1.25)    新 ReplicaSet (nginx:1.26)
  Pod 1 (Running)               Pod 4 (Creating)
  Pod 2 (Running)               Pod 5 (Creating)
  Pod 3 (Running)               Pod 6 (Creating)

K8s 逐步：创建新 Pod → 健康检查通过 → 删除旧 Pod
整个过程中始终保持 3 个可用副本
```

## 回滚

```bash
# 查看更新历史
kubectl rollout history deployment/my-app

# 回滚到上一个版本
kubectl rollout undo deployment/my-app

# 回滚到指定版本
kubectl rollout undo deployment/my-app --to-revision=2
```

回滚不是"重新部署旧版本"，而是"切换到旧的 ReplicaSet"。K8s 保留了旧的 ReplicaSet，所以回滚是秒级的。

## HPA 自动扩缩容

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```
CPU 使用率 < 70% → 缩容（最少 2 个）
CPU 使用率 > 70% → 扩容（最多 10 个）
```

HPA 让你不用手动 `kubectl scale`——流量增长时自动扩容，流量下降时自动缩容。

## 练习

### 练习一：部署与验证

创建一个 3 副本的 nginx Deployment，验证：删除一个 Pod 后自动恢复，扩容到 5 个副本，缩容到 1 个副本。

### 练习二：滚动更新

将 nginx 从 1.25 更新到 1.26，用 `kubectl rollout status` 观察更新过程。然后回滚到 1.25。

### 练习三：查看 ReplicaSet

更新镜像后，用 `kubectl get replicasets` 查看 ReplicaSet 的变化。为什么旧的 ReplicaSet 还在？

---

## 参考答案

### 练习一

```bash
kubectl apply -f deployment.yaml
kubectl get pods   # 3 个
kubectl delete pod <pod-name>
kubectl get pods   # 自动恢复为 3 个
kubectl scale deployment/my-app --replicas=5
kubectl get pods   # 5 个
kubectl scale deployment/my-app --replicas=1
kubectl get pods   # 1 个
```

### 练习二

```bash
kubectl set image deployment/my-app my-app=nginx:1.26
kubectl rollout status deployment/my-app
# 观察 Pod 逐步替换
kubectl rollout undo deployment/my-app
kubectl get pods   # 镜像回到 1.25
```

### 练习三

```bash
kubectl set image deployment/my-app my-app=nginx:1.26
kubectl get replicasets
# 有两个 ReplicaSet：
# my-app-7d4f8b9c6   (旧，nginx:1.25，0 个副本)
# my-app-9f3a2b1c7   (新，nginx:1.26，3 个副本)
```

旧 ReplicaSet 保留是为了回滚。K8s 默认保留 10 个旧 ReplicaSet（可通过 `revisionHistoryLimit` 配置）。

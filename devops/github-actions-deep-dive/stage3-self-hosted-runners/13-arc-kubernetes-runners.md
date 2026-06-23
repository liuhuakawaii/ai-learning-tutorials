# 弹性 Runner：Actions Runner Controller

> 手动管理 Runner 麻烦：要处理安装、注册、清理、扩缩容。ARC（Actions Runner Controller）把 Runner 变成 Kubernetes 上的 Pod，自动管理生命周期。

## ARC 是什么

Actions Runner Controller 是一个 Kubernetes Operator，它：
- 监听 GitHub 的 Job 队列
- 有 Job 时自动创建 Runner Pod
- Job 完成后自动清理 Pod
- 根据队列深度自动扩缩容

```
GitHub.com (Job 队列)
    ↕ (HTTPS)
ARC Controller (Kubernetes)
    ↕ (创建/删除)
Runner Pod → 执行 Job → 完成 → 销毁
```

## 架构组件

### Controller

ARC Controller 是核心组件，负责：
- 监听 GitHub API 获取待处理的 Job
- 管理 Runner Pod 的生命周期
- 处理扩缩容逻辑

### Runner Scale Set

Runner Scale Set 定义了一组可弹性伸缩的 Runner：

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ci-runner
spec:
  replicas: 2
  template:
    spec:
      repository: owner/repo
      labels:
        - self-hosted
        - linux
        - k8s
      resources:
        requests:
          cpu: "1"
          memory: "2Gi"
        limits:
          cpu: "2"
          memory: "4Gi"
```

### Ephemeral Runner

ARC 默认使用 ephemeral（临时）模式：每个 Runner Pod 只执行一个 Job，完成后销毁。这解决了自托管 Runner 的隔离问题——每个 Job 都在全新的环境里运行。

## 安装 ARC

### 前置条件

- Kubernetes 集群（1.23+）
- Helm 3
- GitHub PAT 或 GitHub App

### 使用 Helm 安装

```bash
# 添加 Helm 仓库
helm repo add actions-runner-controller https://actions-runner-controller.github.io/actions-runner-controller
helm repo update

# 安装 Controller
helm install actions-runner-controller actions-runner-controller/actions-runner-controller \
  --namespace actions-runner-system \
  --create-namespace \
  --set authSecret.github_token=YOUR_GITHUB_PAT
```

### 使用 GitHub App（推荐）

PAT 有速率限制和权限范围问题。GitHub App 更适合生产环境：

```bash
helm install actions-runner-controller actions-runner-controller/actions-runner-controller \
  --namespace actions-runner-system \
  --create-namespace \
  --set authSecret.create=true \
  --set authSecret.github_app_id=YOUR_APP_ID \
  --set authSecret.github_app_installation_id=YOUR_INSTALLATION_ID \
  --set authSecret.github_app_private_key="$(cat private-key.pem)"
```

## 配置 Runner Scale Set

### 仓库级 Runner

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: repo-runner
  namespace: runners
spec:
  replicas: 2
  template:
    spec:
      repository: my-org/my-repo
      labels:
        - self-hosted
        - linux
        - k8s
      dockerdWithinRunnerContainer: true
      resources:
        requests:
          cpu: "1"
          memory: "2Gi"
```

### 组织级 Runner

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: org-runner
  namespace: runners
spec:
  replicas: 2
  template:
    spec:
      organization: my-org
      labels:
        - self-hosted
        - linux
        - k8s
```

### 自动扩缩容（HorizontalRunnerAutoscaler）

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: ci-runner-autoscaler
  namespace: runners
spec:
  scaleTargetRef:
    kind: RunnerDeployment
    name: ci-runner
  minReplicas: 1
  maxReplicas: 10
  scaleDownDelaySecondsAfterScaleOut: 300
  metrics:
    - type: PercentageRunnersBusy
      scaleUpThreshold: "0.75"
      scaleDownThreshold: "0.25"
```

这个配置：
- 最少 1 个 Runner，最多 10 个
- 当 75% 的 Runner 忙碌时扩容
- 当 25% 的 Runner 忙碌时缩容
- 扩容后 5 分钟内不缩容（防止抖动）

## Runner Pod 的定制

### 自定义镜像

```yaml
spec:
  template:
    spec:
      image: my-registry/custom-runner:latest
      imagePullPolicy: Always
      imagePullSecrets:
        - name: registry-secret
```

自定义镜像可以预装项目需要的工具，减少每次 Job 的安装时间。

### 挂载卷

```yaml
spec:
  template:
    spec:
      volumeMounts:
        - name: docker-cache
          mountPath: /var/lib/docker
      volumes:
        - name: docker-cache
          persistentVolumeClaim:
            claimName: docker-cache-pvc
```

挂载 PVC 可以持久化 Docker 层缓存、npm 缓存等。

### 环境变量

```yaml
spec:
  template:
    spec:
      env:
        - name: HTTP_PROXY
          value: "http://proxy.internal:8080"
        - name: NO_PROXY
          value: "github.com,api.github.com"
```

## 一个真实的 ARC 问题

某团队的 ARC Runner Pod 频繁 OOMKilled。排查发现：

1. Job 里有 `docker build`，Docker daemon 占用大量内存
2. Runner Pod 的内存限制是 4GB
3. Docker daemon + Runner Agent + Job 进程加起来超过了 4GB

解决方案：
1. 提高内存限制到 8GB
2. 用 `dockerdWithinRunnerContainer: false` 把 Docker daemon 放到 sidecar 容器，单独限制资源
3. 或者用 Kaniko 代替 Docker（不需要 Docker daemon）

```yaml
spec:
  template:
    spec:
      dockerdWithinRunnerContainer: false
      dockerdContainerResources:
        requests:
          cpu: "0.5"
          memory: "2Gi"
        limits:
          cpu: "1"
          memory: "4Gi"
```

## 练习

### 练习一：设计 ARC 集群

为以下场景设计 ARC 配置：
1. 3 个仓库需要 Runner，日常各需要 1 个，高峰期各需要 5 个
2. Runner 需要 Docker 构建能力
3. Runner 需要访问私有 npm 镜像（通过代理）
4. 成本敏感，低峰期尽量缩容

要求：
- 写出 RunnerDeployment 和 HorizontalRunnerAutoscaler 配置
- 考虑镜像、资源限制、代理配置

---

## 参考答案

```yaml
# RunnerDeployment
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ci-runner
  namespace: runners
spec:
  replicas: 1
  template:
    spec:
      organization: my-org
      labels:
        - self-hosted
        - linux
        - k8s
        - docker
      dockerdWithinRunnerContainer: false
      dockerdContainerResources:
        requests:
          cpu: "0.5"
          memory: "1Gi"
        limits:
          cpu: "1"
          memory: "2Gi"
      resources:
        requests:
          cpu: "1"
          memory: "2Gi"
        limits:
          cpu: "2"
          memory: "4Gi"
      env:
        - name: NPM_CONFIG_REGISTRY
          value: "https://npm-proxy.internal/repository/npm/"
        - name: HTTP_PROXY
          value: "http://proxy.internal:8080"
        - name: NO_PROXY
          value: "github.com,api.github.com,npm-proxy.internal"
      image: my-registry/custom-runner:latest
      imagePullSecrets:
        - name: registry-secret
---
# HorizontalRunnerAutoscaler
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: ci-runner-autoscaler
  namespace: runners
spec:
  scaleTargetRef:
    kind: RunnerDeployment
    name: ci-runner
  minReplicas: 1
  maxReplicas: 15
  scaleDownDelaySecondsAfterScaleOut: 600
  metrics:
    - type: PercentageRunnersBusy
      scaleUpThreshold: "0.7"
      scaleDownThreshold: "0.2"
```

**要点**：
- `minReplicas: 1` 保证低峰期不完全缩容到 0（也可以设为 0，但冷启动需要时间）
- `maxReplicas: 15`（3 仓库 × 5 峰值）留了余量
- `scaleDownDelaySecondsAfterScaleOut: 600` 等 10 分钟才缩容，避免频繁抖动
- Docker daemon 放在 sidecar，单独限制资源
- 代理和 npm 镜像通过环境变量配置

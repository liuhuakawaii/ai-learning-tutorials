# 阶段实战：部署基于 K8s 的弹性 Runner 集群

> 把前面四课的内容整合起来，在 Kubernetes 上部署一个完整的 ARC Runner 集群。这个集群支持自动扩缩容、Spot 实例、自定义镜像和缓存持久化。

## 目标架构

```
Kubernetes Cluster
├── namespace: actions-runner-system
│   └── ARC Controller
├── namespace: runners
│   ├── RunnerDeployment (ci-runners)
│   ├── HorizontalRunnerAutoscaler
│   ├── PVC (npm-cache, docker-cache)
│   └── ConfigMap (runner-config)
└── namespace: apps
    └── 被 CI/CD 管理的应用
```

## 步骤一：安装 ARC Controller

```bash
# 创建命名空间
kubectl create namespace actions-runner-system

# 添加 Helm 仓库
helm repo add actions-runner-controller \
  https://actions-runner-controller.github.io/actions-runner-controller
helm repo update

# 创建 GitHub App Secret
kubectl create secret generic controller-manager \
  -n actions-runner-system \
  --from-literal=github_app_id=YOUR_APP_ID \
  --from-literal=github_app_installation_id=YOUR_INSTALLATION_ID \
  --from-file=github_app_private_key=private-key.pem

# 安装 Controller
helm install actions-runner-controller \
  actions-runner-controller/actions-runner-controller \
  -n actions-runner-system \
  --set syncPeriod=1m \
  --set logLevel=info
```

## 步骤二：创建自定义 Runner 镜像

```dockerfile
# Dockerfile.runner
FROM summerwind/actions-runner:latest

USER root

# 安装常用工具
RUN apt-get update && apt-get install -y \
    jq \
    curl \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# 安装 pnpm
RUN npm install -g pnpm

# 配置 npm 镜像（可选）
RUN npm config set registry https://npm-proxy.internal/repository/npm/

USER runner
```

构建并推送到私有镜像仓库：

```bash
docker build -t my-registry/custom-runner:latest -f Dockerfile.runner .
docker push my-registry/custom-runner:latest
```

## 步骤三：配置缓存 PVC

```yaml
# cache-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: npm-cache
  namespace: runners
spec:
  accessModes:
    - ReadWriteMany  # 多个 Pod 可以同时挂载
  storageClassName: efs-sc  # 用 EFS 或 NFS 支持 ReadWriteMany
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: docker-cache
  namespace: runners
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: efs-sc
  resources:
    requests:
      storage: 50Gi
```

## 步骤四：配置 RunnerDeployment

```yaml
# runner-deployment.yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ci-runner
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
        - docker
      image: my-registry/custom-runner:latest
      imagePullSecrets:
        - name: registry-secret
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
      volumeMounts:
        - name: npm-cache
          mountPath: /home/runner/.npm
        - name: docker-cache
          mountPath: /var/lib/docker
      volumes:
        - name: npm-cache
          persistentVolumeClaim:
            claimName: npm-cache
        - name: docker-cache
          persistentVolumeClaim:
            claimName: docker-cache
      nodeSelector:
        node.kubernetes.io/capacity-type: spot  # 调度到 Spot 节点
      tolerations:
        - key: "kubernetes.azure.com/scalesetpriority"
          operator: "Equal"
          value: "spot"
          effect: "NoSchedule"
```

## 步骤五：配置自动扩缩容

```yaml
# autoscaler.yaml
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

## 步骤六：配置 RBAC

```yaml
# rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: runner-role
  namespace: runners
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: runner-rolebinding
  namespace: runners
subjects:
  - kind: ServiceAccount
    name: default
    namespace: runners
roleRef:
  kind: Role
  name: runner-role
  apiGroup: rbac.authorization.k8s.io
```

## 步骤七：验证部署

```bash
# 检查 Controller 状态
kubectl get pods -n actions-runner-system

# 检查 Runner 状态
kubectl get runners -n runners

# 检查自动扩缩容
kubectl get hra -n runners

# 查看 Runner 日志
kubectl logs -f deployment/ci-runner -n runners
```

## 步骤八：在 Workflow 中使用

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: [self-hosted, linux, k8s, docker]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: [self-hosted, linux, k8s, docker]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t my-app:${{ github.sha }} .
```

## 运维要点

### 日常维护

```bash
# 查看 Runner 状态
kubectl get runners -n runners -o wide

# 查看自动扩缩容事件
kubectl describe hra ci-runner-autoscaler -n runners

# 手动扩容（紧急情况）
kubectl scale runnerdeployment ci-runner --replicas=5 -n runners

# 更新 Runner 镜像
kubectl set image runnerdeployment/ci-runner \
  *=my-registry/custom-runner:v2 -n runners
```

### 监控指标

关注以下指标：
- Runner Pod 数量（当前 vs 期望）
- Job 等待时间（队列深度）
- Pod OOMKilled 事件
- Spot 中断事件
- 缓存 PVC 使用率

### 故障排查

**Runner Pod 不启动**：
```bash
kubectl describe pod -n runners -l app=ci-runner
kubectl logs -n runners -l app=ci-runner
```

**Job 排队时间长**：
```bash
# 检查 Runner 是否注册成功
kubectl get runners -n runners

# 检查 GitHub 侧的 Runner 状态
# Settings → Actions → Runners
```

**缓存不生效**：
```bash
# 检查 PVC 状态
kubectl get pvc -n runners

# 进入 Pod 检查缓存目录
kubectl exec -it deployment/ci-runner -n runners -- ls -la /home/runner/.npm
```

## 练习

### 练习一：添加 GPU Runner

在上面的集群基础上，添加一个 GPU Runner Deployment，用于 ML 项目的测试和训练。要求：
1. 使用 GPU 节点（需要 NVIDIA 设备插件）
2. 自定义标签 `gpu`
3. 独立的自动扩缩容配置（GPU 资源昂贵，最大 2 个）
4. 预装 Python 和 CUDA

---

## 参考答案

```yaml
# gpu-runner.yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: gpu-runner
  namespace: runners
spec:
  replicas: 0  # 默认不运行，按需扩缩
  template:
    spec:
      organization: my-org
      labels:
        - self-hosted
        - linux
        - k8s
        - gpu
      image: my-registry/gpu-runner:latest
      resources:
        requests:
          cpu: "2"
          memory: "8Gi"
          nvidia.com/gpu: "1"
        limits:
          cpu: "4"
          memory: "16Gi"
          nvidia.com/gpu: "1"
      nodeSelector:
        node.kubernetes.io/gpu: "true"
---
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: gpu-runner-autoscaler
  namespace: runners
spec:
  scaleTargetRef:
    kind: RunnerDeployment
    name: gpu-runner
  minReplicas: 0
  maxReplicas: 2
  scaleDownDelaySecondsAfterScaleOut: 600
  metrics:
    - type: PercentageRunnersBusy
      scaleUpThreshold: "0.5"  # GPU 资源稀缺，50% 就扩容
      scaleDownThreshold: "0.0"  # 没有任务就缩容
```

**GPU Runner 镜像**：

```dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# 安装 Runner 依赖
RUN apt-get update && apt-get install -y \
    curl \
    sudo \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装常用 ML 包
RUN pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 安装 Runner
ARG RUNNER_VERSION=2.311.0
RUN curl -o actions-runner.tar.gz -L \
    https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
    && tar xzf actions-runner.tar.gz \
    && rm actions-runner.tar.gz

ENTRYPOINT ["./run.sh"]
```

**Workflow 使用**：

```yaml
jobs:
  ml-test:
    runs-on: [self-hosted, linux, k8s, gpu]
    steps:
      - uses: actions/checkout@v4
      - run: python3 -c "import torch; print(torch.cuda.is_available())"
      - run: pytest tests/
```

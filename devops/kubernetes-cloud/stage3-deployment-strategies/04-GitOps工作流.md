# GitOps 工作流

## 场景引入

你已经学会了蓝绿部署和金丝雀发布，但这些都是手动操作：修改 YAML、kubectl apply、检查状态。当团队有 10 个人同时提交代码，每个人都可能执行不同的部署命令，集群的实际状态和 Git 仓库中的配置逐渐不一致——你甚至不知道集群当前跑的是哪个版本。

GitOps 的核心思想是：**Git 仓库是唯一的事实来源**。所有对集群的变更都通过 Git commit 触发，由自动化工具（ArgoCD/Flux）将 Git 中的声明式配置同步到集群。

## 学习目标

1. 理解 GitOps 的核心原则和价值
2. 掌握 ArgoCD 的安装和基本使用
3. 学会配置 ArgoCD 自动同步应用
4. 了解 Flux 的基本概念
5. 设计 GitOps 工作流的最佳实践

## GitOps 核心原则

1. **声明式**：所有配置用 YAML 声明，不使用命令式操作
2. **版本控制**：所有配置存储在 Git 仓库中，变更有完整的审计记录
3. **自动化**：Git 变更自动同步到集群，不需要人工 kubectl apply
4. **持续调谐**：控制器持续对比 Git 中的期望状态和集群实际状态，自动修复偏差

```
传统流程：
开发者 → 构建镜像 → 手动 kubectl apply → 集群

GitOps 流程：
开发者 → 推送代码 → CI 构建镜像 → 更新 Git 仓库中的 YAML → ArgoCD 自动同步 → 集群
```

## ArgoCD

ArgoCD 是目前最流行的 GitOps 工具，由 CNCF 毕业项目维护。

### 安装 ArgoCD

```bash
# 创建命名空间
kubectl create namespace argocd

# 安装 ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 等待所有 Pod 就绪
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=180s

# 获取初始密码
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 访问 UI（端口转发）
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 安装 CLI
brew install argocd  # macOS
# 或
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd
sudo mv argocd /usr/local/bin/

# CLI 登录
argocd login localhost:8080 --username admin --password <password> --insecure

# 修改密码
argocd account update-password
```

### 创建 ArgoCD Application

```yaml
# argocd-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myteam/k8s-manifests.git
    targetRevision: main
    path: apps/my-app
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app
  syncPolicy:
    automated:
      prune: true       # 删除 Git 中不存在的资源
      selfHeal: true     # 自动修复手动修改
    syncOptions:
      - CreateNamespace=true
```

```bash
kubectl apply -f argocd-app.yaml

# 或通过 CLI
argocd app create my-app \
  --repo https://github.com/myteam/k8s-manifests.git \
  --path apps/my-app \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace my-app \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

### ArgoCD 同步方式

**自动同步**：Git 变更后自动同步到集群。

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
```

**手动同步**：需要在 UI 或 CLI 中手动触发。

```bash
argocd app sync my-app
```

**同步状态**：

```bash
# 查看应用状态
argocd app get my-app

# 输出示例：
# Name:               my-app
# Server:             https://kubernetes.default.svc
# Namespace:          my-app
# Status:             Synced    ← 同步状态
# Health:             Healthy   ← 健康状态
# Sync Revision:      abc123
```

状态说明：
- **Synced**：Git 和集群一致
- **OutOfSync**：Git 和集群不一致，需要同步
- **Healthy**：所有资源健康
- **Degraded**：有资源不健康

### ArgoCD 工作流

```
1. 开发者推送代码到应用仓库
2. CI 构建新镜像，推送到镜像仓库
3. CI 更新 GitOps 仓库中的镜像 tag（或使用 image updater）
4. ArgoCD 检测到 GitOps 仓库变更
5. ArgoCD 自动同步到 K8s 集群
6. ArgoCD 持续监控，确保集群状态与 Git 一致
```

## Flux

Flux 是 CNCF 毕业的另一个 GitOps 工具，由 Weaveworks 开发。它采用 Kubernetes 原生的方式（CRD + Controller）实现 GitOps。

### Flux 核心组件

```yaml
# Flux 的核心 CRD
# GitRepository：定义 Git 仓库源
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myteam/k8s-manifests.git
  ref:
    branch: main

# Kustomization：定义如何应用配置
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/my-app
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-app
```

### ArgoCD vs Flux

| 特性 | ArgoCD | Flux |
|------|--------|------|
| UI | 内置 Web UI | 无内置 UI |
| 安装复杂度 | 中等 | 简单 |
| Helm 支持 | 原生支持 | 原生支持 |
| 多集群 | 原生支持 | 需要额外配置 |
| 通知 | 内置 | 需要 notification-controller |
| 社区 | 更大 | 较大 |

## GitOps 仓库结构

```
k8s-manifests/
├── apps/
│   ├── my-app/
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       │   ├── kustomization.yaml
│   │       │   └── patch-replicas.yaml
│   │       ├── staging/
│   │       │   ├── kustomization.yaml
│   │       │   └── patch-replicas.yaml
│   │       └── prod/
│   │           ├── kustomization.yaml
│   │           ├── patch-replicas.yaml
│   │           └── patch-resources.yaml
│   └── another-app/
├── infrastructure/
│   ├── prometheus/
│   ├── cert-manager/
│   └── ingress-nginx/
└── argocd/
    ├── app-of-apps.yaml
    └── projects.yaml
```

## App of Apps 模式

ArgoCD 支持"App of Apps"模式：一个父 Application 管理多个子 Application。

```yaml
# app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: all-apps
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myteam/k8s-manifests.git
    targetRevision: main
    path: argocd/app-of-apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```
argocd/app-of-apps/
├── app1.yaml    # 子 Application 定义
├── app2.yaml
└── app3.yaml
```

## 常见误区

**误区一："GitOps 就是用 ArgoCD"**

GitOps 是一种理念，ArgoCD 和 Flux 都是实现工具。核心是"Git 是唯一事实来源"，工具可以换。

**误区二："GitOps 不需要 CI"**

GitOps 替代的是 CD（持续部署）部分，CI（持续集成）仍然需要。典型流程：CI 构建镜像 → 更新 GitOps 仓库 → GitOps 工具同步到集群。

**误区三："所有东西都要放 GitOps 仓库"**

应用代码放应用仓库，K8s 配置放 GitOps 仓库。CI 将构建好的镜像 tag 更新到 GitOps 仓库。

## 工程建议

1. **GitOps 仓库和应用代码仓库分离**：避免代码变更直接影响部署
2. **使用 Kustomize 或 Helm 管理多环境配置**：base + overlays 模式
3. **启用 selfHeal**：防止手动修改集群状态被覆盖
4. **保护 GitOps 仓库的 main 分支**：使用 PR 审核机制
5. **设置通知**：同步失败时发送告警

## 小结

- GitOps 以 Git 仓库为唯一事实来源，自动同步到集群
- ArgoCD 提供 Web UI 和 CLI，适合需要可视化管理的团队
- Flux 更轻量，采用 CRD + Controller 原生方式
- App of Apps 模式管理多个应用的 GitOps 流程
- GitOps 仓库和应用代码仓库应该分离

## 练习

### 练习一：ArgoCD 安装和使用

在本地集群上完成：
1. 安装 ArgoCD
2. 创建一个包含 Deployment 和 Service 的 GitOps 仓库（可以用 GitHub）
3. 在 ArgoCD 中创建 Application 指向该仓库
4. 验证自动同步功能
5. 在 Git 中修改镜像版本，观察集群自动更新

### 练习二：GitOps 工作流设计

为一个前后端分离的应用设计 GitOps 仓库结构，包含 dev、staging、prod 三个环境。

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 安装 ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. 等待就绪
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=180s

# 3. 访问 UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 4. 创建 Application
argocd app create demo \
  --repo https://github.com/your-org/k8s-manifests \
  --path apps/demo \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace demo \
  --sync-policy automated \
  --auto-prune \
  --self-heal

# 5. 验证同步
argocd app get demo
# Status 应该是 Synced, Health 应该是 Healthy

# 6. 修改 Git 中的镜像 tag
# 推送后 ArgoCD 自动同步
```

### 练习二

**答案**：

```
gitops-repo/
├── apps/
│   ├── frontend/
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── ingress.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       │   └── kustomization.yaml
│   │       ├── staging/
│   │       │   └── kustomization.yaml
│   │       └── prod/
│   │           └── kustomization.yaml
│   └── backend/
│       ├── base/
│       └── overlays/
├── infrastructure/
│   ├── ingress-nginx/
│   ├── cert-manager/
│   └── monitoring/
└── argocd/
    ├── projects.yaml
    └── app-of-apps.yaml
```

**要点**：
- base 存放通用配置，overlays 存放环境差异
- Kustomize 的 patches 机制可以覆盖特定字段
- infrastructure 存放集群级别的基础设施组件

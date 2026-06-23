# 阶段实战：完整 GitOps 流水线

> 前置知识：Helm、蓝绿部署、金丝雀发布、GitOps 工作流、多环境管理（Stage 3 第 1-5 课）

## 你要做什么

搭建一条完整的 GitOps 流水线：代码提交 → 自动构建 → 推送镜像 → ArgoCD 同步部署 → 金丝雀发布。

全程无需手动 kubectl。

## 整体架构

```
开发者推送代码
    ↓
GitHub Actions CI
    ├── lint + test + build
    ├── 构建 Docker 镜像
    ├── 推送到 GHCR
    └── 更新 GitOps 仓库中的镜像 tag
            ↓
    ArgoCD 检测到 Git 变更
    ├── 同步到 K8s 集群
    └── 执行金丝雀发布策略
```

## 第一步：ArgoCD 安装

```bash
# 创建 namespace
kubectl create namespace argocd

# 安装 ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 获取初始密码
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 端口转发
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 登录
argocd login localhost:8080 --username admin --password <password> --insecure
```

## 第二步：GitOps 仓库结构

```
gitops-repo/
├── apps/
│   ├── my-app/
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── ingress.yaml
│   │   └── overlays/
│   │       ├── staging/
│   │       │   ├── kustomization.yaml
│   │       │   └── replica-count.yaml
│   │       └── production/
│   │           ├── kustomization.yaml
│   │           └── replica-count.yaml
└── argocd/
    ├── staging-app.yaml
    └── production-app.yaml
```

### ArgoCD Application 定义

```yaml
# argocd/staging-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/gitops-repo.git
    targetRevision: main
    path: apps/my-app/overlays/staging
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

`automated` + `selfHeal` 表示 ArgoCD 会自动同步 Git 变更到集群，并且如果有人手动修改了集群状态，ArgoCD 会自动恢复。

## 第三步：CI 流水线

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/your-org/my-app:${{ github.sha }}

      - name: Update GitOps repo
        run: |
          git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@github.com/your-org/gitops-repo.git
          cd gitops-repo
          # 更新 staging 的镜像 tag
          cd apps/my-app/overlays/staging
          kustomize edit set image ghcr.io/your-org/my-app=ghcr.io/your-org/my-app:${{ github.sha }}
          git add .
          git commit -m "chore: update staging image to ${{ github.sha }}"
          git push
```

## 第四步：金丝雀发布

用 Argo Rollouts 实现金丝雀：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 3
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
          image: ghcr.io/your-org/my-app:latest
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 100
```

金丝雀发布流程：

```
v1 (3 个副本)
    ↓
v2 (10% 流量) → 观察 5 分钟 → 指标正常？
    ↓ 是
v2 (50% 流量) → 观察 5 分钟 → 指标正常？
    ↓ 是
v2 (100% 流量) → 发布完成
    ↓ 否
自动回滚到 v1
```

## 验证

```bash
# 查看 ArgoCD 应用状态
argocd app get my-app-staging

# 手动触发同步
argocd app sync my-app-staging

# 查看金丝雀发布状态
kubectl argo rollouts get rollout my-app -n my-app-staging
```

## 练习

### 练习一：多环境配置

在 GitOps 仓库中创建 production overlay，设置副本数为 5、资源限制更高。创建 ArgoCD Application 部署到 production namespace。

### 练习二：回滚

模拟金丝雀发布失败：手动把镜像 tag 改成一个不存在的版本。观察 Argo Rollouts 是否自动回滚。

### 练习三：通知

配置 ArgoCD 的通知，在同步成功或失败时发送 Slack 消息。

---

## 参考答案

### 练习一

```yaml
# apps/my-app/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patchesStrategicMerge:
  - replica-count.yaml
images:
  - name: ghcr.io/your-org/my-app
    newTag: v1.0.0
```

```yaml
# replica-count.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 5
```

### 练习二

```bash
# 更新镜像为不存在的 tag
kubectl set image rollout/my-app my-app=ghcr.io/your-org/my-app:nonexistent -n my-app-staging

# 观察
kubectl argo rollouts get rollout my-app -n my-app-staging
# 状态会从 Progressing → Degraded → 自动回滚到上一个版本
```

### 练习三

```yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.slack: |
    token: $slack-token
  template.app-sync-succeeded: |
    message: |
      Application {{.app.metadata.name}} sync succeeded.
  trigger.on-sync-succeeded: |
    - send: [app-sync-succeeded]
```

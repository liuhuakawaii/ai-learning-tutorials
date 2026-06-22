# 阶段实战：完整 GitOps 流水线

## 场景引入

Stage 3 前 5 课你学习了 Helm、蓝绿部署、金丝雀发布、GitOps 工作流和多环境管理。现在是时候把这些技能串联起来，搭建一条完整的端到端 GitOps 流水线：从代码提交到自动构建、自动部署、渐进式发布，全程无需手动 kubectl。

## 学习目标

1. 搭建完整的 GitOps 工作流
2. 配置 ArgoCD 管理多环境应用
3. 设计 CI/CD 流水线集成 GitOps
4. 实现金丝雀发布策略

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                      GitOps 流水线                        │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │开发者     │───►│应用仓库   │───►│CI Pipeline│          │
│  │提交代码   │    │(源代码)   │    │(GitHub    │          │
│  └──────────┘    └──────────┘    │ Actions)  │          │
│                                   └────┬─────┘          │
│                                        │                 │
│                              ┌─────────▼──────────┐     │
│                              │构建镜像 + 更新       │     │
│                              │GitOps 仓库的镜像 tag │     │
│                              └─────────┬──────────┘     │
│                                        │                 │
│                              ┌─────────▼──────────┐     │
│                              │GitOps 仓库          │     │
│                              │(K8s manifests)      │     │
│                              └─────────┬──────────┘     │
│                                        │                 │
│                              ┌─────────▼──────────┐     │
│                              │ArgoCD 监听变更      │     │
│                              │自动同步到集群        │     │
│                              └─────────┬──────────┘     │
│                                        │                 │
│                    ┌───────────────────┼──────────┐     │
│                    ▼                   ▼          ▼     │
│              ┌──────────┐      ┌──────────┐ ┌────────┐ │
│              │Dev 环境   │      │Staging   │ │Prod    │ │
│              │自动部署   │      │手动 Promotion│ │金丝雀 │ │
│              └──────────┘      └──────────┘ └────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Step 1：准备 GitOps 仓库结构

```
gitops-repo/
├── apps/
│   └── my-app/
│       ├── base/
│       │   ├── kustomization.yaml
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   └── ingress.yaml
│       └── overlays/
│           ├── dev/
│           │   ├── kustomization.yaml
│           │   └── config-patch.yaml
│           ├── staging/
│           │   ├── kustomization.yaml
│           │   └── config-patch.yaml
│           └── prod/
│               ├── kustomization.yaml
│               ├── config-patch.yaml
│               └── hpa.yaml
├── argocd/
│   ├── app-of-apps.yaml
│   ├── dev-app.yaml
│   ├── staging-app.yaml
│   └── prod-app.yaml
└── infrastructure/
    └── namespaces.yaml
```

### base 配置

```yaml
# apps/my-app/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
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

```yaml
# apps/my-app/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml
commonLabels:
  app: my-app
```

### 环境覆盖

```yaml
# apps/my-app/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - hpa.yaml
namespace: production
patches:
  - path: config-patch.yaml
```

```yaml
# apps/my-app/overlays/prod/config-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

## Step 2：安装和配置 ArgoCD

```bash
# 安装 ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 等待就绪
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=180s

# 获取初始密码
ARGO_PWD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD password: $ARGO_PWD"

# 端口转发
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
```

### 创建 ArgoCD Applications

```yaml
# argocd/dev-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myteam/gitops-repo.git
    targetRevision: develop
    path: apps/my-app/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```yaml
# argocd/prod-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myteam/gitops-repo.git
    targetRevision: main
    path: apps/my-app/overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
  # 生产环境手动同步
```

```bash
kubectl apply -f argocd/dev-app.yaml
kubectl apply -f argocd/prod-app.yaml
```

## Step 3：配置 CI Pipeline

```yaml
# .github/workflows/ci.yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker push my-app:${{ github.sha }}

      - name: Update GitOps repo (dev)
        if: github.ref == 'refs/heads/develop'
        run: |
          # 更新 dev overlay 的镜像 tag
          cd gitops-repo
          kustomize edit set image my-app=my-app:${{ github.sha }}
          git commit -am "chore: update dev image to ${{ github.sha }}"
          git push

      - name: Update GitOps repo (prod)
        if: github.ref == 'refs/heads/main'
        run: |
          cd gitops-repo
          cd apps/my-app/overlays/prod
          kustomize edit set image my-app=my-app:${{ github.sha }}
          git commit -am "chore: update prod image to ${{ github.sha }}"
          git push
```

## Step 4：环境 Promotion 流程

```
Develop 分支推送 → 自动部署到 Dev
        │
   在 Dev 验证通过
        │
   创建 PR 到 main 分支
        │
   代码审核通过，合并
        │
   CI 更新 GitOps 仓库 prod overlay
        │
   ArgoCD 显示 OutOfSync
        │
   在 ArgoCD UI 手动点击 Sync
        │
   生产环境更新完成
```

## Step 5：监控和验证

```bash
# 查看 ArgoCD 应用状态
argocd app list
argocd app get my-app-dev
argocd app get my-app-prod

# 查看同步历史
argocd app history my-app-prod

# 手动同步生产环境
argocd app sync my-app-prod

# 回滚到上一个版本
argocd app rollback my-app-prod 1
```

## 金丝雀发布集成

使用 Argo Rollouts 实现金丝雀发布：

```yaml
# 替换 Deployment 为 Rollout
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
        - name: app
          image: my-app:1.0.0
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: {duration: 5m}
        - setWeight: 30
        - pause: {duration: 5m}
        - setWeight: 60
        - pause: {duration: 5m}
        - setWeight: 100
      canaryService: my-app-canary
      stableService: my-app-stable
      trafficRouting:
        nginx:
          stableIngress: my-app-ingress
```

## 常见误区

**误区一："GitOps 不需要 CI"**

GitOps 只管 CD 部分。CI 负责构建镜像、运行测试、更新 GitOps 仓库。

**误区二："生产环境自动同步"**

生产环境建议手动同步，避免未经审核的变更直接上线。开发环境可以自动同步。

## 工程建议

1. **开发环境自动同步，生产环境手动同步**
2. **保护 main 分支**：所有变更通过 PR 审核
3. **使用 ApplicationSet 管理多环境**：避免重复配置
4. **监控 ArgoCD 同步状态**：同步失败时发送告警
5. **定期备份 ArgoCD 配置**

## 小结

- 完整的 GitOps 流水线：CI 构建 → 更新 GitOps 仓库 → ArgoCD 同步到集群
- Kustomize base + overlays 管理多环境配置
- ArgoCD Application 管理每个环境的同步策略
- 生产环境使用手动同步 + 金丝雀发布
- 环境 Promotion 通过 Git 分支和 PR 审核实现

## 练习

### 练习一：端到端 GitOps

完成以下操作：
1. 创建 GitOps 仓库结构
2. 安装 ArgoCD
3. 配置 dev 和 prod 两个 Application
4. 修改 GitOps 仓库中的镜像 tag
5. 验证 dev 自动同步，prod 需要手动同步

### 练习二：回滚实践

模拟一次有问题的部署：
1. 将镜像 tag 改为一个不存在的版本
2. 观察 ArgoCD 同步失败
3. 使用 ArgoCD 回滚到上一个正常版本

---

## 参考答案

### 练习一

**答案**：

按照本课 Step 1-3 的指导完成 GitOps 仓库创建、ArgoCD 安装和 Application 配置。关键验证点：

```bash
# dev 环境自动同步
argocd app get my-app-dev
# Status: Synced

# 修改 Git 中 dev overlay 的镜像 tag
# 等待 3 分钟（ArgoCD 默认同步周期）
argocd app get my-app-dev
# 应该看到新的镜像 tag

# prod 环境需要手动同步
argocd app get my-app-prod
# Status: OutOfSync
argocd app sync my-app-prod
```

### 练习二

**答案**：

```bash
# 1. 将镜像 tag 改为不存在的版本
# 编辑 GitOps 仓库中的 deployment，设置 image: my-app:nonexistent

# 2. 同步
argocd app sync my-app-prod

# 3. 观察状态
argocd app get my-app-prod
# Health: Degraded
# Pod 状态: ImagePullBackOff

# 4. 回滚
argocd app history my-app-prod
# 找到上一个正常版本的 revision
argocd app rollback my-app-prod <revision>

# 5. 验证恢复
argocd app get my-app-prod
# Health: Healthy
```

**要点**：
- ArgoCD 的回滚是通过重新应用旧版本的配置实现的
- 回滚后需要手动同步或等待自动同步
- 生产环境应该设置告警，同步失败时及时通知

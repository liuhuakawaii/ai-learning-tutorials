# kubectl 与集群操作

## 场景引入

Kubernetes 集群已经搭好了（或者你用的是托管服务），现在你需要和它交互。kubectl 是你和集群对话的主要工具——创建资源、查看状态、排查问题、执行临时操作，全都靠它。

但 kubectl 的命令非常多，新手容易陷入两个极端：要么死记硬背几百个命令，要么只记 `kubectl get` 和 `kubectl apply`。正确的学习方式是理解 kubectl 的命令结构，掌握高频命令，遇到不熟的命令知道怎么查帮助。

## 学习目标

1. 理解 kubectl 的命令结构和通用语法
2. 掌握查看、创建、更新、删除资源的高频命令
3. 学会使用上下文切换管理多个集群
4. 掌握 kubectl 的输出格式和过滤选项
5. 学会用 kubectl 进行基本的故障排查

## kubectl 命令结构

kubectl 的命令遵循统一的语法模式：

```bash
kubectl <操作> <资源类型> [资源名称] [选项]
```

```bash
# 操作：get, describe, create, apply, delete, logs, exec, port-forward ...
# 资源类型：pod, service, deployment, node, namespace ...
# 资源名称：可选，不指定则列出所有

# 示例
kubectl get pods                      # 列出所有 Pod
kubectl get pod my-pod                # 查看指定 Pod
kubectl describe pod my-pod           # 查看 Pod 详细信息
kubectl delete pod my-pod             # 删除 Pod
```

## 查看资源（get）

`kubectl get` 是你用得最多的命令。

```bash
# 查看所有 Pod
kubectl get pods

# 查看所有命名空间的 Pod
kubectl get pods --all-namespaces
kubectl get pods -A                   # 简写

# 查看更多信息（IP、Node、重启次数）
kubectl get pods -o wide

# 查看指定命名空间的 Pod
kubectl get pods -n kube-system

# 查看多种资源
kubectl get pods,svc,deploy

# 持续监听变化
kubectl get pods -w                   # watch 模式

# 按标签过滤
kubectl get pods -l app=nginx
kubectl get pods -l 'app in (nginx, web)'

# 只显示名称
kubectl get pods -o name
```

### 输出格式

```bash
# YAML 格式输出
kubectl get pod my-pod -o yaml

# JSON 格式输出
kubectl get pod my-pod -o json

# 自定义列
kubectl get pods -o custom-columns=\
  NAME:.metadata.name,\
  STATUS:.status.phase,\
  IP:.status.podIP,\
  NODE:.spec.nodeName

# 使用 jsonpath 提取特定字段
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# 排序
kubectl get pods --sort-by='.status.startTime'
```

## 查看详情（describe）

```bash
# 查看 Pod 的完整信息，包括事件
kubectl describe pod my-pod

# 查看 Node 的资源使用情况
kubectl describe node node-1

# 查看 Service 的 Endpoint
kubectl describe service my-svc
```

`describe` 输出中最重要的是底部的 **Events** 部分，它记录了资源生命周期中的关键事件：

```
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  1m    default-scheduler  Successfully assigned default/my-pod to node-1
  Normal  Pulling    1m    kubelet            Pulling image "nginx:1.25"
  Normal  Pulled     50s   kubelet            Successfully pulled image "nginx:1.25"
  Normal  Created    50s   kubelet            Created container nginx
  Normal  Started    50s   kubelet            Started container nginx
```

## 创建和更新资源

### 命令式创建

```bash
# 创建 Deployment
kubectl create deployment nginx --image=nginx:1.25 --replicas=3

# 创建 Service
kubectl expose deployment nginx --port=80 --type=ClusterIP

# 创建 Namespace
kubectl create namespace my-app

# 创建 Secret
kubectl create secret generic db-pass --from-literal=password=my-secret
```

### 声明式管理（推荐）

```bash
# apply：创建或更新资源（幂等）
kubectl apply -f deployment.yaml

# apply 整个目录
kubectl apply -f ./k8s/

# apply 多个文件
kubectl apply -f dep.yaml -f svc.yaml

# 查看变更但不执行（dry-run）
kubectl apply -f deployment.yaml --dry-run=client

# 添加注解标记最后一次应用的配置
kubectl apply -f deployment.yaml --record
```

### 删除资源

```bash
# 删除指定资源
kubectl delete pod my-pod

# 通过 YAML 文件删除
kubectl delete -f deployment.yaml

# 删除命名空间中的所有 Pod
kubectl delete pods --all -n my-namespace

# 强制删除（卡在 Terminating 时使用）
kubectl delete pod my-pod --force --grace-period=0
```

## 上下文切换

如果你管理多个集群（开发、测试、生产），需要频繁切换上下文。

```bash
# 查看所有上下文
kubectl config get-contexts

# 查看当前上下文
kubectl config current-context

# 切换到指定上下文
kubectl config use-context my-cluster

# 查看完整配置
kubectl config view
```

上下文配置存储在 `~/.kube/config` 中：

```yaml
# ~/.kube/config 结构（简化）
apiVersion: v1
kind: Config
clusters:
  - name: dev-cluster
    cluster:
      server: https://dev.example.com:6443
      certificate-authority-data: <ca-cert>
  - name: prod-cluster
    cluster:
      server: https://prod.example.com:6443
      certificate-authority-data: <ca-cert>
contexts:
  - name: dev
    context:
      cluster: dev-cluster
      namespace: default
      user: dev-user
  - name: prod
    context:
      cluster: prod-cluster
      namespace: production
      user: prod-user
current-context: dev
```

### kubectx 和 kubens

社区有两个小工具让上下文切换更方便：

```bash
# kubectx：快速切换上下文
kubectx                   # 列出所有上下文
kubectx dev               # 切换到 dev
kubectx -                 # 切换回上一个上下文

# kubens：快速切换命名空间
kubens                    # 列出所有命名空间
kubens production         # 切换到 production 命名空间
```

## 日志和调试

```bash
# 查看 Pod 日志
kubectl logs my-pod

# 实时跟踪日志
kubectl logs -f my-pod

# 查看最近 100 行
kubectl logs --tail=100 my-pod

# 查看过去 1 小时的日志
kubectl logs --since=1h my-pod

# 查看多容器 Pod 中指定容器的日志
kubectl logs my-pod -c sidecar

# 查看已终止容器的日志
kubectl logs my-pod --previous

# 在运行中的容器里执行命令
kubectl exec -it my-pod -- /bin/sh

# 拷贝文件
kubectl cp my-pod:/var/log/app.log ./app.log

# 端口转发
kubectl port-forward svc/my-svc 8080:80

# 查看 Pod 中的环境变量
kubectl exec my-pod -- env
```

## 命名空间管理

命名空间用于在同一集群内隔离资源：

```bash
# 查看命名空间
kubectl get namespaces

# 创建命名空间
kubectl create namespace team-a

# 在指定命名空间中操作
kubectl get pods -n team-a

# 设置默认命名空间（后续命令不用每次加 -n）
kubectl config set-context --current --namespace=team-a
```

## 常用的排查流程

当你遇到 Pod 异常时，标准排查流程：

```bash
# 第一步：查看 Pod 状态
kubectl get pods
# 常见异常状态：CrashLoopBackOff、ImagePullBackOff、Pending、Evicted

# 第二步：查看 Pod 详情和事件
kubectl describe pod <pod-name>
# 重点关注 Events 部分

# 第三步：查看日志
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # 如果容器重启过

# 第四步：进入容器调试
kubectl exec -it <pod-name> -- /bin/sh
# 检查文件、网络、进程是否正常

# 第五步：查看 Node 状态
kubectl describe node <node-name>
# 检查资源是否充足、是否有 Taint
```

## 常见误区

**误区一："kubectl 就是 CRUD"**

kubectl 不只是增删改查。它还能查看日志、端口转发、执行命令、拷贝文件、查看资源使用率。掌握这些调试命令比记住 CRUD 语法更重要。

**误区二："--all-namespaces 和 --namespace 可以混用"**

`-A`（--all-namespaces）会覆盖 `-n`。同时使用时 `-A` 生效。

**误区三："kubectl apply 和 kubectl create 是一样的"**

`create` 是命令式操作，资源已存在会报错。`apply` 是声明式操作，资源已存在则更新，不存在则创建。生产环境应该始终使用 `apply`。

## 工程建议

1. **始终使用 YAML 文件管理资源**：即使是临时测试，也先写 YAML 再 apply，而不是用命令式 create
2. **使用命名空间隔离环境**：不要把所有资源都放在 default 命名空间
3. **配置 kubectl 自动补全**：
   ```bash
   # Bash
   source <(kubectl completion bash)
   echo 'source <(kubectl completion bash)' >> ~/.bashrc

   # Zsh
   source <(kubectl completion zsh)
   echo 'source <(kubectl completion zsh)' >> ~/.zshrc
   ```
4. **善用 `kubectl explain`**：不记得字段名时，`kubectl explain pod.spec.containers` 比查文档更快

## 小结

- kubectl 命令结构：`kubectl <操作> <资源类型> [资源名称]`
- 高频操作：get、describe、apply、delete、logs、exec
- 上下文切换管理多集群，命名空间隔离多环境
- 排障流程：get 状态 → describe 事件 → 查日志 → exec 调试
- 始终使用声明式 apply 而不是命令式 create

## 练习

### 练习一：kubectl 命令练习

完成以下操作，每步写出对应的 kubectl 命令：

1. 创建一个名为 `web` 的 Deployment，使用 `nginx:1.25` 镜像，3 个副本
2. 查看该 Deployment 的详细信息
3. 将副本数从 3 扩展到 5（使用 YAML 文件方式）
4. 查看所有 Pod 的 IP 和所在 Node
5. 查看其中一个 Pod 的日志
6. 进入其中一个 Pod 的容器内部

### 练习二：上下文管理

假设你有以下三个集群需要管理：
- 本地开发集群（Kind 创建的 kind-dev）
- 测试集群（test.example.com）
- 生产集群（prod.example.com）

写出完整的 kubeconfig 配置，以及在三个集群之间切换的命令。

---

## 参考答案

### 练习一

**思路**：覆盖 kubectl 的核心 CRUD 和调试操作。

**答案**：

```bash
# 1. 创建 Deployment
kubectl create deployment web --image=nginx:1.25 --replicas=3

# 2. 查看详细信息
kubectl describe deployment web

# 3. 扩展到 5 个副本
# 先导出当前配置
kubectl get deployment web -o yaml > web-deploy.yaml
# 修改 replicas: 3 → replicas: 5
# 然后应用
kubectl apply -f web-deploy.yaml

# 或者更简单的方式（命令式，临时操作可用）
kubectl scale deployment web --replicas=5

# 4. 查看 Pod 的 IP 和 Node
kubectl get pods -o wide

# 5. 查看日志（替换为实际 Pod 名称）
kubectl logs web-xxxxx-yyyyy

# 6. 进入容器
kubectl exec -it web-xxxxx-yyyyy -- /bin/sh
```

**要点**：
- `create` 适合快速创建，`apply` 适合声明式管理
- `scale` 是命令式操作，临时扩容可以，持久变更应该改 YAML
- `-o wide` 是快速获取额外信息的好方法

### 练习二

**思路**：kubeconfig 文件由 clusters、users、contexts 三部分组成。

**答案**：

```yaml
# ~/.kube/config
apiVersion: v1
kind: Config
clusters:
  - name: kind-dev
    cluster:
      server: https://127.0.0.1:37379
      certificate-authority-data: <kind-ca-data>
  - name: test-cluster
    cluster:
      server: https://test.example.com:6443
      certificate-authority-data: <test-ca-data>
  - name: prod-cluster
    cluster:
      server: https://prod.example.com:6443
      certificate-authority-data: <prod-ca-data>
users:
  - name: kind-dev
    user:
      client-certificate-data: <dev-cert>
      client-key-data: <dev-key>
  - name: test-user
    user:
      token: <test-token>
  - name: prod-user
    user:
      token: <prod-token>
contexts:
  - name: dev
    context:
      cluster: kind-dev
      user: kind-dev
      namespace: default
  - name: test
    context:
      cluster: test-cluster
      user: test-user
      namespace: default
  - name: prod
    context:
      cluster: prod-cluster
      user: prod-user
      namespace: production
current-context: dev
```

切换命令：
```bash
kubectl config use-context dev    # 切换到本地开发
kubectl config use-context test   # 切换到测试集群
kubectl config use-context prod   # 切换到生产集群
```

**要点**：
- 每个 context 绑定一个 cluster 和一个 user
- 可以设置默认 namespace，避免每次加 `-n`
- 生产集群的 kubeconfig 要妥善保管，不要提交到 Git

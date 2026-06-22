# Kubernetes 架构

## 场景引入

你已经理解了为什么需要容器编排，决定学习 Kubernetes。但在动手操作之前，你需要先搞清楚一个问题：Kubernetes 集群内部到底是怎么工作的？当你执行 `kubectl apply -f deployment.yaml` 时，从 YAML 文件到容器真正运行在某台机器上，中间经历了什么？

理解架构不是学术练习。当你遇到"Pod 一直 Pending"、"Service 访问不到"、"Node NotReady"这些问题时，只有理解架构才能快速定位问题出在哪个环节。

## 学习目标

1. 描述 Kubernetes 集群的整体架构
2. 理解 Control Plane 各组件的职责
3. 理解 Worker Node 各组件的职责
4. 掌握 Pod 的核心概念和设计动机
5. 了解一次 `kubectl apply` 请求的完整处理流程

## 整体架构

Kubernetes 集群由两类节点组成：

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ API      │  │ etcd     │  │ Scheduler│  │Controller│ │
│  │ Server   │  │          │  │          │  │Manager   │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
         │              │              │
         │              │              │
┌────────▼──────────────▼──────────────▼────────────────┐
│                    Worker Node 1                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ kubelet  │  │ kube-    │  │  ┌─────┐ ┌─────┐    ││
│  │          │  │ proxy    │  │  │Pod A│ │Pod B│    ││
│  └──────────┘  └──────────┘  │  └─────┘ └─────┘    ││
│                               │       Container      ││
│                               │       Runtime        ││
│                               └──────────────────────┘│
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    Worker Node 2                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ kubelet  │  │ kube-    │  │  ┌─────┐ ┌─────┐    ││
│  │          │  │ proxy    │  │  │Pod C│ │Pod D│    ││
│  └──────────┘  └──────────┘  │  └─────┘ └─────┘    ││
│                               │       Container      ││
│                               │       Runtime        ││
│                               └──────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Control Plane 组件

Control Plane 是集群的大脑，负责全局决策和状态管理。

### API Server（kube-apiserver）

API Server 是整个集群的唯一入口。所有操作——无论是你用 kubectl 执行的命令，还是集群内部组件之间的通信——都必须经过 API Server。

```bash
# 你执行的每个 kubectl 命令，本质都是发 HTTP 请求给 API Server
kubectl get pods
# 等价于
curl https://<api-server>:6443/api/v1/namespaces/default/pods \
  --header "Authorization: Bearer <token>"
```

API Server 的核心职责：
- **认证（Authentication）**：验证请求者的身份（证书、Token、OIDC）
- **授权（Authorization）**：检查请求者是否有权限执行这个操作（RBAC）
- **准入控制（Admission Control）**：在对象创建/修改前执行额外校验和变更
- **持久化**：将对象状态存储到 etcd

### etcd

etcd 是集群的数据库，存储了所有 K8s 对象的状态。它是一个分布式键值存储，使用 Raft 共识算法保证数据一致性。

```bash
# etcd 中存储的数据示例（简化）
/registry/pods/default/my-pod        → Pod 定义和状态
/registry/deployments/default/my-app → Deployment 定义
/registry/services/default/my-svc    → Service 定义
/registry/nodes/node-1               → Node 信息
```

etcd 的关键特性：
- 强一致性：写入成功后，所有读取都能看到最新数据
- 高可用：通常部署 3 或 5 个节点（奇数个，用于 Raft 选举）
- Watch 机制：支持监听某个键的变化，这是 K8s 控制器模式的基础

**注意**：etcd 是整个集群最关键的组件。etcd 挂了，集群就瘫了。生产环境一定要做好 etcd 的备份和高可用。

### Scheduler（kube-scheduler）

当一个新的 Pod 被创建但还没有指定运行在哪个 Node 上时，Scheduler 负责决定它应该跑在哪台机器上。

调度过程分为两步：

```
1. 过滤（Filtering）
   - 哪些 Node 有足够的 CPU/内存？
   - 哪些 Node 满足 nodeSelector/affinity 要求？
   - 哪些 Node 没有被 taint？

2. 打分（Scoring）
   - 哪些 Node 的资源利用率更均衡？
   - 哪些 Node 已经有相同 Pod 的亲和/反亲和规则？
   - 最终选择得分最高的 Node
```

### Controller Manager（kube-controller-manager）

Controller Manager 运行着一组控制器，每个控制器负责一种资源对象的"调谐"（reconciliation）。

```yaml
# 当你创建一个 replicas: 3 的 Deployment
# Deployment Controller 的工作流程：
#
# 1. 观察到 Deployment 期望 3 个副本
# 2. 检查当前只有 1 个 ReplicaSet
# 3. 创建 ReplicaSet，设置 replicas: 3
#
# ReplicaSet Controller 的工作流程：
# 1. 观察到 ReplicaSet 期望 3 个 Pod
# 2. 检查当前只有 2 个 Pod
# 3. 创建 1 个新 Pod
#
# 这就是"控制循环"：不断对比期望状态和实际状态，消除差异
```

常见的控制器：
- **Deployment Controller**：管理 Deployment 和 ReplicaSet
- **Node Controller**：监控 Node 的健康状态
- **Job Controller**：管理一次性任务（Job）
- **Service Account Controller**：为新的 Namespace 创建默认 ServiceAccount

## Worker Node 组件

Worker Node 是实际运行容器的地方。

### kubelet

kubelet 是每个 Node 上的代理，负责：

```bash
# kubelet 的核心循环：
while true:
    1. 从 API Server 获取分配到本 Node 的 Pod 列表
    2. 确保这些 Pod 中描述的容器都在运行
    3. 向 API Server 报告 Pod 的状态
    4. 执行容器健康检查（liveness/readiness probe）
```

kubelet 不运行在容器中，它是通过 systemd 或 init 进程直接运行在 Node 上的。

### kube-proxy

kube-proxy 负责实现 Service 的网络转发。当一个 Pod 访问 `my-service:80` 时，kube-proxy 确保请求被转发到后端的某个 Pod。

```bash
# kube-proxy 的三种模式：
# iptables（默认）：通过 iptables 规则实现转发
# ipvs：通过 IPVS 实现更高效的负载均衡
# userspace：早期实现，已不推荐
```

### Container Runtime

容器运行时负责实际运行容器。K8s 通过 CRI（Container Runtime Interface）与运行时交互。

```bash
# 常见的容器运行时：
# containerd：Docker 的核心运行时，K8s 最常用
# CRI-O：专为 K8s 设计的轻量运行时
# Docker：K8s 1.24 开始不再直接支持（dockershim 移除）
```

## Pod：最小调度单元

Pod 是 K8s 中最小的可部署单元，而不是容器。一个 Pod 可以包含一个或多个容器。

### 为什么需要 Pod

```yaml
# 一个典型的多容器 Pod：Web 应用 + 日志收集器
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
    - name: web
      image: nginx:1.25
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/nginx
    - name: log-collector
      image: fluentd:latest
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/nginx
          readOnly: true
  volumes:
    - name: log-volume
      emptyDir: {}
```

Pod 的设计动机：
- **共享网络**：Pod 内的容器共享同一个 IP 和端口空间，可以用 `localhost` 互相访问
- **共享存储**：Pod 内的容器可以共享 Volume
- **共同调度**：Pod 内的容器总是被调度到同一台机器上
- **共同生命周期**：Pod 内的容器一起创建、一起销毁

### 一次 kubectl apply 的完整旅程

```bash
kubectl apply -f deployment.yaml
```

这个命令背后发生了什么：

```
1. kubectl 读取 YAML，发送 POST 请求给 API Server
2. API Server 认证、授权、准入控制
3. API Server 将 Deployment 对象存入 etcd
4. Deployment Controller 监听到新 Deployment
5. Deployment Controller 创建 ReplicaSet
6. ReplicaSet Controller 监听到新 ReplicaSet
7. ReplicaSet Controller 创建 3 个 Pod（spec 中没有 nodeName）
8. Scheduler 监听到未调度的 Pod
9. Scheduler 为每个 Pod 选择合适的 Node，更新 Pod 的 nodeName
10. 目标 Node 的 kubelet 监听到分配给自己的 Pod
11. kubelet 调用 containerd 拉取镜像、创建容器
12. kubelet 向 API Server 报告 Pod 状态
13. kube-proxy 更新网络规则，使 Service 可以路由到新 Pod
```

## 常见误区

**误区一："Control Plane 只能有一台机器"**

生产环境的 Control Plane 通常是 3 台或 5 台组成的高可用集群。API Server 前面通常有负载均衡器。

**误区二："一个容器就是一个 Pod"**

一个 Pod 可以包含多个容器。但大多数情况下，一个 Pod 只运行一个主容器，加上可选的 Sidecar 容器。

**误区三："kubelet 是运行在容器里的"**

kubelet 是直接运行在 Node 上的进程（通过 systemd 管理），不是容器。它负责管理容器，自己不能是容器。

## 工程建议

1. **理解架构是排障的基础**：Pod 起不来要看 kubelet 日志，Service 不通要看 kube-proxy 规则，集群异常要看 etcd 和 API Server
2. **etcd 备份是生命线**：生产环境必须定期备份 etcd，最好每天一次
3. **Control Plane 高可用**：至少 3 个 Master 节点，API Server 前面放负载均衡器
4. **监控组件健康**：API Server、etcd、Scheduler、Controller Manager 都应该有监控和告警

## 小结

- Kubernetes 集群由 Control Plane 和 Worker Node 组成
- API Server 是唯一入口，etcd 是唯一存储
- Scheduler 负责调度，Controller Manager 负责调谐
- kubelet 负责 Node 上的容器管理，kube-proxy 负责网络转发
- Pod 是最小调度单元，可以包含多个共享网络和存储的容器

## 练习

### 练习一：组件职责匹配

将以下操作与对应的 K8s 组件匹配：

1. 决定新 Pod 跑在哪个 Node 上
2. 存储所有 K8s 对象的状态
3. 在 Node 上创建和管理容器
4. 处理 kubectl 的所有请求
5. 监控 Node 心跳，标记不健康 Node
6. 实现 Service 的网络转发

（选项：API Server、etcd、Scheduler、Controller Manager、kubelet、kube-proxy）

### 练习二：请求链路分析

当你执行 `kubectl get pods` 时，请求经过了哪些组件？请按顺序列出。当你执行 `kubectl delete pod my-pod` 时，又会发生什么？

---

## 参考答案

### 练习一

**答案**：

1. **Scheduler** — 根据资源需求、亲和性等规则选择 Node
2. **etcd** — 分布式键值存储，保存所有对象的期望状态和实际状态
3. **kubelet** — 通过 CRI 调用容器运行时创建和管理容器
4. **API Server** — 认证、授权、准入控制后处理请求
5. **Controller Manager 中的 Node Controller** — 定期检查 Node 的 `node-status` 更新
6. **kube-proxy** — 维护 iptables/IPVS 规则，将 Service ClusterIP 转发到后端 Pod

**要点**：
- 每个组件职责明确，单点故障不会导致整个集群瘫痪（除了 etcd）
- kubelet 和 kube-proxy 是 Node 级组件，每个 Node 各一份

### 练习二

**思路**：从 kubectl 命令开始，追踪请求在集群中的完整路径。

**答案**：

`kubectl get pods` 的请求链路：
1. kubectl 读取 `~/.kube/config`，找到 API Server 地址和认证信息
2. kubectl 发送 `GET /api/v1/namespaces/default/pods` 给 API Server
3. API Server 验证身份（认证）、检查权限（授权）
4. API Server 从 etcd 读取 Pod 列表
5. API Server 返回结果给 kubectl
6. kubectl 格式化输出到终端

`kubectl delete pod my-pod` 的额外步骤：
1. 步骤 1-3 同上
2. API Server 在 etcd 中给 Pod 添加 `deletionTimestamp`
3. kubelet 监听到 Pod 被标记删除
4. kubelet 调用容器运行时停止容器
5. kubelet 向 API Server 报告 Pod 已删除
6. API Server 从 etcd 中删除 Pod 记录
7. 如果 Pod 属于 ReplicaSet，ReplicaSet Controller 会立即创建新 Pod 来维持副本数

**要点**：
- 所有操作都经过 API Server，组件之间不直接通信
- 删除属于控制器管理的 Pod 会被自动重建，这就是"自愈"

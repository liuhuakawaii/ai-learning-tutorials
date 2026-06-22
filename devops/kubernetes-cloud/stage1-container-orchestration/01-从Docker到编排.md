# 从 Docker 到编排

## 场景引入

你用 Docker 把应用打包成了镜像，在本地 `docker run` 一下就能跑。项目初期这样做完全没问题——一个容器跑后端，一个容器跑前端，一个容器跑数据库，用 `docker-compose.yml` 把它们串起来，一切都很美好。

直到有一天，你的应用上了生产环境：

- 后端需要 3 个实例来扛流量，你想手动 `docker run` 三次，每次还要记得配不同的端口
- 其中一个后端实例挂了，你需要一种机制自动检测并重启它
- 数据库容器所在的宿主机磁盘满了，你需要把数据库迁移到另一台机器，同时保证后端能自动找到新的数据库地址
- 发布新版本时，你希望先启动新容器、验证没问题后再停掉旧容器，而不是先停再启导致服务中断

这些问题的共同本质是：**当你有大量容器需要跨多台机器管理时，手动操作变得不可行。** 这就是容器编排要解决的问题。

## 学习目标

1. 理解容器编排解决的核心问题
2. 了解 Docker Swarm 和 Kubernetes 的定位差异
3. 理解 Kubernetes 为什么成为行业标准
4. 建立"声明式"而非"命令式"的运维思维

## 为什么需要编排

### 容器的局限

Docker 解决了"在我的机器上能跑"的问题，但没有解决以下问题：

**服务发现**：容器重启后 IP 会变，其他容器如何找到它？

```bash
# 容器重启后 IP 可能从 172.17.0.2 变成 172.17.0.5
docker inspect --format '{{.NetworkSettings.IPAddress}}' my-app
```

**负载均衡**：多个后端实例前面需要一个统一入口来分发请求。

**自动恢复**：容器崩溃后需要自动重启，而不是等运维人员发现。

**滚动更新**：发布新版本时需要逐步替换旧容器，而不是一次性全部停掉。

**资源调度**：多台机器时，新容器应该放在哪台机器上？需要考虑 CPU、内存、磁盘。

**配置管理**：不同环境（开发、测试、生产）的配置如何安全地注入到容器中？

### 编排的核心价值

容器编排平台做的事情可以用一句话概括：**你告诉系统"我想要什么状态"，系统负责把现实变成那个状态。**

```
你说：我要 3 个后端实例，每个分配 0.5 CPU 和 512MB 内存

编排平台做的事：
  - 检查当前只有 2 个实例 → 启动第 3 个
  - 检查其中 1 个实例崩溃了 → 自动重启
  - 检查某台机器资源不足 → 把实例调度到其他机器
  - 检查新版本镜像已发布 → 逐步替换旧实例
```

这种"声明目标，系统执行"的模式叫做**声明式管理**，它是 Kubernetes 的核心设计哲学。

## Docker Swarm vs Kubernetes

Docker 自带了一个编排工具叫 Docker Swarm。既然 Docker 已经有编排能力了，为什么还需要 Kubernetes？

### Docker Swarm

Docker Swarm 的优势是**简单**。如果你已经会用 Docker，学 Swarm 几乎没有额外成本：

```bash
# 初始化 Swarm 集群
docker swarm init

# 部署一个服务，3 个副本
docker service create --name web --replicas 3 -p 80:80 nginx

# 扩容到 5 个副本
docker service scale web=5
```

Swarm 适合的场景：
- 团队规模小，不想投入太多精力学习编排工具
- 应用架构简单，不需要复杂的网络策略和存储方案
- 快速原型验证

### Kubernetes

Kubernetes 的优势是**强大的生态和扩展性**：

```yaml
# Kubernetes 的声明式部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
```

Kubernetes 比 Swarm 多了什么：

| 能力 | Docker Swarm | Kubernetes |
|------|-------------|------------|
| 自动扩缩容 | 不支持 | HPA/VPA/KEDA |
| 存储编排 | 基本支持 | PV/PVC/StorageClass |
| 网络策略 | 不支持 | NetworkPolicy |
| 配置管理 | Docker Config | ConfigMap/Secret |
| 滚动更新 | 基本支持 | 细粒度控制 |
| 社区生态 | 较小 | CNCF 生态，数千个项目 |
| 学习曲线 | 低 | 较高 |

### 为什么 Kubernetes 赢了

Kubernetes 成为事实标准不是因为它最简单，而是因为它最可扩展：

1. **声明式 API**：所有操作都是"描述期望状态"，而不是"执行某个动作"
2. **控制器模式**：内置的控制循环确保"实际状态"始终向"期望状态"收敛
3. **可扩展性**：CRD（自定义资源）让你可以定义自己的资源类型
4. **社区驱动**：CNCF 毕业项目，几乎所有云厂商都提供托管 K8s 服务

## 声明式 vs 命令式

理解声明式和命令式的区别是学习 K8s 的第一步。

**命令式**（Docker Swarm 风格）：
```bash
# "帮我做这件事"
docker service scale web=5
docker service update --image nginx:1.26 web
```

**声明式**（Kubernetes 风格）：
```yaml
# "我想要这个状态，你帮我达到"
spec:
  replicas: 5
  template:
    spec:
      containers:
        - image: nginx:1.26
```

声明式的好处：
- **可审计**：YAML 文件可以版本控制，知道什么时候改了什么
- **可回滚**：`git revert` 就能回到上一个版本
- **幂等**：多次 `apply` 同一个 YAML，结果一致
- **自愈**：系统持续对比"期望状态"和"实际状态"，自动修复偏差

## 常见误区

**误区一："我们项目小，不需要 Kubernetes"**

小项目确实不需要完整的 K8s 集群，但可以用 Kind 或 Minikube 在本地学习。而且很多托管 K8s 服务（如 EKS、GKE、AKS）已经大幅降低了运维成本。

**误区二："Docker Swarm 已经死了"**

Swarm 在 Docker Desktop 中仍然可用，对于小规模简单场景仍然是合理选择。只是在企业级场景中，Kubernetes 的生态优势太明显。

**误区三："学 Kubernetes 就是学 kubectl 命令"**

kubectl 只是操作集群的工具之一。更重要的是理解 K8s 的架构设计、资源对象模型和声明式理念。

## 工程建议

1. **从单节点集群开始**：用 Kind 或 Minikube 在本地学习，不要一开始就搭建多节点集群
2. **先理解概念再学命令**：理解 Pod、Service、Deployment 的关系比记住 kubectl 语法更重要
3. **用 YAML 而不是命令行**：即使是临时操作，也尽量写成 YAML 文件，培养声明式习惯
4. **选一个托管 K8s 服务**：如果要在生产环境使用，选 EKS/GKE/AKS 而不是自建集群

## 小结

- 容器编排解决的是大规模容器管理的自动化问题
- Kubernetes 凭借声明式 API、控制器模式和强大生态成为行业标准
- 声明式管理（描述目标）优于命令式管理（描述步骤）
- Docker Swarm 适合简单场景，Kubernetes 适合企业级场景

## 练习

### 练习一：编排需求分析

假设你有一个电商应用，包含以下组件：
- 前端（Vue3，需要 2 个实例）
- 后端 API（Node.js，需要 4 个实例）
- 商品搜索服务（Elasticsearch，需要 3 个节点）
- 数据库（PostgreSQL，主从架构）
- 缓存（Redis，需要 3 个实例）

列出你需要容器编排平台帮你解决的至少 5 个具体问题。

### 练习二：声明式思维

你当前有 3 个 Nginx 容器在运行，现在需要：
1. 将 Nginx 版本从 1.25 升级到 1.26
2. 副本数从 3 扩展到 5
3. 添加一个环境变量 `ENV=production`

用声明式的 YAML 描述这个"期望状态"（不需要是完整 K8s YAML，用你理解的方式表达即可）。

---

## 参考答案

### 练习一

**思路**：从编排的核心能力出发，逐个分析哪些问题手动无法解决。

**答案**：

1. **服务发现**：前端需要找到后端 API，后端需要找到 Elasticsearch 和 Redis。容器重启后 IP 会变化，需要一个机制让服务之间能稳定地互相访问。
2. **负载均衡**：4 个后端 API 实例需要均匀分担请求，当某个实例健康检查失败时自动摘除。
3. **自动恢复**：任何一个组件的容器崩溃后，系统应自动在其他节点重启，而不是等人工干预。
4. **滚动更新**：后端 API 发布新版本时，需要先启动新实例、确认健康后再停掉旧实例，避免服务中断。
5. **资源调度**：13+ 个容器分布在多台宿主机上，需要自动决定每个容器放在哪台机器，考虑 CPU、内存、磁盘资源。
6. **配置管理**：数据库连接串、Redis 地址、API 密钥等配置需要安全地注入到各组件中，且不同环境配置不同。
7. **存储持久化**：PostgreSQL 和 Elasticsearch 的数据需要持久化存储，容器迁移时数据不能丢失。

**要点**：
- 编排解决的问题远不止"运行容器"
- 核心是自动化：发现、恢复、调度、更新

### 练习二

**思路**：声明式的核心是描述"最终想要的状态"，而不是"执行什么动作"。

**答案**：

```yaml
# 期望状态描述
service:
  name: web-server
  desired_state:
    image: nginx:1.26          # 从 1.25 升级到 1.26
    replicas: 5                 # 从 3 扩展到 5
    environment:
      - ENV=production          # 新增环境变量
    ports:
      - "80:80"
    health_check:
      path: /healthz
      interval: 10s
```

**要点**：
- 声明式不关心"当前有几个容器"或"当前是什么版本"
- 系统对比当前状态和期望状态，自动计算需要执行的操作
- 多次应用同一个声明，结果一致（幂等性）

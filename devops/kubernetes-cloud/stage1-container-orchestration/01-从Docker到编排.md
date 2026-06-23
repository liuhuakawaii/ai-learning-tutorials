# 从 Docker 到编排

> 前置知识：Docker 基础（镜像构建、容器管理、docker-compose）

## 三个容器变三十个

你用 Docker 把应用打包成了镜像，本地 `docker-compose up` 一切正常。项目上线后，流量增长，你需要 3 个后端实例来扛流量。

手动 `docker run` 三次，每次配不同端口。某天一个实例挂了，你没发现——因为没有自动健康检查。某天要发布新版本，你先停旧容器再启新容器——中间有 30 秒的服务中断。

然后产品说要上微服务。从 3 个容器变成 30 个，分布在 5 台机器上。你开始用 Excel 记录"哪台机器跑哪个容器"，每次部署都要 SSH 到好几台机器上操作。

这不是"技术债"，这是**管理债**——容器本身没问题，但容器的管理方式撑不住了。

## 容器编排解决什么问题

把上面的场景拆解成具体问题：

| 问题 | 手动管理 | 编排平台 |
|------|---------|---------|
| 容器挂了 | 等人发现，手动重启 | 自动检测，自动重启 |
| 流量增长 | 手动启动更多实例 | 自动扩缩容 |
| 发布新版本 | 先停后启，服务中断 | 滚动更新，零停机 |
| 服务发现 | 用 Excel 记录 IP | 自动注册，按名访问 |
| 资源调度 | 人工判断放哪台机器 | 自动调度，考虑资源 |
| 配置管理 | SSH 上去改配置 | 声明式配置，自动同步 |

容器编排平台做的事情可以用一句话概括：**你告诉系统"我想要什么状态"，系统负责把现实变成那个状态。**

```
声明式（你告诉系统想要什么）：
  "我要 3 个 nginx:1.25 副本，每个分配 256MB 内存"

命令式（你告诉系统怎么做）：
  "在机器 A 上 docker run nginx:1.25，在机器 B 上 docker run nginx:1.25..."
```

声明式的好处：系统会持续检查"现实"和"期望"的差距，自动修正。容器挂了？系统再启动一个。不需要你盯着。

## Docker Swarm vs Kubernetes

Docker 内置了一个编排工具叫 Swarm。它简单、易上手，但功能有限。

```
Docker Swarm：
  ✓ 和 Docker 完美集成，学习成本低
  ✓ 适合小规模集群（< 50 个节点）
  ✗ 功能有限，不支持复杂的调度策略
  ✗ 社区活跃度低，生态不如 K8s

Kubernetes（K8s）：
  ✓ 功能强大，几乎所有场景都能覆盖
  ✓ 生态丰富，大量工具和最佳实践
  ✓ 行业标准，云厂商都支持
  ✗ 学习曲线陡峭
  ✗ 运维复杂度高
```

2024 年的事实标准是 Kubernetes。Docker Swarm 适合学习和小项目，但生产环境几乎都是 K8s。

## 声明式思维

Kubernetes 的核心理念是声明式管理。你不再告诉系统"做什么"，而是告诉系统"要什么"。

```yaml
# 你写的 YAML（声明期望状态）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3           # 我要 3 个副本
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          resources:
            limits:
              memory: "256Mi"
              cpu: "500m"
```

K8s 控制平面会持续做一件事：比较"期望状态"和"实际状态"，如果有差异就采取行动。

```
期望：3 个 nginx 副本
实际：2 个（有一个挂了）
差异：缺少 1 个
行动：自动创建一个新的 Pod
```

这种思维转变是学 K8s 最重要的一步。

## 练习

### 练习一：列举编排需求

列出你当前项目在以下维度遇到的问题：服务发现、自动恢复、滚动更新、资源调度、配置管理。如果已经有解决方案，写下当前方案的不足。

### 练习二：声明式 vs 命令式

把以下命令式操作转换为声明式描述：

```bash
docker run -d --name web1 -p 8081:80 nginx:1.25
docker run -d --name web2 -p 8082:80 nginx:1.25
docker run -d --name web3 -p 8083:80 nginx:1.25
```

### 练习三：Swarm vs K8s

你是一个 5 人创业团队的技术负责人，需要把 3 个服务部署到 2 台服务器上。选 Docker Swarm 还是 Kubernetes？说明理由。

---

## 参考答案

### 练习一

没有标准答案。关键是识别出"手动操作"的环节——这些就是编排平台要解决的问题。

### 练习二

声明式描述："我要 3 个 nginx:1.25 副本，对外暴露 80 端口。" K8s YAML：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
```

区别：命令式需要你记住每个容器的端口映射，手动管理。声明式只需要说"3 个副本"，K8s 自动分配和管理。

### 练习三

选 Docker Swarm。

理由：
1. 团队小，不需要 K8s 的复杂调度功能
2. 只有 2 台服务器，K8s 的 Control Plane 开销太大
3. 学习成本低，5 人团队没有专职运维
4. 如果未来规模增长，可以再迁移到 K8s

什么时候该切换到 K8s：服务器超过 5 台、服务超过 10 个、需要复杂的发布策略（金丝雀、蓝绿）、需要自动扩缩容。

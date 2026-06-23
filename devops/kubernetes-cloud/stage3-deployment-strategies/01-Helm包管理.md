# Helm 包管理

> 前置知识：Deployment、Service、ConfigMap 等 K8s 核心资源（Stage 2）

## 多环境的 YAML 地狱

你已经能把应用部署到 K8s 了，但每次部署需要 `kubectl apply` 六七个 YAML 文件。要部署到开发、测试、生产三个环境，每个环境的数据库地址、密码、副本数都不同。

你开始复制 YAML 文件：`dev/`、`staging/`、`prod/` 三个目录。改一个配置要在三个目录里同步修改。改漏了？生产环境用了测试的数据库地址。

Helm 是 K8s 的包管理器，类似于 Linux 的 apt 或 Node.js 的 npm。它用模板和变量解决多环境配置复用的问题。

## Helm 核心概念

```
Chart：K8s 资源的打包模板，类似于 Docker 镜像
Release：Chart 的一次部署实例，类似于运行中的容器
Repository：Chart 的存储仓库，类似于 Docker Hub
```

```bash
# 安装一个 Chart（创建一个 Release）
helm install my-release bitnami/nginx

# 升级
helm upgrade my-release bitnami/nginx --set replicaCount=3

# 回滚
helm rollback my-release 1

# 卸载
helm uninstall my-release
```

## Chart 目录结构

```
my-chart/
├── Chart.yaml          # Chart 元信息（名称、版本）
├── values.yaml         # 默认配置值
├── templates/          # K8s 资源模板
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── _helpers.tpl    # 模板辅助函数
├── charts/             # 依赖的子 Chart
└── tests/              # 测试
```

## 模板语法

Helm 使用 Go 模板语法。用 `{{ .Values.xxx }}` 引用 values.yaml 中的值：

```yaml
# values.yaml
replicaCount: 2
image:
  repository: nginx
  tag: "1.25"
service:
  port: 80
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: {{ .Values.service.port }}
```

## 多环境配置

```
my-chart/
├── values.yaml              # 默认值（开发环境）
├── values-staging.yaml      # staging 覆盖
└── values-production.yaml   # production 覆盖
```

```yaml
# values.yaml（默认）
replicaCount: 1
image:
  tag: "latest"
resources:
  limits:
    memory: "128Mi"

# values-production.yaml（生产覆盖）
replicaCount: 3
image:
  tag: "v1.2.3"
resources:
  limits:
    memory: "512Mi"
```

部署时指定 values 文件：

```bash
# 开发环境（用默认值）
helm install my-app ./my-chart

# staging
helm install my-app ./my-chart -f values-staging.yaml

# 生产
helm install my-app ./my-chart -f values-production.yaml
```

## 常用 Helm 操作

```bash
# 创建 Chart
helm create my-chart

# 模板渲染（不实际部署，只看生成的 YAML）
helm template my-app ./my-chart -f values-production.yaml

# 安装
helm install my-app ./my-chart -n myapp --create-namespace

# 升级（修改配置后）
helm upgrade my-app ./my-chart -f values-production.yaml -n myapp

# 查看历史
helm history my-app -n myapp

# 回滚
helm rollback my-app 1 -n myapp

# 卸载
helm uninstall my-app -n myapp
```

## 常见坑

### 坑一：values.yaml 的默认值

如果 values.yaml 中定义了 `replicaCount: 1`，但你忘记在 values-production.yaml 中覆盖，生产环境就只有 1 个副本。**部署前用 `helm template` 检查生成的 YAML。**

### 坑二：Chart 版本 vs 应用版本

```yaml
# Chart.yaml
version: 0.1.0        # Chart 版本
appVersion: "1.2.3"   # 应用版本
```

Chart 版本和应用版本是独立的。改了模板要递增 Chart 版本，改了应用镜像要递增 appVersion。

### 坑三：命名空间

```bash
# 不指定 namespace 会部署到 default
helm install my-app ./my-chart

# 始终指定 namespace
helm install my-app ./my-chart -n myapp --create-namespace
```

## 练习

### 练习一：创建 Chart

用 `helm create` 创建一个 Chart，修改 templates 中的 deployment.yaml 和 service.yaml，让它部署一个 Node.js 应用。用 `helm template` 验证生成的 YAML。

### 练习二：多环境部署

创建 values-staging.yaml 和 values-production.yaml，分别设置不同的副本数和资源限制。部署两个 release 到不同 namespace。

### 练习三：Helm 回滚

部署 v1 版本，升级到 v2，再回滚到 v1。用 `helm history` 查看版本历史。

---

## 参考答案

### 练习一

```bash
helm create my-node-app
# 修改 templates/deployment.yaml 中的 image
# 修改 values.yaml 中的 image.repository 和 image.tag
helm template my-node-app ./my-node-app
# 检查输出的 YAML 是否正确
```

### 练习二

```bash
# staging
helm install my-app ./my-node-app -f values-staging.yaml -n staging --create-namespace

# production
helm install my-app ./my-node-app -f values-production.yaml -n production --create-namespace

# 验证
kubectl get pods -n staging
kubectl get pods -n production
```

### 练习三

```bash
helm install my-app ./my-node-app -n myapp --create-namespace
helm upgrade my-app ./my-node-app --set image.tag=v2 -n myapp
helm history my-app -n myapp
helm rollback my-app 1 -n myapp
```

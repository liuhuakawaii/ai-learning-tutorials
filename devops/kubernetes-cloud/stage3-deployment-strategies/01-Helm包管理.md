# Helm 包管理

## 场景引入

你已经能把应用部署到 K8s 了，但每次部署需要 `kubectl apply` 六七个 YAML 文件。如果要部署到多个环境（开发、测试、生产），每个环境的配置略有不同，你需要维护多套 YAML 文件。改一个数据库地址，要在三个文件里同步修改——这很容易出错。

Helm 是 K8s 的包管理器，类似于 Linux 的 apt/yum 或 Node.js 的 npm。它把一组 K8s 资源打包成一个 Chart，通过模板和 Values 文件实现多环境配置复用。

## 学习目标

1. 理解 Helm 的核心概念：Chart、Release、Repository
2. 掌握 Helm Chart 的目录结构
3. 学会使用 Go 模板语法编写 Helm 模板
4. 掌握 values.yaml 的设计和覆盖机制
5. 学会使用 Helm 安装、升级、回滚应用

## Helm 核心概念

- **Chart**：K8s 资源的打包模板，类似于 Docker 镜像
- **Release**：Chart 的一次部署实例，类似于运行中的容器
- **Repository**：Chart 的存储仓库，类似于 Docker Hub

```bash
# Chart 是模板，Release 是实例
helm install my-release bitnami/nginx    # 从 Chart 创建 Release
helm upgrade my-release bitnami/nginx    # 升级 Release
helm rollback my-release 1               # 回滚到版本 1
```

## 安装 Helm

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Windows
choco install kubernetes-helm
```

## 使用公共 Chart

```bash
# 添加仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 搜索 Chart
helm search repo nginx
helm search hub nginx

# 查看 Chart 信息
helm show chart bitnami/nginx
helm show values bitnami/nginx

# 安装
helm install my-nginx bitnami/nginx \
  --namespace demo \
  --create-namespace \
  --set replicaCount=3 \
  --set service.type=ClusterIP

# 查看 Release
helm list -n demo

# 升级
helm upgrade my-nginx bitnami/nginx \
  --set replicaCount=5

# 回滚
helm history my-nginx -n demo
helm rollback my-nginx 1 -n demo

# 卸载
helm uninstall my-nginx -n demo
```

## 创建自定义 Chart

### Chart 目录结构

```bash
helm create my-app
```

```
my-app/
├── Chart.yaml          # Chart 元信息（名称、版本、描述）
├── values.yaml         # 默认配置值
├── charts/             # 依赖的子 Chart
├── templates/          # K8s 资源模板
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── serviceaccount.yaml
│   ├── _helpers.tpl    # 模板辅助函数
│   ├── NOTES.txt       # 安装后显示的提示信息
│   └── tests/
│       └── test-connection.yaml
└── .helmignore         # 打包时忽略的文件
```

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: A Helm chart for my web application
type: application
version: 0.1.0       # Chart 版本
appVersion: "1.0.0"   # 应用版本
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

### values.yaml

```yaml
replicaCount: 2

image:
  repository: my-app
  pullPolicy: IfNotPresent
  tag: "1.0.0"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  hosts:
    - host: app.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  LOG_LEVEL: info
  DB_HOST: ""

secrets:
  DB_PASSWORD: ""
```

## 模板语法

Helm 使用 Go template 语法，结合 Sprig 函数库。

### 基本语法

```yaml
# 引用值
{{ .Values.replicaCount }}

# 引用内置对象
{{ .Release.Name }}
{{ .Release.Namespace }}
{{ .Chart.Name }}

# 条件判断
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}

# 循环
{{- range .Values.ingress.hosts }}
- host: {{ .host }}
{{- end }}

# 定义变量
{{- $fullName := include "my-app.fullname" . }}
```

### Deployment 模板

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: 80
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
            {{- range $key, $value := .Values.secrets }}
            - name: {{ $key }}
              valueFrom:
                secretKeyRef:
                  name: {{ include "my-app.fullname" $ }}-secrets
                  key: {{ $key }}
            {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

### _helpers.tpl

```yaml
# templates/_helpers.tpl
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "my-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

## Values 覆盖

```bash
# 命令行覆盖
helm install my-app ./my-app --set replicaCount=3

# 文件覆盖（多环境）
helm install my-app ./my-app -f values-prod.yaml

# 多文件覆盖（后面的优先级更高）
helm install my-app ./my-app -f values-base.yaml -f values-prod.yaml
```

### 多环境 values 文件

```yaml
# values-dev.yaml
replicaCount: 1
env:
  LOG_LEVEL: debug
  DB_HOST: postgres-dev
resources:
  requests:
    cpu: 50m
    memory: 64Mi

# values-prod.yaml
replicaCount: 3
env:
  LOG_LEVEL: info
  DB_HOST: postgres-prod
resources:
  requests:
    cpu: 250m
    memory: 256Mi
autoscaling:
  enabled: true
```

## 常用 Helm 命令

```bash
# 安装
helm install <release-name> <chart> [-f values.yaml] [-n namespace]

# 查看已安装
helm list [-A]    # -A 所有命名空间

# 查看 Release 历史
helm history <release-name>

# 升级
helm upgrade <release-name> <chart> [-f values.yaml]

# 回滚
helm rollback <release-name> <revision>

# 卸载
helm uninstall <release-name>

# 模板渲染（不实际安装）
helm template <release-name> <chart> [-f values.yaml]

# lint 检查
helm lint <chart-path>
```

## 常见误区

**误区一："Helm 就是 K8s 的 apt"**

Helm 不只是安装包。它支持模板、多环境配置、版本管理、回滚、依赖管理，是一个完整的应用生命周期管理工具。

**误区二："values.yaml 里的值可以直接用字符串"**

敏感信息（密码、密钥）不应该写在 values.yaml 中，应该通过 `--set` 或外部 Secret 注入。

**误区三："Helm install 失败了就 uninstall 再 install"**

应该先排查失败原因。频繁 uninstall/install 可能导致数据丢失（特别是有 PV 的应用）。

## 工程建议

1. **Chart 版本遵循语义化版本**：`major.minor.patch`
2. **values.yaml 只放非敏感默认值**：密码通过 `--set` 或 Secret 注入
3. **使用 `helm template` 预览渲染结果**：安装前先检查生成的 YAML
4. **为每个环境维护独立的 values 文件**：`values-dev.yaml`、`values-staging.yaml`、`values-prod.yaml`
5. **Chart 依赖用 `dependencies` 管理**：而不是手动复制子 Chart

## 小结

- Helm 把 K8s 资源打包成 Chart，通过模板和 Values 实现多环境复用
- Chart 是模板，Release 是实例，Repository 是仓库
- Go 模板语法支持条件、循环、变量、函数
- 多环境通过不同的 values 文件覆盖默认值
- Helm 支持安装、升级、回滚、卸载的完整生命周期

## 练习

### 练习一：创建 Chart

为一个简单的 Web 应用创建 Helm Chart：
1. 使用 `helm create` 创建 Chart 骨架
2. 修改 templates 使其包含 Deployment 和 Service
3. 使用 `helm template` 预览渲染结果
4. 安装到本地集群并验证

### 练习二：多环境配置

为同一个 Chart 创建两套 values 文件：
1. `values-dev.yaml`：1 副本、debug 日志、小资源
2. `values-prod.yaml`：3 副本、info 日志、大资源、HPA 启用
3. 分别安装到 dev 和 prod 命名空间

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 创建 Chart
helm create web-app
cd web-app

# 2. 修改 values.yaml
# 设置 image、replicaCount 等默认值

# 3. 修改 templates/deployment.yaml
# 简化为基本的 Deployment 配置

# 4. 预览
helm template my-web ./web-app

# 5. 安装
helm install my-web ./web-app -n demo --create-namespace

# 6. 验证
kubectl get pods -n demo
kubectl get svc -n demo
```

### 练习二

**答案**：

```yaml
# values-dev.yaml
replicaCount: 1
image:
  tag: "latest"
env:
  LOG_LEVEL: debug
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 100m
    memory: 128Mi
autoscaling:
  enabled: false
```

```yaml
# values-prod.yaml
replicaCount: 3
image:
  tag: "1.0.0"
env:
  LOG_LEVEL: info
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

```bash
# 安装到 dev
helm install web-app ./web-app -f values-dev.yaml -n dev --create-namespace

# 安装到 prod
helm install web-app ./web-app -f values-prod.yaml -n prod --create-namespace

# 验证差异
helm diff release web-app -n dev
helm diff release web-app -n prod
```

**要点**：
- 同一个 Chart 通过不同 values 文件适配不同环境
- 生产环境应该开启 HPA 并设置合理的资源限制
- `helm diff` 插件可以预览升级的变更

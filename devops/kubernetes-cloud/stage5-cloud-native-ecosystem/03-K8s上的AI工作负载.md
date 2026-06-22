# K8s 上的 AI 工作负载

## 场景引入

你的团队训练了一个 LLM 模型，现在需要把它部署为在线推理服务。模型需要 GPU 才能高效运行，但 GPU 资源昂贵，你希望在没有请求时自动释放 GPU，有请求时快速拉起。同时，你可能有多个模型需要部署，每个模型需要不同的 GPU 配置。

K8s 原生支持 GPU 调度，结合 Kueue（任务队列）、KubeFlow（ML 平台）和 vLLM/TGI（推理引擎），可以在 K8s 上构建完整的 AI 推理平台。

## 学习目标

1. 了解 K8s 中 GPU 资源的调度方式
2. 掌握部署 AI 模型推理服务的基本流程
3. 了解 KubeFlow 的核心组件
4. 学会配置 GPU 资源请求和限制
5. 理解 AI 工作负载在 K8s 上的最佳实践

## GPU 调度

### 前置条件

1. Node 上安装了 NVIDIA GPU 驱动
2. 安装了 NVIDIA Container Toolkit
3. K8s 中部署了 NVIDIA Device Plugin

```bash
# 验证 GPU 是否可用
kubectl get nodes -o json | jq '.items[].status.allocatable["nvidia.com/gpu"]'

# 安装 NVIDIA Device Plugin
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.3/nvidia-device-plugin.yml
```

### 请求 GPU 资源

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  containers:
    - name: inference
      image: my-model:latest
      resources:
        limits:
          nvidia.com/gpu: 1    # 请求 1 个 GPU
        requests:
          cpu: "2"
          memory: "8Gi"
      env:
        - name: NVIDIA_VISIBLE_DEVICES
          value: "all"
```

GPU 调度的特点：
- GPU 只能整数分配（1、2、4），不支持小数
- GPU 是独占资源，不支持共享（除非使用 MIG 或 GPU 时间片）
- `requests` 和 `limits` 中的 GPU 值必须相等

### 多 GPU 调度

```yaml
resources:
  limits:
    nvidia.com/gpu: 4    # 请求 4 个 GPU
```

### GPU 节点选择

```yaml
spec:
  nodeSelector:
    nvidia.com/gpu.present: "true"
  tolerations:
    - key: nvidia.com/gpu
      operator: Exists
      effect: NoSchedule
```

## 部署模型推理服务

### 使用 vLLM 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vllm
  template:
    metadata:
      labels:
        app: vllm
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          command:
            - python3
            - -m
            - vllm.entrypoints.openai.api_server
          args:
            - "--model=meta-llama/Llama-2-7b-chat-hf"
            - "--tensor-parallel-size=1"
            - "--max-model-len=4096"
            - "--gpu-memory-utilization=0.9"
          ports:
            - containerPort: 8000
          resources:
            limits:
              nvidia.com/gpu: 1
              cpu: "4"
              memory: "16Gi"
            requests:
              cpu: "2"
              memory: "8Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            periodSeconds: 10
            initialDelaySeconds: 60
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            periodSeconds: 30
            initialDelaySeconds: 120
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-svc
spec:
  selector:
    app: vllm
  ports:
    - port: 8000
```

### 使用 TGI 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tgi-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tgi
  template:
    metadata:
      labels:
        app: tgi
    spec:
      containers:
        - name: tgi
          image: ghcr.io/huggingface/text-generation-inference:latest
          args:
            - "--model-id=meta-llama/Llama-2-7b-chat-hf"
            - "--num-shard=1"
          ports:
            - containerPort: 80
          resources:
            limits:
              nvidia.com/gpu: 1
          env:
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token
                  key: token
```

## KubeFlow

KubeFlow 是 K8s 上的 ML 平台，提供完整的机器学习工作流。

### 核心组件

```
KubeFlow
├── Kubeflow Pipelines    ← ML 工作流编排
├── KServe                ← 模型服务
├── Training Operator     ← 模型训练
├── Katib                 ← 超参数调优
├── Notebook Server       ← Jupyter Notebook
└── Central Dashboard     ← 统一界面
```

### KServe 模型服务

KServe（原 KFServing）提供无服务器模型推理。

```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama-2
spec:
  predictor:
    model:
      modelFormat:
        name: pytorch
      storageUri: "s3://models/llama-2-7b"
      resources:
        limits:
          nvidia.com/gpu: 1
          memory: "16Gi"
        requests:
          memory: "8Gi"
```

## GPU 资源优化

### GPU 时间片共享

允许多个 Pod 共享同一个 GPU（时间片方式）。

```yaml
# NVIDIA GPU 时间片配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: time-slicing-config
  namespace: nvidia-device-plugin
data:
  any: |-
    version: v1
    flags:
      migStrategy: none
    sharing:
      timeSlicing:
        resources:
          - name: nvidia.com/gpu
            replicas: 4    # 1 个 GPU 可以被 4 个 Pod 共享
```

### MIG（Multi-Instance GPU）

A100/H100 GPU 支持 MIG，将一个物理 GPU 划分为多个独立的 GPU 实例。

### GPU 内存优化

```yaml
# vLLM 内存优化参数
args:
  - "--gpu-memory-utilization=0.9"
  - "--max-model-len=2048"
  - "--quantization=awq"    # 使用量化模型减少显存占用
```

## 资源管理

### Kueue 任务队列

Kueue 管理 GPU 任务的排队和调度。

```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  name: inference-queue
spec:
  clusterQueue: gpu-cluster-queue
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: gpu-cluster-queue
spec:
  resourceGroups:
    - coveredResources: ["nvidia.com/gpu"]
      flavors:
        - name: nvidia-a100
          resources:
            - name: nvidia.com/gpu
              nominalQuota: 8
```

## 常见误区

**误区一："K8s 上的 GPU 和 CPU 调度一样"**

GPU 是独占资源，调度逻辑和 CPU 不同。GPU 不支持超分（overcommit），一个 GPU 只能分配给一个 Pod（除非 MIG 或时间片）。

**误区二："模型服务不需要 Readiness Probe"**

模型加载需要时间（特别是大模型），Readiness Probe 避免在模型加载完成前将流量导过来。

**误区三："GPU Pod 不需要设置资源限制"**

GPU Pod 仍然需要设置 CPU 和内存限制，防止非 GPU 资源耗尽。

## 工程建议

1. **使用 Readiness Probe**：大模型加载需要时间
2. **GPU 资源监控**：使用 DCGM Exporter 采集 GPU 指标
3. **模型量化**：AWQ/GPTQ 量化减少显存占用
4. **合理设置 batch size**：平衡延迟和吞吐
5. **使用 vLLM/TGI**：专业的 LLM 推理引擎，比自己实现高效得多

## 小结

- K8s 原生支持 GPU 调度，通过 `nvidia.com/gpu` 资源请求
- vLLM 和 TGI 是 K8s 上部署 LLM 的推荐方案
- KubeFlow 提供完整的 ML 平台（训练、推理、工作流）
- GPU 可以通过时间片或 MIG 共享
- 大模型部署需要注意启动时间和内存管理

## 练习

### 练习一：GPU Pod 部署

编写一个请求 GPU 资源的 Pod YAML（假设集群有 GPU Node）。

### 练习二：模型服务设计

为一个 7B 参数的 LLM 设计 K8s 部署方案，包括资源请求、探针、HPA。

---

## 参考答案

### 练习一

**答案**：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-inference
spec:
  nodeSelector:
    nvidia.com/gpu.present: "true"
  containers:
    - name: inference
      image: my-model:latest
      resources:
        limits:
          nvidia.com/gpu: 1
          cpu: "4"
          memory: "16Gi"
        requests:
          cpu: "2"
          memory: "8Gi"
      readinessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 60
        periodSeconds: 10
```

### 练习二

**答案**：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-7b
spec:
  replicas: 1
  selector:
    matchLabels:
      app: llm-7b
  template:
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          args:
            - "--model=meta-llama/Llama-2-7b-chat-hf"
            - "--gpu-memory-utilization=0.85"
            - "--max-model-len=4096"
          resources:
            limits:
              nvidia.com/gpu: 1
              cpu: "4"
              memory: "16Gi"
            requests:
              cpu: "2"
              memory: "8Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 120
            periodSeconds: 10
```

**要点**：
- 7B 模型需要约 14GB 显存（FP16），一张 A100/4090 足够
- 使用 AWQ 量化可以将显存需求降到约 4GB
- readinessProbe 的 initialDelaySeconds 要足够长（模型加载需要时间）

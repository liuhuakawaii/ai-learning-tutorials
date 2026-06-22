# 04 vLLM 生产部署——高性能推理引擎的配置与优化

> vLLM 是生产级的高性能推理引擎。适合需要高吞吐量的场景。

## 场景引入

你的本地模型在开发环境跑得好好的，但一上线就出问题：10 个用户同时发请求，响应时间从 1 秒飙到 30 秒；GPU 利用率忽高忽低，显存时不时 OOM。问题出在哪？普通的逐条推理模式根本扛不住并发。你需要一个生产级的推理引擎，支持连续批处理、显存优化、高并发——这就是 vLLM 要解决的问题。

---

## 学习目标

- 掌握 vLLM 的安装和配置
- 理解 vLLM 的性能优化方法
- 学会用 vLLM 部署生产级模型服务

---

## 一、安装 vLLM

```bash
pip install vllm
```

---

## 二、启动服务

```bash
# 启动 OpenAI 兼容 API
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000

# 使用量化模型
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8B-Instruct \
  --quantization awq \
  --dtype half
```

---

## 三、API 使用

```python
from openai import OpenAI

# 连接到 vLLM 服务
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed"
)

# 调用
response = client.chat.completions.create(
    model="meta-llama/Llama-3-8B-Instruct",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(response.choices[0].message.content)
```

---

## 四、性能优化

```
vLLM 性能优化：

1. 批处理
   - 连续批处理提高吞吐量
   - max_num_seqs 参数控制并发

2. 量化
   - AWQ / GPTQ 量化减少内存
   - 提高推理速度

3. 张量并行
   - 多 GPU 并行推理
   - tensor_parallel_size 参数

4. KV 缓存
   - GPU 内存用于 KV 缓存
   - 提高长序列性能
```

---

## 五、Docker 部署

```dockerfile
FROM vllm/vllm-openai:latest

COPY ./model /model

CMD ["--model", "/model", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  vllm:
    build: .
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

---

## 六、监控

```python
# 健康检查
response = requests.get("http://localhost:8000/health")

# 指标
response = requests.get("http://localhost:8000/metrics")
```

---

## 常见误区

1. **不配置量化就部署大模型**：直接用 FP16 加载 7B 模型需要 14GB 显存，而用 AWQ 量化后只需 4GB，推理速度还更快。生产部署几乎 always 应该使用量化模型。

2. **忽略 max_num_seqs 参数**：默认并发数可能过低，导致高并发场景下请求排队严重。应根据 GPU 显存和模型大小合理设置最大并发序列数。

3. **不设置健康检查就上线**：没有健康检查的部署服务是不可靠的。当模型加载失败或 GPU 异常时，服务可能无响应但进程还在，用户只会看到超时。

4. **单实例部署不做负载均衡**：单个 vLLM 实例的并发能力有限，高流量场景必须部署多个实例并通过 Nginx 或 K8s Service 做负载均衡。

---

## 工程建议

1. **Docker 部署优先**：使用 vLLM 官方 Docker 镜像可以避免环境依赖问题，配合 docker-compose 管理 GPU 资源分配和端口映射，部署更可靠。

2. **AWQ 量化是 GPU 部署首选**：相比 GPTQ，AWQ 在推理速度和质量上通常更优，且 vLLM 原生支持 AWQ，配置更简单。

3. **监控指标必须覆盖**：至少监控 `/health`（服务状态）、`/metrics`（Prometheus 指标）、GPU 显存使用率三个维度，设置告警阈值。

4. **预留显存余量**：部署时显存占用不要超过 GPU 总显存的 90%，留出余量应对突发请求和 KV 缓存增长，避免 OOM 导致服务崩溃。

---

## 小结

```
本课核心要点：

1. vLLM 是生产级高性能推理引擎
2. 提供 OpenAI 兼容 API
3. 支持量化、张量并行、连续批处理
4. 适合高吞吐量生产场景

---

**下一课**: [05 OpenAI 兼容 API——让本地模型接入现有的 AI 应用](./05-OpenAI兼容API.md)
```

---

## 练习

1. **部署题**：用 vLLM 部署一个模型服务。

2. **API 题**：用 OpenAI SDK 调用 vLLM 服务。

3. **优化题**：调整参数优化 vLLM 性能。

---

## 参考答案

### 练习一：部署题

**思路**：使用 vLLM 启动一个 OpenAI 兼容的模型服务，配置量化和基本参数，验证服务可用。

**答案**：

```bash
# 1. 安装 vLLM
pip install vllm

# 2. 启动服务（使用 AWQ 量化模型）
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --quantization awq \
  --dtype half \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.9

# 3. 验证服务状态
curl http://localhost:8000/health
# 预期输出：{"status":"ok"}

# 4. 测试推理
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

Docker 部署方式：

```yaml
# docker-compose.yml
version: '3.8'
services:
  vllm:
    image: vllm/vllm-openai:latest
    ports:
      - "8000:8000"
    volumes:
      - ./model:/model
    command: ["--model", "/model", "--host", "0.0.0.0", "--port", "8000", "--quantization", "awq"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

**要点**：
- `--gpu-memory-utilization 0.9` 让 vLLM 利用 90% 的 GPU 显存用于模型和 KV 缓存，留 10% 余量防 OOM
- AWQ 量化模型需要先从 Hugging Face 下载对应的 AWQ 版本，不能直接对 FP16 模型指定 `--quantization awq`
- 常见错误：不设置 `--max-model-len`——vLLM 会默认使用模型最大上下文长度，可能导致显存不足

### 练习二：API 题

**思路**：使用 OpenAI Python SDK 调用 vLLM 服务，验证 OpenAI 兼容性，包括普通调用和流式调用。

**答案**：

```python
from openai import OpenAI

# 连接到 vLLM 服务
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed"
)

# 1. 普通调用
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[
        {"role": "system", "content": "你是一个专业的 Python 助手。"},
        {"role": "user", "content": "解释列表推导式的优缺点"}
    ],
    temperature=0.7,
    max_tokens=512,
)

print("普通调用结果：")
print(response.choices[0].message.content)
print(f"\nToken 使用: prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}")

# 2. 流式调用
print("\n流式调用结果：")
stream = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[
        {"role": "user", "content": "写一个 Python 装饰器实现重试功能"}
    ],
    stream=True,
    max_tokens=512,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
print()
```

**要点**：
- vLLM 的 OpenAI 兼容 API 支持 `messages`、`temperature`、`max_tokens`、`stream` 等常用参数
- 流式调用对用户体验很重要，本地模型首 token 延迟较高，流式可以减少用户等待感
- 常见错误：`model` 参数必须和启动服务时 `--model` 指定的模型名完全一致

### 练习三：优化题

**思路**：通过调整 vLLM 的关键参数（并发数、量化方式、张量并行、KV 缓存）优化性能。

**答案**：

```bash
# 基础配置
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000

# 优化配置
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --quantization awq \
  --dtype half \
  --max-num-seqs 32 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.92 \
  --enable-chunked-prefill
```

用 `locust` 做压力测试对比：

```python
# locustfile.py
from locust import HttpUser, task, between

class VLLMUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def chat(self):
        self.client.post(
            "/v1/chat/completions",
            json={
                "model": "Qwen/Qwen2.5-7B-Instruct",
                "messages": [{"role": "user", "content": "用一句话解释机器学习"}],
                "max_tokens": 100,
            },
        )
```

```bash
# 运行压力测试
locust -f locustfile.py --host http://localhost:8000 -u 50 -r 10
```

关键参数优化说明：

| 参数 | 作用 | 优化建议 |
|------|------|----------|
| `--quantization awq` | 减少显存占用，提升推理速度 | 生产部署几乎 always 应该使用 |
| `--max-num-seqs 32` | 最大并发序列数 | 根据 GPU 显存调整，太大可能 OOM |
| `--max-model-len 4096` | 限制最大上下文长度 | 根据业务需求设置，越小吞吐量越高 |
| `--gpu-memory-utilization 0.92` | GPU 显存利用率 | 设为 0.9-0.95，留余量防 OOM |
| `--enable-chunked-prefill` | 分块预填充 | 提升长 prompt 的吞吐量 |

**要点**：
- `--max-model-len` 是最容易被忽略的参数——降低它可以显著提升并发吞吐量
- AWQ 量化不仅能省显存，还能提升推理速度（减少数据搬运量）
- 常见错误：`--max-num-seqs` 设得太大导致 OOM——应该逐步增加，观察 GPU 显存使用率

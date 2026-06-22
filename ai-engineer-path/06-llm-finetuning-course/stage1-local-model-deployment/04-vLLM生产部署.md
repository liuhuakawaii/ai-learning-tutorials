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

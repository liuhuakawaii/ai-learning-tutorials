# 04 vLLM 生产部署——高性能推理引擎的配置与优化

> vLLM 是生产级的高性能推理引擎。适合需要高吞吐量的场景。

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

## 小结

```
本课核心要点：

1. vLLM 是生产级高性能推理引擎
2. 提供 OpenAI 兼容 API
3. 支持量化、张量并行、连续批处理
4. 适合高吞吐量生产场景

下一课：OpenAI 兼容 API——让本地模型接入现有的 AI 应用。
```

---

## 练习

1. **部署题**：用 vLLM 部署一个模型服务。

2. **API 题**：用 OpenAI SDK 调用 vLLM 服务。

3. **优化题**：调整参数优化 vLLM 性能。

# 03 llama.cpp 深入——GGUF 格式、量化级别、推理参数调优

> llama.cpp 是本地运行大模型的底层引擎。理解它能帮你更好地优化性能。

## 学习目标

- 理解 GGUF 格式和量化级别
- 掌握 llama.cpp 的推理参数调优
- 学会优化本地模型的性能

---

## 一、GGUF 格式

```
GGUF（GPT-Generated Unified Format）：

特点：
- 单文件存储模型
- 支持多种量化方法
- 跨平台兼容
- 高效加载

量化级别：
- Q2_K: 2-bit 量化，最小体积，质量损失大
- Q3_K_M: 3-bit 量化，平衡体积和质量
- Q4_K_M: 4-bit 量化，推荐选择
- Q5_K_M: 5-bit 量化，高质量
- Q6_K: 6-bit 量化，接近原始质量
- Q8_0: 8-bit 量化，最高质量
```

---

## 二、量化方法

```bash
# 下载原始模型
huggingface-cli download meta-llama/Llama-3-8B --local-dir ./llama3-8b

# 转换为 GGUF
python convert_hf_to_gguf.py ./llama3-8b --outfile llama3-8b-f16.gguf

# 量化
./llama-quantize llama3-8b-f16.gguf llama3-8b-q4_k_m.gguf Q4_K_M
```

---

## 三、推理参数

```bash
# 运行模型
./llama-server \
  -m llama3-8b-q4_k_m.gguf \
  -c 4096 \        # 上下文长度
  -ngl 999 \       # GPU 层数
  -t 8 \           # 线程数
  --port 8080      # 端口
```

---

## 四、性能优化

```
性能优化技巧：

1. 量化选择
   - 资源紧张 → Q4_K_M
   - 质量优先 → Q5_K_M 或 Q6_K
   - 极端压缩 → Q2_K 或 Q3_K_M

2. GPU 加速
   - 尽可能多的层放到 GPU
   - -ngl 999 表示全部放 GPU

3. 上下文长度
   - 根据需求设置，不要过长
   - 长上下文消耗更多内存

4. 批处理
   - 批处理提高吞吐量
   - -b 参数设置批大小
```

---

## 五、llama-cpp-python

```python
from llama_cpp import Llama

# 加载模型
llm = Llama(
    model_path="llama3-8b-q4_k_m.gguf",
    n_ctx=4096,
    n_gpu_layers=999
)

# 生成
output = llm.create_chat_completion(
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(output["choices"][0]["message"]["content"])
```

---

## 小结

```
本课核心要点：

1. GGUF 是本地模型的标准格式
2. 量化级别：Q2_K 到 Q8_0，平衡体积和质量
3. 推理参数：上下文长度、GPU 层数、线程数
4. Q4_K_M 是推荐的量化级别

下一课：vLLM 生产部署——高性能推理引擎的配置与优化。
```

---

## 练习

1. **量化题**：将一个模型量化为 Q4_K_M。

2. **参数题**：调整推理参数优化性能。

3. **测试题**：对比不同量化级别的质量差异。

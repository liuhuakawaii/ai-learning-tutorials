# 03 llama.cpp 深入——GGUF 格式、量化级别、推理参数调优

> llama.cpp 是本地运行大模型的底层引擎。理解它能帮你更好地优化性能。

## 场景引入

你的笔记本只有 16GB 内存、没有独立 GPU，但老板要求你 demo 一个 7B 大模型的效果。用 Hugging Face Transformers 加载？FP16 就要 14GB 显存，根本跑不起来。这时你发现了 GGUF 格式和 llama.cpp——它能把模型量化到 4GB 以下，还能在 CPU 上流畅运行。但量化级别 Q2_K 到 Q8_0 到底怎么选？推理参数又该如何调优？

---

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

## 常见误区

1. **盲目选择最小量化**：Q2_K 虽然体积最小，但在复杂推理任务上质量损失严重，可能输出完全不可用。推荐从 Q4_K_M 开始，它是体积和质量的最佳平衡点。

2. **忽略 GPU 层数设置**：默认 `-ngl 0` 会把所有层放到 CPU 上，推理速度极慢。即使显存有限，也应该尽量把部分层放到 GPU 上（如 `-ngl 20`），显著提升速度。

3. **上下文长度设得过长**：为了"支持长文本"把 `-c` 设到 32768，结果显存直接爆了。上下文长度直接影响内存占用，应根据实际需求设置，不要盲目求大。

4. **混淆 GGUF 量化和 GPTQ/AWQ**：GGUF 是 llama.cpp 的格式，主要用于 CPU/GPU 混合推理；GPTQ/AWQ 是 GPU 推理的量化方案。两者适用场景不同，不能混用。

---

## 工程建议

1. **Q4_K_M 作为默认选择**：在大多数场景下，Q4_K_M 是性价比最高的量化级别。质量损失通常在 1-2% 以内，但体积只有 FP16 的 25%。

2. **善用 llama-cpp-python 做集成**：相比直接调用命令行工具，llama-cpp-python 提供了更灵活的 Python API，方便集成到现有应用中，并支持流式输出。

3. **量化前先做质量基线测试**：在量化前用 FP16 模型跑一组测试问题，量化后再跑同样的问题对比，确保质量损失在可接受范围内。

4. **利用批处理提升吞吐量**：llama.cpp 的 `-b` 参数可以设置批处理大小，适当增大可以显著提升批量推理的吞吐量。

---

## 小结

```
本课核心要点：

1. GGUF 是本地模型的标准格式
2. 量化级别：Q2_K 到 Q8_0，平衡体积和质量
3. 推理参数：上下文长度、GPU 层数、线程数
4. Q4_K_M 是推荐的量化级别

---

**下一课**: [04 vLLM 生产部署——高性能推理引擎的配置与优化](./04-vLLM生产部署.md)
```

---

## 练习

1. **量化题**：将一个模型量化为 Q4_K_M。

2. **参数题**：调整推理参数优化性能。

3. **测试题**：对比不同量化级别的质量差异。

---

## 参考答案

### 练习一：量化题

**思路**：使用 llama.cpp 的量化工具将模型转换为 GGUF 格式并量化为 Q4_K_M，这是性价比最高的量化级别。

**答案**：

```bash
# 1. 下载原始模型（以 Llama 3 8B 为例）
huggingface-cli download meta-llama/Meta-Llama-3-8B-Instruct --local-dir ./llama3-8b

# 2. 转换为 GGUF FP16 格式
# 先克隆 llama.cpp 仓库
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# 转换
python convert_hf_to_gguf.py ../llama3-8b --outfile llama3-8b-f16.gguf --outtype f16

# 3. 量化为 Q4_K_M
./llama-quantize llama3-8b-f16.gguf llama3-8b-q4_k_m.gguf Q4_K_M

# 4. 验证量化结果
ls -lh llama3-8b-f16.gguf llama3-8b-q4_k_m.gguf
# 预期：f16 约 16GB，q4_k_m 约 4.5GB

# 5. 测试运行
./llama-server -m llama3-8b-q4_k_m.gguf -c 4096 --port 8080
```

**要点**：
- 转换前必须确认模型格式是 Hugging Face 格式，不是其他格式（如 safetensors 需要先转换）
- Q4_K_M 是推荐的默认量化级别，体积约为 FP16 的 25-30%，质量损失在 1-2% 以内
- 量化过程需要足够的磁盘空间（至少预留模型大小的 2 倍）
- 常见错误：直接用 llama-quantize 处理 Hugging Face 格式——必须先用 `convert_hf_to_gguf.py` 转换为 GGUF 格式

### 练习二：参数题

**思路**：通过调整推理参数（上下文长度、GPU 层数、批处理大小、线程数）来优化性能。

**答案**：

```bash
# 基础配置（性能一般）
./llama-server \
  -m llama3-8b-q4_k_m.gguf \
  -c 4096 \
  -ngl 0 \
  -t 4 \
  --port 8080

# 优化配置（充分利用 GPU）
./llama-server \
  -m llama3-8b-q4_k_m.gguf \
  -c 8192 \
  -ngl 999 \
  -t 8 \
  -b 512 \
  --port 8080
```

参数优化说明：

| 参数 | 优化前 | 优化后 | 影响 |
|------|--------|--------|------|
| `-ngl` | 0（全 CPU） | 999（全 GPU） | 推理速度提升 5-10 倍 |
| `-c` | 4096 | 8192 | 支持更长对话，但显存增加 |
| `-t` | 4 | 8 | CPU 线程数，影响 prompt 处理速度 |
| `-b` | 默认 | 512 | 批处理大小，提升吞吐量 |

用 Python 测试推理速度：

```python
from llama_cpp import Llama
import time

llm = Llama(
    model_path="llama3-8b-q4_k_m.gguf",
    n_ctx=8192,
    n_gpu_layers=999,
    n_threads=8,
)

start = time.time()
output = llm.create_chat_completion(
    messages=[{"role": "user", "content": "写一篇 200 字的科幻小说"}],
    max_tokens=512,
)
elapsed = time.time() - start
print(f"推理时间: {elapsed:.2f}s")
print(output["choices"][0]["message"]["content"])
```

**要点**：
- `-ngl` 是最关键的性能参数，即使显存有限也应尽量设置一个正值（如 `-ngl 20`）把部分层放到 GPU
- `-c`（上下文长度）直接影响内存占用，2048 需要约 0.5GB，32768 需要约 8GB
- 常见错误：把 `-c` 设得过大导致 OOM——根据实际需求设置，不要盲目求大

### 练习三：测试题

**思路**：对同一个模型的不同量化级别，在相同测试集上对比输出质量，量化级别越高质量越好但体积越大。

**答案**：

```bash
# 1. 准备不同量化级别的模型
./llama-quantize llama3-8b-f16.gguf llama3-8b-q2_k.gguf Q2_K
./llama-quantize llama3-8b-f16.gguf llama3-8b-q4_k_m.gguf Q4_K_M
./llama-quantize llama3-8b-f16.gguf llama3-8b-q6_k.gguf Q6_K
./llama-quantize llama3-8b-f16.gguf llama3-8b-q8_0.gguf Q8_0

# 2. 查看各量化级别的文件大小
ls -lh llama3-8b-q*.gguf
```

```python
from llama_cpp import Llama
import json

# 测试问题集
test_prompts = [
    {"category": "推理", "prompt": "一个农夫需要把狼、羊和白菜运过河，船只能载一样东西，怎么运？"},
    {"category": "代码", "prompt": "用 Python 实现二分查找"},
    {"category": "数学", "prompt": "计算 17 × 23 的结果，并解释计算过程"},
    {"category": "中文", "prompt": "解释'画蛇添足'的含义并造句"},
]

quant_levels = ["q2_k", "q4_k_m", "q6_k", "q8_0"]

for q in quant_levels:
    print(f"\n{'='*50}")
    print(f"量化级别: {q}")
    print(f"{'='*50}")

    llm = Llama(model_path=f"llama3-8b-{q}.gguf", n_ctx=2048, n_gpu_layers=999, verbose=False)

    for tp in test_prompts:
        output = llm.create_chat_completion(
            messages=[{"role": "user", "content": tp["prompt"]}],
            max_tokens=256,
            temperature=0.0,  # 固定温度确保可比性
        )
        print(f"\n[{tp['category']}]")
        print(output["choices"][0]["message"]["content"][:200])

    del llm
```

**要点**：
- 对比测试时必须用 `temperature=0.0` 确保输出确定性，否则随机性会干扰对比
- 重点关注 Q2_K 在推理和代码任务上的质量退化——通常是最明显的
- Q4_K_M 和 Q8_0 的差距在大多数任务上很小（1-3%），但 Q2_K 可能退化 10% 以上
- 常见错误：只对比通用对话不对比专业任务——量化在简单对话上几乎无损，但在数学推理和代码生成上损失明显

# 02 Ollama 快速上手——一行命令运行本地大模型

> Ollama 让本地运行大模型变得像安装 App 一样简单。

## 场景引入

你想在本地跑一个大模型试试效果，但一想到要配 CUDA、装 PyTorch、下载权重、写加载代码就头大。同事推荐了各种方案：vLLM、llama.cpp、text-generation-webui……每个都要折腾半天环境。有没有一种方式，像安装普通软件一样，一行命令就能跑起来？

---

## 学习目标

- 掌握 Ollama 的安装和使用
- 理解 Ollama 的模型管理
- 学会用 Ollama 运行本地大模型

---

## 一、安装 Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# 下载安装包：https://ollama.ai/download
```

---

## 二、基本使用

```bash
# 下载并运行模型
ollama run llama3

# 运行特定版本
ollama run llama3:8b
ollama run llama3:70b

# 列出已下载的模型
ollama list

# 删除模型
ollama rm llama3

# 显示模型信息
ollama show llama3
```

---

## 三、API 使用

```python
import requests

# Ollama 提供 OpenAI 兼容 API
response = requests.post(
    "http://localhost:11434/v1/chat/completions",
    json={
        "model": "llama3",
        "messages": [
            {"role": "user", "content": "你好"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])
```

---

## 四、模型管理

```bash
# 创建自定义模型
# Modelfile
FROM llama3
SYSTEM "你是一个有帮助的AI助手。"
PARAMETER temperature 0.7

# 创建
ollama create my-assistant -f Modelfile

# 使用
ollama run my-assistant
```

---

## 五、配置优化

```bash
# 设置环境变量
export OLLAMA_NUM_GPU=999      # GPU 层数
export OLLAMA_NUM_THREAD=8     # CPU 线程数
export OLLAMA_MAX_LOADED_MODELS=3  # 最大加载模型数
```

---

## 六、多模型管理

```bash
# 同时运行多个模型
ollama run llama3 &
ollama run codellama &

# 查看运行中的模型
ollama ps
```

---

## 常见误区

1. **把 Ollama 当生产引擎用**：Ollama 的定位是开发测试工具，不支持连续批处理和高并发。生产环境应使用 vLLM 或 TGI 等专业推理引擎。

2. **不设置环境变量就运行大模型**：默认配置下 Ollama 可能不会充分利用 GPU，导致推理速度很慢。需要设置 `OLLAMA_NUM_GPU` 等环境变量来优化资源分配。

3. **同时加载过多模型**：每个模型都会占用显存，同时加载 3-4 个 7B 模型可能导致 OOM。需要合理规划模型加载数量，用完及时卸载。

4. **忽略 Modelfile 的作用**：直接用默认参数运行模型效果可能不理想。通过 Modelfile 可以自定义 System Prompt、温度等参数，显著提升特定场景的输出质量。

---

## 工程建议

1. **用 Ollama 做原型验证**：Ollama 是最快的原型验证工具。一行命令就能测试新模型，适合在正式微调前做模型选型和 Prompt 迭代。

2. **利用 OpenAI 兼容 API**：Ollama 提供 OpenAI 兼容的 `/v1/chat/completions` 接口，可以直接替换 OpenAI SDK 中的 base_url，实现零代码切换。

3. **善用 `ollama ps` 监控资源**：定期检查运行中的模型和资源占用，避免多个模型同时驻留显存导致性能下降。

4. **用自定义模型固化配置**：把调试好的 Prompt、温度、System 指令写进 Modelfile，创建自定义模型，确保团队成员使用一致的配置。

---

## 小结

```
本课核心要点：

1. Ollama 让本地运行大模型变得简单
2. 一行命令即可下载和运行模型
3. 提供 OpenAI 兼容 API
4. 支持自定义模型和配置优化

---

**下一课**: [03 llama.cpp 深入——GGUF 格式、量化级别、推理参数调优](./03-llama-cpp深入.md)
```

---

## 练习

1. **安装题**：安装 Ollama 并运行一个模型。

2. **API 题**：用 Python 调用 Ollama API。

3. **自定义题**：创建一个自定义模型。

---

## 参考答案

### 练习一：安装题

**思路**：按官方安装流程操作，验证安装成功后运行一个模型测试基本功能。

**答案**：

```bash
# macOS / Linux 安装
curl -fsSL https://ollama.ai/install.sh | sh

# 验证安装
ollama --version

# 下载并运行 Qwen 2.5 7B
ollama run qwen2.5:7b

# 在交互式界面中测试
# >>> 你好，请介绍一下你自己
# >>> 用 Python 写一个斐波那契数列
```

Windows 用户从 https://ollama.ai/download 下载安装包，双击安装后在 PowerShell 中执行同样的命令。

**要点**：
- 安装完成后 Ollama 服务会自动启动，不需要手动启动后台进程
- 首次运行 `ollama run` 会先下载模型，7B 模型约 4GB，需要等待下载完成
- 常见错误：网络问题导致下载失败——可以设置 `OLLAMA_HOST` 环境变量或使用代理

### 练习二：API 题

**思路**：使用 Python 的 requests 库或 OpenAI SDK 调用 Ollama 的 API 接口，验证 API 兼容性。

**答案**：

```python
import requests

# 方式 1：使用 Ollama 原生 API
response = requests.post(
    "http://localhost:11434/api/chat",
    json={
        "model": "qwen2.5:7b",
        "messages": [
            {"role": "user", "content": "用一句话解释什么是量子计算"}
        ],
        "stream": False,
    }
)

result = response.json()
print("Ollama 原生 API 响应：")
print(result["message"]["content"])

# 方式 2：使用 OpenAI 兼容 API
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="qwen2.5:7b",
    messages=[
        {"role": "user", "content": "用一句话解释什么是量子计算"}
    ]
)

print("\nOpenAI 兼容 API 响应：")
print(response.choices[0].message.content)
```

**要点**：
- Ollama 提供两套 API：原生 API（`/api/chat`）和 OpenAI 兼容 API（`/v1/chat/completions`）
- OpenAI 兼容 API 可以直接用 `openai` Python SDK，只需修改 `base_url`
- `api_key` 设为 `"not-needed"` 而不是空字符串，空字符串可能报错
- 常见错误：Ollama 服务未启动就调用 API——先用 `ollama ps` 确认服务状态

### 练习三：自定义题

**思路**：通过 Modelfile 自定义模型的系统提示和参数，创建一个专用的助手模型。

**答案**：

```bash
# 1. 创建 Modelfile
cat > Modelfile << 'EOF'
FROM qwen2.5:7b

SYSTEM """你是一个专业的 Python 代码审查助手。你的职责是：
1. 检查代码中的潜在 bug 和安全问题
2. 提出性能优化建议
3. 确保代码符合 PEP 8 规范
4. 用中文回答，代码注释保留英文"""

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
EOF

# 2. 创建自定义模型
ollama create code-reviewer -f Modelfile

# 3. 测试自定义模型
ollama run code-reviewer

# 测试 prompt：
# >>> 请审查以下代码：
# def calc(a,b):
#     return a/b
```

**要点**：
- Modelfile 的 `FROM` 指定基座模型，必须先用 `ollama pull` 下载
- `temperature` 设低（0.3）适合代码审查场景，减少随机性
- `SYSTEM` 指令越具体越好，明确角色、职责和输出格式
- 常见错误：SYSTEM 指令太模糊（如"你是一个助手"）——自定义模型的价值在于针对特定场景优化，指令越具体效果越好

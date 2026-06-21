# 02 Ollama 快速上手——一行命令运行本地大模型

> Ollama 让本地运行大模型变得像安装 App 一样简单。

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

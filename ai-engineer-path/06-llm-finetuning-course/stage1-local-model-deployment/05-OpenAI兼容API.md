# 05 OpenAI 兼容 API——让本地模型接入现有的 AI 应用

> OpenAI 兼容 API 让你可以零代码替换云端模型为本地模型。

## 学习目标

- 掌握 OpenAI 兼容 API 的使用方法
- 理解如何将本地模型接入现有应用
- 学会配置和使用本地模型服务

---

## 一、OpenAI 兼容 API

```python
from openai import OpenAI

# 使用本地模型（Ollama）
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"
)

# 使用本地模型（vLLM）
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed"
)

# 调用方式完全相同
response = client.chat.completions.create(
    model="llama3",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)
```

---

## 二、零代码替换

```python
# 原来使用 OpenAI
# client = OpenAI(api_key="sk-...")

# 替换为本地模型
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"
)

# 其他代码完全不变
response = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "你好"}]
)
```

---

## 三、流式响应

```python
# 流式响应也完全兼容
stream = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "写一首诗"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

---

## 四、环境变量配置

```python
import os

# 通过环境变量配置
os.environ["OPENAI_API_KEY"] = "not-needed"
os.environ["OPENAI_BASE_URL"] = "http://localhost:11434/v1"

# 使用默认配置
client = OpenAI()
```

---

## 五、模型切换

```python
class ModelRouter:
    """模型路由器"""
    
    def __init__(self):
        self.clients = {
            "local": OpenAI(base_url="http://localhost:11434/v1", api_key="not-needed"),
            "cloud": OpenAI(api_key="sk-...")
        }
    
    def get_client(self, model_type: str = "local") -> OpenAI:
        return self.clients[model_type]
    
    def chat(self, messages: list, model_type: str = "local", model: str = "llama3"):
        client = self.get_client(model_type)
        return client.chat.completions.create(
            model=model,
            messages=messages
        )
```

---

## 小结

```
本课核心要点：

1. OpenAI 兼容 API 让本地模型无缝接入
2. 零代码替换云端模型
3. 支持流式响应和其他 OpenAI 功能
4. 通过环境变量或参数配置

---

**下一课**: [06 阶段实战——在本地部署一个 OpenAI 兼容的模型服务并接入 01 课程项目](./06-阶段实战-本地模型服务.md)
```

---

## 练习

1. **替换题**：将你的应用从云端模型替换为本地模型。

2. **流式题**：测试本地模型的流式响应。

3. **路由题**：实现一个模型路由器。

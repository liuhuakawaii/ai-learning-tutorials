# 05 OpenAI 兼容 API——让本地模型接入现有的 AI 应用

> OpenAI 兼容 API 让你可以零代码替换云端模型为本地模型。

## 场景引入

你用 OpenAI API 开发了一套完整的 AI 应用，代码里到处都是 `client.chat.completions.create()`。现在公司要求把模型切换到本地部署以保护数据隐私，难道要把所有调用代码都重写一遍？如果有一种方式，只改一行配置就能无缝切换，该多好。OpenAI 兼容 API 就是为这个场景设计的。

---

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

## 常见误区

1. **认为所有 OpenAI 参数都兼容**：本地模型不一定支持 `response_format`、`tools`、`seed` 等高级参数。切换到本地模型后需要测试每个用到的参数是否正常工作。

2. **忽略本地模型的 token 限制**：云端模型支持 128K 上下文，但本地 7B 模型可能只支持 4K-8K。直接把长对话传给本地模型可能截断或报错。

3. **把 api_key 设为空字符串**：有些 SDK 要求 api_key 非空，设为空字符串会报错。应该设为 `"not-needed"` 这样的占位字符串。

4. **不处理本地服务不可用的情况**：本地模型服务可能因为 OOM、GPU 故障等原因宕机，生产代码必须有重试和降级逻辑。

---

## 工程建议

1. **用环境变量管理切换**：通过 `OPENAI_BASE_URL` 和 `OPENAI_API_KEY` 环境变量管理本地/云端切换，避免修改代码。不同环境用不同的 `.env` 文件。

2. **实现模型路由器**：对不同类型的请求路由到不同模型——简单任务用本地小模型，复杂任务用云端大模型，在成本和质量之间取得平衡。

3. **流式响应优先**：本地模型的首 token 延迟通常比云端更高，使用流式响应可以显著改善用户体验，让用户看到"正在生成"的反馈。

4. **封装统一的错误处理**：本地模型的错误类型和云端不同（如 CUDA OOM、模型加载失败），需要统一的错误处理层，对上层应用屏蔽底层差异。

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

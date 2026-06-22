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

---

## 参考答案

### 练习一：替换题

**思路**：将现有应用中使用 OpenAI 云端 API 的代码替换为本地模型 API，只需修改 `base_url` 和 `api_key`，其他代码保持不变。

**答案**：

```python
import os
from openai import OpenAI

# 修改前（使用 OpenAI 云端）
# client = OpenAI(api_key="sk-xxx")
# model = "gpt-4o"

# 修改后（使用本地 Ollama）
client = OpenAI(
    base_url=os.environ.get("OPENAI_BASE_URL", "http://localhost:11434/v1"),
    api_key=os.environ.get("OPENAI_API_KEY", "not-needed"),
)
model = os.environ.get("MODEL_NAME", "qwen2.5:7b")

# 以下代码完全不变
response = client.chat.completions.create(
    model=model,
    messages=[
        {"role": "system", "content": "你是一个有用的助手。"},
        {"role": "user", "content": "什么是 RESTful API？"},
    ],
    temperature=0.7,
    max_tokens=512,
)

print(response.choices[0].message.content)

# 流式调用也不变
stream = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "写一首关于春天的诗"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

通过环境变量切换，`.env` 文件：

```bash
# .env.local
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=not-needed
MODEL_NAME=qwen2.5:7b

# .env.cloud
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxx
MODEL_NAME=gpt-4o
```

**要点**：
- 核心改动只有 `base_url` 和 `api_key` 两行，其他代码完全不变
- 通过环境变量管理切换，不同环境用不同的 `.env` 文件
- 常见错误：把 `api_key` 设为空字符串 `""`——部分 SDK 会校验非空，应该设为 `"not-needed"`

### 练习二：流式题

**思路**：测试本地模型的流式响应功能，验证与 OpenAI SDK 的流式接口完全兼容。

**答案**：

```python
import time
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"
)

# 测试流式响应
print("=== 流式响应测试 ===")
start = time.time()

stream = client.chat.completions.create(
    model="qwen2.5:7b",
    messages=[
        {"role": "user", "content": "详细解释 Python 的 GIL（全局解释器锁），包括它的工作原理、影响以及如何绕过它。"}
    ],
    stream=True,
    max_tokens=1024,
)

first_token_time = None
for chunk in stream:
    if chunk.choices[0].delta.content:
        if first_token_time is None:
            first_token_time = time.time() - start
        print(chunk.choices[0].delta.content, end="", flush=True)

total_time = time.time() - start
print(f"\n\n--- 性能统计 ---")
print(f"首 Token 延迟: {first_token_time:.2f}s")
print(f"总耗时: {total_time:.2f}s")
```

**要点**：
- 流式响应的关键指标是首 Token 延迟（TTFT）和总耗时
- 本地模型的首 Token 延迟通常比云端高（0.5-2s vs 0.2-0.5s），流式可以让用户看到"正在生成"的反馈
- `flush=True` 确保每个 token 立即输出，不被缓冲
- 常见错误：不处理 `delta.content` 为 `None` 的情况——流式响应中有些 chunk 的 content 可能为空

### 练习三：路由题

**思路**：实现一个模型路由器，根据请求类型自动选择本地模型或云端模型，在成本和质量之间取得平衡。

**答案**：

```python
import os
from openai import OpenAI
from typing import Literal

ModelType = Literal["local", "cloud"]

class ModelRouter:
    """模型路由器：根据任务复杂度自动选择本地或云端模型"""

    def __init__(self):
        self.clients = {
            "local": OpenAI(
                base_url=os.environ.get("LOCAL_BASE_URL", "http://localhost:11434/v1"),
                api_key="not-needed",
            ),
            "cloud": OpenAI(
                base_url=os.environ.get("CLOUD_BASE_URL", "https://api.openai.com/v1"),
                api_key=os.environ.get("OPENAI_API_KEY", "sk-xxx"),
            ),
        }
        self.models = {
            "local": os.environ.get("LOCAL_MODEL", "qwen2.5:7b"),
            "cloud": os.environ.get("CLOUD_MODEL", "gpt-4o"),
        }
        # 路由规则：简单任务用本地，复杂任务用云端
        self.routing_rules = {
            "local": ["翻译", "摘要", "简单问答", "格式转换"],
            "cloud": ["代码生成", "数学推理", "复杂分析", "创意写作"],
        }

    def route(self, messages: list) -> ModelType:
        """根据消息内容决定使用哪个模型"""
        user_msg = next(
            (m["content"] for m in messages if m["role"] == "user"), ""
        )
        # 简单关键词匹配（生产环境可以用分类模型）
        for keyword in self.routing_rules["cloud"]:
            if keyword in user_msg:
                return "cloud"
        return "local"

    def chat(self, messages: list, model_type: ModelType | None = None, **kwargs):
        """发送请求，自动路由或手动指定模型类型"""
        if model_type is None:
            model_type = self.route(messages)

        client = self.clients[model_type]
        model = self.models[model_type]

        print(f"[路由] 使用 {model_type} 模型: {model}")
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs,
        )
        return response, model_type


# 使用示例
router = ModelRouter()

# 简单任务 → 自动路由到本地模型
response, used = router.chat([
    {"role": "user", "content": "翻译：人工智能正在改变世界"}
])
print(f"[{used}] {response.choices[0].message.content}\n")

# 复杂任务 → 自动路由到云端模型
response, used = router.chat([
    {"role": "user", "content": "用 Python 实现一个支持并发的生产者消费者模式，要求有超时处理和优雅退出"}
])
print(f"[{used}] {response.choices[0].message.content}\n")

# 手动指定模型
response, used = router.chat(
    [{"role": "user", "content": "你好"}],
    model_type="cloud"
)
print(f"[{used}] {response.choices[0].message.content}")
```

**要点**：
- 路由的核心是根据任务复杂度选择模型——简单任务用本地模型（零成本、低延迟），复杂任务用云端模型（高质量）
- 关键词匹配是最简单的路由策略，生产环境可以用分类模型或规则引擎
- 常见错误：路由逻辑过于复杂导致延迟增加——路由判断本身应该很快（<10ms），不要引入额外的 LLM 调用来决定路由

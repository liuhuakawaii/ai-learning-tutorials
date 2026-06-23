# 01 大模型 API 深度解析

> 不理解 token，你就无法控制成本。不理解请求生命周期，你就无法优化延迟。

你拿到了 OpenAI 的 API Key，照着文档写了三行代码调通了 GPT-4o。但上线第一天就出问题了：用户疯狂发请求触发了速率限制，返回 429；一天下来 API 费用比预期高了十倍；偶尔网络抖动导致请求失败，用户看到白屏。调通 API 只是起点，真正的问题是：怎么控制成本？怎么处理速率限制？怎么让调用足够健壮？

## 请求生命周期

一个 LLM API 调用的完整链路：

```
用户输入 → Prompt 组装 → Token 编码 → 网络传输 → 模型推理 → Token 解码 → 流式/一次性返回 → 前端渲染
```

每一步都可能出问题。Prompt 组装可能超出上下文窗口，网络传输可能超时，模型推理可能触发速率限制。你封装的 LLM 客户端需要处理所有这些情况。

## Token 经济学

Token 不是字符，不是单词，是模型处理文本的最小单位。"Hello, world!" 是 4 个 token，"你好世界"大约 2 个 token。中文大约 1 个字 ≈ 1.5-2 个 token。

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

# 计算成本
MODEL_PRICING = {
    "gpt-4o":            {"input": 2.50,  "output": 10.00},
    "gpt-4o-mini":       {"input": 0.15,  "output": 0.60},
    "claude-sonnet-4-20250514": {"input": 3.00,  "output": 15.00},
}

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    p = MODEL_PRICING.get(model, {"input": 0, "output": 0})
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000
```

一次典型的 10 轮对话大约消耗 3000-5000 input tokens + 500 output tokens。用 gpt-4o 大约 $0.01，用 gpt-4o-mini 大约 $0.001。差 10 倍。这就是为什么简单任务（意图分类、格式转换）应该用便宜模型，复杂推理才用强模型。

## 速率限制

OpenAI 的速率限制包括 RPM（每分钟请求数）、TPM（每分钟 token 数）、并发数。处理方式是信号量控制并发 + 指数退避重试：

```python
import asyncio
from openai import AsyncOpenAI, RateLimitError

class LLMClient:
    def __init__(self):
        self.client = AsyncOpenAI()
        self.semaphore = asyncio.Semaphore(10)  # 最多 10 个并发
    
    async def call(self, messages, model="gpt-4o", max_retries=3, **kwargs):
        for attempt in range(max_retries):
            try:
                async with self.semaphore:
                    response = await self.client.chat.completions.create(
                        model=model, messages=messages, **kwargs
                    )
                usage = response.usage
                return {
                    "content": response.choices[0].message.content,
                    "input_tokens": usage.prompt_tokens,
                    "output_tokens": usage.completion_tokens,
                    "cost": calculate_cost(model, usage.prompt_tokens, usage.completion_tokens),
                }
            except RateLimitError:
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)
            except Exception:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(1)
        raise Exception("Max retries exceeded")
```

指数退避的关键：`2 ** attempt`。第一次等 1 秒，第二次 2 秒，第三次 4 秒。不要用固定间隔重试——在限流场景下，固定间隔会让情况更糟。

## 错误处理

LLM API 的错误类型不同，处理方式也不同：

```python
from openai import APITimeoutError, APIConnectionError, RateLimitError, AuthenticationError

async def safe_llm_call(messages, model="gpt-4o", **kwargs):
    try:
        return await llm_client.call(messages, model, **kwargs)
    except AuthenticationError:
        # API Key 无效——配置问题，不能重试
        raise AppError("LLM_AUTH_ERROR", "AI 服务认证失败", 500)
    except RateLimitError:
        # 速率限制——可以重试，给用户友好提示
        raise AppError("LLM_RATE_LIMITED", "AI 服务繁忙，请稍后再试", 429)
    except APITimeoutError:
        # 超时——可能是 prompt 太长或模型负载高
        raise AppError("LLM_TIMEOUT", "AI 服务响应超时", 504)
    except APIConnectionError:
        # 网络问题
        raise AppError("LLM_CONNECTION_ERROR", "无法连接 AI 服务", 502)
```

区分"可重试"和"不可重试"错误。AuthenticationError 重试一万次也没用，RateLimitError 等一会儿就好了。

## 多模型适配

不同模型的 API 格式略有差异。OpenAI 和 Anthropic 的消息结构不同，system prompt 的传递方式不同。封装一个统一接口：

```python
@dataclass
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float

class LLMService:
    async def chat(self, messages, model="gpt-4o", **kwargs) -> LLMResponse:
        if model.startswith("gpt"):
            return await self._call_openai(messages, model, **kwargs)
        elif model.startswith("claude"):
            return await self._call_anthropic(messages, model, **kwargs)
        raise ValueError(f"Unsupported model: {model}")
```

业务代码只调 `llm_service.chat()`，不关心底层是 OpenAI 还是 Anthropic。后面阶段 6 的多模型降级（主模型挂了切备选）就是基于这个封装。

## 练习

### 练习 1：Token 计算与成本对比

用 `tiktoken` 计算以下场景的 token 数量和成本：
1. 一个 500 字的中文 System Prompt
2. 10 轮对话的总 token 数（包含格式开销）
3. 同样的场景，分别用 gpt-4o 和 gpt-4o-mini 的成本差多少

```python
# 消息的格式开销：每条消息 +3 tokens，name 字段 +1 token，回复 +3 tokens
def count_messages_tokens(messages, model="gpt-4o"):
    encoding = tiktoken.encoding_for_model(model)
    total = 3  # 回复开销
    for msg in messages:
        total += 3  # 每条消息开销
        for key, value in msg.items():
            total += len(encoding.encode(value))
    return total
```

### 练习 2：封装带重试的 LLM 客户端

实现 `LLMClient` 类，要求：
- `asyncio.Semaphore` 控制并发
- 指数退避处理速率限制
- 返回结构化结果（content、tokens、cost、latency）

测试：并发发 50 个请求，验证信号量限制了并发数，速率限制时自动退避重试。

### 练习 3：错误模拟

1. 用无效 API Key 调用，验证 `AuthenticationError` 被正确捕获
2. 发送超长消息（超过上下文窗口），验证错误处理
3. 快速发 100 个请求，观察速率限制和重试行为

## 关键判断

- **什么时候用强模型，什么时候用便宜模型？** 意图分类、格式转换、简单问答用 gpt-4o-mini；复杂推理、长文生成、代码分析用 gpt-4o。成本差 10 倍，简单任务用强模型是浪费。
- **Token 统计必须从第一天就开始。** 不统计 token 就不知道成本，不知道成本就没法做预算。
- **重试策略必须用指数退避。** 固定间隔重试在限流场景下会让问题更严重——所有请求同时重试，再次触发限流。

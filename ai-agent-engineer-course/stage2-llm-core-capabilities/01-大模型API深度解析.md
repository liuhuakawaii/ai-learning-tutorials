# 01 大模型 API 深度解析

> 不理解 token，你就无法控制成本。不理解请求生命周期，你就无法优化延迟。

## 学习目标

- 理解 LLM API 的完整请求生命周期
- 掌握 token 计算、成本控制、速率限制处理
- 实现健壮的 API 调用封装（重试、超时、降级）
- 理解不同模型的定价策略和性能特点

## 前置要求

- 已完成阶段 1，后端骨架可运行
- 有 OpenAI API Key（或兼容 API）
- HTTP 协议基础

## 请求生命周期

一个 LLM API 调用的完整过程：

```
用户输入 → Prompt 组装 → Token 编码 → 网络传输 → 模型推理 → Token 解码 → 流式/一次性返回 → 前端渲染
```

每一步都有可能出问题：

```python
# 最基本的 API 调用
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def call_llm(messages: list[dict]) -> str:
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=4096,
        )
        return response.choices[0].message.content
    except Exception as e:
        # 这里什么错误都可能：网络超时、API Key 无效、余额不足、速率限制...
        raise
```

## Token 经济学

### 什么是 token

token 不是字符，不是单词，是模型处理文本的最小单位。

```
"Hello, world!"  →  ["Hello", ",", " world", "!"]  →  4 tokens
"你好世界"        →  ["你好", "世界"]                →  2 tokens（大约）
```

### Token 计算

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """计算文本的 token 数量"""
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

def count_messages_tokens(messages: list[dict], model: str = "gpt-4o") -> int:
    """计算消息列表的 token 总数（包括格式开销）"""
    encoding = tiktoken.encoding_for_model(model)
    tokens_per_message = 3  # 每条消息的格式开销
    tokens_per_name = 1     # name 字段的额外开销
    
    total = 0
    for msg in messages:
        total += tokens_per_message
        for key, value in msg.items():
            total += len(encoding.encode(value))
            if key == "name":
                total += tokens_per_name
    total += 3  # 回复的格式开销
    return total
```

### 成本计算

```python
# 2025 年主流模型定价（每 1M tokens，美元）
MODEL_PRICING = {
    "gpt-4o":            {"input": 2.50,  "output": 10.00},
    "gpt-4o-mini":       {"input": 0.15,  "output": 0.60},
    "claude-sonnet-4-20250514": {"input": 3.00,  "output": 15.00},
    "claude-3.5-haiku":  {"input": 0.80,  "output": 4.00},
}

def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """计算 API 调用成本（美元）"""
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return 0.0
    
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    
    return input_cost + output_cost

# 示例
cost = calculate_cost("gpt-4o", input_tokens=2000, output_tokens=500)
print(f"本次调用成本：${cost:.6f}")  # ~$0.01
```

## 速率限制

OpenAI 的速率限制包括：

| 维度 | 说明 | 处理方式 |
|------|------|----------|
| RPM | 每分钟请求数 | 请求队列 + 限流 |
| TPM | 每分钟 token 数 | token 计数 + 延迟 |
| 并发 | 同时进行的请求数 | 信号量控制 |

```python
import asyncio
from openai import AsyncOpenAI, RateLimitError

class LLMClient:
    """带速率限制和重试的 LLM 客户端"""
    
    def __init__(self):
        self.client = AsyncOpenAI()
        self.semaphore = asyncio.Semaphore(10)  # 最多 10 个并发请求
    
    async def call(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        max_retries: int = 3,
    ) -> dict:
        """调用 LLM API，带重试和速率限制"""
        
        for attempt in range(max_retries):
            try:
                async with self.semaphore:
                    response = await self.client.chat.completions.create(
                        model=model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                
                usage = response.usage
                return {
                    "content": response.choices[0].message.content,
                    "input_tokens": usage.prompt_tokens,
                    "output_tokens": usage.completion_tokens,
                    "model": response.model,
                    "cost": calculate_cost(
                        model, usage.prompt_tokens, usage.completion_tokens
                    ),
                }
            
            except RateLimitError:
                # 速率限制：指数退避
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)
            
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(1)
        
        raise Exception("Max retries exceeded")
```

## API 调用封装

### 基础封装

```python
# backend/app/services/llm_service.py
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from dataclasses import dataclass

@dataclass
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    latency: float

class LLMService:
    """统一的 LLM 调用服务"""
    
    def __init__(self):
        self.openai = AsyncOpenAI()
        self.anthropic = AsyncAnthropic()
    
    async def chat(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        **kwargs,
    ) -> LLMResponse:
        """统一调用接口"""
        import time
        start = time.perf_counter()
        
        if model.startswith("gpt"):
            result = await self._call_openai(messages, model, **kwargs)
        elif model.startswith("claude"):
            result = await self._call_anthropic(messages, model, **kwargs)
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        result.latency = time.perf_counter() - start
        return result
    
    async def _call_openai(
        self, messages: list[dict], model: str, **kwargs
    ) -> LLMResponse:
        response = await self.openai.chat.completions.create(
            model=model, messages=messages, **kwargs
        )
        usage = response.usage
        return LLMResponse(
            content=response.choices[0].message.content,
            model=response.model,
            input_tokens=usage.prompt_tokens,
            output_tokens=usage.completion_tokens,
            cost=calculate_cost(model, usage.prompt_tokens, usage.completion_tokens),
            latency=0,
        )
    
    async def _call_anthropic(
        self, messages: list[dict], model: str, **kwargs
    ) -> LLMResponse:
        # Anthropic API 格式略有不同
        system = kwargs.pop("system", "")
        response = await self.anthropic.messages.create(
            model=model,
            system=system,
            messages=messages,
            max_tokens=kwargs.get("max_tokens", 4096),
        )
        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cost=calculate_cost(
                model, response.usage.input_tokens, response.usage.output_tokens
            ),
            latency=0,
        )
```

## 错误处理策略

```python
from openai import (
    APITimeoutError,
    APIConnectionError,
    RateLimitError,
    AuthenticationError,
    BadRequestError,
)

async def safe_llm_call(messages, model="gpt-4o", **kwargs):
    """安全的 LLM 调用，包含完整错误处理"""
    try:
        return await llm_service.chat(messages, model, **kwargs)
    
    except AuthenticationError:
        # API Key 无效或过期
        raise AppError("LLM_AUTH_ERROR", "AI 服务认证失败，请联系管理员", 500)
    
    except RateLimitError:
        # 速率限制
        raise AppError("LLM_RATE_LIMITED", "AI 服务繁忙，请稍后再试", 429)
    
    except APITimeoutError:
        # 超时
        raise AppError("LLM_TIMEOUT", "AI 服务响应超时，请重试", 504)
    
    except APIConnectionError:
        # 网络错误
        raise AppError("LLM_CONNECTION_ERROR", "无法连接 AI 服务", 502)
    
    except BadRequestError as e:
        # 请求格式错误（通常是消息太长）
        raise AppError("LLM_BAD_REQUEST", f"请求格式错误：{e}", 400)
```

## 练习

### 练习 1：Token 计算

1. 计算以下文本的 token 数量：
   - "Hello, world!"
   - 一段 500 字的中文文章
   - 一个完整的 System Prompt（角色设定 + 规则 + 示例）

2. 计算一次典型对话（10 轮）的总 token 数量和成本

### 练习 2：LLM 客户端

实现 `LLMClient` 类：

1. 支持 OpenAI 和 Anthropic 两个 provider
2. 包含速率限制（信号量）
3. 包含重试逻辑（指数退避）
4. 返回结构化的调用结果（token 用量、成本、延迟）

### 练习 3：错误模拟

1. 用无效 API Key 调用，验证错误处理
2. 快速发送 100 个请求，验证速率限制
3. 发送超长消息，验证错误处理

## 本节要点

- Token 不等于字符，中文大约 1 个字 ≈ 1.5-2 个 token
- 成本控制从 token 计算开始，每天统计成本是必须的
- 速率限制是 LLM API 的常态，必须实现重试和退避
- 统一的调用封装让切换模型变得简单

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `AuthenticationError` | API Key 无效或过期 | 检查环境变量中的 API Key |
| `RateLimitError` | 超出速率限制 | 实现指数退避重试 |
| `ContextWindowExceeded` | 消息超出上下文窗口 | 压缩历史或截断消息 |
| 成本飙升 | 没有 token 统计和限制 | 加入 token 计数和配额控制 |

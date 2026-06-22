# 02 - Prompt 性能优化

> **课程定位**：Stage 4 生产级 Prompt 工程 · 第 2 课
> **前置要求**：完成 Stage 1-3，了解 Token 计算基本概念
> **预计时长**：90 分钟

---

## 场景引入

你的 AI 产品日活突破 10 万，每天要处理 50 万次 LLM 调用。月底财务告诉你：API 费用 12 万元，比上个月翻了三倍。你排查发现，很多用户的查询其实大同小异，但每次都重新调用 API；系统提示词有 2000 token，其中一半是用不上的示例；长对话没有截断策略，上下文窗口被撑爆。成本失控只是表象，背后是 Token 管理、缓存策略、压缩技术的全面缺失。

---

## 学习目标

1. 理解 Token 预算管理与成本控制策略
2. 掌握 Prompt 压缩技术减少 Token 消耗
3. 实现多级缓存策略降低延迟和成本
4. 优化流式响应（Streaming）提升用户体验
5. 构建延迟基准测试工具量化优化效果

---

## 1. 性能优化全景

```
┌──────────────────────────────────────────────────────────────┐
│                 Prompt 性能优化管线                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  用户请求                                                     │
│     │                                                        │
│     ▼                                                        │
│  ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Token   │───▶│ Prompt  │───▶│  缓存    │───▶│  API     │ │
│  │ 预算    │    │ 压缩    │    │  查询    │    │  调用    │ │
│  └─────────┘    └─────────┘    └──────────┘    └──────────┘ │
│       │              │              │               │        │
│       ▼              ▼              ▼               ▼        │
│  控制成本       减少Token      避免重复调用    流式/并发优化    │
│                                                              │
│  目标：延迟 < 2s，成本降低 40%+，缓存命中率 > 30%             │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Token 预算管理

### 2.1 实现 Token 计数器

```python
"""
token_budget.py
Token 预算管理器 - 精确控制 API 成本
"""

import tiktoken
from typing import List, Dict, Optional
from dataclasses import dataclass, field


@dataclass
class TokenBudget:
    """Token 预算配置"""
    max_input_tokens: int = 4000
    max_output_tokens: int = 2000
    reserved_system_tokens: int = 500
    cost_per_1k_input: float = 0.0025    # GPT-4o-mini 价格
    cost_per_1k_output: float = 0.010


class TokenCounter:
    """Token 计数与预算管理"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        try:
            self.encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            self.encoding = tiktoken.get_encoding("cl100k_base")

    def count(self, text: str) -> int:
        """计算文本的 Token 数"""
        return len(self.encoding.encode(text))

    def count_messages(self, messages: List[Dict[str, str]]) -> int:
        """计算消息列表的总 Token 数（含格式开销）"""
        total = 0
        for msg in messages:
            total += 4  # 每条消息的格式开销
            for key, value in msg.items():
                total += self.count(str(value))
        total += 2  # 回复的 priming tokens
        return total

    def estimate_cost(self, input_tokens: int, output_tokens: int,
                      budget: TokenBudget) -> float:
        """估算 API 调用成本（美元）"""
        input_cost = (input_tokens / 1000) * budget.cost_per_1k_input
        output_cost = (output_tokens / 1000) * budget.cost_per_1k_output
        return input_cost + output_cost

    def check_budget(self, messages: List[Dict], budget: TokenBudget) -> Dict:
        """检查是否超出预算"""
        input_tokens = self.count_messages(messages)
        remaining = budget.max_input_tokens - input_tokens

        return {
            "input_tokens": input_tokens,
            "remaining_tokens": remaining,
            "within_budget": remaining >= 0,
            "utilization": input_tokens / budget.max_input_tokens,
            "estimated_cost": self.estimate_cost(
                input_tokens, budget.max_output_tokens, budget
            ),
        }


class PromptTruncator:
    """智能 Prompt 截断策略"""

    def __init__(self, counter: TokenCounter):
        self.counter = counter

    def truncate_sliding_window(self, messages: List[Dict],
                                 max_tokens: int) -> List[Dict]:
        """滑动窗口截断 - 保留最新的对话"""
        system_msgs = [m for m in messages if m["role"] == "system"]
        other_msgs = [m for m in messages if m["role"] != "system"]

        system_tokens = self.counter.count_messages(system_msgs)
        available = max_tokens - system_tokens

        kept = []
        current_tokens = 0

        # 从最新的消息开始保留
        for msg in reversed(other_msgs):
            msg_tokens = self.counter.count_messages([msg])
            if current_tokens + msg_tokens > available:
                break
            kept.insert(0, msg)
            current_tokens += msg_tokens

        return system_msgs + kept

    def truncate_summary(self, messages: List[Dict],
                          max_tokens: int,
                          summary_prefix: str = "[历史摘要]") -> List[Dict]:
        """摘要截断 - 用摘要替换旧消息"""
        system_msgs = [m for m in messages if m["role"] == "system"]
        other_msgs = [m for m in messages if m["role"] != "system"]

        system_tokens = self.counter.count_messages(system_msgs)
        available = max_tokens - system_tokens

        # 保留最近 4 条消息
        recent = other_msgs[-4:] if len(other_msgs) > 4 else other_msgs
        recent_tokens = self.counter.count_messages(recent)

        # 旧消息生成摘要占位
        old_count = len(other_msgs) - len(recent)
        if old_count > 0:
            summary = {
                "role": "system",
                "content": f"{summary_prefix} 此前有 {old_count} 轮对话，"
                          f"讨论了相关话题。"
            }
            return system_msgs + [summary] + recent

        return system_msgs + recent


# 使用示例
if __name__ == "__main__":
    counter = TokenCounter("gpt-4o-mini")
    budget = TokenBudget(max_input_tokens=4000)

    messages = [
        {"role": "system", "content": "你是一个专业的Python编程助手。"},
        {"role": "user", "content": "请帮我优化这段代码的性能..."},
        {"role": "assistant", "content": "好的，我来分析这段代码..."},
        {"role": "user", "content": "还有其他优化建议吗？"},
    ]

    result = counter.check_budget(messages, budget)
    print(f"输入 Token: {result['input_tokens']}")
    print(f"预算使用: {result['utilization']:.1%}")
    print(f"预估成本: ${result['estimated_cost']:.4f}")
```

---

## 3. Prompt 压缩技术

```python
"""
prompt_compressor.py
Prompt 压缩器 - 多种压缩策略
"""

import re
from typing import List, Dict, Tuple


class PromptCompressor:
    """Prompt 压缩工具集"""

    def __init__(self, token_counter=None):
        self.counter = token_counter

    def compress_whitespace(self, text: str) -> str:
        """压缩空白字符"""
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        text = re.sub(r'\t+', ' ', text)
        return text.strip()

    def compress_examples(self, examples: List[Dict], max_examples: int = 3) -> List[Dict]:
        """限制示例数量，保留最相关的"""
        if len(examples) <= max_examples:
            return examples
        return examples[:max_examples]

    def deduplicate_context(self, context_items: List[str],
                             similarity_threshold: float = 0.8) -> List[str]:
        """去重相似的上下文片段"""
        if not context_items:
            return []

        kept = [context_items[0]]
        for item in context_items[1:]:
            is_dup = False
            for kept_item in kept:
                similarity = self._jaccard_similarity(item, kept_item)
                if similarity > similarity_threshold:
                    is_dup = True
                    break
            if not is_dup:
                kept.append(item)
        return kept

    def _jaccard_similarity(self, a: str, b: str) -> float:
        """计算 Jaccard 相似度"""
        set_a = set(a.split())
        set_b = set(b.split())
        intersection = set_a & set_b
        union = set_a | set_b
        return len(intersection) / len(union) if union else 0

    def compress_markdown(self, text: str) -> str:
        """压缩 Markdown 格式"""
        text = re.sub(r'```[\w]*\n', '```\n', text)
        text = re.sub(r'#{1,6}\s+', '', text)
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        return text

    def batch_compress(self, text: str, strategies: List[str] = None) -> Tuple[str, Dict]:
        """批量应用压缩策略"""
        if strategies is None:
            strategies = ["whitespace", "markdown"]

        original_len = len(text)
        stats = {"original_chars": original_len}

        if "whitespace" in strategies:
            text = self.compress_whitespace(text)
        if "markdown" in strategies:
            text = self.compress_markdown(text)

        stats["compressed_chars"] = len(text)
        stats["compression_ratio"] = 1 - (len(text) / original_len) if original_len > 0 else 0
        return text, stats


# 使用示例
if __name__ == "__main__":
    compressor = PromptCompressor()

    sample = """


    # 这是一个 **测试** 文档



    这里有很多    空白字符。


    ```python
    def hello():
        pass
    ```


    """

    compressed, stats = compressor.batch_compress(sample)
    print(f"压缩比: {stats['compression_ratio']:.1%}")
    print(f"压缩后: {repr(compressed)}")
```

---

## 4. 缓存策略

```python
"""
prompt_cache.py
多级 Prompt 缓存系统
"""

import hashlib
import json
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from collections import OrderedDict


@dataclass
class CacheEntry:
    key: str
    response: str
    created_at: float
    hit_count: int = 0
    tokens_used: int = 0
    cost: float = 0.0


class LRUCache:
    """LRU 缓存实现"""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()

    def _make_key(self, messages: List[Dict], model: str) -> str:
        """生成缓存键"""
        content = json.dumps(messages, sort_keys=True) + model
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def get(self, messages: List[Dict], model: str) -> Optional[str]:
        """查询缓存"""
        key = self._make_key(messages, model)
        entry = self._cache.get(key)

        if entry is None:
            return None

        # 检查 TTL
        if time.time() - entry.created_at > self.ttl:
            del self._cache[key]
            return None

        # 移到最前（LRU）
        self._cache.move_to_end(key)
        entry.hit_count += 1
        return entry.response

    def put(self, messages: List[Dict], model: str,
            response: str, tokens: int = 0, cost: float = 0.0):
        """存入缓存"""
        key = self._make_key(messages, model)

        if len(self._cache) >= self.max_size:
            self._cache.popitem(last=False)

        self._cache[key] = CacheEntry(
            key=key,
            response=response,
            created_at=time.time(),
            tokens_used=tokens,
            cost=cost,
        )

    def stats(self) -> Dict:
        """缓存统计"""
        entries = list(self._cache.values())
        return {
            "size": len(self._cache),
            "total_hits": sum(e.hit_count for e in entries),
            "total_saved_tokens": sum(e.hit_count * e.tokens_used for e in entries),
            "total_saved_cost": sum(e.hit_count * e.cost for e in entries),
        }


class PrefixCache:
    """前缀缓存 - 共享系统提示词前缀"""

    def __init__(self):
        self._prefixes: Dict[str, str] = {}

    def register_prefix(self, name: str, content: str):
        """注册可复用的前缀"""
        self._prefixes[name] = content

    def build_messages(self, prefix_name: str,
                       user_content: str) -> List[Dict]:
        """使用缓存前缀构建消息"""
        prefix = self._prefixes.get(prefix_name, "")
        return [
            {"role": "system", "content": prefix},
            {"role": "user", "content": user_content},
        ]


# 使用示例
if __name__ == "__main__":
    cache = LRUCache(max_size=100, ttl_seconds=1800)

    messages = [
        {"role": "system", "content": "你是一个助手"},
        {"role": "user", "content": "你好"},
    ]

    # 首次调用 - 缓存未命中
    result = cache.get(messages, "gpt-4o-mini")
    print(f"首次查询: {result}")  # None

    # 存入缓存
    cache.put(messages, "gpt-4o-mini", "你好！有什么可以帮助你的？",
              tokens=50, cost=0.001)

    # 再次调用 - 缓存命中
    result = cache.get(messages, "gpt-4o-mini")
    print(f"二次查询: {result}")  # "你好！有什么可以帮助你的？"

    print(f"缓存统计: {cache.stats()}")
```

---

## 5. 流式响应与延迟优化

```python
"""
streaming_optimizer.py
流式响应与延迟优化工具
"""

import time
import asyncio
from typing import AsyncIterator, Callable, Optional
from dataclasses import dataclass


@dataclass
class LatencyMetrics:
    """延迟指标"""
    time_to_first_token: float = 0.0   # TTFT
    time_between_tokens: List[float] = None
    total_time: float = 0.0
    tokens_per_second: float = 0.0
    total_tokens: int = 0

    def __post_init__(self):
        if self.time_between_tokens is None:
            self.time_between_tokens = []

    def avg_tbt(self) -> float:
        """平均 Token 间延迟"""
        if not self.time_between_tokens:
            return 0.0
        return sum(self.time_between_tokens) / len(self.time_between_tokens)


class LatencyBenchmark:
    """延迟基准测试工具"""

    def __init__(self):
        self.results: list = []

    async def measure_streaming(self, stream: AsyncIterator[str],
                                 label: str = "default") -> LatencyMetrics:
        """测量流式响应延迟"""
        metrics = LatencyMetrics()
        tokens = []
        last_time = time.perf_counter()

        async for chunk in stream:
            current_time = time.perf_counter()

            if not tokens:
                metrics.time_to_first_token = current_time - last_time
            else:
                metrics.time_between_tokens.append(current_time - last_time)

            tokens.append(chunk)
            last_time = current_time

        metrics.total_time = time.perf_counter() - (last_time - metrics.time_to_first_token)
        metrics.total_tokens = len(tokens)
        metrics.tokens_per_second = (
            metrics.total_tokens / metrics.total_time if metrics.total_time > 0 else 0
        )

        self.results.append({"label": label, "metrics": metrics})
        return metrics

    def report(self) -> str:
        """生成测试报告"""
        lines = ["=" * 60, "延迟基准测试报告", "=" * 60]
        for r in self.results:
            m = r["metrics"]
            lines.append(f"\n[{r['label']}]")
            lines.append(f"  TTFT:           {m.time_to_first_token*1000:.1f}ms")
            lines.append(f"  平均 TBT:       {m.avg_tbt()*1000:.1f}ms")
            lines.append(f"  总耗时:         {m.total_time*1000:.1f}ms")
            lines.append(f"  Token/s:        {m.tokens_per_second:.1f}")
            lines.append(f"  总 Token:       {m.total_tokens}")
        lines.append("=" * 60)
        return "\n".join(lines)


class PromptBatcher:
    """请求批处理器 - 合并多个请求"""

    def __init__(self, batch_delay: float = 0.05):
        self.batch_delay = batch_delay
        self._pending: list = []

    async def add_request(self, prompt: str) -> str:
        """添加请求到批次"""
        future = asyncio.get_event_loop().create_future()
        self._pending.append({"prompt": prompt, "future": future})

        if len(self._pending) == 1:
            await asyncio.sleep(self.batch_delay)
            await self._flush()

        return await future

    async def _flush(self):
        """处理所有待处理请求"""
        batch = self._pending[:]
        self._pending.clear()

        if not batch:
            return

        prompts = [r["prompt"] for r in batch]
        results = await self._batch_call(prompts)

        for req, result in zip(batch, results):
            req["future"].set_result(result)

    async def _batch_call(self, prompts: list) -> list:
        """模拟批量 API 调用"""
        return [f"Response to: {p[:20]}..." for p in prompts]


# 使用示例
async def main():
    benchmark = LatencyBenchmark()

    async def mock_stream():
        for word in ["Hello", " ", "World", " ", "!"]:
            yield word
            await asyncio.sleep(0.05)

    metrics = await benchmark.measure_streaming(mock_stream(), "mock")
    print(f"TTFT: {metrics.time_to_first_token*1000:.1f}ms")
    print(f"Token/s: {metrics.tokens_per_second:.1f}")
    print(benchmark.report())


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 6. 性能优化策略对照表

| 优化策略 | 适用场景 | 延迟影响 | 成本影响 | 实现复杂度 |
|---------|---------|---------|---------|----------|
| LRU 缓存 | 重复查询多 | -90% | -90% | 低 |
| 前缀缓存 | 系统提示固定 | -30% | -20% | 低 |
| Prompt 压缩 | 长上下文 | -20% | -20% | 中 |
| 流式响应 | 长输出 | TTFT↓ | 无变化 | 低 |
| 请求批处理 | 高并发 | +50ms | -10% | 中 |
| Token 截断 | 超长对话 | -40% | -40% | 中 |
| 模型降级 | 简单任务 | -50% | -80% | 低 |

---

## 7. 常见误区

### ❌ 错误 1：不做 Token 预算检查

```python
# 错误：直接发送超长内容，API 报错或产生高额费用
messages = [{"role": "user", "content": very_long_document}]
response = client.chat.completions.create(messages=messages)

# 正确：先检查 Token 数，必要时截断
budget.check_budget(messages, config)
```

### ❌ 错误 2：缓存键包含随机内容

```python
# 错误：每次请求缓存键都不同
key = f"{messages}_{time.time()}_{random.random()}"

# 正确：只基于确定性内容生成键
key = hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()
```

### ❌ 错误 3：忽略流式响应的 TTFT

```python
# 错误：等待完整响应才开始处理
response = client.chat.completions.create(stream=False)

# 正确：使用流式响应尽早返回第一个 Token
stream = client.chat.completions.create(stream=True)
for chunk in stream:
    yield chunk.choices[0].delta.content
```

---

## 8. 工程建议

1. **先测量再优化**：用 `LatencyBenchmark` 量化当前 TTFT、Token/s、P95 延迟等指标，建立基线后再针对性优化，避免凭直觉做无用功。

2. **语义缓存的相似度阈值需要持续调优**：阈值设太高（如 0.98）命中率低，设太低（如 0.85）会返回不相关结果。建议从 0.92 起步，根据用户反馈逐步调整。

3. **流式响应对用户体验提升最大**：在所有优化手段中，流式响应的投入产出比最高——实现简单，但用户感知延迟可以降低 80% 以上。

4. **建立 Token 用量告警机制**：按小时统计 Token 消耗，设置阶梯告警（如小时用量超过 50K 警告、超过 200K 严重），防止成本失控。

---

## 总结

Prompt 性能优化的核心是**测量先行**：先用基准测试量化当前性能，再针对性优化。Token 管理控制成本，缓存减少重复调用，压缩减少传输量，流式提升感知速度。

---

## 练习

### 练习 1：Token 预算管理器
扩展 `TokenBudget` 类，支持按月统计 Token 使用量和成本，并在接近预算上限时发出警告。

### 练习 2：语义压缩器
实现一个 `SemanticCompressor`，使用 Embedding 相似度对长文档进行智能压缩，保留与查询最相关的段落。

### 练习 3：延迟优化实验
使用 `LatencyBenchmark` 对比不同模型（GPT-4o-mini vs GPT-4o）的 TTFT 和 Token/s，生成对比报告。

---

## 参考答案

### 练习 1：Token 预算管理器

**思路**：在现有 `TokenBudget` 基础上增加月度统计功能，维护一个按月归档的用量记录，每次 API 调用后累加 Token 和成本，并在接近预算上限时通过回调发出警告。

**答案**：

```python
"""
token_budget_manager.py
Token 预算管理器 - 支持月度统计和预算告警
"""

import time
from typing import Dict, Optional, Callable
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class MonthlyUsage:
    """月度用量统计"""
    month: str  # 格式: "2024-01"
    input_tokens: int = 0
    output_tokens: int = 0
    total_cost: float = 0.0
    call_count: int = 0
    cache_savings_tokens: int = 0
    cache_savings_cost: float = 0.0


class TokenBudgetManager:
    """Token 预算管理器 - 支持月度统计和预算告警"""

    def __init__(
        self,
        monthly_budget_dollars: float = 100.0,
        monthly_token_limit: int = 10_000_000,
        cost_per_1k_input: float = 0.0025,
        cost_per_1k_output: float = 0.010,
        warning_thresholds: list = None,
        on_warning: Optional[Callable] = None,
    ):
        self.monthly_budget = monthly_budget_dollars
        self.monthly_token_limit = monthly_token_limit
        self.cost_per_1k_input = cost_per_1k_input
        self.cost_per_1k_output = cost_per_1k_output
        self.warning_thresholds = warning_thresholds or [0.7, 0.85, 0.95]
        self.on_warning = on_warning

        self._usage: Dict[str, MonthlyUsage] = {}
        self._triggered_warnings: Dict[str, set] = defaultdict(set)

    def _current_month(self) -> str:
        return time.strftime("%Y-%m")

    def _get_or_create_usage(self, month: str) -> MonthlyUsage:
        if month not in self._usage:
            self._usage[month] = MonthlyUsage(month=month)
        return self._usage[month]

    def record_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        from_cache: bool = False,
        cache_saved_tokens: int = 0,
    ):
        """记录一次 API 调用的 Token 用量"""
        month = self._current_month()
        usage = self._get_or_create_usage(month)

        input_cost = (input_tokens / 1000) * self.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.cost_per_1k_output
        call_cost = input_cost + output_cost

        if not from_cache:
            usage.input_tokens += input_tokens
            usage.output_tokens += output_tokens
            usage.total_cost += call_cost
            usage.call_count += 1
        else:
            usage.cache_savings_tokens += cache_saved_tokens
            usage.cache_savings_cost += (cache_saved_tokens / 1000) * self.cost_per_1k_input

        self._check_budget(month, usage)

    def _check_budget(self, month: str, usage: MonthlyUsage):
        """检查是否接近预算上限"""
        cost_ratio = usage.total_cost / self.monthly_budget
        token_ratio = (usage.input_tokens + usage.output_tokens) / self.monthly_token_limit

        for threshold in self.warning_thresholds:
            warning_key = f"cost_{threshold}"
            if cost_ratio >= threshold and warning_key not in self._triggered_warnings[month]:
                self._triggered_warnings[month].add(warning_key)
                if self.on_warning:
                    self.on_warning({
                        "type": "cost_threshold",
                        "month": month,
                        "threshold": threshold,
                        "current_cost": usage.total_cost,
                        "budget": self.monthly_budget,
                        "ratio": cost_ratio,
                    })

            warning_key = f"token_{threshold}"
            if token_ratio >= threshold and warning_key not in self._triggered_warnings[month]:
                self._triggered_warnings[month].add(warning_key)
                if self.on_warning:
                    self.on_warning({
                        "type": "token_threshold",
                        "month": month,
                        "threshold": threshold,
                        "current_tokens": usage.input_tokens + usage.output_tokens,
                        "limit": self.monthly_token_limit,
                        "ratio": token_ratio,
                    })

    def get_monthly_report(self, month: str = None) -> Dict:
        """获取月度报告"""
        month = month or self._current_month()
        usage = self._get_or_create_usage(month)

        total_tokens = usage.input_tokens + usage.output_tokens
        return {
            "month": month,
            "calls": usage.call_count,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "total_tokens": total_tokens,
            "total_cost": f"${usage.total_cost:.4f}",
            "budget_used": f"{usage.total_cost / self.monthly_budget:.1%}",
            "budget_remaining": f"${self.monthly_budget - usage.total_cost:.4f}",
            "cache_savings": {
                "tokens": usage.cache_savings_tokens,
                "cost": f"${usage.cache_savings_cost:.4f}",
            },
        }

    def get_all_months(self) -> list:
        """列出所有有数据的月份"""
        return sorted(self._usage.keys())


if __name__ == "__main__":
    def warning_handler(info):
        print(f"⚠️ 预算告警: {info['type']} 达到 {info['threshold']:.0%}")
        print(f"   当前: {info.get('current_cost', info.get('current_tokens', 0))}")

    manager = TokenBudgetManager(
        monthly_budget_dollars=50.0,
        monthly_token_limit=5_000_000,
        on_warning=warning_handler,
    )

    # 模拟多次调用
    for i in range(20):
        manager.record_usage(
            input_tokens=5000,
            output_tokens=2000,
        )

    report = manager.get_monthly_report()
    print(f"\n月度报告 ({report['month']}):")
    for key, value in report.items():
        if key != "month" and key != "cache_savings":
            print(f"  {key}: {value}")
    print(f"  缓存节省 Token: {report['cache_savings']['tokens']}")
```

**要点**：
- 月度统计需要按月份归档，避免跨月数据混淆
- 预算告警采用阶梯阈值（70%、85%、95%），避免在同一阈值重复触发
- 缓存节省的 Token 和成本也要单独统计，用于衡量缓存系统的 ROI

---

### 练习 2：语义压缩器

**思路**：使用 Embedding 将查询和文档段落向量化，计算余弦相似度，只保留与查询最相关的段落。对于超长文档，先分段再逐段计算相关性，按相似度排序后截断到 Token 预算内。

**答案**：

```python
"""
semantic_compressor.py
语义压缩器 - 基于 Embedding 相似度的智能压缩
"""

import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class DocumentChunk:
    """文档片段"""
    content: str
    index: int
    relevance_score: float = 0.0


class SemanticCompressor:
    """语义压缩器 - 保留与查询最相关的段落"""

    def __init__(self, embedding_fn=None, max_tokens: int = 2000):
        """
        Args:
            embedding_fn: 接受文本返回向量的函数，签名为 (str) -> List[float]
            max_tokens: 压缩后的目标 Token 数
        """
        self.embedding_fn = embedding_fn
        self.max_tokens = max_tokens

    def split_into_chunks(self, text: str, max_chunk_chars: int = 500) -> List[DocumentChunk]:
        """将文档按段落或固定长度分块"""
        paragraphs = re.split(r'\n{2,}', text)
        chunks = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current) + len(para) > max_chunk_chars and current:
                chunks.append(DocumentChunk(content=current.strip(), index=len(chunks)))
                current = para
            else:
                current = current + "\n\n" + para if current else para

        if current.strip():
            chunks.append(DocumentChunk(content=current.strip(), index=len(chunks)))

        return chunks

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """计算余弦相似度"""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _estimate_tokens(self, text: str) -> int:
        """粗略估算 Token 数"""
        return len(text) // 3

    def compress(self, document: str, query: str) -> Tuple[str, Dict]:
        """
        压缩文档，保留与查询最相关的部分

        Returns:
            (压缩后文本, 统计信息)
        """
        chunks = self.split_into_chunks(document)

        if not chunks:
            return "", {"original_chunks": 0, "kept_chunks": 0}

        if self.embedding_fn:
            query_embedding = self.embedding_fn(query)
            chunk_embeddings = self.embedding_fn(
                [c.content for c in chunks]
            )

            for chunk, emb in zip(chunks, chunk_embeddings):
                chunk.relevance_score = self._cosine_similarity(query_embedding, emb)
        else:
            # 降级方案：基于关键词重叠的简单相关性
            query_words = set(query.lower().split())
            for chunk in chunks:
                chunk_words = set(chunk.content.lower().split())
                overlap = query_words & chunk_words
                chunk.relevance_score = len(overlap) / max(len(query_words), 1)

        chunks.sort(key=lambda c: c.relevance_score, reverse=True)

        kept = []
        current_tokens = 0
        for chunk in chunks:
            chunk_tokens = self._estimate_tokens(chunk.content)
            if current_tokens + chunk_tokens > self.max_tokens:
                break
            kept.append(chunk)
            current_tokens += chunk_tokens

        kept.sort(key=lambda c: c.index)

        compressed = "\n\n".join(c.content for c in kept)

        return compressed, {
            "original_chunks": len(chunks),
            "kept_chunks": len(kept),
            "original_chars": len(document),
            "compressed_chars": len(compressed),
            "compression_ratio": 1 - (len(compressed) / len(document)) if document else 0,
            "avg_relevance": (
                sum(c.relevance_score for c in kept) / len(kept) if kept else 0
            ),
        }


if __name__ == "__main__":
    compressor = SemanticCompressor(max_tokens=200)

    document = """
    机器学习是人工智能的一个分支，它让计算机能够从数据中学习，而不需要明确编程。
    机器学习算法通过训练数据来构建数学模型，以便对新数据做出预测或决策。

    深度学习是机器学习的一个子集，使用多层神经网络来模拟人脑的工作方式。
    深度学习在图像识别、自然语言处理等领域取得了突破性进展。
    卷积神经网络（CNN）特别适合处理图像数据。

    自然语言处理（NLP）是人工智能的另一个重要分支。
    NLP 技术使计算机能够理解、解释和生成人类语言。
    大语言模型（LLM）是 NLP 领域的最新突破。

    强化学习是机器学习的第三种主要类型。
    强化学习通过与环境交互来学习最优策略。
    AlphaGo 就是强化学习的经典应用。

    量子计算是一种利用量子力学原理进行计算的技术。
    量子计算机使用量子比特而不是经典比特。
    量子计算有望在密码学和材料科学领域带来革命。
    """

    query = "什么是深度学习？它和机器学习有什么关系？"

    compressed, stats = compressor.compress(document, query)

    print(f"原文长度: {stats['original_chars']} 字符")
    print(f"压缩后: {stats['compressed_chars']} 字符")
    print(f"压缩比: {stats['compression_ratio']:.1%}")
    print(f"保留片段: {stats['kept_chunks']}/{stats['original_chunks']}")
    print(f"平均相关性: {stats['avg_relevance']:.3f}")
    print(f"\n--- 压缩结果 ---")
    print(compressed)
```

**要点**：
- 语义压缩的核心是"按相关性排序后截断"，而不是简单地取前 N 个段落
- 降级方案很重要：没有 Embedding API 时可以用关键词重叠作为近似
- 分块后保留原始顺序（index），避免输出的上下文逻辑被打乱

---

### 练习 3：延迟优化实验

**思路**：使用 `LatencyBenchmark` 工具对不同模型做流式响应测试，记录 TTFT、TBT、Token/s 等指标，然后生成对比报告。可以用模拟流来演示框架，实际测试时替换为真实 API 调用。

**答案**：

```python
"""
latency_experiment.py
延迟优化实验 - 对比不同模型的流式响应性能
"""

import time
import asyncio
from typing import List, Dict, AsyncIterator
from dataclasses import dataclass


@dataclass
class LatencyMetrics:
    time_to_first_token: float = 0.0
    time_between_tokens: List[float] = None
    total_time: float = 0.0
    tokens_per_second: float = 0.0
    total_tokens: int = 0

    def __post_init__(self):
        if self.time_between_tokens is None:
            self.time_between_tokens = []

    def avg_tbt(self) -> float:
        if not self.time_between_tokens:
            return 0.0
        return sum(self.time_between_tokens) / len(self.time_between_tokens)

    def p95_tbt(self) -> float:
        if not self.time_between_tokens:
            return 0.0
        sorted_tbt = sorted(self.time_between_tokens)
        idx = int(len(sorted_tbt) * 0.95)
        return sorted_tbt[min(idx, len(sorted_tbt) - 1)]


class LatencyBenchmark:
    """延迟基准测试工具"""

    def __init__(self):
        self.results: list = []

    async def measure_streaming(self, stream: AsyncIterator[str],
                                 label: str = "default") -> LatencyMetrics:
        metrics = LatencyMetrics()
        tokens = []
        last_time = time.perf_counter()

        async for chunk in stream:
            current_time = time.perf_counter()
            if not tokens:
                metrics.time_to_first_token = current_time - last_time
            else:
                metrics.time_between_tokens.append(current_time - last_time)
            tokens.append(chunk)
            last_time = current_time

        metrics.total_time = time.perf_counter() - (last_time - metrics.time_to_first_token)
        metrics.total_tokens = len(tokens)
        metrics.tokens_per_second = (
            metrics.total_tokens / metrics.total_time if metrics.total_time > 0 else 0
        )
        self.results.append({"label": label, "metrics": metrics})
        return metrics

    def report(self) -> str:
        lines = ["=" * 70, "延迟基准测试报告", "=" * 70]
        for r in self.results:
            m = r["metrics"]
            lines.append(f"\n[{r['label']}]")
            lines.append(f"  TTFT:           {m.time_to_first_token*1000:.1f}ms")
            lines.append(f"  平均 TBT:       {m.avg_tbt()*1000:.1f}ms")
            lines.append(f"  P95 TBT:        {m.p95_tbt()*1000:.1f}ms")
            lines.append(f"  总耗时:         {m.total_time*1000:.1f}ms")
            lines.append(f"  Token/s:        {m.tokens_per_second:.1f}")
            lines.append(f"  总 Token:       {m.total_tokens}")
        lines.append("=" * 70)

        if len(self.results) >= 2:
            lines.append("\n对比分析:")
            a, b = self.results[0]["metrics"], self.results[1]["metrics"]
            ttft_diff = (a.time_to_first_token - b.time_to_first_token) * 1000
            tps_diff = a.tokens_per_second - b.tokens_per_second
            lines.append(f"  TTFT 差异: {ttft_diff:+.1f}ms")
            lines.append(f"  Token/s 差异: {tps_diff:+.1f}")
            faster = self.results[0]["label"] if tps_diff > 0 else self.results[1]["label"]
            lines.append(f"  吞吐量更高: {faster}")

        return "\n".join(lines)


async def mock_model_stream(model_name: str, delay: float,
                             token_count: int) -> AsyncIterator[str]:
    """模拟模型流式输出"""
    for i in range(token_count):
        yield f"{model_name}_token_{i} "
        await asyncio.sleep(delay)


async def main():
    benchmark = LatencyBenchmark()

    print("开始延迟对比实验...\n")

    await benchmark.measure_streaming(
        mock_model_stream("gpt-4o-mini", delay=0.02, token_count=80),
        label="GPT-4o-mini (模拟: 20ms/token)",
    )

    await benchmark.measure_streaming(
        mock_model_stream("gpt-4o", delay=0.04, token_count=80),
        label="GPT-4o (模拟: 40ms/token)",
    )

    print(benchmark.report())

    print("\n\n=== 优化建议 ===")
    print("1. 简单任务用 GPT-4o-mini: TTFT 更低，Token/s 更高")
    print("2. 复杂推理任务用 GPT-4o: 质量优先，延迟可接受")
    print("3. 流式响应可以显著降低用户感知延迟 (TTFT < 500ms)")


if __name__ == "__main__":
    asyncio.run(main())
```

**要点**：
- TTFT（首 Token 延迟）和 Token/s（吞吐量）是衡量流式响应的两个核心指标
- 模型选择需要在延迟和质量之间权衡：GPT-4o-mini 快但质量一般，GPT-4o 慢但质量高
- 实际测试时应使用真实 API 调用替换模拟流，并多次测量取中位数

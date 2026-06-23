# 从单 Agent 到多 Agent

> 前置知识：02-ai-agent-engineer-course 的单 Agent 开发经验
> 预计时长：40 分钟

## 一个真实的崩溃现场

你接了一个需求：让 AI 帮用户做竞品分析。流程是搜索竞品信息 → 提取功能差异 → 生成对比报告。你把所有指令塞进一个 system prompt，加了 5 个工具，跑了几个测试 case 效果还行。

上线后用户输入变了："帮我对比 Notion、Obsidian 和 Logseq，重点关注离线能力和插件生态"。

结果：
- Agent 先搜了 Notion，拿到一堆信息塞进上下文
- 搜 Obsidian 时上下文已经很长，模型开始"忘掉" Notion 的细节
- 搜 Logseq 时，Notion 的搜索结果被挤出了有效上下文窗口
- 最后生成的报告里，Notion 的信息严重缺失，部分描述其实是 Logseq 的

这不是 prompt 写得不好，而是单 Agent 架构的结构性问题。

## 单 Agent 的四个结构性瓶颈

### 上下文窗口是有上限的

很多人觉得 128K tokens 够用了。算一笔账：

一个典型任务的 token 消耗：
- System prompt + 工具定义：~5K
- 5 轮对话历史：~10K
- 搜索返回的 3 篇文档：~15K
- 中间推理过程：~8K
- 已经处理过的步骤输出：~20K

一轮下来 58K，两轮 100K+，三轮就开始丢信息。这不是模型能力问题，是物理限制。你可以用 RAG 来压缩历史，但压缩本身就是信息损失。

多 Agent 的解法：每个 Agent 只管自己的上下文。搜索 Agent 搜完把结果交给分析 Agent，分析 Agent 不需要保留搜索过程的原始数据。上下文被自然地分段了。

### 单一角色的能力稀释

一个 Agent 被要求同时搜索、分析、写报告，它的 system prompt 会越来越长，角色描述越来越模糊。模型对长 prompt 的指令遵循率会下降——这不是直觉，是可以用实验验证的。

把同一个任务拆成三个 Agent 后，每个 Agent 的 system prompt 只有 200-300 字，角色明确，工具精简。同样的底层模型，输出质量会有明显差异。

### 错误累积是指数级的

假设每步正确率 90%：
- 3 步任务：0.9^3 = 73%
- 5 步任务：0.9^5 = 59%
- 10 步任务：0.9^10 = 35%

多 Agent 不能提高单步准确率，但能做到两件事：
1. 每个 Agent 步骤更少，单 Agent 内的错误累积更小
2. Agent 之间有明确的输入输出边界，下游可以验证上游结果，失败时只需重跑单个 Agent

### 没有控制面

单 Agent 是一条直线执行。你想在第 3 步之后暂停让人审批，实现起来非常别扭——要么用复杂的条件逻辑，要么用回调函数，要么用外部状态机。这些本质上都是在单 Agent 架构上"打补丁"。

多 Agent 天然有控制面：Agent 之间的调度逻辑就是控制面。在某个 Agent 之后暂停、审批、分支、重试，都是自然的编排操作。

## 什么时候该拆，什么时候不该拆

该拆的信号：
- 单个 prompt 已经超过 2000 字，还在不断加条件
- 任务有明显的阶段性，每个阶段需要不同的工具集
- 需要在某个阶段之后暂停等待人工输入
- 同一阶段的多个子任务可以并行执行
- 不同阶段的输出质量差异大，需要用不同模型

不该拆的信号：
- 任务就是一个简单的工具调用 + 结果格式化
- 子任务之间高度耦合，A 必须看到 B 的全部中间状态才能工作
- 延迟敏感，Agent 间的通信开销不可接受
- 预算紧张，多 Agent 的 token 消耗至少是单 Agent 的 2-3 倍

一个简单的决策方法：如果你能把任务画成一张有向图（节点是子任务，边是数据流），且图里有 3 个以上节点，值得考虑多 Agent。如果画出来就是一条直线，先别拆。

## 第一个多 Agent：用纯 Python 理解核心思想

不依赖任何框架，用最简单的方式实现一个三 Agent 流水线：

```python
from dataclasses import dataclass, field
from typing import Callable
import time


@dataclass
class AgentContext:
    """Agent 间传递的上下文。"""
    query: str
    data: dict = field(default_factory=dict)
    trace: list[str] = field(default_factory=list)

    def record(self, agent_name: str, output: str):
        self.trace.append(f"[{agent_name}] {output[:80]}...")


class Agent:
    def __init__(self, name: str, process: Callable[[AgentContext], str]):
        self.name = name
        self.process = process

    def run(self, ctx: AgentContext) -> AgentContext:
        start = time.time()
        output = self.process(ctx)
        elapsed = time.time() - start
        ctx.data[self.name] = output
        ctx.record(self.name, f"完成，耗时 {elapsed:.1f}s")
        return ctx


class Pipeline:
    def __init__(self):
        self.agents: list[Agent] = []

    def add(self, agent: Agent) -> "Pipeline":
        self.agents.append(agent)
        return self

    def execute(self, query: str) -> AgentContext:
        ctx = AgentContext(query=query)
        for agent in self.agents:
            ctx = agent.run(ctx)
        return ctx


# 定义三个 Agent
def researcher(ctx: AgentContext) -> str:
    return f"搜索 '{ctx.query}' 的结果：找到 3 篇相关文章，提取了关键数据点"

def analyst(ctx: AgentContext) -> str:
    research = ctx.data["researcher"]
    return f"基于研究结果的分析：识别出 3 个核心趋势，2 个风险点"

def writer(ctx: AgentContext) -> str:
    analysis = ctx.data["analyst"]
    return f"# 研究报告\n\n{analysis}\n\n## 结论\n综合分析后建议..."


# 组装并运行
pipeline = Pipeline()
pipeline.add(Agent("researcher", researcher))
pipeline.add(Agent("analyst", analyst))
pipeline.add(Agent("writer", writer))

result = pipeline.execute("2025 年多 Agent 系统的发展趋势")
print(f"最终输出:\n{result.data['writer']}")
print(f"\n执行轨迹:")
for step in result.trace:
    print(f"  {step}")
```

这个例子只有 60 行代码，但它包含了多 Agent 系统的核心要素：
- **Agent 抽象**：有名字、有处理函数、有上下文
- **上下文传递**：AgentContext 在 Agent 间流转，每个 Agent 读写不同的字段
- **执行追踪**：trace 记录每个 Agent 的执行情况
- **流水线编排**：Pipeline 按顺序调度 Agent

## 一个容易忽略的成本问题

多 Agent 系统的 token 消耗是单 Agent 的 N 倍（N = Agent 数量），因为每个 Agent 都有自己的 system prompt、工具定义和上下文。

一个实际的数字对比：

单 Agent 做竞品分析：~8K tokens（prompt + 工具 + 上下文 + 输出）
三 Agent 做同样的事：
- 搜索 Agent：~3K（prompt + 搜索工具 + 输出）
- 分析 Agent：~4K（prompt + 搜索结果 + 输出）
- 写作 Agent：~5K（prompt + 分析结果 + 输出）
- 总计：~12K

多花了 50% 的 token，换来的是：上下文更干净、每个 Agent 的 prompt 更精准、可以在 Agent 之间插入检查点。

值不值得？取决于任务复杂度。简单任务不值得，复杂任务的收益远超成本。

## 练习

### 练习一：给 Pipeline 加错误处理

在上面的 Pipeline 基础上，增加以下能力：
1. 某个 Agent 执行失败时，重试 1 次
2. 重试仍然失败，跳过该 Agent，在 ctx.data 中标记 `{"error": "agent_name failed"}`
3. 下游 Agent 检查上游是否有 error，有则做降级处理

```python
# 在这里实现你的 PipelineWithRetry
# 提示：在 Pipeline.execute 的循环里加 try/except
```

### 练习二：实现并行 Agent

当前的 Pipeline 是串行的。实现一个 `ParallelGroup`，让多个 Agent 并行执行：

```python
class ParallelGroup:
    """让组内 Agent 并行执行，全部完成后继续。"""
    def __init__(self, agents: list[Agent]):
        self.agents = agents

    def run(self, ctx: AgentContext) -> AgentContext:
        # 用 concurrent.futures.ThreadPoolExecutor 并行执行
        # 所有 Agent 的输出写入 ctx.data
        ...
```

### 练习三：画架构图

用纸笔或工具画出以下场景的多 Agent 架构图：
- 场景：自动代码审查系统
- 要求：标注每个 Agent 的职责、输入输出格式、Agent 之间的数据流
- 额外：标出你认为需要人工审批的节点

---

## 参考答案

### 练习一

```python
class PipelineWithRetry(Pipeline):
    def execute(self, query: str) -> AgentContext:
        ctx = AgentContext(query=query)
        for agent in self.agents:
            # 检查上游是否有错误
            if any(k.startswith("_error_") for k in ctx.data):
                ctx.record(agent.name, "跳过（上游有错误）")
                continue

            try:
                ctx = agent.run(ctx)
            except Exception as e:
                # 重试一次
                try:
                    ctx.record(agent.name, f"首次失败: {e}，重试中...")
                    ctx = agent.run(ctx)
                except Exception as e2:
                    ctx.data[f"_error_{agent.name}"] = str(e2)
                    ctx.record(agent.name, f"重试失败: {e2}")
        return ctx
```

关键判断：重试策略应该是"快速失败"还是"持续重试"？在多 Agent 场景中，快速失败通常更好——因为下游 Agent 可能有降级方案，持续重试只会增加延迟和成本。

# 阶段实战：用纯 Python 实现多 Agent 编排的最小原型

> 预计时长：4 小时
> 目标：从零实现一个支持 Sequential、Parallel、Supervisor 三种编排模式的多 Agent 框架

## 你要做什么

前 5 课讲了三种编排模式的概念和适用场景。现在要动手实现它们。不是写 demo，是写一个能跑通三种模式、有错误处理、有执行追踪的最小框架。

最终交付物：
```
multi-agent-prototype/
├── core/
│   ├── agent.py          # Agent 基类
│   ├── context.py        # 共享上下文
│   └── tracer.py         # 执行追踪
├── orchestrators/
│   ├── sequential.py     # 顺序编排
│   ├── parallel.py       # 并行编排
│   └── supervisor.py     # 监督者编排
├── agents/
│   ├── researcher.py     # 研究 Agent
│   ├── analyst.py        # 分析 Agent
│   └── writer.py         # 写作 Agent
└── main.py               # 入口，运行三种模式
```

## Step 1：定义核心抽象

先不急着写编排器。把 Agent、Context、Tracer 三个基础组件设计好，后面所有编排器都复用它们。

```python
# core/context.py
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Context:
    """多 Agent 共享的执行上下文。"""
    query: str
    data: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)

    def set(self, key: str, value, agent_name: str):
        self.data[key] = {
            "value": value,
            "source": agent_name,
            "timestamp": datetime.now().isoformat(),
        }

    def get(self, key: str, default=None):
        entry = self.data.get(key)
        return entry["value"] if entry else default

    def get_source(self, key: str) -> str | None:
        entry = self.data.get(key)
        return entry["source"] if entry else None
```

```python
# core/tracer.py
from dataclasses import dataclass, field
from datetime import datetime
import time


@dataclass
class Span:
    agent_name: str
    input_keys: list[str]
    output_key: str
    duration_ms: float
    success: bool
    error: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class Tracer:
    def __init__(self):
        self.spans: list[Span] = []

    def record(self, agent_name: str, input_keys: list[str],
               output_key: str, duration_ms: float,
               success: bool, error: str | None = None):
        self.spans.append(Span(
            agent_name=agent_name,
            input_keys=input_keys,
            output_key=output_key,
            duration_ms=duration_ms,
            success=success,
            error=error,
        ))

    def summary(self) -> str:
        lines = []
        for s in self.spans:
            status = "✓" if s.success else "✗"
            lines.append(f"  {status} {s.agent_name}: "
                        f"{','.join(s.input_keys)} → {s.output_key} "
                        f"({s.duration_ms:.0f}ms)")
        return "\n".join(lines)
```

```python
# core/agent.py
import time
from core.context import Context
from core.tracer import Tracer


class Agent:
    def __init__(self, name: str, input_keys: list[str], output_key: str):
        self.name = name
        self.input_keys = input_keys
        self.output_key = output_key

    def execute(self, ctx: Context, tracer: Tracer) -> Context:
        start = time.time()
        try:
            inputs = {k: ctx.get(k) for k in self.input_keys}
            result = self.process(inputs, ctx)
            ctx.set(self.output_key, result, self.name)
            tracer.record(self.name, self.input_keys, self.output_key,
                         (time.time() - start) * 1000, True)
        except Exception as e:
            tracer.record(self.name, self.input_keys, self.output_key,
                         (time.time() - start) * 1000, False, str(e))
            raise
        return ctx

    def process(self, inputs: dict, ctx: Context):
        raise NotImplementedError
```

设计决策说明：
- Agent 声明自己的 `input_keys` 和 `output_key`，这样编排器可以自动校验依赖关系
- Tracer 独立于 Agent，编排器负责在合适的时机调用 tracer
- Context 的 `set` 记录了 source，方便调试时追溯"这个数据是谁写的"

## Step 2：实现三种编排器

### Sequential（顺序执行）

```python
# orchestrators/sequential.py
from core.agent import Agent
from core.context import Context
from core.tracer import Tracer


class SequentialOrchestrator:
    def __init__(self, agents: list[Agent]):
        self.agents = agents

    def run(self, query: str) -> tuple[Context, Tracer]:
        ctx = Context(query=query)
        tracer = Tracer()
        for agent in self.agents:
            ctx = agent.execute(ctx, tracer)
        return ctx, tracer
```

### Parallel（并行执行）

```python
# orchestrators/parallel.py
from concurrent.futures import ThreadPoolExecutor, as_completed
from core.agent import Agent
from core.context import Context
from core.tracer import Tracer


class ParallelOrchestrator:
    def __init__(self, agents: list[Agent]):
        self.agents = agents

    def run(self, query: str) -> tuple[Context, Tracer]:
        ctx = Context(query=query)
        tracer = Tracer()

        with ThreadPoolExecutor(max_workers=len(self.agents)) as pool:
            futures = {
                pool.submit(agent.execute, ctx, tracer): agent
                for agent in self.agents
            }
            for future in as_completed(futures):
                agent = futures[future]
                try:
                    future.result()
                except Exception as e:
                    print(f"[Parallel] {agent.name} 失败: {e}")

        return ctx, tracer
```

注意：并行执行时，多个 Agent 可能同时写入 Context。当前的 Context 实现是线程不安全的。你需要决定：
1. 加锁（简单，但可能有性能问题）
2. 每个 Agent 用独立的 Context 副本（无锁，但最后需要合并）
3. 用队列传递结果（解耦，但更复杂）

这里选方案 1，因为我们的场景是写入不频繁、写入的 key 不同：

```python
# core/context.py 中给 set 方法加锁
import threading

@dataclass
class Context:
    # ... 其他字段 ...
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def set(self, key: str, value, agent_name: str):
        with self._lock:
            self.data[key] = {
                "value": value,
                "source": agent_name,
                "timestamp": datetime.now().isoformat(),
            }
```

### Supervisor（监督者编排）

```python
# orchestrators/supervisor.py
from core.agent import Agent
from core.context import Context
from core.tracer import Tracer


class SupervisorOrchestrator:
    """
    Supervisor 模式：一个调度者决定下一步由哪个 Agent 执行。
    与 Sequential 的区别：执行顺序是动态的，由 Supervisor 根据当前状态决策。
    """
    def __init__(self, agents: dict[str, Agent], supervisor_fn):
        self.agents = agents
        self.supervisor_fn = supervisor_fn  # (ctx) -> agent_name | "FINISH"
        self.max_steps = 10  # 防止死循环

    def run(self, query: str) -> tuple[Context, Tracer]:
        ctx = Context(query=query)
        tracer = Tracer()

        for step in range(self.max_steps):
            decision = self.supervisor_fn(ctx)
            if decision == "FINISH":
                break
            if decision not in self.agents:
                raise ValueError(f"Supervisor 返回了未知的 Agent: {decision}")
            ctx = self.agents[decision].execute(ctx, tracer)

        return ctx, tracer
```

`supervisor_fn` 是一个纯函数，接收当前 Context，返回下一个要执行的 Agent 名称或 "FINISH"。它的决策逻辑可以是规则引擎，也可以是 LLM 调用——但编排器不关心这个，它只负责执行调度。

## Step 3：实现具体的 Agent

```python
# agents/researcher.py
from core.agent import Agent
from core.context import Context


class ResearcherAgent(Agent):
    def __init__(self):
        super().__init__(
            name="researcher",
            input_keys=["query"],
            output_key="research",
        )

    def process(self, inputs: dict, ctx: Context) -> str:
        query = inputs["query"]
        # 实际项目中这里调用搜索 API
        return f"关于「{query}」的研究结果：找到 5 篇核心文献，提取了 12 个关键数据点。"


# agents/analyst.py
class AnalystAgent(Agent):
    def __init__(self):
        super().__init__(
            name="analyst",
            input_keys=["research"],
            output_key="analysis",
        )

    def process(self, inputs: dict, ctx: Context) -> str:
        research = inputs["research"]
        return f"基于研究结果的分析：识别出 3 个核心趋势，2 个潜在风险，1 个机会窗口。"


# agents/writer.py
class WriterAgent(Agent):
    def __init__(self):
        super().__init__(
            name="writer",
            input_keys=["analysis"],
            output_key="report",
        )

    def process(self, inputs: dict, ctx: Context) -> str:
        analysis = inputs["analysis"]
        return f"# 研究报告\n\n{analysis}\n\n## 建议\n基于以上分析，建议采取以下行动..."
```

## Step 4：组装运行

```python
# main.py
from agents.researcher import ResearcherAgent
from agents.analyst import AnalystAgent
from agents.writer import WriterAgent
from orchestrators.sequential import SequentialOrchestrator
from orchestrators.parallel import ParallelOrchestrator
from orchestrators.supervisor import SupervisorOrchestrator


def run_sequential():
    print("=" * 50)
    print("Sequential 模式")
    orch = SequentialOrchestrator([
        ResearcherAgent(),
        AnalystAgent(),
        WriterAgent(),
    ])
    ctx, tracer = orch.run("2025 年 AI Agent 发展趋势")
    print(f"结果: {ctx.get('report')[:100]}...")
    print(f"\n执行轨迹:\n{tracer.summary()}")


def run_supervisor():
    print("=" * 50)
    print("Supervisor 模式")

    def simple_supervisor(ctx):
        if not ctx.get("research"):
            return "researcher"
        if not ctx.get("analysis"):
            return "analyst"
        if not ctx.get("report"):
            return "writer"
        return "FINISH"

    agents = {
        "researcher": ResearcherAgent(),
        "analyst": AnalystAgent(),
        "writer": WriterAgent(),
    }
    orch = SupervisorOrchestrator(agents, simple_supervisor)
    ctx, tracer = orch.run("2025 年 AI Agent 发展趋势")
    print(f"结果: {ctx.get('report')[:100]}...")
    print(f"\n执行轨迹:\n{tracer.summary()}")


if __name__ == "__main__":
    run_sequential()
    run_supervisor()
```

## 验收标准

1. 能跑通 Sequential 和 Supervisor 两种模式，输出正确结果
2. Parallel 模式能并行执行（可以用 `time.sleep` 模拟耗时来验证）
3. Tracer 能记录每个 Agent 的输入、输出、耗时、成功/失败
4. Agent 执行失败时，Tracer 记录错误信息，编排器有合理的错误处理
5. Supervisor 模式有 `max_steps` 防止死循环

## 扩展挑战

如果你想深入，可以尝试：

1. **给 Supervisor 加 LLM 决策**：用 OpenAI API 替换规则引擎，让 Supervisor 根据当前 Context 动态决定下一步
2. **实现 Hierarchical 模式**：Supervisor 本身也是一个 Agent，可以被上级 Supervisor 调用
3. **加条件分支**：Sequential 中某个 Agent 的输出决定了下一步走哪条路
4. **持久化 Context**：把 Context 序列化到 JSON，支持中断恢复

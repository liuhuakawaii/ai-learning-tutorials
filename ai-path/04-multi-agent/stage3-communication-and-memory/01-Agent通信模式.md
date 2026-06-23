# Agent 通信模式：直接调用、消息传递、共享黑板

> 前置知识：stage1 和 stage2 的多 Agent 编排经验
> 预计时长：40 分钟

## 问题从哪来

你用 LangGraph 构建了一个多 Agent 系统，State 在节点间流转，看起来 Agent 之间已经在"通信"了。但 State 只解决了"流水线"场景——数据从 A 流到 B 再流到 C。

当你遇到这些场景时，State 就不够用了：
- Agent A 和 Agent B 需要双向交换信息，而不是单向传递
- 5 个 Agent 需要共享一份实时更新的数据源
- Agent 之间需要异步通信，A 发完消息不等 B 处理完就继续做自己的事
- 新的 Agent 加入系统时，不应该修改已有 Agent 的代码

这些场景需要不同的通信模式。

## 三种通信模式的工程对比

### 直接调用

Agent A 持有 Agent B 的引用，直接调用 B 的方法：

```python
class DirectCallAgent:
    def __init__(self, name: str):
        self.name = name
        self.peers: dict[str, "DirectCallAgent"] = {}

    def register_peer(self, name: str, agent: "DirectCallAgent"):
        self.peers[name] = agent

    def call(self, peer_name: str, task: str) -> str:
        peer = self.peers[peer_name]
        return peer.handle(task)

    def handle(self, task: str) -> str:
        raise NotImplementedError
```

优点：延迟最低（就是函数调用），调试最方便（直接看调用栈），类型安全（Python 的类型检查能覆盖）。

缺点：Agent 之间必须互相持有引用，新增 Agent 时需要修改调用方代码。不适合跨进程/跨机器部署。

适用场景：单进程内的 Agent 协作，Agent 数量少（< 5 个），对延迟敏感。

### 消息传递

Agent 通过消息队列通信，不直接持有对方引用：

```python
import asyncio
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Message:
    sender: str
    receiver: str
    content: dict
    timestamp: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )


class MessageBroker:
    def __init__(self):
        self._queues: dict[str, asyncio.Queue] = {}

    def register(self, agent_name: str):
        self._queues[agent_name] = asyncio.Queue()

    async def send(self, message: Message):
        if message.receiver not in self._queues:
            raise ValueError(f"未知的接收者: {message.receiver}")
        await self._queues[message.receiver].put(message)

    async def receive(self, agent_name: str) -> Message:
        return await self._queues[agent_name].get()

    def receive_nowait(self, agent_name: str) -> Message | None:
        try:
            return self._queues[agent_name].get_nowait()
        except asyncio.QueueEmpty:
            return None
```

优点：Agent 之间完全解耦，新增 Agent 只需要注册队列，支持跨进程部署（把 Queue 换成 Redis Pub/Sub）。

缺点：调试困难（消息在队列里，看不到调用栈），消息可能丢失（需要持久化），延迟更高。

适用场景：分布式部署，Agent 数量多（> 5），需要异步通信。

### 共享黑板

所有 Agent 共享一个数据存储，可以读写任意字段：

```python
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class BlackboardEntry:
    value: Any
    author: str
    timestamp: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )


class Blackboard:
    def __init__(self):
        self._data: dict[str, BlackboardEntry] = {}
        self._lock = threading.Lock()
        self._watchers: dict[str, list] = {}

    def write(self, key: str, value: Any, author: str):
        with self._lock:
            self._data[key] = BlackboardEntry(
                value=value, author=author
            )
        self._notify_watchers(key, value, author)

    def read(self, key: str) -> Any | None:
        entry = self._data.get(key)
        return entry.value if entry else None

    def read_entry(self, key: str) -> BlackboardEntry | None:
        return self._data.get(key)

    def watch(self, key: str, callback):
        """当某个 key 被更新时，调用 callback(key, value, author)。"""
        self._watchers.setdefault(key, []).append(callback)

    def _notify_watchers(self, key, value, author):
        for cb in self._watchers.get(key, []):
            try:
                cb(key, value, author)
            except Exception:
                pass  # watcher 的异常不应该影响写入
```

优点：最灵活（任何 Agent 可以读写任何数据），天然支持多对多通信，易于理解（就是共享字典）。

缺点：需要并发控制（加锁），数据竞争风险（两个 Agent 同时写同一个 key），watcher 回调可能引入意外的副作用。

适用场景：Agent 需要共享实时状态（如"当前任务进度"），多对多通信，原型阶段快速迭代。

## 怎么选

不是三选一，通常是组合使用：

- **流水线数据流**：用 State（LangGraph 内置）
- **Agent 间的实时状态**：用 Blackboard
- **跨服务通信**：用 MessageBroker
- **同进程内的简单调用**：用 DirectCall

一个实际的架构可能长这样：

```
LangGraph State（流水线主干）
    │
    ├── Blackboard（共享实时状态）
    │   ├── 当前任务进度
    │   ├── 各 Agent 的中间结果
    │   └── 全局配置
    │
    └── MessageBroker（异步事件）
        ├── Agent A 完成通知
        ├── 错误告警
        └── 人工审批请求
```

## 一个完整的组合示例

```python
import asyncio
from dataclasses import dataclass


@dataclass
class AgentMessage:
    sender: str
    receiver: str
    action: str
    payload: dict


class HybridCommunicationLayer:
    """组合三种通信方式的通信层。"""

    def __init__(self):
        self.blackboard = Blackboard()
        self.broker = MessageBroker()
        self._agents: dict[str, "HybridAgent"] = {}

    def register_agent(self, agent: "HybridAgent"):
        self._agents[agent.name] = agent
        self.broker.register(agent.name)

    async def send_message(self, msg: AgentMessage):
        await self.broker.send(Message(
            sender=msg.sender,
            receiver=msg.receiver,
            content={"action": msg.action, "payload": msg.payload},
        ))

    def update_shared_state(self, key: str, value, agent_name: str):
        self.blackboard.write(key, value, agent_name)

    def get_shared_state(self, key: str):
        return self.blackboard.read(key)


class HybridAgent:
    def __init__(self, name: str, comm: HybridCommunicationLayer):
        self.name = name
        self.comm = comm

    async def execute(self, task: str) -> str:
        # 读取共享状态
        context = self.comm.get_shared_state("context")

        # 执行任务
        result = f"[{self.name}] 处理 '{task}'，上下文: {context}"

        # 更新共享状态
        self.comm.update_shared_state(
            f"{self.name}_result", result, self.name
        )

        # 发送完成通知
        await self.comm.send_message(AgentMessage(
            sender=self.name,
            receiver="supervisor",
            action="completed",
            payload={"result": result},
        ))

        return result


async def main():
    comm = HybridCommunicationLayer()

    agents = [
        HybridAgent("researcher", comm),
        HybridAgent("analyst", comm),
    ]
    for agent in agents:
        comm.register_agent(agent)

    # 设置共享上下文
    comm.update_shared_state("context", "2025 年 AI 趋势", "system")

    # 并行执行
    await asyncio.gather(
        agents[0].execute("搜索信息"),
        agents[1].execute("分析数据"),
    )

    # 查看结果
    print(comm.get_shared_state("researcher_result"))
    print(comm.get_shared_state("analyst_result"))


if __name__ == "__main__":
    asyncio.run(main())
```

## 练习

### 练习一：实现带版本号的 Blackboard

给 Blackboard 加版本控制：每次写入时自动递增版本号，读取时可以获取指定版本的数据。

```python
class VersionedBlackboard:
    def __init__(self):
        self._history: dict[str, list[BlackboardEntry]] = {}

    def write(self, key: str, value: Any, author: str):
        """写入时自动追加到历史记录。"""
        ...

    def read(self, key: str, version: int = -1) -> Any | None:
        """读取指定版本，默认最新版。version=-1 表示最新。"""
        ...

    def get_versions(self, key: str) -> int:
        """返回某个 key 的版本数量。"""
        ...
```

### 练习二：实现消息超时

给 MessageBroker 加超时机制：如果消息在队列中等待超过 N 秒未被消费，自动移除并记录到死信队列。

### 练习三：通信模式选型

画出以下场景的通信架构图，标注每条数据流使用哪种通信方式：
- 场景：多 Agent 代码审查系统（搜索 Agent 搜索代码、分析 Agent 分析问题、审核 Agent 审核质量、通知 Agent 发送通知）
- 约束：通知 Agent 异步执行，不阻塞主流程；所有 Agent 需要共享"当前审查进度"

---

## 参考答案

### 练习一

```python
class VersionedBlackboard:
    def __init__(self):
        self._history: dict[str, list[BlackboardEntry]] = {}
        self._lock = threading.Lock()

    def write(self, key: str, value: Any, author: str):
        with self._lock:
            if key not in self._history:
                self._history[key] = []
            self._history[key].append(BlackboardEntry(
                value=value, author=author,
            ))

    def read(self, key: str, version: int = -1) -> Any | None:
        entries = self._history.get(key, [])
        if not entries:
            return None
        try:
            return entries[version].value
        except IndexError:
            return None

    def get_versions(self, key: str) -> int:
        return len(self._history.get(key, []))
```

设计决策：为什么用列表存历史而不是覆盖？因为多 Agent 系统中，回滚和审计是常见需求。保留历史版本的存储成本很低（相对于 LLM 调用的 token 成本），但调试价值很高。

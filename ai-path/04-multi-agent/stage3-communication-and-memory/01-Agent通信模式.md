# 01 Agent 通信模式——直接调用 / 消息传递 / 共享黑板

> 多 Agent 系统的核心问题：Agent 之间如何交流信息？

## 场景引入

你的多 Agent 系统中有三个 Agent：研究员、分析师、写作员。研究员完成了搜索，分析师怎么拿到搜索结果？是直接调用研究员的函数，还是通过消息队列传递，还是写到一个共享的"黑板"上？不同的通信方式决定了系统的耦合度、可扩展性和复杂度。

---

## 学习目标

- 掌握三种 Agent 通信模式
- 理解每种模式的优缺点
- 学会根据场景选择合适的通信模式

---

## 一、三种通信模式

```
┌─────────────────────────────────────────────────────────────┐
│                    三种通信模式                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 直接调用（Direct Call）                                  │
│     Agent A → 调用 Agent B → 获取结果                        │
│     优点：简单、同步、低延迟                                  │
│     缺点：紧耦合、不利于扩展                                  │
│                                                             │
│  2. 消息传递（Message Passing）                              │
│     Agent A → 发送消息 → 消息队列 → Agent B 接收              │
│     优点：松耦合、支持异步、可扩展                            │
│     缺点：复杂、可能有延迟                                    │
│                                                             │
│  3. 共享黑板（Shared Blackboard）                            │
│     Agent A → 写入黑板 → Agent B 读取黑板                    │
│     优点：灵活、支持多对多、易于理解                          │
│     缺点：需要同步机制、可能有冲突                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、实现示例

### 2.1 直接调用

```python
class DirectCallAgent:
    def __init__(self, name: str, agents: dict):
        self.name = name
        self.agents = agents
    
    def call_agent(self, agent_name: str, task: str) -> str:
        """直接调用其他 Agent"""
        agent = self.agents[agent_name]
        return agent.execute(task)
```

### 2.2 消息传递

```python
from queue import Queue

class MessageBroker:
    """消息代理"""
    
    def __init__(self):
        self.queues = {}
    
    def register(self, agent_name: str):
        self.queues[agent_name] = Queue()
    
    def send(self, to: str, message: dict):
        self.queues[to].put(message)
    
    def receive(self, agent_name: str) -> dict:
        return self.queues[agent_name].get()
```

### 2.3 共享黑板

```python
class Blackboard:
    """共享黑板"""
    
    def __init__(self):
        self.data = {}
        self.lock = threading.Lock()
    
    def write(self, key: str, value: any, author: str):
        with self.lock:
            self.data[key] = {
                "value": value,
                "author": author,
                "timestamp": datetime.now().isoformat()
            }
    
    def read(self, key: str) -> any:
        return self.data.get(key, {}).get("value")
```

---

## 三、模式选择

```
选择指南：

简单系统、同步调用 → 直接调用
分布式系统、异步处理 → 消息传递
多对多通信、灵活协作 → 共享黑板
```

---


---

## 常见误区

1. **通信模式选择不当**：简单系统用消息队列，引入了不必要的复杂度；分布式系统用直接调用，导致紧耦合。根据系统的规模和部署方式选择合适的通信模式。
2. **消息格式不统一**：Agent A 发送的是纯文本，Agent B 期望的是 JSON。在设计阶段就应该定义统一的消息格式，包含 sender、content、metadata、timestamp 等标准字段。
3. **忽略通信失败处理**：消息发送失败了怎么办？消息队列满了怎么办？接收 Agent 挂了消息会不会丢失？通信层的可靠性直接影响整个系统的稳定性。

---

## 工程建议

1. **从单 Agent 开始，按需演进**：先用单 Agent 验证核心逻辑，当遇到上下文瓶颈、能力稀释或需要并行处理时，再拆分为多 Agent。不要为了"看起来高级"而引入多 Agent 架构。
2. **为每个 Agent 定义清晰的职责边界**：每个 Agent 应该有单一、明确的职责（如"只负责搜索""只负责分析"），输入输出格式在设计阶段就确定下来，避免职责重叠和数据格式混乱。
3. **建立可观测性基础设施**：从第一版开始就为每个 Agent 添加结构化日志和追踪机制，记录输入、输出、耗时、错误。多 Agent 系统的调试难度远高于单 Agent，没有日志就是在"盲人摸象"。
4. **在关键决策节点加入人工审批**：涉及高风险操作（删除数据、发送消息、支付）和不可逆操作时，使用 Human-in-the-loop 机制暂停执行，等待人类确认后再继续。

---

## 小结

```
本课核心要点：

1. 直接调用：简单、同步、紧耦合
2. 消息传递：松耦合、异步、可扩展
3. 共享黑板：灵活、多对多、易于理解
4. 根据场景选择合适的通信模式

---

**下一课**: [短期记忆——会话上下文在 Agent 间的传递策略](./02-短期记忆.md)
```

---

## 练习

1. **实现题**：实现一个消息代理，支持 Agent 间消息传递。

2. **黑板题**：实现一个共享黑板，支持多 Agent 读写。

3. **选择题**：你的系统适合用哪种通信模式？为什么？

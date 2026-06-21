# 01 Agent 通信模式——直接调用 / 消息传递 / 共享黑板

> 多 Agent 系统的核心问题：Agent 之间如何交流信息？

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

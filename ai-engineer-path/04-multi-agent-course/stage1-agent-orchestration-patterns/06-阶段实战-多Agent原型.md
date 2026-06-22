# 06 阶段实战——用纯 Python 实现一个多 Agent 编排的最小原型

> 动手实现一个多 Agent 系统，理解编排的核心原理。

## 场景引入

你已经学习了 Supervisor、Sequential、Parallel 三种编排模式，但它们都只是理论。现在你需要把它们真正实现出来：定义 Agent 基类、实现编排器、管理状态流转、处理错误。这个实战项目会让你从"知道"变成"做到"。

---

## 学习目标

- 用纯 Python 实现一个多 Agent 编排系统
- 掌握 Agent 间通信和状态管理
- 完成一个可运行的多 Agent 原型

---

## 一、项目结构

```
multi-agent-prototype/
├── agents/
│   ├── base.py          # Agent 基类
│   ├── researcher.py    # 研究 Agent
│   ├── analyst.py       # 分析 Agent
│   └── writer.py        # 写作 Agent
├── orchestrator/
│   ├── sequential.py    # 顺序编排
│   ├── parallel.py      # 并行编排
│   └── supervisor.py    # 监督者编排
├── models/
│   └── state.py         # 状态模型
└── main.py              # 入口
```

---

## 二、核心实现

```python
# agents/base.py
class BaseAgent:
    def __init__(self, name: str, llm):
        self.name = name
        self.llm = llm
    
    def execute(self, input_data: dict) -> dict:
        raise NotImplementedError

# orchestrator/supervisor.py
class SupervisorOrchestrator:
    def __init__(self, llm, agents: dict):
        self.llm = llm
        self.agents = agents
    
    def run(self, task: str) -> dict:
        # 分析任务
        plan = self._plan(task)
        
        # 执行计划
        results = {}
        for step in plan["steps"]:
            agent = self.agents[step["agent"]]
            result = agent.execute({"task": step["task"], "context": results})
            results[step["agent"]] = result
        
        # 汇总
        return self._summarize(task, results)
    
    def _plan(self, task: str) -> dict:
        prompt = f"""分析任务并制定执行计划。
        
任务：{task}

可用 Agent：{list(self.agents.keys())}

请以 JSON 格式输出执行计划。"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    def _summarize(self, task: str, results: dict) -> dict:
        results_text = json.dumps(results, ensure_ascii=False, indent=2)
        
        prompt = f"""汇总以下多 Agent 执行结果。

任务：{task}

执行结果：
{results_text}

请生成最终回答。"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {"answer": response.choices[0].message.content, "details": results}
```

---

## 三、运行示例

```python
# main.py
def main():
    llm = OpenAI()
    
    agents = {
        "researcher": ResearchAgent("researcher", llm),
        "analyst": AnalysisAgent("analyst", llm),
        "writer": WriterAgent("writer", llm)
    }
    
    orchestrator = SupervisorOrchestrator(llm, agents)
    
    result = orchestrator.run("分析 2024 年 AI 行业的发展趋势")
    print(result["answer"])

if __name__ == "__main__":
    main()
```

---

## 四、运行效果

```
[Supervisor] 分析任务...
[Supervisor] 执行计划：researcher → analyst → writer
[researcher] 收集信息...
[analyst] 分析数据...
[writer] 生成报告...

最终结果：
2024 年 AI 行业呈现以下主要趋势：
1. 多模态 AI 快速发展...
2. Agent 技术逐渐成熟...
3. 开源模型持续进步...
```

---


---

## 常见误区

1. **一开始就追求完美架构**：第一版原型应该尽可能简单——3 个 Agent、1 个编排器、最简单的状态管理。先跑通再优化，不要在第一版就引入复杂的设计模式。
2. **忽略 Agent 间的接口定义**：在写代码之前没有定义好 Agent 的输入输出格式，导致后期集成时需要大量重构。先定义接口，再实现逻辑。
3. **没有日志和追踪**：多 Agent 系统的调试比单 Agent 难得多。如果不在第一版就加入基本的日志和追踪，出了问题你根本不知道是哪个 Agent 出了错。

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

1. 多 Agent 系统的核心：Agent 基类、编排器、状态管理
2. Supervisor 模式：分析 → 计划 → 执行 → 汇总
3. Agent 间通过结构化数据通信
4. 从简单原型开始，逐步增加复杂度

阶段总结：
  你已经掌握了多 Agent 编排的核心模式。
  下一阶段，我们将深入 LangGraph 的多 Agent 实战。
```

---

## 作业

1. **完成实战**：运行本课的多 Agent 原型。

2. **扩展题**：添加一个新的 Agent（如审核 Agent）到系统中。

3. **优化题**：改进 Supervisor 的任务分解逻辑。

# 06 阶段实战——用纯 Python 实现一个多 Agent 编排的最小原型

> 动手实现一个多 Agent 系统，理解编排的核心原理。

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

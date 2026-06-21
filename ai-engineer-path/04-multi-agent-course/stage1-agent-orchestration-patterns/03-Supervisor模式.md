# 03 Supervisor 模式——一个管理者调度多个专家 Agent

> Supervisor 是多 Agent 系统的"项目经理"——它不做具体工作，只负责调度和决策。

## 学习目标

- 深入理解 Supervisor 模式的工作原理
- 掌握 Supervisor 的决策逻辑设计
- 学会实现一个 Supervisor 编排系统

---

## 一、Supervisor 工作原理

```
Supervisor 模式的核心思想：

1. Supervisor 不执行具体任务
2. Supervisor 负责理解任务、分解任务、分配任务
3. Supervisor 评估 Agent 的输出，决定是否需要继续
4. Supervisor 汇总最终结果

流程：
用户任务 → Supervisor 分析 → 选择 Agent → 执行 → Supervisor 评估 → 汇总结果
```

---

## 二、Supervisor 实现

```python
class Supervisor:
    """Supervisor 编排器"""
    
    def __init__(self, llm, agents: dict):
        self.llm = llm
        self.agents = agents
    
    def run(self, task: str) -> dict:
        """执行任务"""
        
        # 1. 分析任务
        analysis = self._analyze_task(task)
        
        # 2. 分解子任务
        subtasks = self._decompose_task(task, analysis)
        
        # 3. 分配并执行
        results = []
        for subtask in subtasks:
            agent = self._select_agent(subtask)
            result = agent.execute(subtask["description"])
            results.append({
                "subtask": subtask,
                "agent": agent.name,
                "result": result
            })
        
        # 4. 汇总结果
        final_result = self._aggregate_results(task, results)
        
        return final_result
    
    def _analyze_task(self, task: str) -> dict:
        """分析任务"""
        prompt = f"""分析以下任务，确定需要哪些专业能力。

任务：{task}

请以 JSON 格式输出：
{{"task_type": "类型", "required_skills": ["技能1", "技能2"], "complexity": "low/medium/high"}}"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    def _decompose_task(self, task: str, analysis: dict) -> list[dict]:
        """分解任务"""
        prompt = f"""将以下任务分解为子任务。

任务：{task}
分析：{json.dumps(analysis, ensure_ascii=False)}

请以 JSON 格式输出：
{{"subtasks": [{{"id": 1, "description": "子任务描述", "required_skill": "所需技能"}}]}}"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)["subtasks"]
    
    def _select_agent(self, subtask: dict):
        """选择 Agent"""
        # 根据子任务所需技能选择最合适的 Agent
        # 这里简化为随机选择，实际应该用更智能的匹配
        return list(self.agents.values())[0]
    
    def _aggregate_results(self, task: str, results: list) -> dict:
        """汇总结果"""
        results_text = "\n".join([
            f"子任务 {r['subtask']['id']}: {r['result']}"
            for r in results
        ])
        
        prompt = f"""汇总以下子任务结果，生成最终回答。

原始任务：{task}

子任务结果：
{results_text}

请生成完整的最终回答。"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {
            "answer": response.choices[0].message.content,
            "subtask_results": results
        }
```

---

## 三、Supervisor 设计要点

```
Supervisor 设计要点：

1. 任务分析要准确
   - 正确识别任务类型
   - 正确识别所需技能
   - 正确评估复杂度

2. 任务分解要合理
   - 子任务粒度适中
   - 子任务之间依赖清晰
   - 避免过度分解

3. Agent 选择要匹配
   - 根据技能匹配 Agent
   - 考虑 Agent 的负载
   - 考虑 Agent 的历史表现

4. 结果汇总要完整
   - 覆盖所有子任务结果
   - 处理冲突和矛盾
   - 生成结构化输出
```

---

## 小结

```
本课核心要点：

1. Supervisor 是多 Agent 系统的"项目经理"
2. 核心流程：分析 → 分解 → 分配 → 执行 → 汇总
3. 设计要点：任务分析、分解、Agent 选择、结果汇总
4. Supervisor 本身也是一个 Agent

---

**下一课**: [Sequential Pipeline——按顺序传递的链式 Agent 工作流](./04-Sequential-Pipeline.md)
```

---

## 练习

1. **实现题**：实现一个完整的 Supervisor 编排器。

2. **设计题**：为你的应用场景设计一个 Supervisor 决策逻辑。

3. **测试题**：用 Supervisor 模式处理一个复杂任务，观察执行过程。

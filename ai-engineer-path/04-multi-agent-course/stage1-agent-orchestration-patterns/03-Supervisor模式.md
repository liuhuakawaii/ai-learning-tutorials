# 03 Supervisor 模式——一个管理者调度多个专家 Agent

> Supervisor 是多 Agent 系统的"项目经理"——它不做具体工作，只负责调度和决策。

## 场景引入

你正在构建一个需要动态决策的多 Agent 系统：有时候需要先搜索再分析，有时候需要直接写作，有时候还需要回头补充搜索。如果用固定的流水线，根本无法应对这种灵活的路由需求。你需要一个"项目经理"角色来统筹全局——这就是 Supervisor 模式要解决的问题。

---

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


---

## 常见误区

1. **Supervisor 决策逻辑过于简单**：如果 Supervisor 只是按固定顺序调用 Agent，那它和 Sequential Pipeline 没有区别。Supervisor 的价值在于根据当前状态动态决策。
2. **Supervisor 和 Agent 用同一个 Prompt**：Supervisor 应该专注于"分析任务、分解子任务、选择 Agent、评估结果"，而不是自己去做具体工作。职责混淆会导致决策质量下降。
3. **忽略 Supervisor 的错误处理**：Supervisor 本身也可能犯错——选错 Agent、分解出不合理的子任务。需要在 Supervisor 层面添加验证和回退机制。

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

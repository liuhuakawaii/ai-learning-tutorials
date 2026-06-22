# 04 Sequential Pipeline——按顺序传递的链式 Agent 工作流

> 流水线是最简单的多 Agent 模式——上一个 Agent 的输出是下一个 Agent 的输入。

## 场景引入

你有一个明确的多步流程：先收集数据，再清洗数据，最后生成报告。每一步的输出就是下一步的输入，顺序不能乱。如果用 Supervisor 模式，决策开销太大；如果用并行模式，步骤之间有依赖无法并行。你需要的是最简单、最直接的链式执行模式。

---

## 学习目标

- 掌握 Sequential Pipeline 的实现方法
- 理解数据在 Agent 间的传递机制
- 学会处理流水线中的错误

---

## 一、Pipeline 实现

```python
class AgentPipeline:
    """Agent 流水线"""
    
    def __init__(self):
        self.steps = []
    
    def add_step(self, name: str, agent, transform=None):
        """添加步骤"""
        self.steps.append({
            "name": name,
            "agent": agent,
            "transform": transform  # 可选的数据转换函数
        })
    
    def run(self, input_data: dict) -> dict:
        """执行流水线"""
        current_data = input_data
        trace = []
        
        for step in self.steps:
            try:
                # 执行 Agent
                result = step["agent"].execute(current_data)
                
                # 数据转换
                if step["transform"]:
                    result = step["transform"](result)
                
                # 记录追踪
                trace.append({
                    "step": step["name"],
                    "input": current_data,
                    "output": result,
                    "status": "success"
                })
                
                current_data = result
            
            except Exception as e:
                trace.append({
                    "step": step["name"],
                    "input": current_data,
                    "error": str(e),
                    "status": "failed"
                })
                raise
        
        return {
            "result": current_data,
            "trace": trace
        }

# 使用示例
pipeline = AgentPipeline()
pipeline.add_step("研究", research_agent)
pipeline.add_step("分析", analysis_agent)
pipeline.add_step("写作", writing_agent)

result = pipeline.run({"task": "分析 AI 行业趋势"})
```

---

## 二、数据传递模式

```
数据传递模式：

1. 直接传递
   Agent A 输出 → Agent B 输入
   适用于：简单流水线

2. 累积传递
   Agent A 输出 + 原始输入 → Agent B 输入
   适用于：需要保留上下文的场景

3. 结构化传递
   定义统一的数据结构
   每个 Agent 读写特定字段
   适用于：复杂流水线
```

---

## 三、错误处理

```python
class ResilientPipeline(AgentPipeline):
    """容错流水线"""
    
    def __init__(self, max_retries: int = 3):
        super().__init__()
        self.max_retries = max_retries
    
    def run(self, input_data: dict) -> dict:
        current_data = input_data
        
        for step in self.steps:
            retries = 0
            while retries < self.max_retries:
                try:
                    result = step["agent"].execute(current_data)
                    current_data = result
                    break
                except Exception as e:
                    retries += 1
                    if retries >= self.max_retries:
                        # 降级处理
                        current_data = self._fallback(step, current_data, e)
        
        return {"result": current_data}
    
    def _fallback(self, step, data, error):
        """降级处理"""
        # 可以选择跳过、使用默认值、或人工介入
        return data  # 跳过该步骤
```

---


---

## 常见误区

1. **流水线过长导致错误累积**：每增加一个步骤，整体成功率就下降一步。5 步流水线每步 95% 正确率，整体只有 77%。超过 5 步的流水线需要考虑添加中间验证节点。
2. **忽略步骤间的数据格式转换**：上游 Agent 输出的是纯文本，下游 Agent 期望的是 JSON。在添加步骤时没有定义统一的数据格式，导致下游解析失败。
3. **错误处理策略过于简单**：只做"重试"不够。有些错误重试没用（如输入数据格式错误），需要降级策略（跳过该步骤或使用默认值）。

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

1. Sequential Pipeline 是最简单的多 Agent 模式
2. 数据传递：直接传递、累积传递、结构化传递
3. 错误处理：重试、降级、人工介入
4. 流水线要保持简单，避免过长

---

**下一课**: [Parallel Fan-out——并行执行后聚合的 Map-Reduce 模式](./05-Parallel-Fan-out.md)
```

---

## 练习

1. **实现题**：实现一个 3 步的 Agent Pipeline。

2. **错误处理题**：为 Pipeline 添加错误处理和降级策略。

3. **设计题**：设计一个适合你应用场景的 Pipeline 结构。

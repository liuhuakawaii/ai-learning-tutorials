# 04 Sequential Pipeline——按顺序传递的链式 Agent 工作流

> 流水线是最简单的多 Agent 模式——上一个 Agent 的输出是下一个 Agent 的输入。

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

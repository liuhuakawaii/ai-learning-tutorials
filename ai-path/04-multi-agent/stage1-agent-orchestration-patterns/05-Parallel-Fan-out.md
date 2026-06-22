# 05 Parallel Fan-out——并行执行后聚合的 Map-Reduce 模式

> 有些任务可以拆成独立的子任务并行执行，最后汇总结果。

## 场景引入

你需要同时分析五个竞品的功能、价格和用户评价，然后汇总成一份报告。如果用串行流水线，分析完一个再分析下一个，总耗时是五倍。但如果让五个 Agent 各自独立分析一个竞品，最后再汇总，总耗时就只取决于最慢的那个。这就是 Parallel Fan-out 模式的核心价值。

---

## 学习目标

- 掌握 Parallel Fan-out 的实现方法
- 理解并行执行和结果聚合的机制
- 学会处理并行执行的同步和错误

---

## 一、Fan-out 实现

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelFanOut:
    """并行 Fan-out 编排器"""
    
    def __init__(self, agents: list, aggregator):
        self.agents = agents
        self.aggregator = aggregator
    
    def run(self, task: str) -> dict:
        """并行执行并汇总"""
        
        # Fan-out：并行执行
        results = []
        with ThreadPoolExecutor(max_workers=len(self.agents)) as executor:
            futures = {
                executor.submit(agent.execute, task): agent.name
                for agent in self.agents
            }
            
            for future in futures:
                agent_name = futures[future]
                try:
                    result = future.result(timeout=30)
                    results.append({
                        "agent": agent_name,
                        "result": result,
                        "status": "success"
                    })
                except Exception as e:
                    results.append({
                        "agent": agent_name,
                        "error": str(e),
                        "status": "failed"
                    })
        
        # Fan-in：汇总结果
        successful_results = [r for r in results if r["status"] == "success"]
        
        if not successful_results:
            raise Exception("所有 Agent 都执行失败")
        
        aggregated = self.aggregator.aggregate([r["result"] for r in successful_results])
        
        return {
            "result": aggregated,
            "details": results
        }

# 异步版本
class AsyncParallelFanOut:
    """异步并行 Fan-out"""
    
    def __init__(self, agents: list, aggregator):
        self.agents = agents
        self.aggregator = aggregator
    
    async def run(self, task: str) -> dict:
        tasks = [agent.execute(task) for agent in self.agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = [r for r in results if not isinstance(r, Exception)]
        return self.aggregator.aggregate(successful)
```

---

## 二、聚合策略

```
聚合策略：

1. 拼接聚合
   简单地将所有结果拼接在一起
   适用于：收集信息

2. 投票聚合
   多数投票决定最终结果
   适用于：分类、判断

3. 加权聚合
   根据 Agent 的可靠性加权
   适用于：有质量差异的场景

4. LLM 聚合
   用 LLM 综合所有结果
   适用于：需要推理的场景
```

---

## 三、使用场景

```
Parallel Fan-out 适用场景：

1. 多源信息收集
   - 同时从多个数据源获取信息
   - 汇总后生成报告

2. 多角度分析
   - 从不同角度分析同一问题
   - 综合得出全面结论

3. 多方案生成
   - 生成多个备选方案
   - 选择最优方案

4. 冗余执行
   - 同一任务执行多次
   - 取共识结果，提高可靠性
```

---


---

## 常见误区

1. **并行执行但结果有依赖**：把有数据依赖的任务也强行并行执行，结果某些 Agent 拿到的是空数据。并行的前提是子任务之间完全独立。
2. **聚合策略选择不当**：简单的拼接聚合适合信息收集，但不适合需要推理的场景。如果多个 Agent 给出了矛盾的分析，直接拼接只会让最终输出自相矛盾。
3. **忽略并行执行的超时和错误**：某个 Agent 超时了怎么办？是等待还是跳过？如果 3 个并行 Agent 中有 1 个失败，是用剩余 2 个的结果还是全部重跑？这些问题需要在设计时就考虑清楚。

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

1. Parallel Fan-out 适合可并行的独立子任务
2. 实现方式：ThreadPoolExecutor 或 asyncio
3. 聚合策略：拼接、投票、加权、LLM
4. 注意处理并行执行的错误和超时

---

**下一课**: [阶段实战——用纯 Python 实现一个多 Agent 编排的最小原型](./06-阶段实战-多Agent原型.md)
```

---

## 练习

1. **实现题**：实现一个 Parallel Fan-out 编排器。

2. **聚合题**：实现一个 LLM 聚合器，综合多个 Agent 的结果。

3. **场景题**：设计一个适合 Parallel Fan-out 的应用场景。

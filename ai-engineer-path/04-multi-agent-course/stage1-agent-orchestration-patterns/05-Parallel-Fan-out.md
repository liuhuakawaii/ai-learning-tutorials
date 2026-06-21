# 05 Parallel Fan-out——并行执行后聚合的 Map-Reduce 模式

> 有些任务可以拆成独立的子任务并行执行，最后汇总结果。

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

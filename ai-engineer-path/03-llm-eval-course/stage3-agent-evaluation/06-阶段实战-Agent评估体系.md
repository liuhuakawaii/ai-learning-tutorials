# 06 阶段实战——为 Agent 平台搭建评估体系

> 把前 5 课的评估方法整合成一个完整的 Agent 评估体系。

## 学习目标

- 搭建完整的 Agent 评估套件
- 集成结果评估、过程评估、安全评估、成本评估
- 输出可操作的评估报告

---

## 一、评估套件架构

```python
class AgentEvalSuite:
    """Agent 评估套件"""
    
    def __init__(self, client):
        self.client = client
        self.result_evaluator = TaskCompletionEvaluator(client)
        self.process_evaluator = MultiStepEvaluator(client)
        self.tool_evaluator = ToolCallEvaluator(client)
        self.security_evaluator = SecurityTestSuite(client)
        self.token_tracker = TokenTracker()
        self.latency_tracker = LatencyTracker()
    
    def evaluate_single(self, test_case: dict, agent_fn) -> dict:
        """评估单个 Agent 执行"""
        
        # 运行 Agent
        start_time = time.time()
        result = agent_fn(test_case["query"])
        latency = time.time() - start_time
        
        # 结果评估
        result_eval = self.result_evaluator.evaluate(
            test_case["query"],
            result["output"],
            test_case["expected_output"],
            self.client
        )
        
        # 过程评估
        process_eval = self.process_evaluator.evaluate(
            test_case["query"],
            result.get("trace", []),
            result["output"],
            test_case["expected_output"]
        )
        
        # 工具调用评估
        tool_eval = {}
        if result.get("tool_calls"):
            tool_eval = self.tool_evaluator.evaluate_tool_call(
                test_case["query"],
                result["tool_calls"][0],
                result.get("tool_output", ""),
                result["output"],
                test_case.get("expected_tool_call", {}),
                test_case.get("available_tools", [])
            )
        
        # 安全评估
        security_eval = evaluate_output_safety(result["output"], self.client)
        
        return {
            "query": test_case["query"],
            "result": result_eval,
            "process": process_eval,
            "tool": tool_eval,
            "security": security_eval,
            "latency": latency,
            "token_usage": result.get("token_usage", {}),
            "overall_score": self._compute_overall(
                result_eval, process_eval, tool_eval, security_eval
            )
        }
    
    def _compute_overall(self, result_eval, process_eval, tool_eval, security_eval) -> float:
        """计算综合评分"""
        scores = []
        
        if result_eval:
            scores.append(result_eval.get("quality", 0) / 5.0)
        if process_eval:
            scores.append(process_eval.get("overall_score", 0))
        if tool_eval:
            scores.append(tool_eval.get("overall_score", 0))
        
        # 安全是底线
        if security_eval and not security_eval.get("safe", True):
            return 0.0
        
        return sum(scores) / len(scores) if scores else 0.0
    
    def run_batch(self, test_cases: list[dict], agent_fn) -> list[dict]:
        """批量评估"""
        results = []
        for i, case in enumerate(test_cases):
            print(f"[{i+1}/{len(test_cases)}] {case['query'][:30]}...")
            result = self.evaluate_single(case, agent_fn)
            results.append(result)
        return results
    
    def generate_report(self, results: list[dict]) -> str:
        """生成评估报告"""
        report = "# Agent 评估报告\n\n"
        
        # 总体统计
        avg_score = sum(r["overall_score"] for r in results) / len(results)
        avg_latency = sum(r["latency"] for r in results) / len(results)
        security_pass = sum(1 for r in results if r["security"].get("safe", True))
        
        report += "## 总体指标\n\n"
        report += f"- 综合评分：{avg_score:.3f}/1.0\n"
        report += f"- 平均延迟：{avg_latency:.2f}s\n"
        report += f"- 安全通过率：{security_pass/len(results):.1%}\n"
        
        # 低分案例
        report += "\n## 低分案例\n\n"
        low_scores = sorted(results, key=lambda x: x["overall_score"])[:5]
        for r in low_scores:
            report += f"### {r['query'][:50]}...\n"
            report += f"- 综合评分：{r['overall_score']:.3f}\n"
            report += f"- 任务完成：{r['result'].get('completed', 'N/A')}\n"
            report += f"- 安全：{r['security'].get('safe', 'N/A')}\n\n"
        
        return report
```

---

## 二、运行评估

```python
def main():
    client = OpenAI()
    suite = AgentEvalSuite(client)
    
    # 加载测试用例
    with open("test_cases.json", "r") as f:
        test_cases = json.load(f)
    
    # 运行评估
    results = suite.run_batch(test_cases, my_agent_function)
    
    # 生成报告
    report = suite.generate_report(results)
    print(report)
    
    # 保存报告
    with open(f"reports/agent_eval_{datetime.now().strftime('%Y%m%d')}.md", "w") as f:
        f.write(report)

if __name__ == "__main__":
    main()
```

---

## 三、评估结果解读

```
评估报告解读：

综合评分 > 0.8：Agent 表现优秀，可以上线
综合评分 0.6-0.8：Agent 表现一般，需要优化
综合评分 < 0.6：Agent 表现差，需要重大改进

常见问题：
- 任务完成率低 → 优化任务理解和规划能力
- 工具调用错误多 → 优化工具选择和参数生成
- 安全问题 → 加强安全防护
- 延迟高 → 优化调用链路和缓存策略
```

---

## 小结

```
本课核心要点：

1. 完整的 Agent 评估套件包含结果、过程、工具、安全四个维度
2. 安全是底线，不通过安全检查的 Agent 不能上线
3. 低分案例是优化的重点
4. 定期评估，持续改进

阶段总结：
  你已经掌握了 Agent 系统评估的完整方法论。
  下一阶段，我们将搭建可观测性平台。
```

---

## 作业

1. **完成实战**：搭建完整的 Agent 评估套件，评估你的 Agent 系统。

2. **优化循环**：根据评估结果优化 Agent，再重新评估。

3. **文档化**：记录评估过程和发现的问题。

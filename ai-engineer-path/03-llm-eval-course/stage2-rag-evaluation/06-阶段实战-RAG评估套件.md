# 06 阶段实战——为知识工作台搭建 RAG 评估套件

> 把前 5 课学到的评估方法整合成一个完整的评估套件。

## 学习目标

- 搭建完整的 RAG 评估套件
- 集成检索评估、生成评估、端到端评估
- 输出可操作的评估报告

---

## 一、评估套件架构

```
rag-eval-suite/
├── config.py              # 配置
├── dataset/
│   ├── golden_set.json    # 评估数据集
│   └── feedback.json      # 用户反馈
├── evaluators/
│   ├── retrieval.py       # 检索评估
│   ├── generation.py      # 生成评估
│   └── e2e.py             # 端到端评估
├── pipeline.py            # 评估 Pipeline
├── report.py              # 报告生成
└── run_eval.py            # 入口脚本
```

---

## 二、核心实现

```python
# pipeline.py

from evaluators.retrieval import RetrievalEvaluator
from evaluators.generation import GenerationEvaluator
from evaluators.e2e import E2EEvaluator

class RAGEvalSuite:
    """RAG 评估套件"""
    
    def __init__(self, config):
        self.client = OpenAI()
        self.retrieval_eval = RetrievalEvaluator(self.client)
        self.generation_eval = GenerationEvaluator(self.client)
        self.e2e_eval = E2EEvaluator(self.client)
        self.config = config
    
    def evaluate_single(self, question: str, rag_result: dict) -> dict:
        """评估单个 RAG 结果"""
        
        answer = rag_result["answer"]
        contexts = rag_result["contexts"]
        latency = rag_result.get("latency", 0)
        tokens = rag_result.get("token_count", 0)
        
        results = {
            "question": question,
            "retrieval": self.retrieval_eval.evaluate(question, contexts),
            "generation": self.generation_eval.evaluate(question, answer, contexts),
            "e2e": self.e2e_eval.evaluate(question, answer, contexts, latency, tokens),
        }
        
        # 综合评分
        results["overall"] = self._compute_overall(results)
        
        return results
    
    def _compute_overall(self, results: dict) -> float:
        """计算综合评分"""
        retrieval_score = results["retrieval"].get("score", 0)
        generation_score = results["generation"].get("overall_score", 0)
        e2e_score = results["e2e"].get("overall_score", 0)
        
        return (
            retrieval_score * 0.3 +
            generation_score * 0.4 +
            e2e_score * 0.3
        )
    
    def run_batch(self, dataset: list[dict], rag_pipeline) -> list[dict]:
        """批量评估"""
        results = []
        
        for i, item in enumerate(dataset):
            print(f"[{i+1}/{len(dataset)}] {item['question'][:30]}...")
            
            # 运行 RAG Pipeline
            rag_result = rag_pipeline(item["question"])
            
            # 评估
            eval_result = self.evaluate_single(item["question"], rag_result)
            eval_result["ground_truth"] = item.get("ground_truth")
            
            results.append(eval_result)
        
        return results
    
    def generate_report(self, results: list[dict]) -> str:
        """生成评估报告"""
        report = "# RAG 评估报告\n\n"
        
        # 总体统计
        avg_overall = sum(r["overall"] for r in results) / len(results)
        report += f"## 总体评分：{avg_overall:.3f}/1.0\n\n"
        
        # 分维度统计
        retrieval_scores = [r["retrieval"].get("score", 0) for r in results]
        generation_scores = [r["generation"].get("overall_score", 0) for r in results]
        
        report += "## 分维度评分\n\n"
        report += f"- 检索质量：{sum(retrieval_scores)/len(retrieval_scores):.3f}\n"
        report += f"- 生成质量：{sum(generation_scores)/len(generation_scores):.3f}\n"
        
        # 低分案例
        report += "\n## 需要优化的案例\n\n"
        low_scores = sorted(results, key=lambda x: x["overall"])[:5]
        for r in low_scores:
            report += f"### {r['question'][:50]}...\n"
            report += f"- 综合评分：{r['overall']:.3f}\n"
            report += f"- 检索评分：{r['retrieval'].get('score', 0):.3f}\n"
            report += f"- 生成评分：{r['generation'].get('overall_score', 0):.3f}\n\n"
        
        return report
```

---

## 三、运行评估

```python
# run_eval.py

from pipeline import RAGEvalSuite
from config import Config

def main():
    config = Config()
    suite = RAGEvalSuite(config)
    
    # 加载数据集
    with open("dataset/golden_set.json", "r") as f:
        dataset = json.load(f)
    
    # 运行评估
    results = suite.run_batch(dataset, my_rag_pipeline)
    
    # 生成报告
    report = suite.generate_report(results)
    print(report)
    
    # 保存报告
    with open(f"reports/eval_{datetime.now().strftime('%Y%m%d')}.md", "w") as f:
        f.write(report)

if __name__ == "__main__":
    main()
```

---

## 四、评估结果解读

```
评估报告示例：

# RAG 评估报告

## 总体评分：0.756/1.0

## 分维度评分
- 检索质量：0.823
- 生成质量：0.712

## 诊断
- 检索质量良好（>0.8），说明 embedding 和检索策略有效
- 生成质量偏低（<0.8），需要优化 Prompt

## 优化建议
1. 在 System Prompt 中强调"只使用参考资料中的信息"
2. 添加拒答策略："如果参考资料中没有相关信息，请说明"
3. 优化上下文格式，让模型更容易提取关键信息
```

---

## 小结

```
本课核心要点：

1. 完整的 RAG 评估套件包含检索、生成、端到端三个维度
2. 批量评估后生成可操作的报告
3. 低分案例是优化的重点
4. 评估是持续的过程，每次优化后都要重新评估

阶段总结：
  你已经掌握了 RAG 系统评估的完整方法论。
  下一阶段，我们将进入 Agent 系统的评估。
```

---

## 作业

1. **完成实战**：搭建完整的 RAG 评估套件，评估你的 RAG 系统。

2. **优化循环**：根据评估结果优化 RAG 系统，再重新评估，对比改进效果。

3. **文档化**：记录你的评估过程和发现的问题，形成评估报告。

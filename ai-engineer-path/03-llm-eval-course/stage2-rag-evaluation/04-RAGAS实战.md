# 04 RAGAS 实战——用 RAGAS 框架评估你的 RAG Pipeline

> RAGAS 是目前最成熟的 RAG 评估框架。用好它，能省掉 80% 的评估代码。

## 场景引入

你已经为 RAG 系统手写了忠实度、相关性、幻觉检测等评估函数，每次评估都要跑 20 多分钟的 LLM 调用，而且不同指标的 Prompt 设计不一致，评估结果经常有偏差。你需要一个成熟的框架来统一评估流程，同时能方便地接入 CI/CD，在每次模型或 Prompt 变更后自动跑回归测试。

## 学习目标

- 掌握 RAGAS 框架的核心概念和 API
- 学会用 RAGAS 评估 RAG 系统的各项指标
- 理解 RAGAS 的评估流程和输出格式

---

## 一、RAGAS 简介

### 1.1 安装与配置

```bash
pip install ragas
```

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset
```

### 1.2 数据格式

```python
# RAGAS 需要特定的数据格式
eval_data = {
    "question": [
        "Python 的列表和元组有什么区别？",
        "如何在 Python 中读取 CSV 文件？",
    ],
    "answer": [
        "列表是可变的，用方括号表示；元组是不可变的，用圆括号表示。",
        "使用 pandas.read_csv() 函数可以读取 CSV 文件。",
    ],
    "contexts": [
        ["Python 列表使用 [] 定义，是可变序列类型。", "Python 元组使用 () 定义，是不可变序列类型。"],
        ["pandas 提供了 read_csv() 函数，可以读取 CSV 文件。"],
    ],
    "ground_truth": [
        "列表可变，元组不可变。列表用 []，元组用 ()。",
        "使用 pandas 的 read_csv() 函数。",
    ]
}

dataset = Dataset.from_dict(eval_data)
```

---

## 二、运行评估

### 2.1 基础评估

```python
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from langchain_openai import ChatOpenAI

# 配置评估用的 LLM
evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))

# 运行评估
result = evaluate(
    dataset=dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    ],
    llm=evaluator_llm,
)

# 查看结果
print(result)
# {'faithfulness': 0.85, 'answer_relevancy': 0.92, ...}

# 转换为 DataFrame
df = result.to_pandas()
print(df)
```

### 2.2 自定义评估配置

```python
from ragas.metrics import (
    Faithfulness,
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
    ContextRelevancy,
    AnswerCorrectness,
    AnswerSimilarity,
)

# 选择需要的指标
metrics = [
    Faithfulness(),           # 忠实度
    AnswerRelevancy(),        # 回答相关性
    ContextPrecision(),       # 上下文精确率
    ContextRecall(),          # 上下文召回率
    AnswerCorrectness(),      # 回答正确性（需要 ground_truth）
]

result = evaluate(
    dataset=dataset,
    metrics=metrics,
    llm=evaluator_llm,
)
```

---

## 三、评估结果分析

### 3.1 详细结果

```python
def analyze_ragas_results(result_df):
    """分析 RAGAS 评估结果"""
    
    report = "# RAGAS 评估报告\n\n"
    
    # 总体指标
    report += "## 总体指标\n\n"
    for col in result_df.columns:
        if col not in ["question", "answer", "contexts", "ground_truth"]:
            avg = result_df[col].mean()
            report += f"- **{col}**: {avg:.3f}\n"
    
    # 低分案例
    report += "\n## 低分案例\n\n"
    low_faithfulness = result_df[result_df["faithfulness"] < 0.7]
    for _, row in low_faithfulness.iterrows():
        report += f"### 问题: {row['question'][:50]}...\n"
        report += f"- Faithfulness: {row['faithfulness']:.3f}\n"
        report += f"- 回答: {row['answer'][:100]}...\n\n"
    
    return report

report = analyze_ragas_results(result.to_pandas())
print(report)
```

---

## 四、与自定义评估器集成

### 4.1 封装 RAGAS

```python
class RAGASEvaluator:
    """RAGAS 评估器封装"""
    
    def __init__(self, eval_llm_model="gpt-4o-mini"):
        self.eval_llm = LangchainLLMWrapper(
            ChatOpenAI(model=eval_llm_model)
        )
    
    def evaluate(self, questions, answers, contexts, ground_truths=None):
        """运行 RAGAS 评估"""
        data = {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
        }
        if ground_truths:
            data["ground_truth"] = ground_truths
        
        dataset = Dataset.from_dict(data)
        
        metrics = [faithfulness, answer_relevancy, context_precision]
        if ground_truths:
            metrics.append(context_recall)
        
        result = evaluate(
            dataset=dataset,
            metrics=metrics,
            llm=self.eval_llm,
        )
        
        return result
    
    def evaluate_pipeline(self, rag_pipeline, questions, ground_truths=None):
        """评估整个 RAG Pipeline"""
        answers = []
        contexts = []
        
        for q in questions:
            result = rag_pipeline(q)
            answers.append(result["answer"])
            contexts.append(result["contexts"])
        
        return self.evaluate(questions, answers, contexts, ground_truths)
```

---

## 五、持续评估

### 5.1 CI/CD 集成

```python
def ragas_ci_check(dataset_path: str, pipeline_fn, thresholds: dict) -> bool:
    """CI/CD 中的 RAGAS 检查"""
    
    # 加载数据集
    with open(dataset_path, "r") as f:
        eval_data = json.load(f)
    
    # 运行 Pipeline
    answers = []
    contexts = []
    for item in eval_data:
        result = pipeline_fn(item["question"])
        answers.append(result["answer"])
        contexts.append(result["contexts"])
    
    # 运行评估
    evaluator = RAGASEvaluator()
    result = evaluator.evaluate(
        questions=[item["question"] for item in eval_data],
        answers=answers,
        contexts=contexts,
        ground_truths=[item.get("ground_truth") for item in eval_data]
    )
    
    # 检查阈值
    result_df = result.to_pandas()
    for metric, threshold in thresholds.items():
        avg_score = result_df[metric].mean()
        if avg_score < threshold:
            print(f"❌ {metric}: {avg_score:.3f} < {threshold}")
            return False
        print(f"✅ {metric}: {avg_score:.3f} >= {threshold}")
    
    return True

# 使用
thresholds = {
    "faithfulness": 0.8,
    "answer_relevancy": 0.7,
    "context_precision": 0.6,
}

passed = ragas_ci_check("eval_dataset.json", my_rag_pipeline, thresholds)
```

---

## 常见误区

1. **不做 ground_truth 就跑全部指标**：context_recall 和 answer_correctness 需要 ground_truth，没有就跳过，否则 RAGAS 会报错或返回无意义的结果。

2. **评估数据集和训练数据有重叠**：如果评估问题在 embedding 模型的训练集中出现过，检索指标会虚高，评估结果无法反映真实效果。

3. **直接用 RAGAS 默认参数不做调整**：RAGAS 默认的评估模型和 Prompt 不一定适合你的领域。医疗、法律等专业领域需要自定义评估 Prompt。

4. **只看平均分不看分布**：平均 faithfulness=0.8 看起来不错，但如果 20% 的问题 faithfulness 低于 0.5，说明系统存在严重短板。

## 工程建议

1. **评估数据集至少 50 条**：太小的样本集无法覆盖问题类型的多样性，建议按简单/中等/复杂各配 15-20 条。

2. **在 CI/CD 中设置分级阈值**：faithfulness < 0.7 阻断上线，< 0.8 发警告。不同指标设不同阈值，而不是一刀切。

3. **缓存评估结果**：RAGAS 每次调用 LLM 评估成本不低，对相同数据集的重复评估应该缓存，只对新增数据跑评估。

4. **把 RAGAS 结果和自定义指标交叉验证**：RAGAS 的 faithfulness 和你手写的 faithfulness 计算逻辑可能有差异，对比分析能发现评估盲区。

## 小结

```
本课核心要点：

1. RAGAS 提供了开箱即用的 RAG 评估指标
2. 数据格式：question, answer, contexts, ground_truth
3. 可以与 CI/CD 集成，设置质量门禁
4. 评估结果要分析低分案例，找到优化方向

---

**下一课**: [05 端到端评估——从用户提问到最终回答的全链路质量度量](./05-端到端评估.md)
```

---

## 练习

1. **实操题**：用 RAGAS 评估你的 RAG 系统，生成评估报告。

2. **对比题**：比较 RAGAS 评估结果与你自定义评估器的结果，分析差异原因。

3. **集成题**：将 RAGAS 评估集成到你的 CI/CD 流程中。

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

---

## 参考答案

### 练习一

**思路**：用 RAGAS 框架评估 RAG 系统，需要准备符合 RAGAS 格式的数据集（question, answer, contexts, ground_truth），配置评估 LLM，运行评估并分析结果。

**答案**：

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset
from langchain_openai import ChatOpenAI
from ragas.llms import LangchainLLMWrapper

# 步骤 1：准备评估数据（从你的 RAG 系统中收集）
def collect_rag_outputs(questions: list[str], rag_pipeline_fn) -> dict:
    """从 RAG 系统中收集评估所需的数据"""
    data = {"question": [], "answer": [], "contexts": [], "ground_truth": []}

    for q in questions:
        result = rag_pipeline_fn(q)
        data["question"].append(q)
        data["answer"].append(result["answer"])
        data["contexts"].append(result["contexts"])
        data["ground_truth"].append(result.get("reference", ""))

    return data

# 步骤 2：运行 RAGAS 评估
questions = [
    "公司的年假政策是什么？",
    "如何申请报销？",
    "公司的办公地址在哪里？",
    "产品A的保修期是多久？",
    "如何联系HR部门？",
]

# 假设已有 RAG pipeline 函数
eval_data = collect_rag_outputs(questions, my_rag_pipeline)
dataset = Dataset.from_dict(eval_data)

evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))

result = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    llm=evaluator_llm,
)

# 步骤 3：生成评估报告
df = result.to_pandas()

print("=" * 50)
print("RAGAS 评估报告")
print("=" * 50)

for col in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]:
    avg = df[col].mean()
    min_val = df[col].min()
    status = "✅" if avg >= 0.7 else "⚠️" if avg >= 0.5 else "❌"
    print(f"{status} {col}: 平均={avg:.3f}, 最低={min_val:.3f}")

print("\n低分案例（faithfulness < 0.7）：")
low_cases = df[df["faithfulness"] < 0.7]
for _, row in low_cases.iterrows():
    print(f"  问题：{row['question'][:50]}...")
    print(f"  Faithfulness: {row['faithfulness']:.3f}")
    print(f"  回答：{row['answer'][:100]}...")
    print()
```

**要点**：
- RAGAS 的 ground_truth 字段对 context_recall 和 answer_correctness 是必需的，没有就跳过这两个指标
- 评估数据要从真实的 RAG pipeline 中收集，不能手写——手写的 answer 和 contexts 不代表系统真实表现
- 常见错误：用自己编造的 contexts 和 answer 做评估——这样评估的是"你编的数据"而不是"你的系统"

### 练习二

**思路**：对比 RAGAS 和自定义评估器的结果，分析差异原因，找出各自的盲区。

**答案**：

```python
from ragas import evaluate
from ragas.metrics import faithfulness as ragas_faithfulness
from datasets import Dataset

# RAGAS 评估
ragas_result = evaluate(
    dataset=dataset,
    metrics=[ragas_faithfulness],
    llm=evaluator_llm,
)
ragas_scores = ragas_result.to_pandas()["faithfulness"].tolist()

# 自定义评估器（基于声明拆解法）
custom_scores = []
for item in eval_data:
    result = custom_faithfulness_eval(item["answer"], item["contexts"])
    custom_scores.append(result["score"])

# 对比分析
print("RAGAS vs 自定义评估器 对比：")
print("-" * 60)
print(f"{'问题':<30} {'RAGAS':>8} {'自定义':>8} {'差异':>8}")
print("-" * 60)

for i, q in enumerate(eval_data["question"]):
    ragas_s = ragas_scores[i]
    custom_s = custom_scores[i]
    diff = ragas_s - custom_s
    flag = "⚠️" if abs(diff) > 0.2 else ""
    print(f"{q[:28]:<30} {ragas_s:>8.3f} {custom_s:>8.3f} {diff:>+8.3f} {flag}")

ragas_avg = sum(ragas_scores) / len(ragas_scores)
custom_avg = sum(custom_scores) / len(custom_scores)
print("-" * 60)
print(f"{'平均':<30} {ragas_avg:>8.3f} {custom_avg:>8.3f} {ragas_avg - custom_avg:>+8.3f}")

print("\n差异分析：")
print("  1. RAGAS 使用内部 Prompt 模板，自定义评估器使用自己的 Prompt")
print("  2. RAGAS 对'声明'的拆解粒度可能与自定义不同")
print("  3. RAGAS 的评估模型（gpt-4o-mini）可能比自定义的（gpt-4o）更保守")
print("  建议：以人工标注为基准，选择与人工更一致的评估器")
```

**要点**：
- RAGAS 和自定义评估器的差异主要来自：Prompt 模板不同、声明拆解粒度不同、评估模型不同
- 差异 > 0.2 的 case 需要人工复查——看看哪个评估器的判断更准确
- 常见错误：认为 RAGAS 的结果就是"标准答案"——RAGAS 也有偏差，需要和人工评估交叉验证

### 练习三

**思路**：将 RAGAS 评估集成到 CI/CD 中，作为代码合并的质量门禁。需要封装评估逻辑为可复用的函数，设定分级阈值，并输出清晰的通过/失败报告。

**答案**：

```python
# ragas_ci_gate.py
import json
import sys
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision
from datasets import Dataset
from langchain_openai import ChatOpenAI
from ragas.llms import LangchainLLMWrapper

def run_ragas_ci_gate(
    eval_dataset_path: str,
    rag_pipeline_fn,
    thresholds: dict = None
) -> bool:
    """CI/CD 中的 RAGAS 质量门禁

    Args:
        eval_dataset_path: 评估数据集 JSON 文件路径
        rag_pipeline_fn: RAG pipeline 函数，接受 question 返回 {"answer": ..., "contexts": [...]}
        thresholds: 各指标阈值，默认为 {"faithfulness": 0.7, "answer_relevancy": 0.7, "context_precision": 0.6}
    """
    if thresholds is None:
        thresholds = {
            "faithfulness": 0.7,
            "answer_relevancy": 0.7,
            "context_precision": 0.6,
        }

    # 1. 加载评估数据集
    with open(eval_dataset_path, "r", encoding="utf-8") as f:
        eval_items = json.load(f)

    # 2. 运行 RAG pipeline 收集结果
    questions, answers, contexts, ground_truths = [], [], [], []
    for item in eval_items:
        result = rag_pipeline_fn(item["question"])
        questions.append(item["question"])
        answers.append(result["answer"])
        contexts.append(result["contexts"])
        ground_truths.append(item.get("ground_truth", ""))

    # 3. 运行 RAGAS 评估
    dataset = Dataset.from_dict({
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    })

    evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))
    metrics = [faithfulness, answer_relevancy, context_precision]

    result = evaluate(dataset=dataset, metrics=metrics, llm=evaluator_llm)
    df = result.to_pandas()

    # 4. 检查阈值
    all_passed = True
    print("=" * 50)
    print("RAGAS CI/CD 质量门禁报告")
    print("=" * 50)

    for metric, threshold in thresholds.items():
        avg_score = df[metric].mean()
        if avg_score >= threshold:
            print(f"✅ {metric}: {avg_score:.3f} >= {threshold}")
        else:
            print(f"❌ {metric}: {avg_score:.3f} < {threshold} (BLOCKED)")
            all_passed = False

    # 5. 输出低分案例详情
    if not all_passed:
        print("\n低分案例详情：")
        for metric, threshold in thresholds.items():
            low_cases = df[df[metric] < threshold]
            if not low_cases.empty:
                print(f"\n  [{metric} < {threshold}] 的案例：")
                for _, row in low_cases.iterrows():
                    print(f"    - {row['question'][:50]}... → {metric}={row[metric]:.3f}")

    print("\n" + "=" * 50)
    print(f"结果：{'✅ PASSED - 允许合并' if all_passed else '❌ BLOCKED - 不允许合并'}")
    print("=" * 50)

    return all_passed


# GitHub Actions 集成示例
if __name__ == "__main__":
    from my_project.rag_pipeline import my_rag_pipeline

    passed = run_ragas_ci_gate(
        eval_dataset_path="eval_dataset.json",
        rag_pipeline_fn=my_rag_pipeline,
        thresholds={
            "faithfulness": 0.7,
            "answer_relevancy": 0.7,
            "context_precision": 0.6,
        }
    )

    if not passed:
        sys.exit(1)  # 非零退出码阻止 CI 通过
```

```yaml
# .github/workflows/rag-eval.yml
name: RAG Quality Gate
on:
  pull_request:
    paths:
      - 'src/rag/**'
      - 'prompts/**'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: python scripts/ragas_ci_gate.py
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**要点**：
- CI 门禁阈值要分级：faithfulness < 0.5 阻断，< 0.7 警告，>= 0.7 通过
- 评估数据集要和代码一起版本管理，变更时记录原因
- 评估脚本的退出码要正确：失败时 exit(1) 才能阻止 CI 通过
- 常见错误：把评估数据集放在 .gitignore 里——数据集是代码质量的保障，必须进版本控制

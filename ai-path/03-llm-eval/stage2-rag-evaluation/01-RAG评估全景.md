# 01 RAG 评估全景

> RAG 系统出问题了——是检索没找对，还是生成答错了？不拆开看，你永远不知道该修哪里。

## 一个排查故事

你上线了一个企业知识库问答系统。用户反馈"回答不准确"。

第一反应：优化 Prompt。改了 System Prompt，加了"请基于参考资料回答"，重新部署。用户还是说不准。

第二反应：换模型。从 gpt-4o-mini 升级到 gpt-4o，成本翻了 10 倍。用户还是说不准。

最后才发现：**根本原因是向量检索召回的文档就不是用户需要的**。生成模型拿到的上下文从一开始就是错的，再好的 Prompt 和模型也救不回来。

这个问题本可以通过分离评估在 10 分钟内定位到。

## RAG 的两阶段

```
用户问题
    │
    ▼
┌──────────────┐
│  检索阶段     │  从知识库中找到相关文档
└──────┬───────┘
       │ 检索到的上下文
       ▼
┌──────────────┐
│  生成阶段     │  基于上下文生成回答
└──────┬───────┘
       │
       ▼
    最终回答
```

如果最终回答不好，问题可能在检索、可能在生成、也可能两者都有。分离评估让你知道"该修哪里"。

## 实验：分离评估的威力

```python
from openai import OpenAI
import json

client = OpenAI()

# 模拟一个 RAG 场景
question = "公司的年假政策是什么？"

# 场景 1：检索到了错误文档
bad_contexts = [
    "公司简介：XX公司成立于2018年，专注于AI技术。",
    "加班补偿：加班可选择调休或加班费。",
]

# 场景 2：检索到了正确文档
good_contexts = [
    "年假政策：员工入职满一年后，每年享有 10 天带薪年假。",
    "请假流程：员工需在OA系统中提交请假申请。",
]

def ask_with_context(question, contexts):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"基于以下参考资料回答：\n\n{chr(10).join(contexts)}"},
            {"role": "user", "content": question}
        ],
        temperature=0
    )
    return response.choices[0].message.content

# 两个场景都跑一遍
answer_bad = ask_with_context(question, bad_contexts)
answer_good = ask_with_context(question, good_contexts)

print("=== 检索差 + 生成 ===")
print(f"回答：{answer_bad}")
print(f"\n=== 检索好 + 生成 ===")
print(f"回答：{answer_good}")
```

场景 1 的回答大概率是"无法回答"或编造一个政策。场景 2 的回答应该基本正确。

**关键发现**：同样是"回答不准确"，根因完全不同。场景 1 要修检索，场景 2 检索没问题。如果你只看端到端结果，两个场景长得一样——都是"回答不好"。

## RAG 评估三层架构

```
第一层：检索评估
  ├── 检索到的文档是否相关？（Precision）
  ├── 相关文档是否都被检索到了？（Recall）
  ├── 检索结果的排序是否合理？（MRR）
  └── 核心问题：该修检索吗？

第二层：生成评估
  ├── 回答是否忠实于上下文？（Faithfulness）
  ├── 回答是否有幻觉？（Hallucination）
  ├── 回答是否切题？（Relevancy）
  └── 核心问题：该修生成吗？

第三层：端到端评估
  ├── 用户整体体验如何？
  ├── 延迟和成本是否可接受？
  └── 核心问题：用户满意吗？
```

## 检索评估指标

### Context Precision（精确率）

检索到的文档中，有多少是真正相关的？

```python
def context_precision(retrieved: list[str], relevant: list[str]) -> float:
    if not retrieved:
        return 0.0
    relevant_set = set(relevant)
    return sum(1 for doc in retrieved if doc in relevant_set) / len(retrieved)

# 检索了 5 个文档，其中 2 个相关
precision = context_precision(["doc1", "doc2", "doc3", "doc4", "doc5"],
                               ["doc1", "doc3", "doc6", "doc7"])
# = 2/5 = 0.4
```

### Context Recall（召回率）

所有相关文档中，有多少被检索到了？

```python
def context_recall(retrieved: list[str], relevant: list[str]) -> float:
    if not relevant:
        return 1.0
    relevant_set = set(relevant)
    retrieved_set = set(retrieved)
    return len(retrieved_set & relevant_set) / len(relevant_set)

# 4 个相关文档，只检索到了 2 个
recall = context_recall(["doc1", "doc2", "doc3", "doc4", "doc5"],
                         ["doc1", "doc3", "doc6", "doc7"])
# = 2/4 = 0.5
```

### MRR（平均倒数排名）

第一个相关文档出现在第几位？

```python
def mrr(queries_results: list[list[str]], queries_relevant: list[list[str]]) -> float:
    rr_sum = 0.0
    for results, relevant in zip(queries_results, queries_relevant):
        relevant_set = set(relevant)
        for rank, doc in enumerate(results, 1):
            if doc in relevant_set:
                rr_sum += 1.0 / rank
                break
    return rr_sum / len(queries_results)
```

MRR 比 Precision 更能反映检索质量：用户通常只看前几个结果，相关文档排在第 1 位和排在第 10 位，体验完全不同。

## 生成评估指标

### Faithfulness（忠实度）

回答是否忠实于提供的上下文？把回答拆成多个声明，检查每个声明是否有上下文依据。

```python
def faithfulness_eval(contexts: list[str], answer: str) -> dict:
    context_text = "\n".join(contexts)
    prompt = f"""请评估以下回答是否忠实于参考资料。

参考资料：
{context_text}

回答：
{answer}

请将回答拆解为声明，检查每个声明是否有依据。
JSON 输出：{{"total_claims": N, "supported_claims": M, "score": 0-1, "unsupported": ["..."]}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

### Hallucination Detection（幻觉检测）

检查回答中是否有编造的信息：事实声明能否在上下文中找到依据？有没有编造的数据、日期、数字？

## 诊断决策树

```
整体评分低
│
├── 检索评分低
│   ├── Precision 低 → 检索到了很多不相关文档 → 调整检索策略、增加过滤
│   └── Recall 低 → 很多相关文档没检索到 → 增加 top_k、优化 embedding
│
└── 检索评分高，生成评分低
    ├── Faithfulness 低 → 回答不忠实于上下文 → Prompt 强调"基于参考资料"
    ├── Relevancy 低 → 回答不切题 → Prompt 明确问题要求
    └── Hallucination 高 → 有幻觉 → Prompt 强调"不要编造"
```

## 实验：诊断你的 RAG 系统

用以下代码框架，对你的 RAG 系统做一次分离评估：

```python
def diagnose_rag(question, rag_fn, judge_client):
    """对 RAG 系统做一次分离评估诊断"""
    # 1. 运行 RAG
    result = rag_fn(question)
    answer = result["answer"]
    contexts = result["contexts"]

    # 2. 检索评估
    retrieval_score = context_relevancy(question, contexts, judge_client)

    # 3. 生成评估
    faithfulness = faithfulness_eval(contexts, answer)

    # 4. 诊断
    if retrieval_score < 0.6:
        print("问题定位：检索质量差 → 优化检索策略")
    elif faithfulness.get("score", 1) < 0.7:
        print("问题定位：生成质量差 → 优化 Prompt 或模型")
    else:
        print("检索和生成都没大问题，检查端到端体验")

    return {
        "retrieval_score": retrieval_score,
        "faithfulness": faithfulness,
    }
```

## 常见误判

**只看端到端分数**：整体回答质量差可能有多种原因，不拆开看就无法定位瓶颈。

**评估集太小**：用 5 个简单问题评估说"系统没问题"，上线后复杂查询全面崩溃。

**混淆指标用途**：用 Faithfulness 判断检索质量，用 Precision 判断生成质量——指标用错位置会导致错误结论。

## 练习

### 练习一：诊断题

你的 RAG 系统指标如下：Precision=0.8, Recall=0.3, Faithfulness=0.9。问题出在哪？写出你的诊断和优化方案。

### 练习二：实现题

实现一个 `context_relevancy` 函数，用 LLM 评估每个检索片段与问题的相关性，返回整体相关性分数和每个片段的详细评分。

### 练习三：实验题

对同一个问题，分别用 3 个、5 个、10 个检索结果运行 RAG，观察 Precision、Recall 和最终回答质量的变化。记录你的发现：top_k 设多少最合适？

## 下一步

这一课建立了 RAG 评估的整体框架。下一课会深入检索评估指标的计算细节。

---

**下一课**: [02 检索评估指标](./02-检索评估指标.md)

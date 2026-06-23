# RAG 评估体系设计：用实验回答"系统好不好"

> Stage 5 · Lesson 1 | 前置：Stage 4 完成 | 时长：50 分钟

你的 RAG 系统上线两个月了。产品团队问"表现怎么样"，你发现除了"成功/失败"之外没有任何质量数据。上周用户投诉"回答不准确"，你不知道是检索问题还是生成问题。

这节课通过实验建立评估意识：用不同指标衡量同一个系统，理解每个指标在衡量什么。

## 你要建立的能力

- 理解 RAG 评估的两个层面：检索质量和生成质量
- 用实验感受不同指标的敏感度差异
- 知道评估集质量如何影响结论

## 1. 评估的两个层面

```text
用户提问 → 检索 → 文档 → LLM → 答案
             │                │
             ▼                ▼
         检索质量           生成质量
         (找到对的文档了吗)  (答案正确、忠实吗)

检索好 + 生成好 = 理想
检索好 + 生成差 = Prompt 或模型问题
检索差 + 生成好 = 检索策略需优化
检索差 + 生成差 = 都需要改
```

## 2. 实验：三种指标的差异

```python
# 指标一：Recall@K（检索质量）
def recall_at_k(retrieved_ids, relevant_ids, k):
    return len(set(retrieved_ids[:k]) & set(relevant_ids)) / len(relevant_ids)

# 指标二：Faithfulness（忠实度）— 答案是否忠实于检索结果
def evaluate_faithfulness(answer, contexts):
    sentences = [s for s in answer.split("。") if s.strip()]
    supported = 0
    for sentence in sentences:
        judge = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content":
                f"判断陈述是否有文档支持。只回答"支持"或"不支持"。\n\n"
                f"陈述：{sentence}\n文档：{' '.join(contexts[:3])}"}],
            temperature=0.0, max_tokens=10
        )
        if "支持" in judge.choices[0].message.content:
            supported += 1
    return supported / len(sentences) if sentences else 0

# 指标三：Correctness（正确性）— 答案是否和标准答案一致
def evaluate_correctness(answer, ground_truth):
    judge = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content":
            f"评分1-5。5=完全正确，1=完全错误。只输出数字。\n\n"
            f"标准答案：{ground_truth}\n系统回答：{answer}"}],
        temperature=0.0, max_tokens=5
    )
    try:
        return int(judge.choices[0].message.content.strip()) / 5
    except ValueError:
        return 0
```

## 3. 跑实验：看指标之间的分歧

```python
results = []
for item in eval_data:
    rag_result = rag_query(item["question"])
    retrieved_ids = [r["source"] for r in rag_result["contexts"]]
    results.append({
        "question": item["question"],
        "recall@5": recall_at_k(retrieved_ids, item["relevant_doc_ids"], 5),
        "faithfulness": evaluate_faithfulness(rag_result["answer"], [c["text"] for c in rag_result["contexts"]]),
        "correctness": evaluate_correctness(rag_result["answer"], item["ground_truth_answer"])
    })

# 汇总
import statistics
print(f"Recall@5:     {statistics.mean([r['recall@5'] for r in results]):.2%}")
print(f"Faithfulness: {statistics.mean([r['faithfulness'] for r in results]):.2%}")
print(f"Correctness:  {statistics.mean([r['correctness'] for r in results]):.2%}")

# 找分歧案例
for r in results:
    if r["recall@5"] > 0.8 and r["faithfulness"] < 0.5:
        print(f"找到但不忠实: {r['question']}")
    if r["recall@5"] < 0.5 and r["correctness"] > 0.6:
        print(f"没找到但正确(LLM用自身知识): {r['question']}")
```

这些分歧比平均分更有价值——它们告诉你该优化哪个环节。

典型的分歧模式：

```text
案例 1: "Python 3.12 发布日期"
  Recall@5 = 1.0 (找到了文档)
  Faithfulness = 0.3 (答案细节没引用文档)
  Correctness = 0.8 (答案本身正确)
  → LLM 用了自身知识，没用检索结果

案例 2: "如何配置 Nginx 反向代理"
  Recall@5 = 0.0 (没找到文档)
  Faithfulness = N/A
  Correctness = 0.6 (大致正确但不完整)
  → 知识库缺内容，LLM 在编造
```

## 4. 评估集质量的影响

同一个系统，在精心标注的 20 题和自动生成的 100 题上，结论可能完全不同。自动生成的评估集倾向简单问题，精心标注的覆盖边界情况。

评估集的分布决定评估结论的适用范围。

## 5. 指标选型建议

```text
场景                    推荐指标                    原因
──────────────────────────────────────────────────────────
迭代优化(A/B)           Recall@K + Faithfulness     快速、可自动化
上线前验收              Correctness + Faithfulness  确认答案质量
用户投诉排查            逐条分析 + Faithfulness     定位具体问题
向领导汇报              Correctness                 最直观
```

不要只看一个指标。Recall@5 高不代表答案好，Correctness 高不代表没编造。

## 6. 评估的局限性

评估本身也有局限：

- **LLM-as-Judge 不完美**：用 LLM 判断答案正确性，LLM 自己也可能犯错。用更强的模型做 judge（比如用 gpt-4o 判断 gpt-4o-mini 的答案）
- **评估集不代表真实分布**：20 个精心挑选的问题不能代表用户的真实查询分布。上线后要用真实查询做持续评估
- **指标优化 ≠ 用户满意**：Faithfulness 从 0.7 提升到 0.8，用户可能感知不到。指标是工具，不是目标

## 练习

### 练习一：建立评估集

从业务中收集 15 个问答对：5 个简单事实、5 个需综合多文档、5 个边界情况（知识库无答案、模糊问题）。分别评估，对比结果。

### 练习二：找出系统盲区

跑 50 个问题，找出所有 Correctness < 0.4 的案例，分析共同特征和根因。

---

## 参考答案

### 练习一

边界情况最能暴露问题：
- 知识库无答案时，系统是否说"不确定"还是编造
- 答案在多个文档中，系统是否综合引用
- 歧义问题，系统是否指出歧义

### 练习二

盲区模板：问题 → 检索结果里有没有答案 → 有则生成问题，没有则检索问题 → 改进方向
